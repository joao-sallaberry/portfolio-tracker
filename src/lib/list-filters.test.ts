// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';
import {
  ALL,
  filterDividends,
  filterTrades,
  getDatePresetRange,
  monthlyDividendsByAssetClass,
  nextSortConfig,
  sortDividends,
  sumNetValue,
  sumTradeTotals,
  uniqueSorted,
  type DividendFilters,
  type TradeFilters,
} from './list-filters';

const trade = (ticker: string, trade_date: string, movement_type: string, total_value: number) => ({
  ticker,
  trade_date,
  movement_type,
  total_value,
});

const dividend = (ticker: string, payment_date: string, net_value: number, extra = {}) => ({
  ticker,
  payment_date,
  event_type: 'Dividendo',
  institution: 'XP',
  quantity: 100,
  unit_price: net_value / 100,
  net_value,
  ...extra,
});

const noTradeFilters: TradeFilters = { movementType: ALL, ticker: ALL, assetClass: ALL };
const noDividendFilters: DividendFilters = { eventType: ALL, ticker: ALL, assetClass: ALL };

describe('uniqueSorted', () => {
  it('returns distinct values in order', () => {
    expect(uniqueSorted(['VALE3', 'PETR4', 'VALE3'])).toEqual(['PETR4', 'VALE3']);
  });
});

describe('getDatePresetRange', () => {
  const now = new Date(2025, 2, 15, 10, 0, 0); // 15/03/2025

  it('covers whole calendar months and years in local time', () => {
    expect(getDatePresetRange('current_month', now)).toEqual({
      startDate: new Date(2025, 2, 1),
      endDate: new Date(2025, 2, 31, 23, 59, 59),
    });
    expect(getDatePresetRange('last_month', now)).toEqual({
      startDate: new Date(2025, 1, 1),
      endDate: new Date(2025, 1, 28, 23, 59, 59),
    });
    expect(getDatePresetRange('last_year', now)).toEqual({
      startDate: new Date(2024, 0, 1),
      endDate: new Date(2024, 11, 31, 23, 59, 59),
    });
  });

  it('counts rolling periods back from now', () => {
    expect(getDatePresetRange('past_5_years', now)).toEqual({ startDate: new Date(2020, 2, 15, 10, 0, 0), endDate: now });
  });

  it('has no bounds for the whole period', () => {
    expect(getDatePresetRange('all', now)).toEqual({});
  });
});

describe('filterTrades', () => {
  const trades = [
    trade('PETR4', '2025-01-31', 'BUY', 1000),
    trade('HGLG11', '2025-02-01', 'SELL', 500),
    trade('PETR4', '2025-03-01', 'SELL', 700),
  ];

  it('keeps trades on the boundary dates of the range', () => {
    const result = filterTrades(trades, {
      ...noTradeFilters,
      startDate: new Date(2025, 0, 31),
      endDate: new Date(2025, 1, 1),
    });
    expect(result.map((t) => t.trade_date)).toEqual(['2025-01-31', '2025-02-01']);
  });

  it('drops rows with an unparsable date only when a date bound is set', () => {
    const withBadDate = [...trades, trade('PETR4', '', 'BUY', 1)];
    expect(filterTrades(withBadDate, noTradeFilters)).toHaveLength(4);
    expect(filterTrades(withBadDate, { ...noTradeFilters, endDate: new Date(2030, 0, 1) })).toHaveLength(3);
  });

  it('combines type, ticker and asset class filters', () => {
    expect(filterTrades(trades, { ...noTradeFilters, movementType: 'SELL' })).toHaveLength(2);
    expect(filterTrades(trades, { ...noTradeFilters, movementType: 'SELL', ticker: 'PETR4' })).toHaveLength(1);
    expect(filterTrades(trades, { ...noTradeFilters, assetClass: 'FII' }).map((t) => t.ticker)).toEqual(['HGLG11']);
  });
});

describe('sumTradeTotals', () => {
  it('counts bonuses as money in and amortizations as money out, ignoring splits', () => {
    expect(sumTradeTotals([
      trade('PETR4', '2025-01-01', 'BUY', 1000),
      trade('PETR4', '2025-01-02', 'BONUS', '50' as unknown as number),
      trade('PETR4', '2025-01-03', 'SELL', 300),
      trade('PETR4', '2025-01-04', 'AMORTIZATION', 20),
      trade('PETR4', '2025-01-05', 'SPLIT', 0),
    ])).toEqual({ buys: 1050, sells: 320 });
  });
});

describe('dividends', () => {
  const dividends = [
    dividend('PETR4', '2024-12-20', 100),
    dividend('HGLG11', '2025-01-15', 50, { event_type: 'Rendimento', institution: null }),
    dividend('PETR4', '2025-01-20', 30),
  ];

  it('filters by event type, ticker and asset class', () => {
    expect(filterDividends(dividends, { ...noDividendFilters, eventType: 'Rendimento' })).toHaveLength(1);
    expect(filterDividends(dividends, { ...noDividendFilters, ticker: 'PETR4', startDate: new Date(2025, 0, 1) })).toHaveLength(1);
    expect(filterDividends(dividends, { ...noDividendFilters, assetClass: 'Ação' })).toHaveLength(2);
  });

  it('sorts numbers numerically, missing institutions first, and keeps order without a sort', () => {
    const byValue = sortDividends(dividends, { key: 'net_value', direction: 'desc' });
    expect(byValue.map((d) => d.net_value)).toEqual([100, 50, 30]);
    expect(sortDividends(dividends, { key: 'institution', direction: 'asc' })[0].ticker).toBe('HGLG11');
    expect(sortDividends(dividends, { key: 'assetClass', direction: 'asc' })[0].ticker).toBe('PETR4');
    expect(sortDividends(dividends, null)).toBe(dividends);
  });

  it('sorts a column ascending first and flips it on the second click', () => {
    const first = nextSortConfig(null, 'ticker');
    expect(first).toEqual({ key: 'ticker', direction: 'asc' });
    expect(nextSortConfig(first, 'ticker')).toEqual({ key: 'ticker', direction: 'desc' });
    expect(nextSortConfig({ key: 'ticker', direction: 'desc' }, 'ticker')).toEqual({ key: 'ticker', direction: 'asc' });
    expect(nextSortConfig(first, 'net_value')).toEqual({ key: 'net_value', direction: 'asc' });
  });

  it('sums net value, optionally for one year', () => {
    expect(sumNetValue(dividends)).toBe(180);
    expect(sumNetValue(dividends, 2025)).toBe(80);
  });

  it('groups net value by month and asset class, leaving empty classes out', () => {
    expect(monthlyDividendsByAssetClass(dividends)).toEqual([
      { month: 'dez/24', 'Ação': 100 },
      { month: 'jan/25', 'Ação': 30, 'FII': 50 },
    ]);
  });
});
