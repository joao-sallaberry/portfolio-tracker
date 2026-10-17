import { classifyAsset, type AssetClass } from './asset-classifier';
import { parseISODateLocal } from './formatters';
import { applyTradeToCostBasis, EMPTY_COST_BASIS, getAveragePrice, sortTradesByDate } from './portfolio-calculations';

export type TaxGroup = 'Ações e ETFs' | 'FIIs' | 'Isentos';

export const TAX_GROUPS: { label: TaxGroup; rate: number; classes: AssetClass[] }[] = [
  { label: 'Ações e ETFs', rate: 0.15, classes: ['Ação', 'ETF'] },
  { label: 'FIIs', rate: 0.20, classes: ['FII'] },
  { label: 'Isentos', rate: 0, classes: ['FI-Infra', 'FIP'] },
];

/** Monthly stock sales up to this amount have their profit exempt from tax. */
export const MONTHLY_EXEMPTION_LIMIT = 20000;

export interface IrTrade {
  id: string;
  ticker: string;
  trade_date: string;
  movement_type: string;
  quantity: number | string;
  price: number | string;
  total_value: number | string;
  exclude_from_ir?: boolean | null;
}

export interface SaleWithProfit {
  id: string;
  ticker: string;
  trade_date: string;
  quantity: number;
  sale_price: number;
  total_sale_value: number;
  average_price_at_sale: number;
  profit_loss: number;
  tax_due: number;
  month: string;
  year: number;
  excluded_from_ir: boolean;
  /** Economic P&L when excluded_from_ir (display only) */
  economic_profit_loss?: number;
  economic_tax_due?: number;
  /** Sale without book position (quantity would go negative) */
  oversold_position?: boolean;
}

export interface MonthlyTotals {
  month: string;
  year: number;
  monthKey: string;
  total_sales: number;
  total_profit_loss: number;
  total_tax_due: number;
  accumulated_loss: number;
  sales: SaleWithProfit[];
  has_exemption?: boolean;
  total_acao_sales?: number;
  total_acao_profit?: number;
}

export interface IrGrandTotals {
  total_sales: number;
  total_profit_loss: number;
  total_tax_due: number;
  total_exempt_profit: number;
}

/**
 * Sales of one tax group in one year, with profit/loss and tax, grouped by month (ascending).
 * `initialAccumulatedLoss` (≤ 0) seeds the running accumulated loss shown per month.
 */
export function calculateSalesByTaxGroup(
  trades: IrTrade[],
  taxGroup: TaxGroup,
  year: number,
  initialAccumulatedLoss = 0,
): MonthlyTotals[] {
  const groupConfig = TAX_GROUPS.find((g) => g.label === taxGroup);
  if (!groupConfig) return [];

  // Get all unique tickers and filter by the asset classes in this tax group
  const tickersByGroup = [...new Set(trades.map((t) => t.ticker))].filter(
    (ticker) => groupConfig.classes.includes(classifyAsset(ticker))
  );

  // For each ticker, calculate the average price at each sale
  const salesWithProfit: SaleWithProfit[] = [];

  tickersByGroup.forEach((ticker) => {
    let basis = EMPTY_COST_BASIS;

    sortTradesByDate(trades.filter((t) => t.ticker === ticker)).forEach((trade) => {
      const qty = Number(trade.quantity);
      const value = Number(trade.total_value);
      const tradeDate = parseISODateLocal(trade.trade_date);
      const tradeYear = tradeDate?.getFullYear() ?? 0;

      // Calculate average price BEFORE the sale
      const avgPriceBeforeSale = getAveragePrice(basis);

      if (trade.movement_type === 'SELL' && tradeYear === year) {
        // Record the sale with profit/loss calculation
        const salePrice = Number(trade.price);
        const profitLoss = (salePrice - avgPriceBeforeSale) * qty;
        const runningAfterSale = basis.quantity - qty;
        const oversoldPosition = runningAfterSale < 0;

        // Tax rate from group config
        const rawTaxDue = profitLoss > 0 ? profitLoss * groupConfig.rate : 0;
        const taxDue = oversoldPosition ? 0 : rawTaxDue;
        const excludedFromIr = Boolean(trade.exclude_from_ir);

        const month = tradeDate ? tradeDate.toLocaleString('pt-BR', { month: 'long' }) : '';

        salesWithProfit.push({
          id: trade.id,
          ticker,
          trade_date: trade.trade_date,
          quantity: qty,
          sale_price: salePrice,
          total_sale_value: value,
          average_price_at_sale: avgPriceBeforeSale,
          profit_loss: excludedFromIr ? 0 : profitLoss,
          tax_due: excludedFromIr ? 0 : taxDue,
          month,
          year: tradeYear,
          excluded_from_ir: excludedFromIr,
          economic_profit_loss: excludedFromIr ? profitLoss : undefined,
          economic_tax_due: excludedFromIr ? (oversoldPosition ? 0 : rawTaxDue) : undefined,
          oversold_position: oversoldPosition,
        });
      }

      basis = applyTradeToCostBasis(basis, trade);
    });
  });

  // Group by month
  const monthlyMap = new Map<string, MonthlyTotals>();

  salesWithProfit.forEach((sale) => {
    const tradeDate = parseISODateLocal(sale.trade_date);
    const monthKey = tradeDate
      ? `${tradeDate.getFullYear()}-${String(tradeDate.getMonth() + 1).padStart(2, '0')}`
      : '';

    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, {
        month: sale.month,
        year: sale.year,
        monthKey,
        total_sales: 0,
        total_profit_loss: 0,
        total_tax_due: 0,
        accumulated_loss: 0,
        sales: [],
        has_exemption: false,
        total_acao_sales: 0,
        total_acao_profit: 0,
      });
    }

    const monthData = monthlyMap.get(monthKey)!;
    monthData.sales.push(sale);

    if (!sale.excluded_from_ir) {
      monthData.total_sales += sale.total_sale_value;
      monthData.total_profit_loss += sale.profit_loss;
      monthData.total_tax_due += sale.tax_due;

      if (classifyAsset(sale.ticker) === 'Ação') {
        monthData.total_acao_sales! += sale.total_sale_value;
        monthData.total_acao_profit! += sale.profit_loss;
      }
    }
  });

  // Sort sales within each month by date (then id) before tax netting and exemption
  monthlyMap.forEach((monthData) => {
    monthData.sales.sort((a, b) => {
      const dateA = parseISODateLocal(a.trade_date);
      const dateB = parseISODateLocal(b.trade_date);
      const t = (dateA?.getTime() ?? 0) - (dateB?.getTime() ?? 0);
      if (t !== 0) return t;
      return a.id.localeCompare(b.id);
    });
  });

  // Tax is due on the month's consolidated result: gains and losses of all sales in the
  // month offset each other, regardless of their order.
  const taxRate = groupConfig.rate;
  monthlyMap.forEach((monthData) => {
    // Stock profit is exempt when the month's stock sales are up to R$20k
    monthData.has_exemption =
      taxGroup === 'Ações e ETFs' &&
      monthData.total_acao_sales! > 0 &&
      monthData.total_acao_sales! <= MONTHLY_EXEMPTION_LIMIT &&
      monthData.total_acao_profit! > 0;

    const taxableSales = monthData.sales.filter(
      (sale) => !sale.excluded_from_ir && !(monthData.has_exemption && classifyAsset(sale.ticker) === 'Ação')
    );

    // Oversold sales (missing purchase history) can reduce the base, but their gains are never taxed
    const taxBase = Math.max(
      0,
      taxableSales.reduce((sum, sale) => sum + (sale.oversold_position ? Math.min(0, sale.profit_loss) : sale.profit_loss), 0)
    );
    const monthTax = taxBase * taxRate;

    // Spread the month's tax over the taxed gains, so the per-sale column adds up to the month total
    const taxedGains = taxableSales.filter((sale) => !sale.oversold_position && sale.profit_loss > 0);
    const totalTaxedGains = taxedGains.reduce((sum, sale) => sum + sale.profit_loss, 0);
    monthData.sales.forEach((sale) => {
      sale.tax_due = 0;
    });
    taxedGains.forEach((sale) => {
      sale.tax_due = totalTaxedGains > 0 ? monthTax * (sale.profit_loss / totalTaxedGains) : 0;
    });
    monthData.total_tax_due = monthTax;
  });

  // Sort by month and calculate accumulated loss
  const sortedMonths = Array.from(monthlyMap.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  // Calculate accumulated loss from the beginning of the year, starting with initial loss
  let accumulatedLoss = initialAccumulatedLoss;
  sortedMonths.forEach((monthData) => {
    let effectiveProfitForLossCalc = monthData.total_profit_loss;

    if (monthData.has_exemption && monthData.total_acao_profit! > 0) {
      effectiveProfitForLossCalc -= monthData.total_acao_profit!;
    }

    accumulatedLoss += effectiveProfitForLossCalc;
    // Only losses are tracked: a positive balance resets to zero
    monthData.accumulated_loss = accumulatedLoss < 0 ? accumulatedLoss : 0;
    if (accumulatedLoss > 0) {
      accumulatedLoss = 0;
    }
  });

  return sortedMonths;
}

export function calculateGrandTotals(months: MonthlyTotals[]): IrGrandTotals {
  return months.reduce(
    (acc, month) => ({
      total_sales: acc.total_sales + month.total_sales,
      total_profit_loss: acc.total_profit_loss + month.total_profit_loss,
      total_tax_due: acc.total_tax_due + month.total_tax_due,
      total_exempt_profit: acc.total_exempt_profit + (month.has_exemption ? (month.total_acao_profit || 0) : 0),
    }),
    { total_sales: 0, total_profit_loss: 0, total_tax_due: 0, total_exempt_profit: 0 }
  );
}
