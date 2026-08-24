import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("EnergyMarketplaceModule", (m) => {
  const energyToken = m.contract("EnergyToken", [m.getAccount(0)]);
  const marketplace = m.contract("Marketplace", [energyToken]);

  return { energyToken, marketplace };
});