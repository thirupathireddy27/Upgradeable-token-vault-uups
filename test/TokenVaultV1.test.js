const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("TokenVaultV1", function () {
    let TokenVault, vault, MockERC20, token, owner, addr1, addr2;
    const depositFee = 500; // 5%

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();

        // Standard MockERC20 (using standard decimals 18)
        MockERC20 = await ethers.getContractFactory("MockERC20");
        token = await MockERC20.deploy();
        await token.waitForDeployment();

        TokenVault = await ethers.getContractFactory("TokenVaultV1");
        // Initialize with default admin role
        vault = await upgrades.deployProxy(TokenVault, [await token.getAddress(), owner.address, depositFee], {
            initializer: "initialize",
            kind: "uups"
        });
        await vault.waitForDeployment();

        // Mint tokens to users (MockERC20 from user snippet mints to deployer, so transfer to users)
        // User snippet MockERC20 mints 1M to msg.sender.
        await token.transfer(addr1.address, ethers.parseEther("1000"));
        await token.transfer(addr2.address, ethers.parseEther("1000"));

        // Approve vault
        await token.connect(addr1).approve(await vault.getAddress(), ethers.parseEther("1000"));
        await token.connect(addr2).approve(await vault.getAddress(), ethers.parseEther("1000"));
    });

    it("should initialize with correct parameters", async function () {
        expect(await vault.token()).to.equal(await token.getAddress());
        expect(await vault.getDepositFee()).to.equal(depositFee);
        const DEFAULT_ADMIN_ROLE = await vault.DEFAULT_ADMIN_ROLE();
        expect(await vault.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("should allow deposits and update balances", async function () {
        const amount = ethers.parseEther("100");
        await vault.connect(addr1).deposit(amount);

        // Fee is 5%, so 95 should be credited
        const expectedBalance = ethers.parseEther("95");
        expect(await vault.balanceOf(addr1.address)).to.equal(expectedBalance);
    });

    it("should deduct deposit fee correctly", async function () {
        const amount = ethers.parseEther("1000");
        await vault.connect(addr1).deposit(amount);

        // 5% of 1000 is 50. Balance should be 950.
        const expectedBalance = ethers.parseEther("950");
        expect(await vault.balanceOf(addr1.address)).to.equal(expectedBalance);
        expect(await vault.totalDeposits()).to.equal(expectedBalance);
    });

    it("should allow withdrawals and update balances", async function () {
        const amount = ethers.parseEther("100");
        await vault.connect(addr1).deposit(amount);

        const withdrawAmount = ethers.parseEther("50");
        // User has 95. Withdraw 50. Remaining 45.
        await vault.connect(addr1).withdraw(withdrawAmount);

        const expectedBalance = ethers.parseEther("45");
        expect(await vault.balanceOf(addr1.address)).to.equal(expectedBalance);
    });

    it("should prevent withdrawal of more than balance", async function () {
        const amount = ethers.parseEther("100");
        await vault.connect(addr1).deposit(amount);
        // Balance 95. Try to withdraw 100.
        await expect(vault.connect(addr1).withdraw(ethers.parseEther("100"))).to.be.revertedWith("Insufficient balance");
    });

    it("should prevent reinitialization", async function () {
        await expect(vault.initialize(await token.getAddress(), owner.address, 100)).to.be.revertedWithCustomError(vault, "InvalidInitialization");
    });

    it("should return correct version", async function () {
        expect(await vault.getImplementationVersion()).to.equal("V1");
    });
});
