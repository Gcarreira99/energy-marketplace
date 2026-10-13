export type PricingConfig = {
  baseWeiPerKwh: bigint;
  // Price change per kW of demand above (or below) supply.
  kWeiPerKw: bigint;
};

export type MarketPrice = {
  weiPerKwh: string;
  baseWeiPerKwh: string;
  imbalanceKw: number;
};

// 0.0001 ETH per kWh, moving 0.000003 ETH per kW of imbalance.
export const DEFAULT_PRICING: PricingConfig = {
  baseWeiPerKwh: 100_000_000_000_000n,
  kWeiPerKw: 3_000_000_000_000n,
};

// Keeps a large surplus or shortage from driving the price to zero or runaway.
const FLOOR_DIVISOR = 5n;
const CEILING_MULTIPLIER = 5n;

// The plan's rule: Price = BasePrice + k(Demand - Supply), clamped to a sane band.
export function marketPrice(
  demandKw: number,
  supplyKw: number,
  config: PricingConfig = DEFAULT_PRICING,
): MarketPrice {
  const imbalanceKw = Math.round((demandKw - supplyKw) * 1000) / 1000;
  const imbalanceMilliKw = BigInt(Math.round(imbalanceKw * 1000));
  const raw = config.baseWeiPerKwh + (config.kWeiPerKw * imbalanceMilliKw) / 1000n;
  const floor = config.baseWeiPerKwh / FLOOR_DIVISOR;
  const ceiling = config.baseWeiPerKwh * CEILING_MULTIPLIER;
  const clamped = raw < floor ? floor : raw > ceiling ? ceiling : raw;
  return {
    weiPerKwh: clamped.toString(),
    baseWeiPerKwh: config.baseWeiPerKwh.toString(),
    imbalanceKw,
  };
}
