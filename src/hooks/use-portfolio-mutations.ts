// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TablesUpdate } from '@/integrations/supabase/types';
import type { DividendEventRow, TradeOperationRow } from '@/lib/xlsx-parser';
import { dividendKey, rowsToInsert, tradeKey } from '@/lib/import-dedupe';
import { formatISODateLocal, normalizeTicker } from '@/lib/formatters';
import type { TaxGroup } from '@/lib/ir-calculations';
import {
  DIVIDEND_EVENTS_KEY,
  TRADE_OPERATIONS_KEY,
  fetchAllDividendEvents,
  fetchAllTradeOperations,
} from './use-portfolio-data';

// Every write to the user's data goes through this file, so each one invalidates the cache it changes.

export const IR_INITIAL_LOSSES_KEY = ['ir-initial-losses'] as const;

/** Initial accumulated loss (≤ 0) per tax group and year. */
export type InitialLosses = Record<string, number>;

export const initialLossKey = (group: string, year: string | number) => `${group}-${year}`;

async function currentUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');
  return user.id;
}

export interface InsertCount {
  inserted: number;
  total: number;
}

/** Inserts the dividend events that aren't stored yet. */
async function insertNewDividends(rows: DividendEventRow[], userId: string): Promise<InsertCount> {
  const candidates = rows
    .filter((row) => !row.hasErrors)
    .map((row) => ({
      product_raw: row.productRaw,
      ticker: row.ticker,
      payment_date: row.paymentDate ? formatISODateLocal(row.paymentDate) : '',
      event_type: row.eventType,
      institution: row.institution,
      quantity: row.quantity,
      unit_price: row.unitPrice,
      net_value: row.netValue,
      user_id: userId,
    }));
  // All stored rows, paginated (a plain select stops at 1000 rows)
  const newRows = rowsToInsert(await fetchAllDividendEvents(), candidates, dividendKey, dividendKey);
  if (newRows.length) {
    const { error } = await supabase.from('dividend_events').insert(newRows);
    if (error) throw error;
  }
  return { inserted: newRows.length, total: candidates.length };
}

/** Inserts the trades that aren't stored yet. */
async function insertNewTrades(rows: TradeOperationRow[], userId: string): Promise<InsertCount> {
  const candidates = rows
    .filter((row) => !row.hasErrors)
    .map((row) => ({
      trade_date: row.tradeDate ? formatISODateLocal(row.tradeDate) : '',
      movement_type: row.movementType,
      movement_type_raw: row.movementTypeRaw,
      market: row.market,
      maturity: row.maturity,
      institution: row.institution,
      ticker: row.ticker,
      quantity: row.quantity,
      price: row.price,
      total_value: row.totalValue,
      user_id: userId,
    }));
  const newRows = rowsToInsert(await fetchAllTradeOperations(), candidates, tradeKey, tradeKey);
  if (newRows.length) {
    const { error } = await supabase.from('trade_operations').insert(newRows);
    if (error) throw error;
  }
  return { inserted: newRows.length, total: candidates.length };
}

/**
 * Inserts the parsed rows of an import that aren't stored yet (dividends first, then trades)
 * and refreshes the tables that received rows.
 */
export function useImportRows() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ dividends = [], trades = [] }: { dividends?: DividendEventRow[]; trades?: TradeOperationRow[] }) => {
      const userId = await currentUserId();
      return {
        dividends: await insertNewDividends(dividends, userId),
        trades: await insertNewTrades(trades, userId),
      };
    },
    onSuccess: ({ dividends, trades }) => {
      if (dividends.inserted) queryClient.invalidateQueries({ queryKey: DIVIDEND_EVENTS_KEY });
      if (trades.inserted) queryClient.invalidateQueries({ queryKey: TRADE_OPERATIONS_KEY });
    },
  });
}

/** Deletes all of the user's rows of one table (RLS limits the delete to them). */
export function useClearTable(table: 'dividend_events' | 'trade_operations') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // PostgREST refuses a delete without a filter
      const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: table === 'dividend_events' ? DIVIDEND_EVENTS_KEY : TRADE_OPERATIONS_KEY });
    },
  });
}

export type TradeChanges = Pick<
  TablesUpdate<'trade_operations'>,
  'trade_date' | 'movement_type' | 'movement_type_raw' | 'ticker' | 'institution' | 'quantity' | 'price' | 'total_value' | 'exclude_from_ir'
>;

/** Updates one trade; the ticker is normalized before it is stored. */
export function useUpdateTrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: TradeChanges }) => {
      const payload = changes.ticker === undefined ? changes : { ...changes, ticker: normalizeTicker(changes.ticker) };
      const { error } = await supabase.from('trade_operations').update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRADE_OPERATIONS_KEY });
    },
  });
}

export function useInitialLosses() {
  return useQuery({
    queryKey: IR_INITIAL_LOSSES_KEY,
    queryFn: async (): Promise<InitialLosses> => {
      const { data, error } = await supabase.from('ir_initial_losses').select('tax_group, year, amount');
      if (error) throw error;
      return Object.fromEntries(data.map((row) => [initialLossKey(row.tax_group, row.year), Number(row.amount)]));
    },
  });
}

/** Stores the initial accumulated loss of a tax group and year, updating the cache right away. */
export function useSaveInitialLoss() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ group, year, amount }: { group: TaxGroup; year: number; amount: number }) => {
      const { error } = await supabase.from('ir_initial_losses').upsert(
        { user_id: await currentUserId(), tax_group: group, year, amount, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,tax_group,year' },
      );
      if (error) throw error;
    },
    // The calculation doesn't wait for the round trip
    onMutate: ({ group, year, amount }) => {
      queryClient.setQueryData<InitialLosses>(IR_INITIAL_LOSSES_KEY, (prev) => ({
        ...prev,
        [initialLossKey(group, year)]: amount,
      }));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: IR_INITIAL_LOSSES_KEY });
    },
  });
}
