# Energy Marketplace Smart Contracts

This Hardhat project contains the first version of the energy marketplace contracts.

## Contracts

### EnergyToken

`EnergyToken` is an owner-controlled ERC-20 token. One token represents one whole
kilowatt-hour, so the token uses zero decimals.

- `mint(address to, uint256 amount)` creates energy units. Owner only.
- `burn(address from, uint256 amount)` retires energy units. Owner only.
- Standard ERC-20 transfers and allowances are available.

### Marketplace

`Marketplace` uses full-fill sell orders and escrows the energy tokens when an
order is created. Prices are denominated in wei and paid with native ETH.

1. The seller approves the marketplace for the energy quantity.
2. The seller calls `createSellOrder(quantity, price)`.
3. A buyer calls `buyEnergy(orderId)` with exactly `price` wei.
4. The marketplace sends the energy to the buyer and the ETH to the seller.
5. The seller can call `cancelOrder(orderId)` before purchase to recover escrow.

## Development

From the repository root, `npm run dev` starts the local node, deploys the
contracts, and starts the backend and frontend automatically. The commands
below are useful when working on contracts independently.

Install dependencies and run the test suite:

```shell
npm install
npm test
```

Compile contracts directly with:

```shell
npx hardhat compile
```

Deploy both contracts to a local simulated network:

```shell
npx hardhat ignition deploy ignition/modules/EnergyMarketplace.ts
```

For Sepolia, configure `SEPOLIA_RPC_URL` and `SEPOLIA_PRIVATE_KEY`, then run:

```shell
npx hardhat ignition deploy --network sepolia ignition/modules/EnergyMarketplace.ts
```
