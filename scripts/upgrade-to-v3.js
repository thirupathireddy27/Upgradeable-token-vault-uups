const { ethers, upgrades } = require("hardhat");

async function main() {
    const PROXY_ADDRESS = "YOUR_PROXY_ADDRESS_HERE"; // Replace with deployed proxy address

    if (PROXY_ADDRESS === "YOUR_PROXY_ADDRESS_HERE") {
        console.error("Please set PROXY_ADDRESS in scripts/upgrade-to-v3.js");
        return;
    }

    console.log("Upgrading TokenVault to V3...");
    const TokenVaultV3 = await ethers.getContractFactory("TokenVaultV3");

    // Upgrade and initialize V3 (Delay = 1 hour)
    const vaultV3 = await upgrades.upgradeProxy(PROXY_ADDRESS, TokenVaultV3, {
        call: { fn: 'initializeV3', args: [3600] }
    });
    await vaultV3.waitForDeployment();

    console.log("TokenVault upgraded to V3");
    console.log("Withdrawal Delay:", await vaultV3.getWithdrawalDelay());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
