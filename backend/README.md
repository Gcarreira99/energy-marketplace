# Energy Marketplace Backend

Initial backend integration for the on-chain marketplace.

## Offers endpoint

`GET /v1/marketplace/offers` returns active orders indexed from the marketplace
events. Numeric blockchain values are returned as strings so they remain safe in
JSON responses. Offers are persisted in SQLite and rebuilt from
`MARKETPLACE_DEPLOYMENT_BLOCK` when the service starts.

## Settlement endpoint

`POST /v1/transactions/:orderId/settle`

The service reads the order from `Marketplace`, verifies that it is active, and
submits `buyEnergy` using the exact stored price in wei. The configured backend
signer pays the transaction gas and acts as the buyer for this initial slice.

Set the required environment variables from `.env.example`:

- `RPC_URL`: JSON-RPC endpoint
- `BACKEND_PRIVATE_KEY`: funded signer used to submit transactions
- `MARKETPLACE_ADDRESS`: deployed `Marketplace` address
- `MARKETPLACE_DEPLOYMENT_BLOCK`: first block to scan for marketplace events
- `FRONTEND_ORIGIN`: allowed browser origin, defaulting to `http://localhost:3000`
- `DATABASE_PATH`: SQLite file path, defaulting to `./marketplace.sqlite`

Run locally after installing dependencies:

```shell
npm install
npm run start:dev
```
