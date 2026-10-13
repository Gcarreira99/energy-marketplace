import { Module } from "@nestjs/common";
import { RealtimeModule } from "../realtime/realtime.module";
import { SimulationController } from "./controllers/simulation.controller";
import { EnergyMinterService } from "./services/energy-minter.service";
import { SimulationService } from "./services/simulation.service";

@Module({
  imports: [RealtimeModule],
  controllers: [SimulationController],
  providers: [SimulationService, EnergyMinterService],
})
export class SimulationModule {}
