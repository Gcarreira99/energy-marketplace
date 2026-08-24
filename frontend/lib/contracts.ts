import type { Address } from "viem";

export const marketplaceAddress = (process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS ?? "") as Address;
export const energyTokenAddress = (process.env.NEXT_PUBLIC_ENERGY_TOKEN_ADDRESS ?? "") as Address;

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
] as const;
