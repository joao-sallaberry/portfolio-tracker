import { classifyAsset } from './asset-classifier';
import { parseISODateLocal } from './formatters';

export interface TradeForCalculation {
  ticker: string;
  quantity: number | string;
  total_value: number | string;
  movement_type: string;
  trade_date: string | Date;
}

export interface Position {
  ticker: string;
  assetClass: string;
  quantity: number;
  avgPrice: number;
  totalValue: number;
}

/** Running quantity and total cost of a single ticker (weighted average cost method). */
export interface CostBasis {
  quantity: number;
  totalCost: number;
}

export const EMPTY_COST_BASIS: CostBasis = { quantity: 0, totalCost: 0 };

type CostBasisTrade = Pick<TradeForCalculation, 'quantity' | 'total_value' | 'movement_type'>;
type DatedCostBasisTrade = CostBasisTrade & Pick<TradeForCalculation, 'trade_date'>;

function tradeTime(date: string | Date): number {
  if (date instanceof Date) return date.getTime();
  return parseISODateLocal(date)?.getTime() ?? 0;
}

/** Returns a copy sorted by trade date ascending (stable: same-day trades keep input order). */
export function sortTradesByDate<T extends Pick<TradeForCalculation, 'trade_date'>>(trades: T[]): T[] {
  return [...trades].sort((a, b) => tradeTime(a.trade_date) - tradeTime(b.trade_date));
}

export function getAveragePrice(basis: CostBasis): number {
  return basis.quantity > 0 ? basis.totalCost / basis.quantity : 0;
}

/**
 * Applies one trade to a cost basis and returns the new state.
 * - BUY / BONUS: add quantity and cost
 * - SELL: remove quantity at the current average price (average price unchanged)
 * - AMORTIZATION: reduce cost, keep quantity
 * - SPLIT / REVERSE_SPLIT: change quantity, keep cost (average price is diluted/concentrated)
 * A SELL or REVERSE_SPLIT that takes the quantity to zero or below resets the position.
 */
export function applyTradeToCostBasis(basis: CostBasis, trade: CostBasisTrade): CostBasis {
  const qty = Number(trade.quantity);
  const value = Number(trade.total_value);
  let { quantity, totalCost } = basis;

  switch (trade.movement_type) {
    case 'BUY':
    case 'BONUS':
      quantity += qty;
      totalCost += value;
      break;
    case 'SELL': {
      const avgPrice = getAveragePrice(basis);
      quantity -= qty;
      if (quantity <= 0) return { ...EMPTY_COST_BASIS };
      totalCost = avgPrice * quantity;
      break;
    }
    case 'AMORTIZATION':
      totalCost -= value;
      break;
    case 'SPLIT':
      quantity += qty;
      break;
    case 'REVERSE_SPLIT':
      quantity -= qty;
      if (quantity <= 0) return { ...EMPTY_COST_BASIS };
      break;
    default:
      return basis;
  }

  return { quantity, totalCost };
}

/** Cost basis of a single ticker's trades (sorted by date before being applied). */
export function calculateCostBasis(trades: DatedCostBasisTrade[]): CostBasis {
  return sortTradesByDate(trades).reduce(applyTradeToCostBasis, EMPTY_COST_BASIS);
}

export function calculatePositions(trades: TradeForCalculation[] | null | undefined): Position[] {
  const basisByTicker = new Map<string, CostBasis>();

  for (const trade of sortTradesByDate(trades ?? [])) {
    const current = basisByTicker.get(trade.ticker) ?? EMPTY_COST_BASIS;
    basisByTicker.set(trade.ticker, applyTradeToCostBasis(current, trade));
  }

  return Array.from(basisByTicker.entries())
    .map(([ticker, basis]) => ({
      ticker,
      assetClass: classifyAsset(ticker),
      quantity: basis.quantity,
      avgPrice: getAveragePrice(basis),
      totalValue: basis.totalCost,
    }))
    .filter((p) => p.quantity > 0)
    .sort((a, b) => b.totalValue - a.totalValue);
}
