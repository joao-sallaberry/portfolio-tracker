// SPDX-License-Identifier: AGPL-3.0-or-later

import tickerChangesRaw from '@/data/ticker-changes.csv?raw';

/**
 * Ticker changes (renames, fund mergers): the rows stay in the database as imported, so re-imports
 * still deduplicate, and are mapped to the current ticker when read. `factor` is how many new
 * shares each old share became (1 for a plain rename).
 */
export interface TickerChange {
  from: string;
  to: string;
  factor: number;
}

export function parseTickerChanges(csv: string): Map<string, TickerChange> {
  const changes = new Map<string, TickerChange>();
  for (const line of csv.trim().split('\n').slice(1)) {
    const [from, to, factor] = line.split(';').map((c) => c.trim());
    if (!from || !to) continue;
    const parsed = Number((factor || '1').replace(',', '.'));
    changes.set(from.toUpperCase(), { from: from.toUpperCase(), to: to.toUpperCase(), factor: parsed > 0 ? parsed : 1 });
  }
  return changes;
}

const TICKER_CHANGES = parseTickerChanges(tickerChangesRaw);

/** Current ticker and the share factor from `ticker` to it, following chains (A → B → C). */
export function resolveTicker(ticker: string, changes = TICKER_CHANGES): { ticker: string; factor: number } {
  let current = ticker;
  let factor = 1;
  const seen = new Set<string>();
  for (let change = changes.get(current); change && !seen.has(current); change = changes.get(current)) {
    seen.add(current);
    current = change.to;
    factor *= change.factor;
  }
  return { ticker: current, factor };
}

interface MappableTrade {
  ticker: string;
  quantity: number | string;
  price: number | string;
}

/**
 * The trade under its current ticker, quantity × factor and price ÷ factor (the value is kept).
 * A mapped row keeps the stored one in `original`, which is what edits must start from.
 */
export function applyTickerChange<T extends MappableTrade>(trade: T, changes = TICKER_CHANGES): T & { original?: T } {
  const { ticker, factor } = resolveTicker(trade.ticker, changes);
  if (ticker === trade.ticker) return trade;
  return {
    ...trade,
    ticker,
    quantity: Number(trade.quantity) * factor,
    price: Number(trade.price) / factor,
    original: trade,
  };
}

/** The dividend under its current ticker; `original_ticker` keeps the stored one. */
export function applyTickerChangeToDividend<T extends { ticker: string }>(
  dividend: T,
  changes = TICKER_CHANGES,
): T & { original_ticker?: string } {
  const { ticker } = resolveTicker(dividend.ticker, changes);
  return ticker === dividend.ticker ? dividend : { ...dividend, ticker, original_ticker: dividend.ticker };
}
