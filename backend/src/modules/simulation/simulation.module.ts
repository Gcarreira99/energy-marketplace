import { Module } from "@nestjs/common";
import { SimulationController } from "./controllers/simulation.controller";
import { EnergyMinterService } from "./services/energy-minter.service";
import { SimulationService } from "./services/simulation.service";

@Module({
  controllers: [SimulationController],
  providers: [SimulationService, EnergyMinterService],
})
export class SimulationModule {}
