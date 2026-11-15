import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ASSET_CLASSES, classifyAsset, type AssetClass } from './asset-classifier';
import { parseISODateLocal } from './formatters';

/** Value of a select filter that matches everything. */
export const ALL = 'all';

export interface DateRange {
  startDate?: Date;
  endDate?: Date;
}

export type DatePreset =
  | 'all'
  | 'current_month'
  | 'last_month'
  | 'current_year'
  | 'last_year'
  | 'past_year'
  | 'past_5_years';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig<K extends string = string> {
  key: K;
  direction: SortDirection;
}

/** Distinct values, sorted. */
export function uniqueSorted<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort();
}

/** Rows whose date can't be parsed only match when no date bound is set. */
function inDateRange(isoDate: string, { startDate, endDate }: DateRange): boolean {
  if (!startDate && !endDate) return true;
  const date = parseISODateLocal(isoDate);
  if (!date) return false;
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
}

function matches(filter: string, value: string): boolean {
  return filter === ALL || filter === value;
}

/** Date range of a period shortcut, relative to `now`. */
export function getDatePresetRange(preset: DatePreset, now: Date = new Date()): DateRange {
  const year = now.getFullYear();
  const month = now.getMonth();
  const yearsAgo = (years: number) => {
    const start = new Date(now);
    start.setFullYear(year - years);
    return start;
  };

  switch (preset) {
    case 'current_month':
      return { startDate: new Date(year, month, 1), endDate: new Date(year, month + 1, 0, 23, 59, 59) };
    case 'last_month':
      return { startDate: new Date(year, month - 1, 1), endDate: new Date(year, month, 0, 23, 59, 59) };
    case 'current_year':
      return { startDate: new Date(year, 0, 1), endDate: new Date(year, 11, 31, 23, 59, 59) };
    case 'last_year':
      return { startDate: new Date(year - 1, 0, 1), endDate: new Date(year - 1, 11, 31, 23, 59, 59) };
    case 'past_year':
      return { startDate: yearsAgo(1), endDate: now };
    case 'past_5_years':
      return { startDate: yearsAgo(5), endDate: now };
    case 'all':
      return {};
  }
}

// ---------------------------------------------------------------------------
// Negociações
// ---------------------------------------------------------------------------

export interface FilterableTrade {
  ticker: string;
  trade_date: string;
  movement_type: string;
  total_value: number | string;
}

export interface TradeFilters extends DateRange {
  movementType: string;
  ticker: string;
  assetClass: string;
}

export function filterTrades<T extends FilterableTrade>(trades: T[], filters: TradeFilters): T[] {
  return trades.filter((t) =>
    inDateRange(t.trade_date, filters) &&
    matches(filters.movementType, t.movement_type) &&
    matches(filters.ticker, t.ticker) &&
    matches(filters.assetClass, classifyAsset(t.ticker))
  );
}

/** Money in (buys and bonuses) and out (sales and amortizations) of a list of trades. */
export function sumTradeTotals(trades: FilterableTrade[]): { buys: number; sells: number } {
  let buys = 0;
  let sells = 0;
  for (const t of trades) {
    if (t.movement_type === 'BUY' || t.movement_type === 'BONUS') buys += Number(t.total_value);
    else if (t.movement_type === 'SELL' || t.movement_type === 'AMORTIZATION') sells += Number(t.total_value);
  }
  return { buys, sells };
}

// ---------------------------------------------------------------------------
// Proventos
// ---------------------------------------------------------------------------

export interface FilterableDividend {
  ticker: string;
  payment_date: string;
  event_type: string;
  institution?: string | null;
  quantity: number | string;
  unit_price: number | string;
  net_value: number | string;
}

export interface DividendFilters extends DateRange {
  eventType: string;
  ticker: string;
  assetClass: string;
}

export type DividendSortKey =
  | 'payment_date'
  | 'ticker'
  | 'assetClass'
  | 'event_type'
  | 'institution'
  | 'quantity'
  | 'unit_price'
  | 'net_value';

export function filterDividends<T extends FilterableDividend>(dividends: T[], filters: DividendFilters): T[] {
  return dividends.filter((d) =>
    inDateRange(d.payment_date, filters) &&
    matches(filters.eventType, d.event_type) &&
    matches(filters.ticker, d.ticker) &&
    matches(filters.assetClass, classifyAsset(d.ticker))
  );
}

function dividendSortValue(d: FilterableDividend, key: DividendSortKey): string | number {
  switch (key) {
    case 'assetClass':
      return classifyAsset(d.ticker);
    case 'quantity':
    case 'unit_price':
    case 'net_value':
      return Number(d[key]);
    case 'institution':
      return d.institution ?? '';
    default:
      // YYYY-MM-DD dates sort correctly as strings
      return d[key];
  }
}

/** Sorted copy (stable); without a sort config the input order is kept. */
export function sortDividends<T extends FilterableDividend>(dividends: T[], sort: SortConfig<DividendSortKey> | null): T[] {
  if (!sort) return dividends;
  const sign = sort.direction === 'asc' ? 1 : -1;
  return [...dividends].sort((a, b) => {
    const aValue = dividendSortValue(a, sort.key);
    const bValue = dividendSortValue(b, sort.key);
    if (aValue < bValue) return -sign;
    if (aValue > bValue) return sign;
    return 0;
  });
}

/** Clicking a column sorts it ascending; clicking it again flips to descending. */
export function nextSortConfig<K extends string>(current: SortConfig<K> | null, key: K): SortConfig<K> {
  const direction = current?.key === key && current.direction === 'asc' ? 'desc' : 'asc';
  return { key, direction };
}

export function sumNetValue(dividends: FilterableDividend[], year?: number): number {
  return dividends
    .filter((d) => year === undefined || parseISODateLocal(d.payment_date)?.getFullYear() === year)
    .reduce((sum, d) => sum + Number(d.net_value), 0);
}

export type MonthlyDividendsRow = { month: string } & Partial<Record<AssetClass, number>>;

/**
 * Net value per month (oldest first) and asset class, for the stacked chart. Classes without
 * dividends in a month are left out of that row, so the tooltip skips them.
 */
export function monthlyDividendsByAssetClass(dividends: FilterableDividend[]): MonthlyDividendsRow[] {
  const byMonth = new Map<string, Record<AssetClass, number>>();

  for (const d of dividends) {
    const monthKey = d.payment_date.slice(0, 7);
    if (!byMonth.has(monthKey)) {
      byMonth.set(monthKey, Object.fromEntries(ASSET_CLASSES.map((c) => [c, 0])) as Record<AssetClass, number>);
    }
    byMonth.get(monthKey)![classifyAsset(d.ticker)] += Number(d.net_value);
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, values]) => {
      const [year, month] = monthKey.split('-').map(Number);
      return {
        month: format(new Date(year, month - 1, 1), 'MMM/yy', { locale: ptBR }),
        ...Object.fromEntries(Object.entries(values).filter(([, value]) => value !== 0)),
      };
    });
}
