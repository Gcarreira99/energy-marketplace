import { Controller, Get, Param, Post } from "@nestjs/common";
import { SimulationService } from "../services/simulation.service";

@Controller("simulation")
export class SimulationController {
  constructor(private readonly simulation: SimulationService) {}

  @Get("state")
  getState() {
    return this.simulation.getState();
  }

  @Get("history")
  getHistory() {
    return this.simulation.getHistory();
  }

  @Post("households/:householdId/claim")
  claim(@Param("householdId") householdId: string) {
    return this.simulation.claim(householdId);
  }
}
