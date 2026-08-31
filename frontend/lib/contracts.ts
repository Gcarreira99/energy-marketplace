import type { Address } from "viem";

export const marketplaceAddress = (process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS ?? "") as Address;
export const energyTokenAddress = (process.env.NEXT_PUBLIC_ENERGY_TOKEN_ADDRESS ?? "") as Address;

export const energyTokenAbi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "approved", type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
] as const;

export const marketplaceAbi = [
  {
    type: "function",
    name: "getOrder",
    stateMutability: "view",
    inputs: [{ name: "orderId", type: "uint256" }],
    outputs: [{
      name: "order",
      type: "tuple",
      components: [
        { name: "seller", type: "address" },
        { name: "quantity", type: "uint256" },
        { name: "price", type: "uint256" },
        { name: "timestamp", type: "uint256" },
        { name: "active", type: "bool" },
      ],
    }],
  },
  {
    type: "function",
    name: "buyEnergy",
    stateMutability: "payable",
    inputs: [{ name: "orderId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "createSellOrder",
    stateMutability: "nonpayable",
    inputs: [
      { name: "quantity", type: "uint256" },
      { name: "price", type: "uint256" },
    ],
    outputs: [{ name: "orderId", type: "uint256" }],
  },
  {
    type: "event",
    name: "SellOrderCreated",
    inputs: [
      { name: "orderId", type: "uint256", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "quantity", type: "uint256", indexed: false },
      { name: "price", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;
