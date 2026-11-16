// SPDX-License-Identifier: AGPL-3.0-or-later

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ASSET_CLASSES, classifyAsset, type AssetClass } from './asset-classifier';
import { parseISODateLocal } from './formatters';
import { TAX_GROUPS, calculateGrandTotals, calculateSalesByTaxGroup, type IrTrade, type TaxGroup } from './ir-calculations';
import { sortTradesByDate, type Position } from './portfolio-calculations';

// Aggregations behind the Visão Geral page.

export interface DashboardDividend {
  ticker: string;
  payment_date: string;
  net_value: number | string;
}

const yearOf = (isoDate: string) => parseISODateLocal(isoDate)?.getFullYear();

/** Years that have a trade or a dividend, most recent first. */
export function getActivityYears(
  trades: Pick<IrTrade, 'trade_date'>[],
  dividends: Pick<DashboardDividend, 'payment_date'>[],
): number[] {
  const years = new Set<number>();
  for (const t of trades) {
    const year = yearOf(t.trade_date);
    if (year !== undefined) years.add(year);
  }
  for (const d of dividends) {
    const year = yearOf(d.payment_date);
    if (year !== undefined) years.add(year);
  }
  return [...years].sort((a, b) => b - a);
}

/** Total and number of dividend payments, optionally of one year. */
export function sumDividends(dividends: DashboardDividend[], year?: number): { total: number; count: number } {
  let total = 0;
  let count = 0;
  for (const d of dividends) {
    if (year !== undefined && yearOf(d.payment_date) !== year) continue;
    total += Number(d.net_value);
    count += 1;
  }
  return { total, count };
}

/** Date of the first dividend payment (YYYY-MM-DD), or null without dividends. */
export function firstPaymentDate(dividends: Pick<DashboardDividend, 'payment_date'>[]): string | null {
  let first: string | null = null;
  for (const d of dividends) {
    if (parseISODateLocal(d.payment_date) && (first === null || d.payment_date < first)) first = d.payment_date;
  }
  return first;
}

export type MonthlyClassDividends = {
  /** YYYY-MM */
  monthKey: string;
  /** Short month name ("jun") */
  label: string;
  /** Month and year ("jun/25") */
  fullLabel: string;
  total: number;
} & Partial<Record<AssetClass, number>>;

/**
 * Dividends of each of the 12 calendar months ending in `now`'s month, oldest first, split by
 * asset class. Months without dividends are kept (total 0); a class without dividends in a month
 * is left out of that row, so the chart draws no bar segment for it.
 */
export function lastTwelveMonthsDividends(dividends: DashboardDividend[], now: Date = new Date()): MonthlyClassDividends[] {
  const months: MonthlyClassDividends[] = [];
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      monthKey: format(date, 'yyyy-MM'),
      label: format(date, 'MMM', { locale: ptBR }),
      fullLabel: format(date, 'MMM/yy', { locale: ptBR }),
      total: 0,
    });
  }
  const byKey = new Map(months.map((m) => [m.monthKey, m]));

  for (const d of dividends) {
    const month = byKey.get(d.payment_date.slice(0, 7));
    if (!month || !parseISODateLocal(d.payment_date)) continue;
    const assetClass = classifyAsset(d.ticker);
    const value = Number(d.net_value);
    month[assetClass] = (month[assetClass] ?? 0) + value;
    month.total += value;
  }
  return months;
}

export interface ClassAllocation {
  assetClass: AssetClass;
  /** Cost of the class's positions */
  value: number;
  /** Share of the whole portfolio's cost (0 when the portfolio costs nothing) */
  share: number;
  positions: number;
}

/** Cost of the current positions per asset class, in ASSET_CLASSES order. */
export function allocationByClass(positions: Position[]): ClassAllocation[] {
  const total = positions.reduce((sum, p) => sum + p.totalValue, 0);
  return ASSET_CLASSES.map((assetClass) => {
    const ofClass = positions.filter((p) => p.assetClass === assetClass);
    const value = ofClass.reduce((sum, p) => sum + p.totalValue, 0);
    return { assetClass, value, share: total > 0 ? value / total : 0, positions: ofClass.length };
  });
}

export interface TopPayer {
  ticker: string;
  assetClass: AssetClass;
  value: number;
}

/** Tickers that paid the most dividends, largest first. */
export function topPayers(dividends: DashboardDividend[], limit = 5): TopPayer[] {
  const byTicker = new Map<string, number>();
  for (const d of dividends) byTicker.set(d.ticker, (byTicker.get(d.ticker) ?? 0) + Number(d.net_value));
  return [...byTicker.entries()]
    .map(([ticker, value]) => ({ ticker, assetClass: classifyAsset(ticker), value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

/** The latest trades and corporate events, most recent first (same-day rows: last stored first). */
export function recentMovements<T extends Pick<IrTrade, 'trade_date'>>(trades: T[], limit = 5): T[] {
  return sortTradesByDate(trades).reverse().slice(0, limit);
}

/**
 * Income tax due in a year over every tax group, as on the IR page: `initialLoss` gives the loss
 * (≤ 0) each group carried into the year.
 */
export function taxDueInYear(trades: IrTrade[], year: number, initialLoss: (group: TaxGroup) => number): number {
  return TAX_GROUPS.reduce(
    (sum, group) =>
      sum + calculateGrandTotals(calculateSalesByTaxGroup(trades, group.label, year, initialLoss(group.label))).total_tax_due,
    0,
  );
}
