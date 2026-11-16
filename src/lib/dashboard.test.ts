// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';
import {
  allocationByClass,
  firstPaymentDate,
  getActivityYears,
  lastTwelveMonthsDividends,
  recentMovements,
  sumDividends,
  taxDueInYear,
  topPayers,
} from './dashboard';
import { calculatePositions } from './portfolio-calculations';

const dividend = (ticker: string, payment_date: string, net_value: number) => ({ ticker, payment_date, net_value });

const trade = (id: string, ticker: string, trade_date: string, movement_type: string, quantity: number, price: number) => ({
  id,
  ticker,
  trade_date,
  movement_type,
  quantity,
  price,
  total_value: quantity * price,
});

describe('dividend totals', () => {
  const dividends = [
    dividend('PETR4', '2024-12-31', 10),
    dividend('MXRF11', '2025-01-01', 50),
    dividend('PETR4', '2025-02-15', '7.5' as unknown as number),
  ];

  it('sums all payments or one year, reading day-1 dates in their own year', () => {
    expect(sumDividends(dividends)).toEqual({ total: 67.5, count: 3 });
    expect(sumDividends(dividends, 2025)).toEqual({ total: 57.5, count: 2 });
    expect(sumDividends(dividends, 2023)).toEqual({ total: 0, count: 0 });
  });

  it('finds the first payment', () => {
    expect(firstPaymentDate([dividends[2], dividends[0]])).toBe('2024-12-31');
    expect(firstPaymentDate([])).toBeNull();
  });

  it('lists the years with any activity, latest first', () => {
    expect(getActivityYears([{ trade_date: '2023-05-01' }, { trade_date: '' }], dividends)).toEqual([2025, 2024, 2023]);
  });
});

describe('lastTwelveMonthsDividends', () => {
  it('covers the 12 calendar months up to now, empty ones included, split by class', () => {
    const months = lastTwelveMonthsDividends(
      [
        dividend('PETR4', '2025-03-01', 10),
        dividend('MXRF11', '2025-03-15', 50),
        dividend('PETR4', '2026-02-10', 8),
        dividend('PETR4', '2025-02-28', 99), // before the window
      ],
      new Date(2026, 1, 20),
    );
    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ monthKey: '2025-03', label: 'mar', fullLabel: 'mar/25', total: 60, 'Ação': 10, 'FII': 50 });
    expect(months[1]).toEqual({ monthKey: '2025-04', label: 'abr', fullLabel: 'abr/25', total: 0 });
    expect(months[11]).toMatchObject({ monthKey: '2026-02', total: 8, 'Ação': 8 });
  });
});

describe('allocationByClass', () => {
  it('gives every class its cost and share of the portfolio', () => {
    const positions = calculatePositions([
      trade('1', 'PETR4', '2025-01-01', 'BUY', 100, 30),
      trade('2', 'MXRF11', '2025-01-01', 'BUY', 100, 10),
    ]);
    const allocation = allocationByClass(positions);
    expect(allocation.map((a) => a.assetClass)).toEqual(['Ação', 'FII', 'ETF', 'FI-Infra', 'FIP', 'Outro']);
    expect(allocation[0]).toEqual({ assetClass: 'Ação', value: 3000, share: 0.75, positions: 1 });
    expect(allocation[1]).toEqual({ assetClass: 'FII', value: 1000, share: 0.25, positions: 1 });
    expect(allocation[2]).toEqual({ assetClass: 'ETF', value: 0, share: 0, positions: 0 });
  });

  it('has no shares without positions', () => {
    expect(allocationByClass([]).every((a) => a.share === 0)).toBe(true);
  });
});

describe('topPayers', () => {
  it('ranks tickers by total dividends', () => {
    const payers = topPayers(
      [dividend('PETR4', '2025-01-01', 10), dividend('MXRF11', '2025-01-01', 50), dividend('PETR4', '2025-02-01', 5), dividend('EGIE3', '2025-02-01', 1)],
      2,
    );
    expect(payers).toEqual([
      { ticker: 'MXRF11', assetClass: 'FII', value: 50 },
      { ticker: 'PETR4', assetClass: 'Ação', value: 15 },
    ]);
  });
});

describe('recentMovements', () => {
  it('returns the latest trades first, the last stored first within a day', () => {
    const trades = [
      trade('1', 'PETR4', '2025-01-01', 'BUY', 1, 1),
      trade('2', 'EGIE3', '2025-03-01', 'BUY', 1, 1),
      trade('3', 'ITSA4', '2025-03-01', 'SPLIT', 1, 0),
      trade('4', 'HYPE3', '2025-02-01', 'BUY', 1, 1),
    ];
    expect(recentMovements(trades, 3).map((t) => t.id)).toEqual(['3', '2', '4']);
  });
});

describe('taxDueInYear', () => {
  it('adds the tax of every group, each with its own carried loss', () => {
    const trades = [
      trade('1', 'PETR4', '2025-01-10', 'BUY', 1000, 10),
      trade('2', 'PETR4', '2025-02-10', 'SELL', 1000, 30), // R$ 20.000 gain, sales over R$ 20k
      trade('3', 'MXRF11', '2025-01-10', 'BUY', 100, 10),
      trade('4', 'MXRF11', '2025-02-10', 'SELL', 100, 12), // R$ 200 gain at 20%
    ];
    const losses = { 'Ações e ETFs': -5000, 'FIIs': 0, 'Isentos': 0 };
    expect(taxDueInYear(trades, 2025, (group) => losses[group])).toBeCloseTo(15000 * 0.15 + 200 * 0.2, 2);
    expect(taxDueInYear(trades, 2024, () => 0)).toBe(0);
  });
});
