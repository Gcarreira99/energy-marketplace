# Decentralized Energy Marketplace ⚡

A decentralized peer-to-peer energy trading platform built using blockchain technology. The system simulates a microgrid where users can buy and sell energy units transparently using smart contracts.

---

## 🌍 Project Vision

The goal of this project is to simulate a decentralized energy economy where users (households) can:
- Generate energy (simulated solar production)
- Store surplus energy
- Trade energy directly with other users
- Participate in a transparent energy marketplace

This project demonstrates concepts from:
- Blockchain systems
- Smart contracts
- Distributed marketplaces
- Real-time data systems
- (Future extension) AI-driven energy optimization

---

## 🛠️ Tech Stack

### Smart Contracts
- Solidity
- Hardhat (TypeScript setup)
- Mocha (Testing framework)
- Ethers.js (Blockchain interaction)

### Frontend (planned / optional integration)
- Next.js
- TypeScript
- Ethers.js / Viem

### Backend (planned)
- Node.js (TypeScript)
- FastAPI or NestJS (future choice)
- Redis (real-time updates)

---

## 📦 Smart Contract Architecture

### 1. EnergyToken Contract
Represents energy as a tokenized asset.

- 1 token = 1 kWh of energy
- Users can transfer energy between wallets
- Used as the base unit of trade

---

### 2. Marketplace Contract
Handles peer-to-peer energy trading.

Features:
- Create sell orders
- Buy energy from other users
- Cancel orders
- Escrow-based secure transactions

---

### 3. (Future) Grid Governance Contract
DAO-style governance system for:
- Pricing rules
- Grid policies
- Network parameters


### Posterior Features
Addition of AI features to improve overall the system.