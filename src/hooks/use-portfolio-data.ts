// SPDX-License-Identifier: AGPL-3.0-or-later

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import { applyTickerChange, applyTickerChangeToDividend } from '@/lib/ticker-changes';

export type TradeOperation = Tables<'trade_operations'>;
export type DividendEvent = Tables<'dividend_events'>;

export const TRADE_OPERATIONS_KEY = ['trade-operations'] as const;
export const DIVIDEND_EVENTS_KEY = ['dividend-events'] as const;

/** All of the user's trades (RLS), oldest first. */
export function fetchAllTradeOperations(): Promise<TradeOperation[]> {
  return fetchAllPages((from, to) =>
    supabase
      .from('trade_operations')
      .select('*')
      .order('trade_date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
  );
}

/** All of the user's dividend events (RLS), oldest first. */
export function fetchAllDividendEvents(): Promise<DividendEvent[]> {
  return fetchAllPages((from, to) =>
    supabase
      .from('dividend_events')
      .select('*')
      .order('payment_date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
  );
}

// Pages read the rows under their current ticker (src/data/ticker-changes.csv); the fetch
// functions above return them as stored, for the import's deduplication.
const mapTrades = (trades: TradeOperation[]) => trades.map((t) => applyTickerChange(t));
const mapDividends = (dividends: DividendEvent[]) => dividends.map((d) => applyTickerChangeToDividend(d));

/** All of the user's trades under their current ticker, oldest first; a renamed row keeps the stored one in `original`. */
export function useTradeOperations() {
  return useQuery({ queryKey: TRADE_OPERATIONS_KEY, queryFn: fetchAllTradeOperations, select: mapTrades });
}

/** All of the user's dividend events under their current ticker, oldest first. */
export function useDividendEvents() {
  return useQuery({ queryKey: DIVIDEND_EVENTS_KEY, queryFn: fetchAllDividendEvents, select: mapDividends });
}
