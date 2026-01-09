import hardhat from "hardhat";
const { ethers, upgrades } = hardhat;

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // Deploy Mock Token first
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const token = await MockERC20.deploy("Mock Token", "MTK");
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();
    console.log("MockERC20 deployed to:", tokenAddress);

    // Deploy TokenVaultV1
    const TokenVaultV1 = await ethers.getContractFactory("TokenVaultV1");
    const depositFee = 500; // 5%

    const vault = await upgrades.deployProxy(TokenVaultV1, [tokenAddress, deployer.address, depositFee], {
        initializer: "initialize",
        kind: "uups",
    });

    await vault.waitForDeployment();
    console.log("TokenVaultV1 deployed to:", await vault.getAddress());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
