const { ethers, upgrades } = require("hardhat");

async function main() {
    const PROXY_ADDRESS = "YOUR_PROXY_ADDRESS_HERE"; // Replace with deployed proxy address

    if (PROXY_ADDRESS === "YOUR_PROXY_ADDRESS_HERE") {
        console.error("Please set PROXY_ADDRESS in scripts/upgrade-to-v2.js");
        return;
    }

    console.log("Upgrading TokenVault to V2...");
    const TokenVaultV2 = await ethers.getContractFactory("TokenVaultV2");

    // Upgrade and initialize V2 (Yield Rate = 10%)
    const vaultV2 = await upgrades.upgradeProxy(PROXY_ADDRESS, TokenVaultV2, {
        call: { fn: 'initializeV2', args: [1000] }
    });
    await vaultV2.waitForDeployment();

    console.log("TokenVault upgraded to V2");
    console.log("Yield Rate:", await vaultV2.getYieldRate());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
