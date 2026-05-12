import { classifyAsset } from './asset-classifier';

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

export function calculatePositions(trades: TradeForCalculation[] | null | undefined): Position[] {
  const positionsMap = new Map<string, { ticker: string; currentQty: number; currentValue: number }>();

  if (trades && trades.length > 0) {
    // Ensure trades are strictly sorted by date
    const sortedTrades = [...trades].sort((a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime());

    for (const trade of sortedTrades) {
      const ticker = trade.ticker;
      if (!positionsMap.has(ticker)) {
        positionsMap.set(ticker, { ticker, currentQty: 0, currentValue: 0 });
      }

      const pos = positionsMap.get(ticker)!;
      const qty = Number(trade.quantity);
      const total = Number(trade.total_value);

      if (trade.movement_type === 'BUY' || trade.movement_type === 'BONUS' || trade.movement_type === 'SPLIT') {
        pos.currentQty += qty;
        pos.currentValue += total;
      } else if (trade.movement_type === 'SELL' || trade.movement_type === 'AMORTIZATION') {
        const avgPrice = pos.currentQty > 0 ? pos.currentValue / pos.currentQty : 0;
        pos.currentQty -= qty;
        pos.currentValue -= (avgPrice * qty);
      } else if (trade.movement_type === 'REVERSE_SPLIT') {
        pos.currentQty -= qty;
      }
    }
  }

  return Array.from(positionsMap.values())
    .map((pos) => {
      const avgPrice = pos.currentQty > 0 ? pos.currentValue / pos.currentQty : 0;
      return {
        ticker: pos.ticker,
        assetClass: classifyAsset(pos.ticker),
        quantity: pos.currentQty,
        avgPrice,
        totalValue: pos.currentValue,
      };
    })
    .filter((p) => p.quantity > 0)
    .sort((a, b) => b.totalValue - a.totalValue);
}
