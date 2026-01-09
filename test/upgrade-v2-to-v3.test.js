const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("TokenVault Upgrade V2 to V3", function () {
    let vault, token, owner, addr1;
    const depositFee = 500;
    const yieldRate = 1000;
    const withdrawalDelay = 3600; // 1 hour

    beforeEach(async function () {
        [owner, addr1] = await ethers.getSigners();

        // Mock Token
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        token = await MockERC20.deploy();
        await token.waitForDeployment();

        // Distribute tokens
        await token.transfer(addr1.address, ethers.parseEther("1000"));

        // V1
        const TokenVaultV1 = await ethers.getContractFactory("TokenVaultV1");
        vault = await upgrades.deployProxy(TokenVaultV1, [await token.getAddress(), owner.address, depositFee], {
            initializer: "initialize",
            kind: "uups"
        });
        await vault.waitForDeployment();

        // V2 Upgrade
        const TokenVaultV2 = await ethers.getContractFactory("TokenVaultV2");
        vault = await upgrades.upgradeProxy(await vault.getAddress(), TokenVaultV2, {
            call: { fn: 'initializeV2', args: [yieldRate] }
        });

        // Fund Vault and User Approves
        await token.transfer(await vault.getAddress(), ethers.parseEther("10000"));
        await token.connect(addr1).approve(await vault.getAddress(), ethers.parseEther("1000"));

        // V2 Deposit
        await vault.connect(addr1).deposit(ethers.parseEther("100"));
    });

    it("should preserve all V2 state after upgrade", async function () {
        const TokenVaultV3 = await ethers.getContractFactory("TokenVaultV3");
        const vaultV3 = await upgrades.upgradeProxy(await vault.getAddress(), TokenVaultV3, {
            call: { fn: 'initializeV3', args: [withdrawalDelay] }
        });

        expect(await vaultV3.getImplementationVersion()).to.equal("V3");
        expect(await vaultV3.balanceOf(addr1.address)).to.equal(ethers.parseEther("95"));
        expect(await vaultV3.getYieldRate()).to.equal(yieldRate);
    });

    it("should allow setting withdrawal delay", async function () {
        const TokenVaultV3 = await ethers.getContractFactory("TokenVaultV3");
        const vaultV3 = await upgrades.upgradeProxy(await vault.getAddress(), TokenVaultV3, {
            call: { fn: 'initializeV3', args: [withdrawalDelay] }
        });

        expect(await vaultV3.getWithdrawalDelay()).to.equal(withdrawalDelay);
        await vaultV3.setWithdrawalDelay(7200);
        expect(await vaultV3.getWithdrawalDelay()).to.equal(7200);
    });

    it("should enforce withdrawal delay", async function () {
        const TokenVaultV3 = await ethers.getContractFactory("TokenVaultV3");
        const vaultV3 = await upgrades.upgradeProxy(await vault.getAddress(), TokenVaultV3, {
            call: { fn: 'initializeV3', args: [withdrawalDelay] }
        });

        // Direct withdraw should fail
        await expect(vaultV3.connect(addr1).withdraw(10)).to.be.revertedWith("Use requestWithdrawal in V3");

        // Request
        const amount = ethers.parseEther("10");
        await vaultV3.connect(addr1).requestWithdrawal(amount);

        // Verify Request
        const req = await vaultV3.getWithdrawalRequest(addr1.address);
        expect(req.amount).to.equal(amount);

        // Execute too early -> Revert
        await expect(vaultV3.connect(addr1).executeWithdrawal()).to.be.revertedWith("Withdrawal delay not met");

        // Wait
        await ethers.provider.send("evm_increaseTime", [3600 + 1]);
        await ethers.provider.send("evm_mine");

        // Execute success
        // Check balance change (token transfer)
        const balBefore = await token.balanceOf(addr1.address);
        await vaultV3.connect(addr1).executeWithdrawal();
        const balAfter = await token.balanceOf(addr1.address);

        expect(balAfter - balBefore).to.be.gte(amount);
    });

    it("should allow emergency withdrawals", async function () {
        const TokenVaultV3 = await ethers.getContractFactory("TokenVaultV3");
        const vaultV3 = await upgrades.upgradeProxy(await vault.getAddress(), TokenVaultV3, {
            call: { fn: 'initializeV3', args: [withdrawalDelay] }
        });

        const locked = await vaultV3.balanceOf(addr1.address); // 95

        // Emergency withdraw full balance
        await vaultV3.connect(addr1).emergencyWithdraw();

        expect(await vaultV3.balanceOf(addr1.address)).to.equal(0);
        expect(await token.balanceOf(addr1.address)).to.be.gte(locked); // At least principal, plus yield potentially?
        // Note: emergencyWithdraw in V3 calls _manageYield?
        // My impl: Yes. So yield is paid.
    });
});
