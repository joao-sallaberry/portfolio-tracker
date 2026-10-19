import { describe, it, expect } from 'vitest';
import { dividendKey, rowsToInsert, tradeKey } from './import-dedupe';

const key = <T extends { k: string }>(row: T) => row.k;
const rows = (...keys: string[]) => keys.map((k, i) => ({ k, i }));

describe('rowsToInsert', () => {
  it('inserts everything when nothing is stored', () => {
    expect(rowsToInsert([], rows('a', 'a', 'b'), key, key)).toHaveLength(3);
  });

  it('inserts nothing when the same rows are re-imported', () => {
    expect(rowsToInsert(rows('a', 'a', 'b'), rows('a', 'a', 'b'), key, key)).toEqual([]);
  });

  it('keeps identical rows beyond the stored count', () => {
    const result = rowsToInsert(rows('a'), rows('a', 'a', 'a'), key, key);
    expect(result.map((r) => r.i)).toEqual([1, 2]);
  });

  it('only inserts the new rows of an overlapping file', () => {
    const result = rowsToInsert(rows('a', 'b'), rows('b', 'c', 'a', 'd'), key, key);
    expect(result.map((r) => r.k)).toEqual(['c', 'd']);
  });
});

describe('keys', () => {
  it('identify dividends by ticker, date, type, quantity and value', () => {
    expect(dividendKey({ ticker: 'HGLG11', payment_date: '2026-01-15', event_type: 'Rendimento', quantity: 58, net_value: 63.8 }))
      .toBe('HGLG11-2026-01-15-Rendimento-58-63.8');
  });

  it('identify trades by date, type, ticker, quantity and total value', () => {
    expect(tradeKey({ trade_date: '2026-01-19', movement_type: 'SPLIT', ticker: 'RBFF11', quantity: 520, total_value: 0 }))
      .toBe('2026-01-19-SPLIT-RBFF11-520-0');
  });
});
