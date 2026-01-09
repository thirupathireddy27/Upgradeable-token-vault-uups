// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TokenVaultV2.sol";

contract TokenVaultV3 is TokenVaultV2 {
    struct WithdrawalRequest {
        uint256 amount;
        uint256 requestTime;
    }

    uint256 public withdrawalDelay;
    mapping(address => WithdrawalRequest) public withdrawalRequests;

    event WithdrawalRequested(address indexed user, uint256 amount, uint256 requestTime);
    event WithdrawalExecuted(address indexed user, uint256 amount);
    event WithdrawalDelayUpdated(uint256 newDelay);

    function initializeV3(uint256 _withdrawalDelay) public reinitializer(3) {
        withdrawalDelay = _withdrawalDelay;
    }

    function setWithdrawalDelay(uint256 _delaySeconds) external onlyRole(DEFAULT_ADMIN_ROLE) {
        withdrawalDelay = _delaySeconds;
        emit WithdrawalDelayUpdated(_delaySeconds);
    }

    function getWithdrawalDelay() external view returns (uint256) {
        return withdrawalDelay;
    }

    function requestWithdrawal(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(balances[msg.sender] >= amount, "Insufficient balance");
        
        // "New withdrawal request should cancel previous pending request"
        withdrawalRequests[msg.sender] = WithdrawalRequest({
            amount: amount,
            requestTime: block.timestamp
        });
        
        emit WithdrawalRequested(msg.sender, amount, block.timestamp);
    }

    function executeWithdrawal() external nonReentrant returns (uint256) {
        WithdrawalRequest memory req = withdrawalRequests[msg.sender];
        require(req.amount > 0, "No pending withdrawal");
        require(block.timestamp >= req.requestTime + withdrawalDelay, "Withdrawal delay not met");
        require(balances[msg.sender] >= req.amount, "Insufficient balance"); // Re-check balance

        // Process withdrawal
        // V2 `withdraw` handles yield. V3 checks yield? 
        // We should trigger yield update before effect.
        _manageYield(msg.sender); 

        // Update state
        balances[msg.sender] -= req.amount;
        totalDeposits -= req.amount;
        
        // Clear request
        delete withdrawalRequests[msg.sender];

        // Transfer
        token.transfer(msg.sender, req.amount);
        
        emit WithdrawalExecuted(msg.sender, req.amount);
        return req.amount;
    }

    function getWithdrawalRequest(address user) external view returns (uint256 amount, uint256 requestTime) {
        WithdrawalRequest memory req = withdrawalRequests[user];
        return (req.amount, req.requestTime);
    }

    function emergencyWithdraw() external nonReentrant returns (uint256) {
        // "Emergency withdrawal bypasses delay"
        // Usually allows withdrawing FULL balance? Or requested amount?
        // "returns (uint256)". Usually implies withdrawing *something*.
        // Let's assume withdrawing FULL balance for emergency.
        // Or should it use `withdrawalRequests`?
        // "bypasses delay". Usually implies standard withdrawal flow but ignoring time.
        // But `withdraw` in V1/V2 is instant. V3 introduces delay?
        // Wait, V3 `withdraw` function?
        // Does V3 *disable* V1/V2 `withdraw`?
        // Prompt: "V3 implementing withdrawal delays".
        // "User must call requestWithdrawal(amount) first".
        // This implies direct `withdraw` should be disabled or restricted?
        // If `withdraw` (V2) still works, then delay is useless.
        // So we MUST override `withdraw` to revert? Or make it wrap request?
        // Usually we disable `withdraw` or make it revert "Use requestWithdrawal".
        // Let's override `withdraw` to revert.
        
        uint256 amount = balances[msg.sender];
        require(amount > 0, "No balance to withdraw");
        
        _manageYield(msg.sender);

        balances[msg.sender] = 0;
        totalDeposits -= amount;
        
        // Clear request if any
        delete withdrawalRequests[msg.sender];
        
        token.transfer(msg.sender, amount);
        return amount;
    }
    
    // Override base withdraw to enforce V3 logic (disable direct withdraw)
    function withdraw(uint256 amount) public override nonReentrant {
        revert("Use requestWithdrawal in V3");
    }

    function getImplementationVersion() external pure override returns (string memory) {
        return "V3";
    }

    // Gap
    uint256[43] private __gap; // V3 added 2 vars (uint + mapping) + struct? Struct definition doesn't take storage. Mapping takes 1 slot. Uint takes 1 slot.
    // Total 2 slots.
    // V2 gap was 45.
    // So V3 gap 43.
}
