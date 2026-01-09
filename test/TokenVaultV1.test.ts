import { expect } from "chai";
import hardhat from "hardhat";
const { ethers, upgrades } = hardhat;
import { Contract } from "ethers";

describe("TokenVaultV1", function () {
    let vault: Contract;
    let token: Contract;
    let owner: any, addr1: any, addr2: any;
    const depositFee = 500; // 5%

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();

        const MockERC20 = await ethers.getContractFactory("MockERC20");
        token = await MockERC20.deploy("Mock Token", "MTK");
        await token.waitForDeployment();

        const TokenVault = await ethers.getContractFactory("TokenVaultV1");
        // @ts-ignore
        vault = await upgrades.deployProxy(TokenVault, [await token.getAddress(), owner.address, depositFee], {
            initializer: "initialize",
            kind: "uups"
        });
        await vault.waitForDeployment();

        // Mint tokens to users
        await token.mint(addr1.address, ethers.parseEther("1000"));
        await token.mint(addr2.address, ethers.parseEther("1000"));

        // Approve vault
        await token.connect(addr1).approve(await vault.getAddress(), ethers.parseEther("1000"));
        await token.connect(addr2).approve(await vault.getAddress(), ethers.parseEther("1000"));
    });

    it("should initialize with correct parameters", async function () {
        expect(await vault.token()).to.equal(await token.getAddress());
        expect(await vault.getDepositFee()).to.equal(depositFee);
        expect(await vault.hasRole(await vault.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
    });

    it("should allow deposits and update balances", async function () {
        const amount = ethers.parseEther("100");
        await vault.connect(addr1).deposit(amount);

        // Fee is 5%, so 95 should be credited
        // 95 tokens = 95 * 10^18
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
        await vault.connect(addr1).withdraw(withdrawAmount);

        const expectedBalance = ethers.parseEther("45"); // 95 - 50
        expect(await vault.balanceOf(addr1.address)).to.equal(expectedBalance);
    });

    it("should prevent withdrawal of more than balance", async function () {
        const amount = ethers.parseEther("100");
        await vault.connect(addr1).deposit(amount);

        await expect(vault.connect(addr1).withdraw(ethers.parseEther("100"))).to.be.revertedWith("Insufficient balance");
    });

    it("should prevent reinitialization", async function () {
        await expect(vault.initialize(await token.getAddress(), owner.address, 100)).to.be.revertedWithCustomError(vault, "InvalidInitialization");
    });

    it("should return correct version", async function () {
        expect(await vault.getImplementationVersion()).to.equal("V1");
    });
});
