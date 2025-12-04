# Moon or Doom Smart Contracts

## Overview

SimplePredictionMarket.sol enables binary prediction markets for Farcaster cast engagement.

## Contract Features

### For MVP (Phase 1)
- **Create Markets**: Owner creates markets for specific casts
- **Bet MOON/DOOM**: Users bet USDC on whether threshold will be met
- **Manual Resolution**: Owner resolves markets based on Neynar data
- **Claim Winnings**: Winners claim their proportional share
- **1% Protocol Fee**: Small fee on total pool

### Key Functions

```solidity
// Create a market (owner only)
function createMarket(
    string castUrl,
    uint256 threshold,
    uint256 deadline
) returns (uint256 marketId)

// Bet on MOON (cast will exceed threshold)
function betMoon(uint256 marketId, uint256 amount)

// Bet on DOOM (cast will not exceed threshold)
function betDoom(uint256 marketId, uint256 amount)

// Resolve market (owner only)
function resolveMarket(uint256 marketId, Outcome outcome)

// Claim winnings
function claimWinnings(uint256 marketId)

// View functions
function getMoonOdds(uint256 marketId) returns (uint256)
function calculatePotentialWinnings(marketId, amount, isMoon) returns (uint256)
```

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Environment Variables
Create `.env` file:
```env
DEPLOYER_PRIVATE_KEY=your_private_key_here
BASESCAN_API_KEY=your_basescan_api_key_here
```

### 3. Compile Contracts
```bash
npx hardhat compile
```

### 4. Deploy to Base Sepolia (Testnet)
```bash
npx hardhat run scripts/deploy.js --network baseSepolia
```

### 5. Deploy to Base Mainnet
```bash
npx hardhat run scripts/deploy.js --network base
```

## USDC Addresses

- **Base Mainnet**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **Base Sepolia**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

## Testing Locally

### Start Local Hardhat Node
```bash
npx hardhat node
```

### Deploy to Localhost
```bash
npx hardhat run scripts/deploy.js --network localhost
```

## Security Considerations

- Uses OpenZeppelin's battle-tested contracts
- ReentrancyGuard on bet and claim functions
- Ownable for controlled market creation/resolution (MVP only)
- All USDC transfers checked for success

## Future Improvements (Phase 2+)

- [ ] Automated resolution via oracle/backend
- [ ] Permissionless market creation with factory pattern
- [ ] Different market types (time-based, multi-outcome)
- [ ] AMM-style continuous betting
- [ ] Market maker incentives

## Contract Verification

After deployment, verify on Basescan:
```bash
npx hardhat verify --network base <CONTRACT_ADDRESS> <USDC_ADDRESS>
```

## Integration with Frontend

See `/app/api` for Frame integration examples using viem/wagmi.

## License

MIT
