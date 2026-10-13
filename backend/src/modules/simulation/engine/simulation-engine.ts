export type Weather = "sunny" | "cloudy" | "rainy";

export type HouseholdConfig = {
  id: string;
  name: string;
  solarCapacityKw: number;
  baseLoadKw: number;
  wallet: string | null;
};

export type HouseholdSnapshot = {
  id: string;
  name: string;
  wallet: string | null;
  solarCapacityKw: number;
  generationKw: number;
  consumptionKw: number;
  netKw: number;
  storedKwh: number;
  gridImportKwh: number;
};

export type SimulationTotals = {
  tick: number;
  simulatedTime: string;
  weather: Weather;
  generationKw: number;
  consumptionKw: number;
  netKw: number;
};

export type SimulationSnapshot = SimulationTotals & {
  minutesPerTick: number;
  households: HouseholdSnapshot[];
};

export type SimulationOptions = {
  households: HouseholdConfig[];
  minutesPerTick: number;
  startTime: Date;
  random?: () => number;
};

// The plan's weather rule: sunny days give 30% more solar.
export const WEATHER_SOLAR_FACTOR: Record<Weather, number> = {
  sunny: 1.3,
  cloudy: 0.6,
  rainy: 0.25,
};

// Odds that the weather changes on a tick, and what it changes to.
const WEATHER_CHANGE_CHANCE = 0.05;
const WEATHER_NEXT: Record<Weather, Weather[]> = {
  sunny: ["cloudy"],
  cloudy: ["sunny", "rainy"],
  rainy: ["cloudy"],
};

const SUNRISE_HOUR = 6;
const SUNSET_HOUR = 20;

export const DEFAULT_HOUSEHOLDS: Omit<HouseholdConfig, "wallet">[] = [
  { id: "home", name: "Your home", solarCapacityKw: 6, baseLoadKw: 0.6 },
  { id: "solar-farmhouse", name: "Solar farmhouse", solarCapacityKw: 12, baseLoadKw: 0.9 },
  { id: "rooftop-flat", name: "Rooftop flat", solarCapacityKw: 3, baseLoadKw: 0.4 },
  { id: "family-house", name: "Family house", solarCapacityKw: 4, baseLoadKw: 1.1 },
  { id: "corner-bakery", name: "Corner bakery", solarCapacityKw: 0, baseLoadKw: 1.8 },
  { id: "student-flat", name: "Student flat", solarCapacityKw: 0, baseLoadKw: 0.5 },
];

function round(value: number, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

// Share of peak solar output at a given hour: a sine arc between sunrise and sunset.
export function solarShare(hour: number) {
  if (hour <= SUNRISE_HOUR || hour >= SUNSET_HOUR) return 0;
  return Math.sin(((hour - SUNRISE_HOUR) / (SUNSET_HOUR - SUNRISE_HOUR)) * Math.PI);
}

// Household demand relative to its base load, with morning and evening peaks.
export function demandShare(hour: number) {
  const morningPeak = Math.exp(-((hour - 7.5) ** 2) / 2);
  const eveningPeak = Math.exp(-((hour - 19) ** 2) / 4);
  return 0.6 + 0.8 * morningPeak + 1.2 * eveningPeak;
}

export class SimulationEngine {
  private readonly random: () => number;
  private readonly minutesPerTick: number;
  private readonly households: HouseholdConfig[];
  private readonly state = new Map<string, HouseholdSnapshot>();
  private time: Date;
  private tickCount = 0;
  private weather: Weather = "sunny";

  constructor(options: SimulationOptions) {
    this.random = options.random ?? Math.random;
    this.minutesPerTick = options.minutesPerTick;
    this.households = options.households;
    this.time = new Date(options.startTime);
    for (const household of this.households) {
      this.state.set(household.id, {
        id: household.id,
        name: household.name,
        wallet: household.wallet,
        solarCapacityKw: household.solarCapacityKw,
        generationKw: 0,
        consumptionKw: 0,
        netKw: 0,
        storedKwh: 0,
        gridImportKwh: 0,
      });
    }
  }

  tick(): SimulationSnapshot {
    this.tickCount += 1;
    this.time = new Date(this.time.getTime() + this.minutesPerTick * 60_000);
    this.advanceWeather();

    const hour = this.time.getUTCHours() + this.time.getUTCMinutes() / 60;
    const hours = this.minutesPerTick / 60;
    for (const household of this.households) {
      const current = this.state.get(household.id)!;
      const generationKw = household.solarCapacityKw
        * solarShare(hour)
        * WEATHER_SOLAR_FACTOR[this.weather]
        * this.noise(0.1);
      const consumptionKw = household.baseLoadKw * demandShare(hour) * this.noise(0.15);
      const netKwh = (generationKw - consumptionKw) * hours;
      // A deficit is drawn from the grid once the stored surplus runs out.
      const storedKwh = current.storedKwh + netKwh;

      this.state.set(household.id, {
        ...current,
        generationKw: round(generationKw),
        consumptionKw: round(consumptionKw),
        netKw: round(generationKw - consumptionKw),
        storedKwh: round(Math.max(storedKwh, 0)),
        gridImportKwh: round(current.gridImportKwh + Math.max(-storedKwh, 0)),
      });
    }

    return this.snapshot();
  }

  snapshot(): SimulationSnapshot {
    const households = [...this.state.values()];
    const generationKw = households.reduce((sum, household) => sum + household.generationKw, 0);
    const consumptionKw = households.reduce((sum, household) => sum + household.consumptionKw, 0);
    return {
      tick: this.tickCount,
      simulatedTime: this.time.toISOString(),
      weather: this.weather,
      minutesPerTick: this.minutesPerTick,
      generationKw: round(generationKw),
      consumptionKw: round(consumptionKw),
      netKw: round(generationKw - consumptionKw),
      households,
    };
  }

  getHousehold(id: string) {
    return this.state.get(id);
  }

  // Takes whole kWh out of a household's stored surplus, returning how many were taken.
  withdraw(id: string, maxKwh?: number) {
    const household = this.state.get(id);
    if (!household) return 0;
    const available = Math.floor(household.storedKwh);
    const amount = maxKwh === undefined ? available : Math.min(available, Math.floor(maxKwh));
    if (amount <= 0) return 0;
    this.state.set(id, { ...household, storedKwh: round(household.storedKwh - amount) });
    return amount;
  }

  // Puts energy back, used when turning a withdrawal into tokens fails.
  deposit(id: string, kwh: number) {
    const household = this.state.get(id);
    if (!household) return;
    this.state.set(id, { ...household, storedKwh: round(household.storedKwh + kwh) });
  }

  private advanceWeather() {
    if (this.random() >= WEATHER_CHANGE_CHANCE) return;
    const options = WEATHER_NEXT[this.weather];
    this.weather = options[Math.floor(this.random() * options.length)];
  }

  private noise(spread: number) {
    return 1 - spread + this.random() * spread * 2;
  }
}
