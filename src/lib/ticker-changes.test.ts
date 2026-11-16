// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';
import { applyTickerChange, applyTickerChangeToDividend, parseTickerChanges, resolveTicker } from './ticker-changes';
import { calculatePositions } from './portfolio-calculations';
import { classifyAsset } from './asset-classifier';
import tickerChangesRaw from '@/data/ticker-changes.csv?raw';

const changes = parseTickerChanges('antigo;novo;fator\nAAAA3;BBBB3;1\nBBBB3;CCCC3;0,5\nOLD11;NEW11;\n');

const trade = (id: string, ticker: string, trade_date: string, movement_type: string, quantity: number, price: number) => ({
  id,
  ticker,
  trade_date,
  movement_type,
  quantity,
  price,
  total_value: quantity * price,
});

describe('ticker changes', () => {
  it('follows chains and multiplies their factors', () => {
    expect(resolveTicker('AAAA3', changes)).toEqual({ ticker: 'CCCC3', factor: 0.5 });
    expect(resolveTicker('OLD11', changes)).toEqual({ ticker: 'NEW11', factor: 1 });
    expect(resolveTicker('PETR4', changes)).toEqual({ ticker: 'PETR4', factor: 1 });
  });

  it('maps a trade, keeping its value and the stored row', () => {
    const stored = trade('1', 'AAAA3', '2024-01-01', 'BUY', 100, 10);
    const mapped = applyTickerChange(stored, changes);
    expect(mapped).toMatchObject({ ticker: 'CCCC3', quantity: 50, price: 20, total_value: 1000 });
    expect(mapped.original).toBe(stored);
    const current = trade('2', 'PETR4', '2024-01-01', 'BUY', 1, 1);
    expect(applyTickerChange(current, changes)).toBe(current);
  });

  it('joins the history of both tickers into one position', () => {
    const positions = calculatePositions(
      [
        trade('1', 'OLD11', '2024-01-01', 'BUY', 10, 100),
        trade('2', 'NEW11', '2025-01-01', 'BUY', 10, 80),
        trade('3', 'NEW11', '2025-06-01', 'SELL', 5, 120),
      ].map((t) => applyTickerChange(t, changes)),
    );
    expect(positions).toHaveLength(1);
    expect(positions[0]).toMatchObject({ ticker: 'NEW11', quantity: 15, avgPrice: 90 });
  });

  it('renames dividends', () => {
    expect(applyTickerChangeToDividend({ ticker: 'OLD11', net_value: 5 }, changes)).toEqual({
      ticker: 'NEW11',
      net_value: 5,
      original_ticker: 'OLD11',
    });
  });

  it('maps LGCP11 to INLG11, a FII', () => {
    expect(resolveTicker('LGCP11')).toEqual({ ticker: 'INLG11', factor: 1 });
    expect(classifyAsset('INLG11')).toBe('FII');
  });

  it('follows the bundled chains with their factors', () => {
    expect(resolveTicker('ELET5')).toEqual({ ticker: 'AXIA3', factor: 1.1 });
    expect(resolveTicker('PRGA3')).toEqual({ ticker: 'MBRF3', factor: 0.8521 });
    expect(resolveTicker('VVAR3')).toEqual({ ticker: 'BHIA3', factor: 1 });
  });

  it('every bundled change ends in a classified ticker, except a BDR, a Fiagro and delisted ones', () => {
    const unclassified = [...parseTickerChanges(tickerChangesRaw).keys()]
      .map((from) => resolveTicker(from).ticker)
      .filter((to) => classifyAsset(to) === 'Outro');
    expect([...new Set(unclassified)].sort()).toEqual(['ENAT3', 'FTCA11', 'INBR32', 'ZAMP3']);
  });
});
