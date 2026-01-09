# TokenVault Upgradeable System

## Overview
A production-grade upgradeable smart contract system implementing a TokenVault protocol using the UUPS (Universal Upgradeable Proxy Standard) pattern. The system evolves through three versions (V1, V2, V3), introducing yield generation, pause controls, and withdrawal delays while maintaining state integrity.

## Installation and Setup
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```

## Compilation
Compile the smart contracts:
```bash
npx hardhat compile
```

## Running Tests
Run the full test suite (V1, Upgrade V1->V2, Upgrade V2->V3, Security):
```bash
npx hardhat test
```
Desired coverage is >90%.

## Deployment and Upgrades
Scripts are provided in the `scripts/` directory.

1. **Deploy V1**:
   ```bash
   npx hardhat run scripts/deploy-v1.js --network localhost
   ```
2. **Upgrade to V2**:
   Update `PROXY_ADDRESS` in `scripts/upgrade-to-v2.js` then run:
   ```bash
   npx hardhat run scripts/upgrade-to-v2.js --network localhost
   ```
3. **Upgrade to V3**:
   Update `PROXY_ADDRESS` in `scripts/upgrade-to-v3.js` then run:
   ```bash
   npx hardhat run scripts/upgrade-to-v3.js --network localhost
   ```

## Implementation Details

### Storage Layout Strategy
To prevent storage collisions during upgrades, we strictly adhere to the **Append-Only** strategy:
- **Inheritance**: Each new version inherits from the previous version (e.g., `TokenVaultV2 is TokenVaultV1`).
- **Gaps**: Each contract includes a `__gap` array at the end of its storage layout. When adding new variables in a new version (or in the derived contract), we verify that the inheritance chain preserves the slot order. 
- In this implementation, V2 and V3 extend the previous versions. We also use OpenZeppelin's upgradeable contracts which utilize gaps.
- **Variables**: New variables are defined in the new child contract.

### Access Control Design
We use `AccessControlUpgradeable` for granular permission management:
- **DEFAULT_ADMIN_ROLE**: Grants/Revokes roles. Assigned to the deployer.
- **UPGRADER_ROLE**: Required to authorize contract upgrades (`_authorizeUpgrade`). Assigned to the deployer/admin.
- **PAUSER_ROLE**: Required to pause/unpause deposits in V2.

### Design Decisions & Limitations
- **V1 Fee**: Calculated as a tax on valid deposits.
- **V2 Yield**: Simulated as a simple interest calculation based on seconds elapsed. Yield is claimed manually or triggered on interaction. "Zero Yield Init" pattern used for migration: existing users start earning yield from their first V2 interaction.
- **V3 Withdrawal Delay**: Implements a generic request-execute pattern. Emergency withdraw bypasses this (withdraws full balance instantly).
- **Initialization**: `_disableInitializers()` is called in constructors to prevent implementation contract initialization.

## Known Limitations
- Yield is transferred from the vault's own balance. The vault must be funded with enough tokens to pay out yield.
- Time travel in tests relies on `evm_increaseTime`.
