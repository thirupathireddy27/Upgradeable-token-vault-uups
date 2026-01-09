const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("TokenVault Upgrade V1 to V2", function () {
    let vault, token, owner, addr1, addr2;
    const depositFee = 500; // 5%
    const yieldRate = 1000; // 10% (1000 basis points)

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();

        // Deploy Mock Token
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        token = await MockERC20.deploy();
        await token.waitForDeployment();

        // Deploy V1
        const TokenVaultV1 = await ethers.getContractFactory("TokenVaultV1");
        vault = await upgrades.deployProxy(TokenVaultV1, [await token.getAddress(), owner.address, depositFee], {
            initializer: "initialize",
            kind: "uups"
        });
        await vault.waitForDeployment();

        // Setup for interaction
        // Fund users
        await token.transfer(addr1.address, ethers.parseEther("1000"));
        await token.transfer(addr2.address, ethers.parseEther("1000"));

        // Approve vault
        await token.connect(addr1).approve(await vault.getAddress(), ethers.parseEther("1000"));
        await token.connect(addr2).approve(await vault.getAddress(), ethers.parseEther("1000"));

        // V1 Activity: Deposit
        await vault.connect(addr1).deposit(ethers.parseEther("100")); // 95 credited

        // Fund the Vault with rewards (for yield)
        await token.transfer(await vault.getAddress(), ethers.parseEther("10000"));
    });

    it("should preserve user balances after upgrade", async function () {
        const TokenVaultV2 = await ethers.getContractFactory("TokenVaultV2");
        const vaultV2 = await upgrades.upgradeProxy(await vault.getAddress(), TokenVaultV2, {
            call: { fn: 'initializeV2', args: [yieldRate] }
        });
        await vaultV2.waitForDeployment();

        // Check compatibility
        expect(await vaultV2.getImplementationVersion()).to.equal("V2");

        // Check Balance (95)
        expect(await vaultV2.balanceOf(addr1.address)).to.equal(ethers.parseEther("95"));
    });

    it("should maintain admin access control after upgrade", async function () {
        const TokenVaultV2 = await ethers.getContractFactory("TokenVaultV2");
        const vaultV2 = await upgrades.upgradeProxy(await vault.getAddress(), TokenVaultV2, {
            call: { fn: 'initializeV2', args: [yieldRate] }
        });

        const DEFAULT_ADMIN_ROLE = await vaultV2.DEFAULT_ADMIN_ROLE();
        expect(await vaultV2.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("should allow setting yield rate in V2", async function () {
        const TokenVaultV2 = await ethers.getContractFactory("TokenVaultV2");
        const vaultV2 = await upgrades.upgradeProxy(await vault.getAddress(), TokenVaultV2, {
            call: { fn: 'initializeV2', args: [yieldRate] }
        });

        expect(await vaultV2.getYieldRate()).to.equal(yieldRate);

        await vaultV2.setYieldRate(2000);
        expect(await vaultV2.getYieldRate()).to.equal(2000);
    });

    it("should calculate and claim yield correctly", async function () {
        const TokenVaultV2 = await ethers.getContractFactory("TokenVaultV2");
        const vaultV2 = await upgrades.upgradeProxy(await vault.getAddress(), TokenVaultV2, {
            call: { fn: 'initializeV2', args: [yieldRate] }
        });

        // Simulate time passage
        // Increase time by 365 days
        await ethers.provider.send("evm_increaseTime", [365 * 24 * 60 * 60]);
        await ethers.provider.send("evm_mine");

        // Check yield view
        // 95 tokens * 10% * 1 year = 9.5 tokens
        const expectedYield = ethers.parseEther("9.5");

        // User interacts (e.g. claim) which triggers yield calculation + state update
        // Note: Our implementation assumes lastClaimTime was init to NOW on upgrade or first interaction?
        // In our code: `if (lastClaimTime[user] == 0) ... set to block.timestamp`.
        // So correct logic is: user must interact ONCE to start the clock?
        // If so, the FIRST interaction claims NOTHING (0 yield) and starts clock.
        // Let's verify behavior.

        // Interaction 1: Claim (Start Clock)
        await vaultV2.connect(addr1).claimYield(); // yield 0, sets timestamp

        // Now wait 365 days
        await ethers.provider.send("evm_increaseTime", [365 * 24 * 60 * 60]);
        await ethers.provider.send("evm_mine");

        const yieldView = await vaultV2.getUserYield(addr1.address);
        // Expect ~9.5
        expect(yieldView).to.be.closeTo(expectedYield, ethers.parseEther("0.1"));

        // Claim
        const balanceBefore = await token.balanceOf(addr1.address);
        await vaultV2.connect(addr1).claimYield();
        const balanceAfter = await token.balanceOf(addr1.address);

        expect(balanceAfter - balanceBefore).to.be.closeTo(expectedYield, ethers.parseEther("0.1"));
    });

    it("should preserve total deposits after upgrade", async function () {
        const TokenVaultV2 = await ethers.getContractFactory("TokenVaultV2");
        const vaultV2 = await upgrades.upgradeProxy(await vault.getAddress(), TokenVaultV2, {
            call: { fn: 'initializeV2', args: [yieldRate] }
        });

        // V1 deposit was 100 * 0.95 = 95.
        expect(await vaultV2.totalDeposits()).to.equal(ethers.parseEther("95"));
    });

    it("should prevent non-admin from setting yield rate", async function () {
        const TokenVaultV2 = await ethers.getContractFactory("TokenVaultV2");
        const vaultV2 = await upgrades.upgradeProxy(await vault.getAddress(), TokenVaultV2, {
            call: { fn: 'initializeV2', args: [yieldRate] }
        });

        await expect(vaultV2.connect(addr1).setYieldRate(2000))
            .to.be.revertedWithCustomError(vaultV2, "AccessControlUnauthorizedAccount");
    });

    it("should allow pausing deposits in V2", async function () {
        const TokenVaultV2 = await ethers.getContractFactory("TokenVaultV2");
        const vaultV2 = await upgrades.upgradeProxy(await vault.getAddress(), TokenVaultV2, {
            call: { fn: 'initializeV2', args: [yieldRate] }
        });

        // Check role (Owner was granted PAUSER in initV2? No, msg.sender which is owner. Good.)
        await vaultV2.pauseDeposits();
        expect(await vaultV2.isDepositsPaused()).to.be.true;

        await expect(vaultV2.connect(addr1).deposit(100)).to.be.reverted;

        await vaultV2.unpauseDeposits();
        expect(await vaultV2.isDepositsPaused()).to.be.false;
        await vaultV2.connect(addr1).deposit(ethers.parseEther("100"));
    });
});
