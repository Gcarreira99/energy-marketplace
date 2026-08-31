/**
 * Pure comparison used to gate on-chain actions (buy/create) before submitting
 * a transaction that would otherwise revert on-chain for insufficient funds.
 * `available` is undefined while the balance read is still loading/unconfigured,
 * which is treated as "not yet known to be sufficient".
 */
export function hasSufficientBalance(required: bigint, available: bigint | undefined): boolean {
  if (available === undefined) return false;
  return available >= required;
}
