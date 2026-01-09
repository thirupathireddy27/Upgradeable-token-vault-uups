import "./TokenVaultV1.sol";

contract TokenVaultV2 is TokenVaultV1 {
    uint256 public yieldRate; // Basis points
    mapping(address => uint256) public lastClaimTime;
    bool public isPaused; 
    
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    error EnforcedPause();

    modifier whenNotPaused() {
        if (isPaused) revert EnforcedPause();
        _;
    }

    function initializeV2(uint256 _yieldRate) public reinitializer(2) {
        yieldRate = _yieldRate;
        isPaused = false;
        _grantRole(PAUSER_ROLE, msg.sender); 
    }

    function setYieldRate(uint256 _yieldRate) external onlyRole(DEFAULT_ADMIN_ROLE) {
        yieldRate = _yieldRate;
    }

    function getYieldRate() external view returns (uint256) {
        return yieldRate;
    }

    function claimYield() external nonReentrant returns (uint256) {
 
        // Prompt says "function pauseDeposits() external". It doesn't explicitly restrict claim.
        // But usually pause stops interaction.
        // Let's implement yield calculation.
        uint256 yield = _calculateYield(msg.sender);
        // require(yield > 0, "No yield to claim"); // Removed to allow init

        lastClaimTime[msg.sender] = block.timestamp;
        
        if (yield > 0) {
            require(token.balanceOf(address(this)) >= yield, "Insufficient vault funds for yield");
            token.transfer(msg.sender, yield);
        }
        
        return yield;
    }

    function getUserYield(address user) external view returns (uint256) {
        return _calculateYield(user);
    }
    
    function _calculateYield(address user) internal view returns (uint256) {
        uint256 timeElapsed;
        if (lastClaimTime[user] == 0) {
             // For V1 users upgrading to V2, lastClaimTime is 0.
             // Should yield start from V2 upgrade? Or from deposit?
             // V1 didn't track "deposit time".
             // We can't know when they deposited.
             // Prudent approach: Yield starts from *now* (first interaction in V2)?
             // Or assume 0 start implies no yield yet?
             // BUT, if I deposit in V1 and upgrade, I expect yield?
             // Without deposit timestamp in V1, we cannot calculate past yield.
             // We will assume yield starts accumulating from `lastClaimTime` which is 0.
             // If 0, maybe means "never claimed".
             // If we treat 0 as "start of time", huge yield.
             // We need to initialize `lastClaimTime` for existing users?
             // Or allow `timeElapsed` to be derived differently?
             // Prompt: "Track last claim time per user to prevent double-claiming".
             // If I claim now, lastClaimTime = now.
             // If I haven't claimed, lastClaimTime is 0.
             // Logic: Yield = (balance * rate * time) / ...
             // We need a reference time.
             // Let's assume we cannot retroactively pay V1 yield.
             // So for V1 users, effective start time is... when?
             // Maybe `initializeV2` sets a global startTime?
             return 0; // Simplification: You must interacting to start earning? Or `lastClaimTime` defaults to...
             // Wait, if lastClaimTime is 0, we should probably set it to current timestamp upon first interaction/deposit?
             // But existing balances?
             // Let's enforce: Yield is only calculated if lastClaimTime > 0?
             // And set lastClaimTime on deposit?
             // V1 deposits didn't set it.
             // This is a migration issue.
             // "V1... V2 adding yield generation".
             // "State Migration Between Versions" is a skill listed.
             // Maybe migration script should set lastClaimTime for all users? 
             // Iterating all users is impossible on-chain.
             // Lazy migration: First action in V2 initializes `lastClaimTime` to `block.timestamp` (start earning from NOW).
        } else {
            timeElapsed = block.timestamp - lastClaimTime[user];
        }
        
        if (timeElapsed == 0) return 0;

        // Yield = (userBalance * yieldRate * timeElapsed) / (365 days * 10000)
        // yieldRate in basis points (e.g. 500 = 5%). 10000 basis points = 100%.
        // Formula denominator: 365 days * 10000.
        
        return (balances[user] * yieldRate * timeElapsed) / (365 days * 10000);
    }

    // Override deposit to update lastClaimTime?
    // If I deposit more, does it auto-claim previous yield?
    // "Yield should not compound automatically".
    // Usually, on deposit/withdraw, we simply checkpoint.
    // Ideally: Claim pending yield, then update balance, then reset timer.
    function deposit(uint256 amount) public override nonReentrant whenNotPaused {
        // We should trigger V1 deposit logic, but handle V2 state.
        _manageYield(msg.sender);
        _deposit(amount);
    }
    
    function withdraw(uint256 amount) public virtual override nonReentrant { // V1 withdraw was external, need to match or override public? 
        // V1 withdraw is external. Can't override external with public? No, external can be overridden by public/external.
        // But V1 withdraw is implemented.
        // We need to override to manage yield.
        _manageYield(msg.sender);
        _withdraw(amount);
    }

    function _manageYield(address user) internal {
        // If first time (lastClaimTime == 0), just set to now. start earning.
        if (lastClaimTime[user] == 0) {
            lastClaimTime[user] = block.timestamp;
            return;
        }
        // If not first time, user might have pending yield.
        // Should we claim it? "Yield should not compound".
        // If we don't claim/checkpoint, then subsequent high balance will earn yield for past time (exploit).
        // Must Checkpoint: Calculate yield on OLD balance, store it (or claim it).
        // For simplicity: Claim it (send to user).
        // Implementation guidelines: "ClaimYield" function exists.
        // Maybe we just store pending yield?
        // But prompt relies on `claimYield`.
        // Let's just claim it automatically on balance change?
        // Or `_calculateYield` uses weighted average? Too complex.
        // Simplest: Claim pending yield on every balance change.
        // But `withdraw` calls `_manageYield`. If `claimYield` is called, it sends tokens.
        // Is `claimYield` reentrant? standard check.
        // Let's implement an internal claim.
        uint256 pending = _calculateYield(user);
        if (pending > 0) {
            require(token.balanceOf(address(this)) >= pending, "Insufficient vault funds for yield");
            token.transfer(user, pending); 
        }
        lastClaimTime[user] = block.timestamp;
    }

    function pauseDeposits() external onlyRole(PAUSER_ROLE) {
        isPaused = true;
    }

    function unpauseDeposits() external onlyRole(PAUSER_ROLE) {
        isPaused = false;
    }

    function isDepositsPaused() external view returns (bool) {
        return isPaused;
    }

    // Version override
    function getImplementationVersion() external pure virtual override returns (string memory) {
        return "V2";
    }
    
    // Gaps
    uint256[45] private __gap; // V2 added 2 vars (yieldRate, lastClaimTime mapping) + Pausable (has gap).
    // PausableUpgradeable has its own gap (50).
    // Inheriting Pausable adds it to layout.
    // Our vars (yieldRate, mapping) take 2 slots.
    // V1 gap was 46.
    // We SHOULD NOT touch V1 gap in V1 file.
    // In V2, we are appending.
    // So V2 layout: [V1 Storage (inc gap)] + [Pausable Storage] + [V2 Vars] + [V2 Gap]
    // This is fine.
}
