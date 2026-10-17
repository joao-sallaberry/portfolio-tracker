import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { fetchAllPages } from '@/lib/fetch-all-pages';

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

export function useTradeOperations() {
  return useQuery({ queryKey: TRADE_OPERATIONS_KEY, queryFn: fetchAllTradeOperations });
}

export function useDividendEvents() {
  return useQuery({ queryKey: DIVIDEND_EVENTS_KEY, queryFn: fetchAllDividendEvents });
}
