import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { isAddress } from "ethers";
import {
  DEFAULT_HOUSEHOLDS,
  SimulationEngine,
  SimulationTotals,
} from "../engine/simulation-engine";
import { RealtimeGateway } from "../../realtime/realtime.gateway";
import { EnergyMinterService } from "./energy-minter.service";

// One simulated day at the default 15 minutes per tick.
const HISTORY_LENGTH = 96;

function readPositiveNumber(name: string, fallback: number) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return value;
}

@Injectable()
export class SimulationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SimulationService.name);
  private readonly engine: SimulationEngine;
  private readonly tickMs: number;
  private readonly history: SimulationTotals[] = [];
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly minter: EnergyMinterService,
    private readonly realtime: RealtimeGateway,
  ) {
    this.tickMs = readPositiveNumber("SIMULATION_TICK_MS", 10_000);
    const homeWallet = process.env.SIMULATION_HOME_WALLET ?? null;
    if (homeWallet !== null && !isAddress(homeWallet)) {
      throw new Error("SIMULATION_HOME_WALLET must be an address");
    }

    // Start at sunrise so a fresh run shows generation straight away.
    const startTime = new Date();
    startTime.setUTCHours(6, 0, 0, 0);

    this.engine = new SimulationEngine({
      minutesPerTick: readPositiveNumber("SIMULATION_MINUTES_PER_TICK", 15),
      startTime,
      households: DEFAULT_HOUSEHOLDS.map((household) => ({
        ...household,
        wallet: household.id === "home" ? homeWallet : null,
      })),
    });
  }

  onModuleInit() {
    this.tick();
    this.timer = setInterval(() => this.tick(), this.tickMs);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  getState() {
    return { ...this.engine.snapshot(), mintingEnabled: this.minter.enabled };
  }

  getHistory() {
    return this.history;
  }

  async claim(householdId: string) {
    const household = this.engine.getHousehold(householdId);
    if (!household) throw new NotFoundException("Unknown household");
    if (!household.wallet) {
      throw new UnprocessableEntityException("Household has no wallet to receive tokens");
    }
    if (!this.minter.enabled) {
      throw new ServiceUnavailableException("Minting is not configured");
    }

    const amount = this.engine.withdraw(householdId);
    if (amount === 0) {
      throw new UnprocessableEntityException("Less than 1 kWh of surplus to claim");
    }

    try {
      const txHash = await this.minter.mint(household.wallet, amount);
      this.realtime.broadcast("simulation.tick", this.getState());
      return { householdId, wallet: household.wallet, amount, txHash };
    } catch (error) {
      this.engine.deposit(householdId, amount);
      this.logger.error(`Minting ${amount} ENRG failed`, error as Error);
      throw new ServiceUnavailableException("Minting failed; the surplus was kept");
    }
  }

  private tick() {
    const snapshot = this.engine.tick();
    this.history.push({
      tick: snapshot.tick,
      simulatedTime: snapshot.simulatedTime,
      weather: snapshot.weather,
      generationKw: snapshot.generationKw,
      consumptionKw: snapshot.consumptionKw,
      netKw: snapshot.netKw,
    });
    if (this.history.length > HISTORY_LENGTH) this.history.shift();
    this.realtime.broadcast("simulation.tick", this.getState());
  }
}
