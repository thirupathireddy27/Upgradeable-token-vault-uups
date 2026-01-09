const { ethers, upgrades } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // Address of the token to be used. Replace with actual token address on mainnet/testnet.
    // For script verification, we deploy a mock.
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const token = await MockERC20.deploy();
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();
    console.log("MockToken deployed to:", tokenAddress);

    const TokenVaultV1 = await ethers.getContractFactory("TokenVaultV1");
    const vault = await upgrades.deployProxy(TokenVaultV1, [tokenAddress, deployer.address, 500], {
        initializer: "initialize",
        kind: "uups"
    });
    await vault.waitForDeployment();

    console.log("TokenVaultV1 (Proxy) deployed to:", await vault.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
