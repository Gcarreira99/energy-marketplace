# Energy Marketplace Backend Architecture

## Overview

The backend is built with **TypeScript + Node.js/NestJS**, organized into five feature-based modules with clear data ownership and API boundaries. All endpoints follow REST v1 with JWT bearer token authentication.

---

## Folder Structure

```
src/
├── common/
│   ├── decorators/           # Auth, role-based access control
│   ├── filters/              # Global error handlers
│   ├── guards/               # JWT, roles verification
│   ├── middleware/           # Logging, rate limiting
│   └── types/                # Shared interfaces
│
├── modules/
│   ├── users/                # User auth, profiles, roles
│   │   ├── controllers/       # HTTP handlers
│   │   ├── services/          # Business logic
│   │   ├── dtos/              # Data validation (Zod)
│   │   ├── entities/          # Database models
│   │   ├── repositories/      # Data access layer
│   │   └── users.module.ts
│   │
│   ├── marketplace/           # Offers, matching, orders
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── dtos/
│   │   ├── entities/
│   │   ├── repositories/
│   │   └── marketplace.module.ts
│   │
│   ├── energy/               # Production, consumption, grid data
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── dtos/
│   │   ├── entities/
│   │   ├── repositories/
│   │   └── energy.module.ts
│   │
│   ├── transactions/         # Orders, payments, settlements
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── dtos/
│   │   ├── entities/
│   │   ├── repositories/
│   │   └── transactions.module.ts
│   │
│   └── simulation/           # Testing, forecasting, scenarios
│       ├── controllers/
│       ├── services/
│       ├── dtos/
│       ├── entities/
│       ├── repositories/
│       └── simulation.module.ts
│
├── database/
│   ├── migrations/           # Schema version control
│   └── seeds/                # Test data
│
└── app.module.ts
```

---

## Module Responsibilities & Data Ownership

### 1. Users Module
**Responsibility**: Authentication, user profiles, roles, and permissions

**Owns**:
- User accounts and credentials
- JWT token generation/validation
- Role and permission definitions

**Provides (Read-Only)**:
- User profile information to other modules
- Role-based access control

**API Endpoints**:
- `POST /v1/auth/register` — Register new user
- `POST /v1/auth/login` — Login and get JWT token
- `GET /v1/users/:userId` — Get user profile
- `PATCH /v1/users/:userId` — Update profile
- `POST /v1/auth/refresh` — Refresh JWT token

**DTO Example**:
```typescript
import { z } from "zod";

export const CreateUserDTO = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

export type CreateUserDTO = z.infer<typeof CreateUserDTO>;

export const UserProfileDTO = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  walletAddress: z.string(),
  role: z.enum(["producer", "consumer", "prosumer"]),
  createdAt: z.date(),
});

export type UserProfileDTO = z.infer<typeof UserProfileDTO>;
```

---

### 2. Marketplace Module
**Responsibility**: Energy listings, offer creation, matching logic, and order management

**Owns**:
- Energy offers/bids
- Order state and matching logic
- Market clearing algorithm
- Price history

**Reads From**:
- Energy metrics (to validate available capacity)
- User profiles (to validate permissions)

**API Endpoints**:
- `POST /v1/marketplace/offers` — Create energy offer
- `GET /v1/marketplace/offers` — List active offers
- `GET /v1/marketplace/offers/:offerId` — Get offer details
- `DELETE /v1/marketplace/offers/:offerId` — Cancel offer
- `POST /v1/marketplace/orders` — Place a buy order (match with offer)
- `GET /v1/marketplace/orders/:orderId` — Get order status
- `POST /v1/marketplace/orders/:orderId/settle` — Finalize order

**DTO Example**:
```typescript
export const CreateOfferDTO = z.object({
  energyAmount: z.number().positive().max(10000), // kWh
  pricePerUnit: z.number().positive(), // USD/kWh
  availableUntil: z.date().refine(d => d > new Date(), "Must be future date"),
});

export type CreateOfferDTO = z.infer<typeof CreateOfferDTO>;

export const OrderDTO = z.object({
  id: z.string().uuid(),
  offerId: z.string().uuid(),
  buyerId: z.string().uuid(),
  sellerId: z.string().uuid(),
  energyAmount: z.number().positive(),
  totalPrice: z.number().positive(),
  status: z.enum(["pending", "matched", "settled", "cancelled"]),
  createdAt: z.date(),
  settledAt: z.date().optional(),
});

export type OrderDTO = z.infer<typeof OrderDTO>;
```

---

### 3. Energy Module
**Responsibility**: Real-time energy production/consumption tracking, grid data, and node management

**Owns**:
- Energy production metrics
- Consumption records
- Grid node status
- Real-time supply/demand data

**Provides (Read-Only)**:
- Current production/consumption to marketplace (for offer validation)
- Current production/consumption to transactions (for settlement)
- Grid health status to simulation (for forecasting)

**API Endpoints**:
- `POST /v1/energy/nodes` — Register grid node
- `GET /v1/energy/nodes` — List all nodes
- `PATCH /v1/energy/nodes/:nodeId` — Update node status
- `POST /v1/energy/production` — Record production event
- `GET /v1/energy/production/:userId` — Get user's production history
- `POST /v1/energy/consumption` — Record consumption event
- `GET /v1/energy/consumption/:userId` — Get user's consumption history
- `GET /v1/energy/grid-status` — Get real-time grid metrics

**DTO Example**:
```typescript
export const ProductionEventDTO = z.object({
  userId: z.string().uuid(),
  nodeId: z.string().uuid(),
  amount: z.number().nonnegative(), // kWh
  timestamp: z.date(),
  source: z.enum(["solar", "wind", "battery", "grid"]),
});

export type ProductionEventDTO = z.infer<typeof ProductionEventDTO>;

export const GridStatusDTO = z.object({
  totalProduction: z.number().nonnegative(),
  totalConsumption: z.number().nonnegative(),
  activeNodes: z.number().nonnegative(),
  averagePrice: z.number().positive(),
  timestamp: z.date(),
});

export type GridStatusDTO = z.infer<typeof GridStatusDTO>;
```

---

### 4. Transactions Module
**Responsibility**: Order management, payment processing, settlements, and audit trails

**Owns**:
- Transaction history
- Payment records
- Settlement state
- Audit logs

**Reads From**:
- Marketplace (to track orders)
- Energy (to validate production/consumption for settlement)
- Users (to get wallet addresses for payments)

**Writes To**:
- Smart contracts (via Ethers.js) for payment execution

**API Endpoints**:
- `GET /v1/transactions` — List user's transactions
- `GET /v1/transactions/:transactionId` — Get transaction details
- `POST /v1/transactions/:orderId/settle` — Initiate settlement
- `GET /v1/transactions/settlement-status/:orderId` — Check settlement status
- `GET /v1/transactions/audit-log` — Get audit trail (admin only)

**DTO Example**:
```typescript
export const SettlementDTO = z.object({
  orderId: z.string().uuid(),
  buyerId: z.string().uuid(),
  sellerId: z.string().uuid(),
  energyAmount: z.number().positive(),
  totalAmount: z.number().positive(), // USD equivalent
  paymentTxHash: z.string().optional(), // Blockchain tx hash
  status: z.enum(["pending", "processing", "completed", "failed"]),
  timestamp: z.date(),
});

export type SettlementDTO = z.infer<typeof SettlementDTO>;

export const TransactionHistoryDTO = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: z.enum(["buy", "sell", "production", "consumption"]),
  amount: z.number(),
  price: z.number().optional(),
  status: z.string(),
  timestamp: z.date(),
});

export type TransactionHistoryDTO = z.infer<typeof TransactionHistoryDTO>;
```

---

### 5. Simulation Module
**Responsibility**: Market simulation, scenario testing, and forecasting

**Owns**:
- Simulation results
- Test scenarios
- Forecast models

**Reads From**:
- Marketplace (anonymized offer/bid data)
- Energy (grid metrics and historical production)

**Does NOT Write To**:
- Any persistent marketplace or energy data (read-only access)
- Simulations produce isolated test results only

**API Endpoints**:
- `POST /v1/simulations` — Create simulation scenario
- `GET /v1/simulations/:simulationId` — Get simulation results
- `GET /v1/simulations` — List past simulations
- `POST /v1/forecasts` — Generate price forecast
- `GET /v1/forecasts/next-24h` — Get 24-hour forecast

**DTO Example**:
```typescript
export const CreateSimulationDTO = z.object({
  name: z.string(),
  description: z.string().optional(),
  duration: z.number().positive(), // minutes
  initialProducers: z.number().positive(),
  initialConsumers: z.number().positive(),
  marketingConditions: z.enum(["normal", "peak", "low-demand"]),
});

export type CreateSimulationDTO = z.infer<typeof CreateSimulationDTO>;

export const SimulationResultDTO = z.object({
  id: z.string().uuid(),
  name: z.string(),
  executionTime: z.number(), // ms
  totalEnergyTraded: z.number(),
  averageClearingPrice: z.number(),
  priceVolatility: z.number(),
  nodeSuccessRate: z.number().min(0).max(1),
  timestamp: z.date(),
});

export type SimulationResultDTO = z.infer<typeof SimulationResultDTO>;
```

---

## Module Interaction Flow

```
┌─────────────────────────────────────────────────────────┐
│                      API Client                          │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
    [Users]      [Marketplace]  [Energy]
        │              │              │
        └──────────┬───┴──────┬───────┘
                   │          │
            [Transactions] [Simulation]
                   │          │
                   └───┬──────┘
                       │
              [Smart Contracts / Blockchain]
```

**Key Flows**:

1. **User Registration → Authentication**: Users module generates JWT token
2. **Create Offer → Validation**: Marketplace validates user can create offer (Users), checks available production (Energy)
3. **Place Order → Matching**: Marketplace matches buyer with offer
4. **Settlement**: Transactions module processes payment, updates user balances, records in Energy module
5. **Forecasting**: Simulation module reads anonymized Marketplace and Energy data, generates forecast (no data written)

---

## Database Schema (Entity Examples)

### Users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  name VARCHAR(255),
  wallet_address VARCHAR(42) UNIQUE,
  role ENUM('producer', 'consumer', 'prosumer'),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Marketplace Offers
```sql
CREATE TABLE offers (
  id UUID PRIMARY KEY,
  seller_id UUID REFERENCES users(id),
  energy_amount DECIMAL(10, 2),
  price_per_unit DECIMAL(10, 4),
  available_until TIMESTAMP,
  status ENUM('active', 'cancelled'),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Energy Production
```sql
CREATE TABLE production_events (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  node_id UUID,
  amount DECIMAL(10, 2),
  source ENUM('solar', 'wind', 'battery', 'grid'),
  timestamp TIMESTAMP DEFAULT NOW()
);
```

### Transactions (Orders)
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  offer_id UUID REFERENCES offers(id),
  buyer_id UUID REFERENCES users(id),
  seller_id UUID REFERENCES users(id),
  energy_amount DECIMAL(10, 2),
  total_price DECIMAL(10, 2),
  status ENUM('pending', 'settled', 'failed'),
  payment_tx_hash VARCHAR(66),
  created_at TIMESTAMP DEFAULT NOW(),
  settled_at TIMESTAMP
);
```

---

## Implementation Roadmap

### Phase 1: Core Setup (Week 1)
- [ ] Initialize NestJS project structure
- [ ] Set up database (PostgreSQL)
- [ ] Implement Users module (auth, JWT)
- [ ] Create shared decorators and guards

### Phase 2: Marketplace & Energy (Week 2-3)
- [ ] Implement Marketplace module (offers, orders, matching)
- [ ] Implement Energy module (production, consumption tracking)
- [ ] Add validation and error handling
- [ ] Create unit tests

### Phase 3: Transactions & Settlement (Week 4)
- [ ] Implement Transactions module
- [ ] Integrate with smart contracts (Ethers.js)
- [ ] Test settlement flow end-to-end

### Phase 4: Simulation & Forecasting (Week 5)
- [ ] Implement Simulation module
- [ ] Add forecast generation
- [ ] Optimize performance for large datasets

### Phase 5: Testing & Deployment (Week 6)
- [ ] Full integration testing
- [ ] Load testing
- [ ] Documentation
- [ ] Docker containerization

---

## Technology Stack

- **Framework**: NestJS (TypeScript)
- **Database**: PostgreSQL
- **Cache**: Redis (for real-time grid metrics)
- **Authentication**: JWT with bearer tokens
- **Blockchain**: Ethers.js v6
- **Validation**: Zod for DTOs
- **Testing**: Jest + Supertest
- **API Documentation**: Swagger/OpenAPI

---

## Security Considerations

- JWT expiration: 1 hour (access token), 7 days (refresh token)
- Password hashing: bcrypt with salt rounds 10+
- Rate limiting: 100 requests/minute per user
- CORS: Restrict to frontend domain
- Input validation: Zod validation on all DTOs
- SQL injection prevention: Use ORM (TypeORM) or parameterized queries
- Audit logging: Track all state changes in Transactions module

---

## Performance Optimization

- Index frequently queried fields (user_id, created_at, status)
- Use Redis for caching real-time grid metrics
- Paginate list endpoints (default 20, max 100 items)
- Use database connections pooling
- Implement API rate limiting per user

