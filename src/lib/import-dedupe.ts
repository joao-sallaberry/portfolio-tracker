/** Business columns that identify a dividend event, ignoring ids and timestamps. */
export const dividendKey = (row: { ticker: string; payment_date: string; event_type: string; quantity: number; net_value: number }) =>
  `${row.ticker}-${row.payment_date}-${row.event_type}-${row.quantity}-${row.net_value}`;

/** Business columns that identify a trade, ignoring ids and timestamps. */
export const tradeKey = (row: { trade_date: string; movement_type: string; ticker: string; quantity: number; total_value: number }) =>
  `${row.trade_date}-${row.movement_type}-${row.ticker}-${row.quantity}-${row.total_value}`;

/**
 * Picks the incoming rows that aren't already stored. Each existing row absorbs one incoming row
 * with the same key, so re-importing a file adds nothing while legitimately identical rows (e.g.
 * two equal trades on the same day) are kept: 3 identical rows in the file against 1 stored
 * inserts 2.
 */
export function rowsToInsert<Existing, Incoming>(
  existing: Existing[],
  incoming: Incoming[],
  // NoInfer: the row types come from the arrays, not from the (narrower) key functions
  existingKey: (row: NoInfer<Existing>) => string,
  incomingKey: (row: NoInfer<Incoming>) => string,
): Incoming[] {
  const available = new Map<string, number>();
  for (const row of existing) {
    const key = existingKey(row);
    available.set(key, (available.get(key) ?? 0) + 1);
  }

  return incoming.filter((row) => {
    const key = incomingKey(row);
    const count = available.get(key) ?? 0;
    if (count > 0) {
      available.set(key, count - 1);
      return false;
    }
    return true;
  });
}
