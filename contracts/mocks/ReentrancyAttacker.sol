// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../TokenVaultV2.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ReentrancyAttacker {
    TokenVaultV2 public vault;
    IERC20 public token;

    constructor(address _vault, address _token) {
        vault = TokenVaultV2(_vault);
        token = IERC20(_token);
    }

    function attack() external payable {
        // Deposit some amount first
        vault.deposit(1 ether); 
        // Then withdraw, which triggers transfer, which we hope callbacks?
        // MockERC20 standard doesn't callback.
        // We need a specific hook.
        // If Vault calls 'safeTransfer' or similar on us?
        // Vault uses `token.transfer`. Standard ERC20 transfer doesn't call back to receiver (unless ERC777).
        // MockERC20 is standard ERC20.
        // So we cannot re-enter via Transfer in this setup using Standard ERC20.
        // However, `withdraw` calls `_manageYield`.
        // If we use a malicious TOKEN? 
        // Start Vault with Malicious Token?
        // If Vault calls `token.transferFrom` or `token.transfer`, malicious token calls back `withdraw`.
    }
    
    // Fallback?
    receive() external payable {
        // Only if ETH sent.
    }
}
