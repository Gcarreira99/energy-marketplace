# Energy Marketplace Backend

Initial backend integration for the on-chain marketplace.

## Settlement endpoint

`POST /v1/transactions/:orderId/settle`

The service reads the order from `Marketplace`, verifies that it is active, and
submits `buyEnergy` using the exact stored price in wei. The configured backend
signer pays the transaction gas and acts as the buyer for this initial slice.

Set the required environment variables from `.env.example`:

- `RPC_URL`: JSON-RPC endpoint
- `BACKEND_PRIVATE_KEY`: funded signer used to submit transactions
- `MARKETPLACE_ADDRESS`: deployed `Marketplace` address

Run locally after installing dependencies:

```shell
npm install
npm run start:dev
```
