import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TokenVaultV1 is Initializable, AccessControlUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    IERC20 public token;
    uint256 public depositFee; // Basis points (e.g. 500 = 5%)
    uint256 public totalDeposits;

    mapping(address => uint256) public balances;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _token, address _admin, uint256 _depositFee) public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);

        token = IERC20(_token);
        depositFee = _depositFee;
    }

    function deposit(uint256 amount) public virtual nonReentrant {
        _deposit(amount);
    }

    function _deposit(uint256 amount) internal {
        require(amount > 0, "Deposit amount must be greater than 0");
        
        uint256 fee = (amount * depositFee) / 10000;
        uint256 amountAfterFee = amount - fee;

        token.transferFrom(msg.sender, address(this), amount);
        
        balances[msg.sender] += amountAfterFee;
        totalDeposits += amountAfterFee;
    }

    function withdraw(uint256 amount) public virtual nonReentrant {
        _withdraw(amount);
    }

    function _withdraw(uint256 amount) internal {
        require(amount > 0, "Withdraw amount must be greater than 0");
        require(balances[msg.sender] >= amount, "Insufficient balance");

        balances[msg.sender] -= amount;
        totalDeposits -= amount;

        token.transfer(msg.sender, amount);
    }

    function balanceOf(address user) external view returns (uint256) {
        return balances[user];
    }

    function getDepositFee() external view returns (uint256) {
        return depositFee;
    }

    function getImplementationVersion() external pure virtual returns (string memory) {
        return "V1";
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    // Storage gap for future upgrades
    uint256[46] private __gap;
}
