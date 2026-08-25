import { createConfig, http } from "wagmi";
import { hardhat, sepolia } from "wagmi/chains";
import { injected, mock } from "wagmi/connectors";

const localWalletAddress = process.env.NEXT_PUBLIC_LOCAL_WALLET_ADDRESS as `0x${string}`;
const useLocalWallet = process.env.NEXT_PUBLIC_CHAIN === "hardhat" && process.env.NEXT_PUBLIC_USE_LOCAL_WALLET === "true";

export const wagmiConfig = createConfig({
  chains: [hardhat, sepolia],
  connectors: [
    ...(useLocalWallet ? [mock({ accounts: [localWalletAddress] })] : []),
    injected(),
  ],
  transports: {
    [hardhat.id]: http(process.env.NEXT_PUBLIC_CHAIN === "hardhat" ? process.env.NEXT_PUBLIC_RPC_URL : undefined),
    [sepolia.id]: http(process.env.NEXT_PUBLIC_CHAIN === "sepolia" ? process.env.NEXT_PUBLIC_RPC_URL : undefined),
  },
});
