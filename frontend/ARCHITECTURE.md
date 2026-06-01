# Energy Marketplace Frontend Architecture

## Overview

The frontend is built with **Next.js 16 + TypeScript**, organized into feature-based modules with clear data ownership, client/server component separation, and integrated blockchain wallet support via **Wagmi + Viem**. All pages use responsive design with Tailwind CSS and real-time visualizations with Recharts.

---

## Folder Structure

```
frontend/
├── app/
│   ├── layout.tsx              # Root layout with providers
│   ├── page.tsx                # Dashboard (home page)
│   ├── globals.css             # Global styles
│   │
│   ├── auth/
│   │   ├── layout.tsx
│   │   ├── login/page.tsx      # Login page
│   │   └── register/page.tsx   # Registration page
│   │
│   ├── marketplace/
│   │   ├── layout.tsx
│   │   ├── page.tsx            # Marketplace browse
│   │   ├── [offerId]/page.tsx  # Offer details
│   │   └── my-offers/page.tsx  # User's offers
│   │
│   ├── energy/
│   │   ├── layout.tsx
│   │   ├── page.tsx            # Energy dashboard
│   │   ├── nodes/page.tsx      # Grid nodes
│   │   └── production/page.tsx # Production tracking
│   │
│   ├── transactions/
│   │   ├── layout.tsx
│   │   ├── page.tsx            # Transaction history
│   │   └── [transactionId]/page.tsx
│   │
│   └── simulations/
│       ├── layout.tsx
│       ├── page.tsx            # Run simulations
│       └── [simulationId]/page.tsx
│
├── components/
│   ├── common/                 # Reusable components
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Footer.tsx
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   └── Notification.tsx
│   │
│   ├── auth/                   # Authentication components
│   │   ├── LoginForm.tsx
│   │   ├── RegisterForm.tsx
│   │   ├── WalletConnectButton.tsx
│   │   └── ProtectedRoute.tsx
│   │
│   ├── marketplace/            # Marketplace components
│   │   ├── OfferCard.tsx
│   │   ├── OfferList.tsx
│   │   ├── CreateOfferForm.tsx
│   │   ├── OrderConfirmation.tsx
│   │   └── PriceChart.tsx
│   │
│   ├── energy/                 # Energy tracking components
│   │   ├── ProductionCard.tsx
│   │   ├── ConsumptionCard.tsx
│   │   ├── GridTopology.tsx
│   │   ├── NodeVisualization.tsx
│   │   └── EnergyMetrics.tsx
│   │
│   ├── transactions/           # Transaction components
│   │   ├── TransactionTable.tsx
│   │   ├── SettlementStatus.tsx
│   │   └── TransactionDetails.tsx
│   │
│   └── dashboard/              # Dashboard components
│       ├── MarketSummary.tsx
│       ├── TrendChart.tsx
│       ├── RecentActivity.tsx
│       ├── TopProducers.tsx
│       └── GridStatus.tsx
│
├── hooks/                      # Custom React hooks
│   ├── useAuth.ts              # Authentication state
│   ├── useWallet.ts            # Wallet connection
│   ├── useMarketplace.ts       # Marketplace data
│   ├── useEnergy.ts            # Energy tracking
│   ├── useTransactions.ts      # Transaction history
│   ├── useFetch.ts             # Generic data fetching
│   └── useLocalStorage.ts      # Persistent client state
│
├── lib/
│   ├── api-client.ts           # API request wrapper
│   ├── blockchain.ts           # Smart contract interactions (Ethers.js)
│   ├── wagmi-config.ts         # Wagmi configuration
│   ├── constants.ts            # App constants, contract ABIs
│   ├── utils.ts                # Helper functions
│   └── types.ts                # Shared TypeScript types
│
├── context/
│   ├── AuthContext.tsx         # Auth state management
│   ├── ThemeContext.tsx        # Dark/light mode
│   ├── NotificationContext.tsx # Toast notifications
│   └── MarketplaceContext.tsx  # Marketplace state
│
├── styles/
│   ├── colors.ts               # Design tokens
│   ├── typography.ts           # Font definitions
│   └── spacing.ts              # Spacing scale
│
└── public/
    ├── icons/
    ├── images/
    └── placeholder/
```

---

## Module Responsibilities

### 1. Auth Module
**Components**:
- `LoginForm.tsx` — Email/password login with JWT storage
- `RegisterForm.tsx` — User registration
- `WalletConnectButton.tsx` — Wagmi-based wallet connection (MetaMask, WalletConnect)
- `ProtectedRoute.tsx` — Route guard for authenticated pages

**Responsibilities**:
- Handle user authentication flow
- Store JWT tokens (localStorage + secure HttpOnly cookies)
- Connect blockchain wallet
- Manage user sessions

**Pages**:
- `/auth/login` — Login page
- `/auth/register` — Registration page

**Data Flow**:
```
User Input → LoginForm → API POST /v1/auth/login → Store JWT
→ Redirect to Dashboard
```

---

### 2. Marketplace Module
**Components**:
- `OfferCard.tsx` — Individual offer display
- `OfferList.tsx` — Grid of offers with filtering
- `CreateOfferForm.tsx` — Form to create energy offer
- `OrderConfirmation.tsx` — Confirmation modal for purchase
- `PriceChart.tsx` — Weekly price trend (Recharts)

**Responsibilities**:
- Display available energy offers
- Allow users to create offers (producers)
- Handle order placement (buyers)
- Show real-time price trends
- Track user's own offers

**Pages**:
- `/marketplace` — Browse all offers
- `/marketplace/my-offers` — User's offers with management
- `/marketplace/[offerId]` — Offer details

**Data Flow**:
```
GET /v1/marketplace/offers → Display OfferList
→ User clicks offer → GET /v1/marketplace/offers/:offerId
→ User clicks "Buy" → POST /v1/marketplace/orders
```

---

### 3. Energy Module
**Components**:
- `ProductionCard.tsx` — Current production metrics
- `ConsumptionCard.tsx` — Current consumption metrics
- `GridTopology.tsx` — Visual grid node map
- `NodeVisualization.tsx` — Individual node status
- `EnergyMetrics.tsx` — Historical charts (production/consumption trends)

**Responsibilities**:
- Display real-time energy production/consumption
- Show grid topology and node health
- Track energy metrics over time
- Display user's energy balance

**Pages**:
- `/energy` — Energy dashboard
- `/energy/nodes` — Grid nodes overview
- `/energy/production` — Production history

**Data Flow**:
```
WebSocket: /v1/energy/grid-status → Update in real-time
GET /v1/energy/production/:userId → Show production history
GET /v1/energy/consumption/:userId → Show consumption history
```

---

### 4. Transactions Module
**Components**:
- `TransactionTable.tsx` — List of user transactions
- `SettlementStatus.tsx` — Order settlement state
- `TransactionDetails.tsx` — Full transaction info with blockchain link

**Responsibilities**:
- Display transaction history
- Show order settlement status
- Provide blockchain transaction links
- Display payment confirmations

**Pages**:
- `/transactions` — Full transaction history
- `/transactions/[transactionId]` — Transaction details

**Data Flow**:
```
GET /v1/transactions → Display TransactionTable
→ User clicks transaction → GET /v1/transactions/:id
→ Show blockchain link to Ethers.js tx hash
```

---

### 5. Dashboard Module
**Components**:
- `MarketSummary.tsx` — Key metrics (market price, active nodes, volume)
- `TrendChart.tsx` — Weekly price chart
- `RecentActivity.tsx` — Recent trades and events
- `TopProducers.tsx` — Leaderboard of producers
- `GridStatus.tsx` — Overall grid health

**Responsibilities**:
- Aggregate data from other modules
- Display key metrics and summaries
- Show real-time updates
- Provide entry points to other modules

**Pages**:
- `/` — Home/dashboard page

**Data Flow**:
```
GET /v1/marketplace/offers (latest)
GET /v1/energy/grid-status
GET /v1/transactions (recent)
→ Display aggregated dashboard
```

---

## Authentication & Authorization Flow

```
┌─────────────────┐
│  User visits    │
│  /auth/login    │
└────────┬────────┘
         │
         ▼
┌──────────────────────────┐
│  LoginForm component     │
│  - Email input           │
│  - Password input        │
│  - Submit button         │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  POST /v1/auth/login         │
│  (via api-client.ts)         │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  Backend validates           │
│  Returns JWT token           │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  Store JWT in:               │
│  - localStorage (client)     │
│  - AuthContext (memory)      │
│  - Set as Authorization      │
│    header in api-client      │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  Redirect to /               │
│  (Dashboard)                 │
└──────────────────────────────┘
```

---

## Wallet Integration (Wagmi + Viem)

**Configuration** (`lib/wagmi-config.ts`):
```typescript
import { createConfig, http } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { walletConnect, injected } from "wagmi/connectors";

export const config = createConfig({
  chains: [mainnet, sepolia],
  connectors: [
    injected(),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID!,
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
});
```

**Component** (`components/auth/WalletConnectButton.tsx`):
```typescript
"use client";

import { useConnect, useAccount } from "wagmi";
import { Button } from "@/components/common/Button";

export function WalletConnectButton() {
  const { connectors, connect } = useConnect();
  const { address, isConnected } = useAccount();

  if (isConnected) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-600">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
        <Button variant="secondary">Disconnect</Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      {connectors.map((connector) => (
        <Button
          key={connector.uid}
          onClick={() => connect({ connector })}
        >
          Connect {connector.name}
        </Button>
      ))}
    </div>
  );
}
```

---

## State Management Strategy

### Client State
- **AuthContext**: User auth status, JWT token, user profile
- **ThemeContext**: Dark/light mode preference
- **NotificationContext**: Toast notifications
- **Custom Hooks**: `useAuth()`, `useWallet()`, `useMarketplace()`

### Server State
- **Fetch API Calls**: Server-side data fetching in layouts/pages
- **useTransition**: Loading states for form submissions
- **React Query (optional future)**: Cache, pagination, real-time subscriptions

### Example State Hook (`hooks/useAuth.ts`):
```typescript
import { useContext } from "react";
import { AuthContext } from "@/context/AuthContext";

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

// Usage in component:
// const { user, isAuthenticated, logout } = useAuth();
```

---

## API Client Configuration (`lib/api-client.ts`)

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/v1";

export async function apiCall<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const token = localStorage.getItem("jwt_token");
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "API call failed");
  }

  return response.json();
}

// Usage:
// const offers = await apiCall<OfferDTO[]>("/marketplace/offers");
```

---

## Blockchain Integration (`lib/blockchain.ts`)

```typescript
import { ethers } from "ethers";
import { MARKETPLACE_ABI, ENERGY_TOKEN_ABI } from "@/lib/constants";

export const CONTRACTS = {
  energyToken: process.env.NEXT_PUBLIC_ENERGY_TOKEN_ADDRESS!,
  marketplace: process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS!,
};

export async function approveEnergyTransfer(amount: string) {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  
  const contract = new ethers.Contract(
    CONTRACTS.energyToken,
    ENERGY_TOKEN_ABI,
    signer
  );
  
  const tx = await contract.approve(CONTRACTS.marketplace, ethers.parseUnits(amount, 18));
  return tx.wait();
}

export async function executeMarketplaceOrder(
  offerId: string,
  energyAmount: string
) {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  
  const contract = new ethers.Contract(
    CONTRACTS.marketplace,
    MARKETPLACE_ABI,
    signer
  );
  
  const tx = await contract.buyEnergy(offerId, ethers.parseUnits(energyAmount, 2));
  return tx.wait();
}
```

---

## Component Composition Patterns

### Server Component (Async Data Fetching)
```typescript
// app/marketplace/page.tsx
export default async function MarketplacePage() {
  const offers = await fetch(`${API_BASE_URL}/marketplace/offers`).then(r => r.json());
  
  return (
    <div className="space-y-6">
      <h1>Marketplace</h1>
      <OfferList initialOffers={offers} />
    </div>
  );
}
```

### Client Component (Interactivity & State)
```typescript
// components/marketplace/OfferList.tsx
"use client";

import { useState } from "react";
import { OfferCard } from "./OfferCard";

export function OfferList({ initialOffers }) {
  const [offers, setOffers] = useState(initialOffers);
  const [filter, setFilter] = useState("all");

  return (
    <div>
      <div className="flex gap-4 mb-6">
        <button onClick={() => setFilter("all")}>All</button>
        <button onClick={() => setFilter("solar")}>Solar</button>
        <button onClick={() => setFilter("wind")}>Wind</button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {offers.map(offer => (
          <OfferCard key={offer.id} offer={offer} />
        ))}
      </div>
    </div>
  );
}
```

---

## Visualization Components

### Price Trend Chart (using Recharts)
```typescript
// components/marketplace/PriceChart.tsx
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export function PriceChart({ data }) {
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
          <XAxis dataKey="day" stroke="#64748b" />
          <YAxis stroke="#64748b" />
          <Tooltip formatter={(value) => `$${value.toFixed(2)}/kWh`} />
          <Line
            type="monotone"
            dataKey="price"
            stroke="#2563eb"
            strokeWidth={3}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Grid Topology Visualization
```typescript
// components/energy/GridTopology.tsx
"use client";

export function GridTopology({ nodes }) {
  return (
    <div className="relative h-[320px] overflow-hidden rounded-[2rem] bg-slate-950/95 p-4">
      <div className="relative h-full w-full">
        {nodes.map((node) => (
          <div
            key={node.id}
            className="absolute flex flex-col items-center"
            style={{
              left: `${node.x}%`,
              top: `${node.y}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100/10 ring-1 ring-slate-200/10 text-xs font-semibold text-white">
              {node.value} MW
            </div>
            <span className="mt-3 text-[0.78rem] text-slate-300">
              {node.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Performance Optimization

### Image Optimization
- Use Next.js `<Image>` component for automatic optimization
- Lazy load images with `loading="lazy"`
- Use WebP format with fallbacks

### Code Splitting
- Automatic with Next.js App Router
- Dynamic imports for heavy components:
  ```typescript
  const GridTopology = dynamic(() => import("@/components/energy/GridTopology"), {
    loading: () => <div>Loading...</div>,
  });
  ```

### Data Fetching
- Fetch at layout/page level (server-side when possible)
- Use incremental static regeneration (ISR) for non-real-time data
- Client-side polling (via WebSocket) for real-time metrics

### Caching Strategy
```typescript
// Revalidate every 30 seconds
export const revalidate = 30;

export default async function Page() {
  const data = await fetch(`${API_BASE_URL}/data`, {
    next: { revalidate: 30 },
  }).then(r => r.json());
  
  return <Dashboard data={data} />;
}
```

---

## Environment Variables

**`.env.local`**:
```env
NEXT_PUBLIC_API_URL=http://localhost:3000/v1
NEXT_PUBLIC_BLOCKCHAIN_RPC=https://sepolia.infura.io/v3/YOUR_KEY
NEXT_PUBLIC_ENERGY_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_MARKETPLACE_ADDRESS=0x...
NEXT_PUBLIC_WC_PROJECT_ID=your_walletconnect_id
```

---

## Testing Strategy

- **Unit Tests**: Jest + React Testing Library for components
- **Integration Tests**: Test component + hook + API interactions
- **E2E Tests**: Playwright for user flows (auth → offer → purchase)
- **Visual Tests**: Chromatic for UI regression

---

## Implementation Roadmap

### Phase 1: Core Setup (Week 1)
- [ ] Initialize Next.js with Tailwind CSS
- [ ] Set up API client and authentication context
- [ ] Create layout components (Header, Sidebar, Footer)
- [ ] Implement login/register pages

### Phase 2: Dashboard & Marketplace (Week 2-3)
- [ ] Build dashboard with summary cards and charts
- [ ] Implement marketplace browse and offer list
- [ ] Add price trend chart visualization
- [ ] Create offer details page

### Phase 3: Energy & Transactions (Week 4)
- [ ] Build energy dashboard with metrics
- [ ] Implement grid topology visualization
- [ ] Create transaction history page
- [ ] Add settlement status tracking

### Phase 4: Wallet Integration (Week 5)
- [ ] Integrate Wagmi + Viem for wallet connection
- [ ] Connect to smart contracts
- [ ] Implement order execution via blockchain
- [ ] Add transaction confirmations

### Phase 5: Polish & Deploy (Week 6)
- [ ] Performance optimization
- [ ] Mobile responsiveness testing
- [ ] Accessibility audit
- [ ] Vercel deployment

---

## Technology Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 + CSS Modules
- **Charts**: Recharts for data visualization
- **Blockchain**: Wagmi + Viem for wallet, Ethers.js for contracts
- **State**: React Context API + custom hooks
- **HTTP**: Fetch API (no external library needed)
- **Testing**: Jest + React Testing Library + Playwright
- **Deployment**: Vercel

---

## Security Considerations

- Store JWT in secure HttpOnly cookies (backend sets, frontend reads from cookie)
- Fallback to localStorage with Token expiration check
- CORS configured on backend to match frontend domain
- Environment variables for sensitive data (contract addresses, API keys)
- Input validation on all forms using Zod
- CSP headers for XSS protection
- No sensitive data in client-side context or localStorage

