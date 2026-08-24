import { createConfig, http } from "wagmi";
import { hardhat, sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [hardhat, sepolia],
  connectors: [injected()],
  transports: {
    [hardhat.id]: http(process.env.NEXT_PUBLIC_CHAIN === "hardhat" ? process.env.NEXT_PUBLIC_RPC_URL : undefined),
    [sepolia.id]: http(process.env.NEXT_PUBLIC_CHAIN === "sepolia" ? process.env.NEXT_PUBLIC_RPC_URL : undefined),
  },
});
