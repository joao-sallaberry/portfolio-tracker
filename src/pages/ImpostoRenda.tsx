import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDateBR, formatCurrencyBRL, formatNumber, parseISODateLocal } from '@/lib/formatters';
import { classifyAsset, AssetClass } from '@/lib/asset-classifier';
import { cn } from '@/lib/utils';
import { Receipt, Calendar, TrendingUp, TrendingDown, Calculator } from 'lucide-react';

interface PositionSnapshot {
  quantity: number;
  totalValue: number;
  averagePrice: number;
}

interface TradeWithRunning {
  id: string;
  trade_date: string;
  movement_type: string;
  quantity: number;
  price: number;
  total_value: number;
  runningQuantity: number;
  runningAveragePrice: number;
}

interface SaleWithProfit {
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

interface MonthlyTotals {
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

// Tax groups with their tax rates
type TaxGroup = 'Ações e ETFs' | 'FIIs' | 'Isentos';
const TAX_GROUPS: { label: TaxGroup; rate: number; classes: AssetClass[] }[] = [
  { label: 'Ações e ETFs', rate: 0.15, classes: ['Ação', 'ETF'] },
  { label: 'FIIs', rate: 0.20, classes: ['FII'] },
  { label: 'Isentos', rate: 0, classes: ['FI-Infra', 'FIP'] },
];

export default function ImpostoRenda() {
  const [selectedTicker, setSelectedTicker] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedTaxGroup, setSelectedTaxGroup] = useState<TaxGroup>('Ações e ETFs');
  const [selectedSalesYear, setSelectedSalesYear] = useState<string>(new Date().getFullYear().toString());

  // Initial accumulated loss per tax group and year
  const [initialLosses, setInitialLosses] = useState<Record<string, number>>({});
  const [localInputValue, setLocalInputValue] = useState<string>('');

  const getInitialLossKey = (group: TaxGroup, year: string) => `${group}-${year}`;

  const initialAccumulatedLoss = useMemo(() => {
    const key = getInitialLossKey(selectedTaxGroup, selectedSalesYear);
    return initialLosses[key] ?? 0;
  }, [initialLosses, selectedTaxGroup, selectedSalesYear]);

  // Sync local input when the real value changes (e.g. switching years/groups)
  // We only update if the parsed local value differs significantly to avoid cursor jumping if we were editing
  useMemo(() => {
    const formatted = initialAccumulatedLoss === 0 ? '' : formatCurrencyBRL(Math.abs(initialAccumulatedLoss));
    setLocalInputValue(formatted);
  }, [initialAccumulatedLoss]);

  const handleInputChange = (value: string) => {
    setLocalInputValue(value);
  };

  const handleInputBlur = () => {
    const numValue = parseFloat(localInputValue.replace(/[^\d,-]/g, '').replace(',', '.')) || 0;
    // Ensure it's negative or zero (it's a loss)
    const lossValue = numValue > 0 ? -numValue : numValue;
    const key = getInitialLossKey(selectedTaxGroup, selectedSalesYear);

    setInitialLosses(prev => ({ ...prev, [key]: lossValue }));

    // Re-format the display value
    setLocalInputValue(lossValue === 0 ? '' : formatCurrencyBRL(Math.abs(lossValue)));
  };

  const currentYear = new Date().getFullYear();
  const { data: trades, isLoading } = useQuery({
    queryKey: ['trade-operations', 'all', 'v2'],
    queryFn: async () => {
      // Fetch all records using pagination to bypass the 1000 row limit
      const allRecords: any[] = [];
      const pageSize = 1000;
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('trade_operations')
          .select('*')
          .order('trade_date', { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allRecords.push(...data);
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      return allRecords;
    },
  });

  // Get unique tickers sorted alphabetically
  const tickers = useMemo(() => {
    if (!trades) return [];
    const uniqueTickers = [...new Set(trades.map((t) => t.ticker))];
    return uniqueTickers.sort();
  }, [trades]);

  // Get available years from trades
  const availableYears = useMemo(() => {
    if (!trades || !selectedTicker) return [];
    const tickerTrades = trades.filter((t) => t.ticker === selectedTicker);
    const years = new Set(tickerTrades.map((t) => {
      const date = parseISODateLocal(t.trade_date);
      return date ? date.getFullYear() : new Date().getFullYear();
    }));
    return Array.from(years).sort((a, b) => b - a);
  }, [trades, selectedTicker]);

  // Get available years for sales by asset class
  const availableSalesYears = useMemo(() => {
    if (!trades) return [];
    const sales = trades.filter((t) => t.movement_type === 'SELL');
    const years = new Set(sales.map((t) => {
      const date = parseISODateLocal(t.trade_date);
      return date ? date.getFullYear() : new Date().getFullYear();
    }));
    return Array.from(years).sort((a, b) => b - a);
  }, [trades]);

  // Calculate position snapshot at a specific date
  const getPositionAtDate = (endDate: Date): PositionSnapshot => {
    if (!trades || !selectedTicker) {
      return { quantity: 0, totalValue: 0, averagePrice: 0 };
    }

    const tickerTrades = trades
      .filter((t) => {
        const tradeDate = parseISODateLocal(t.trade_date);
        return t.ticker === selectedTicker && tradeDate && tradeDate <= endDate;
      })
      .sort((a, b) => {
        const dateA = parseISODateLocal(a.trade_date);
        const dateB = parseISODateLocal(b.trade_date);
        return (dateA?.getTime() ?? 0) - (dateB?.getTime() ?? 0);
      });

    let runningQuantity = 0;
    let totalCost = 0;

    tickerTrades.forEach((trade) => {
      const qty = Number(trade.quantity);
      const value = Number(trade.total_value);

      if (trade.movement_type === 'BUY' || trade.movement_type === 'BONUS') {
        // BUY and BONUS: increase quantity and total cost
        totalCost += value;
        runningQuantity += qty;
      } else if (trade.movement_type === 'SELL') {
        // SELL: reduce quantity proportionally
        runningQuantity -= qty;
        if (runningQuantity > 0) {
          const avgPrice = totalCost / (runningQuantity + qty);
          totalCost = avgPrice * runningQuantity;
        } else {
          totalCost = 0;
          runningQuantity = 0;
        }
      } else if (trade.movement_type === 'AMORTIZATION') {
        totalCost -= value;
      } else if (trade.movement_type === 'SPLIT') {
        // SPLIT: increase quantity, keep total cost, recalc average price
        runningQuantity += qty;
      } else if (trade.movement_type === 'REVERSE_SPLIT') {
        // REVERSE_SPLIT: decrease quantity, keep total cost, recalc average price
        runningQuantity -= qty;
        if (runningQuantity <= 0) {
          runningQuantity = 0;
          totalCost = 0;
        }
      }
    });

    return {
      quantity: runningQuantity,
      totalValue: totalCost,
      averagePrice: runningQuantity > 0 ? totalCost / runningQuantity : 0,
    };
  };

  // Position snapshots for selected year and previous year
  const yearSnapshots = useMemo(() => {
    if (!selectedYear || !selectedTicker) return null;

    const year = parseInt(selectedYear);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);
    const endOfPrevYear = new Date(year - 1, 11, 31, 23, 59, 59);

    return {
      current: getPositionAtDate(endOfYear),
      previous: getPositionAtDate(endOfPrevYear),
      currentYear: year,
      previousYear: year - 1,
    };
  }, [selectedYear, selectedTicker, trades]);

  // Calculate running quantity and average price for selected ticker
  const tradesWithRunning = useMemo(() => {
    if (!trades || !selectedTicker) return [];

    const tickerTrades = trades
      .filter((t) => t.ticker === selectedTicker)
      .sort((a, b) => {
        const dateA = parseISODateLocal(a.trade_date);
        const dateB = parseISODateLocal(b.trade_date);
        return (dateA?.getTime() ?? 0) - (dateB?.getTime() ?? 0);
      });

    let runningQuantity = 0;
    let totalCost = 0;

    return tickerTrades.map((trade): TradeWithRunning => {
      const qty = Number(trade.quantity);
      const value = Number(trade.total_value);

      if (trade.movement_type === 'BUY' || trade.movement_type === 'BONUS') {
        // BUY and BONUS: increase quantity and total cost
        totalCost += value;
        runningQuantity += qty;
      } else if (trade.movement_type === 'SELL') {
        // SELL: reduce quantity proportionally
        runningQuantity -= qty;
        if (runningQuantity > 0) {
          // Adjust total cost proportionally
          const avgPrice = totalCost / (runningQuantity + qty);
          totalCost = avgPrice * runningQuantity;
        } else {
          totalCost = 0;
          runningQuantity = 0;
        }
      } else if (trade.movement_type === 'AMORTIZATION') {
        totalCost -= value;
      } else if (trade.movement_type === 'SPLIT') {
        // SPLIT: increase quantity, keep total cost
        runningQuantity += qty;
      } else if (trade.movement_type === 'REVERSE_SPLIT') {
        // REVERSE_SPLIT: decrease quantity, keep total cost
        runningQuantity -= qty;
        if (runningQuantity <= 0) {
          runningQuantity = 0;
          totalCost = 0;
        }
      }

      const runningAveragePrice = runningQuantity > 0 ? totalCost / runningQuantity : 0;

      return {
        id: trade.id,
        trade_date: trade.trade_date,
        movement_type: trade.movement_type,
        quantity: qty,
        price: Number(trade.price),
        total_value: value,
        runningQuantity,
        runningAveragePrice,
      };
    });
  }, [trades, selectedTicker]);

  // Get the selected tax group config
  const selectedGroupConfig = useMemo(() => {
    return TAX_GROUPS.find((g) => g.label === selectedTaxGroup) ?? TAX_GROUPS[0];
  }, [selectedTaxGroup]);

  // Calculate sales with profit/loss by tax group, grouped by month
  const salesByTaxGroup = useMemo(() => {
    if (!trades || !selectedTaxGroup || !selectedSalesYear) return [];

    const yearFilter = parseInt(selectedSalesYear);
    const groupConfig = TAX_GROUPS.find((g) => g.label === selectedTaxGroup);
    if (!groupConfig) return [];

    // Get all unique tickers and filter by the asset classes in this tax group
    const tickersByGroup = [...new Set(trades.map((t) => t.ticker))].filter(
      (ticker) => groupConfig.classes.includes(classifyAsset(ticker))
    );

    // For each ticker, calculate the average price at each sale
    const salesWithProfit: SaleWithProfit[] = [];

    tickersByGroup.forEach((ticker) => {
      const tickerTrades = trades
        .filter((t) => t.ticker === ticker)
        .sort((a, b) => {
          const dateA = parseISODateLocal(a.trade_date);
          const dateB = parseISODateLocal(b.trade_date);
          return (dateA?.getTime() ?? 0) - (dateB?.getTime() ?? 0);
        });

      let runningQuantity = 0;
      let totalCost = 0;

      tickerTrades.forEach((trade) => {
        const qty = Number(trade.quantity);
        const value = Number(trade.total_value);
        const tradeDate = parseISODateLocal(trade.trade_date);
        const tradeYear = tradeDate?.getFullYear() ?? 0;

        // Calculate average price BEFORE the sale
        const avgPriceBeforeSale = runningQuantity > 0 ? totalCost / runningQuantity : 0;

        if (trade.movement_type === 'BUY' || trade.movement_type === 'BONUS') {
          totalCost += value;
          runningQuantity += qty;
        } else if (trade.movement_type === 'SELL') {
          // Record the sale with profit/loss calculation
          if (tradeYear === yearFilter) {
            const salePrice = Number(trade.price);
            const profitLoss = (salePrice - avgPriceBeforeSale) * qty;
            const runningAfterSale = runningQuantity - qty;
            const oversoldPosition = runningAfterSale < 0;

            // Tax rate from group config
            const rawTaxDue = profitLoss > 0 ? profitLoss * groupConfig.rate : 0;
            const taxDue = oversoldPosition ? 0 : rawTaxDue;
            const excludedFromIr = Boolean(trade.exclude_from_ir);

            const month = tradeDate ? tradeDate.toLocaleString('pt-BR', { month: 'long' }) : '';
            const year = tradeDate?.getFullYear() ?? 0;

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
              year,
              excluded_from_ir: excludedFromIr,
              economic_profit_loss: excludedFromIr ? profitLoss : undefined,
              economic_tax_due: excludedFromIr ? (oversoldPosition ? 0 : rawTaxDue) : undefined,
              oversold_position: oversoldPosition,
            });
          }

          // Update running values
          runningQuantity -= qty;
          if (runningQuantity > 0) {
            totalCost = avgPriceBeforeSale * runningQuantity;
          } else {
            totalCost = 0;
            runningQuantity = 0;
          }
        } else if (trade.movement_type === 'AMORTIZATION') {
          totalCost -= value;
        } else if (trade.movement_type === 'SPLIT') {
          runningQuantity += qty;
        } else if (trade.movement_type === 'REVERSE_SPLIT') {
          runningQuantity -= qty;
          if (runningQuantity <= 0) {
            runningQuantity = 0;
            totalCost = 0;
          }
        }
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

    // Tax only on profit above month-to-date accumulated P&L (same tax group/year), in chronological order
    const taxRate = groupConfig.rate;
    monthlyMap.forEach((monthData) => {
      let monthCumulativePL = 0;
      for (const sale of monthData.sales) {
        if (sale.excluded_from_ir) continue;
        if (sale.oversold_position) {
          monthCumulativePL += sale.profit_loss;
          continue;
        }
        if (sale.profit_loss > 0 && taxRate > 0) {
          const taxableGain = Math.max(0, Math.min(sale.profit_loss, monthCumulativePL + sale.profit_loss));
          sale.tax_due = taxableGain * taxRate;
        } else {
          sale.tax_due = 0;
        }
        monthCumulativePL += sale.profit_loss;
      }
      monthData.total_tax_due = monthData.sales.reduce((acc, s) => acc + s.tax_due, 0);
    });

    // Check for exemption
    monthlyMap.forEach((monthData) => {
      if (selectedTaxGroup === 'Ações e ETFs' && monthData.total_acao_sales! > 0 && monthData.total_acao_sales! <= 20000 && monthData.total_acao_profit! > 0) {
        monthData.has_exemption = true;
        
        let acaoTaxToRemove = 0;
        monthData.sales.forEach(sale => {
           if (!sale.excluded_from_ir && classifyAsset(sale.ticker) === 'Ação') {
               acaoTaxToRemove += sale.tax_due;
               sale.tax_due = 0; 
           }
        });
        monthData.total_tax_due -= acaoTaxToRemove;
      }
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
      // If accumulated would be positive, set to zero (only track losses)
      monthData.accumulated_loss = accumulatedLoss < 0 ? accumulatedLoss : 0;
      // If there's accumulated loss, update accumulatedLoss to track it
      if (accumulatedLoss > 0) {
        accumulatedLoss = 0;
      }
    });

    return sortedMonths;
  }, [trades, selectedTaxGroup, selectedSalesYear, initialAccumulatedLoss]);

  // Calculate grand totals
  const grandTotals = useMemo(() => {
    return salesByTaxGroup.reduce(
      (acc, month) => ({
        total_sales: acc.total_sales + month.total_sales,
        total_profit_loss: acc.total_profit_loss + month.total_profit_loss,
        total_tax_due: acc.total_tax_due + month.total_tax_due,
        total_exempt_profit: acc.total_exempt_profit + (month.has_exemption ? (month.total_acao_profit || 0) : 0),
      }),
      { total_sales: 0, total_profit_loss: 0, total_tax_due: 0, total_exempt_profit: 0 }
    );
  }, [salesByTaxGroup]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Imposto de Renda</h1>
        <p className="text-muted-foreground">
          Acompanhe as operações, lucros e impostos devidos
        </p>
      </div>

      <Tabs defaultValue="vendas" className="space-y-6">
        <TabsList>
          <TabsTrigger value="vendas">Vendas por Classe</TabsTrigger>
          <TabsTrigger value="ativo">Por Ativo</TabsTrigger>
        </TabsList>

        <TabsContent value="vendas" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Vendas e Impostos por Classe de Ativos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <Select value={selectedTaxGroup} onValueChange={(v) => setSelectedTaxGroup(v as TaxGroup)}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Grupo Tributário" />
                  </SelectTrigger>
                  <SelectContent>
                    {TAX_GROUPS.map((group) => (
                      <SelectItem key={group.label} value={group.label}>
                        {group.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedSalesYear} onValueChange={setSelectedSalesYear}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSalesYears.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap items-end gap-6">
                <p className="text-sm text-muted-foreground">
                  Alíquota de imposto: {selectedGroupConfig.rate === 0 ? 'Isento' : `${(selectedGroupConfig.rate * 100).toFixed(0)}%`} sobre o lucro
                  {selectedGroupConfig.classes.length > 1 && (
                    <span className="ml-2 text-xs">
                      ({selectedGroupConfig.classes.join(', ')})
                    </span>
                  )}
                </p>

                <div className="flex items-center gap-2">
                  <Label htmlFor="initial-loss" className="text-sm text-muted-foreground whitespace-nowrap">
                    Prejuízo acumulado inicial:
                  </Label>
                  <Input
                    id="initial-loss"
                    type="text"
                    placeholder="R$ 0,00"
                    value={localInputValue}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onBlur={handleInputBlur}
                    className="w-36 h-8 text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {salesByTaxGroup.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-muted-foreground text-center">
                  Nenhuma venda encontrada para {selectedTaxGroup} em {selectedSalesYear}.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary Cards */}
              <div className={cn("grid grid-cols-1 gap-4", selectedTaxGroup === 'Ações e ETFs' ? "md:grid-cols-4" : "md:grid-cols-3")}>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium text-muted-foreground">
                      Total de Vendas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{formatCurrencyBRL(grandTotals.total_sales)}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium text-muted-foreground flex items-center gap-2">
                      {grandTotals.total_profit_loss >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      )}
                      Lucro/Prejuízo Total
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className={`text-2xl font-bold ${grandTotals.total_profit_loss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrencyBRL(grandTotals.total_profit_loss)}
                    </p>
                  </CardContent>
                </Card>

                {selectedTaxGroup === 'Ações e ETFs' && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-medium text-muted-foreground flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        Lucro Isento (Vendas &lt; 20k)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrencyBRL(grandTotals.total_exempt_profit)}
                      </p>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium text-muted-foreground">
                      Imposto Devido
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-orange-600">{formatCurrencyBRL(grandTotals.total_tax_due)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Monthly Tables */}
              {salesByTaxGroup.map((monthData) => (
                <Card key={monthData.monthKey}>
                  <CardHeader>
                    <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex flex-col gap-1">
                        <span className="capitalize">{monthData.month} {monthData.year}</span>
                        {monthData.has_exemption && (
                          <Badge variant="outline" className="w-fit text-green-600 border-green-200 bg-green-50 text-xs font-normal">
                            Isenção de venda de ações até R$ 20.000
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-4 text-sm font-normal">
                        <span className={monthData.total_profit_loss >= 0 ? 'text-green-600' : 'text-red-600'}>
                          L/P: {formatCurrencyBRL(monthData.total_profit_loss)}
                        </span>
                        <span className={monthData.accumulated_loss < 0 ? 'text-red-600' : 'text-muted-foreground'}>
                          Prej. Acum.: {formatCurrencyBRL(monthData.accumulated_loss)}
                        </span>
                        <span className="text-orange-600">
                          Imposto: {formatCurrencyBRL(monthData.total_tax_due)}
                        </span>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Ativo</TableHead>
                          <TableHead className="text-right">Qtd</TableHead>
                          <TableHead className="text-right">Preço Venda</TableHead>
                          <TableHead className="text-right">Preço Médio</TableHead>
                          <TableHead className="text-right">Valor Total</TableHead>
                          <TableHead className="text-right">Lucro/Prejuízo</TableHead>
                          <TableHead className="text-right">Imposto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monthData.sales.map((sale) => (
                          <TableRow
                            key={sale.id}
                            className={sale.excluded_from_ir ? 'bg-muted/40' : undefined}
                          >
                            <TableCell>
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                                <span>{formatDateBR(sale.trade_date)}</span>
                                {sale.excluded_from_ir && (
                                  <Badge variant="outline" className="w-fit text-xs font-normal text-muted-foreground">
                                    Excluída do IR
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{sale.ticker}</TableCell>
                            <TableCell className="text-right">{formatNumber(sale.quantity, 0)}</TableCell>
                            <TableCell className="text-right">{formatCurrencyBRL(sale.sale_price)}</TableCell>
                            <TableCell className="text-right">{formatCurrencyBRL(sale.average_price_at_sale)}</TableCell>
                            <TableCell className="text-right">{formatCurrencyBRL(sale.total_sale_value)}</TableCell>
                            <TableCell className="text-right">
                              {sale.excluded_from_ir && sale.economic_profit_loss !== undefined ? (
                                <div className="flex flex-col items-end gap-0.5">
                                  <span
                                    className={`font-medium ${sale.economic_profit_loss >= 0 ? 'text-green-600' : 'text-red-600'}`}
                                  >
                                    {formatCurrencyBRL(sale.economic_profit_loss)}
                                  </span>
                                  <span className="text-xs text-muted-foreground">fora do cálculo</span>
                                </div>
                              ) : (
                                <span className={`font-medium ${sale.profit_loss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {formatCurrencyBRL(sale.profit_loss)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-orange-600">
                              {sale.excluded_from_ir ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                formatCurrencyBRL(sale.tax_due)
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableFooter>
                        <TableRow>
                          <TableCell colSpan={5} className="font-medium">Total do Mês</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrencyBRL(monthData.total_sales)}</TableCell>
                          <TableCell className={`text-right font-bold ${monthData.total_profit_loss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrencyBRL(monthData.total_profit_loss)}
                          </TableCell>
                          <TableCell className="text-right font-bold text-orange-600">
                            {formatCurrencyBRL(monthData.total_tax_due)}
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </TabsContent>

        <TabsContent value="ativo" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Selecione um Ativo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedTicker} onValueChange={setSelectedTicker}>
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue placeholder="Escolha um ativo..." />
                </SelectTrigger>
                <SelectContent>
                  {tickers.map((ticker) => (
                    <SelectItem key={ticker} value={ticker}>
                      {ticker}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {selectedTicker && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Resumo Anual - {selectedTicker}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-full max-w-xs">
                    <SelectValue placeholder="Escolha um ano..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {yearSnapshots && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-muted/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base font-medium">
                          31/12/{yearSnapshots.previousYear}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Quantidade:</span>
                          <span className="font-medium">{formatNumber(yearSnapshots.previous.quantity, 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Valor Total:</span>
                          <span className="font-medium">{formatCurrencyBRL(yearSnapshots.previous.totalValue)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Preço Médio:</span>
                          <span className="font-medium">{formatCurrencyBRL(yearSnapshots.previous.averagePrice)}</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-muted/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base font-medium">
                          31/12/{yearSnapshots.currentYear}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Quantidade:</span>
                          <span className="font-medium">{formatNumber(yearSnapshots.current.quantity, 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Valor Total:</span>
                          <span className="font-medium">{formatCurrencyBRL(yearSnapshots.current.totalValue)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Preço Médio:</span>
                          <span className="font-medium">{formatCurrencyBRL(yearSnapshots.current.averagePrice)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {selectedTicker && (
            <Card>
              <CardHeader>
                <CardTitle>Operações - {selectedTicker}</CardTitle>
              </CardHeader>
              <CardContent>
                {tradesWithRunning.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhuma operação encontrada para este ativo.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Quantidade</TableHead>
                        <TableHead className="text-right">Preço Unit.</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                        <TableHead className="text-right">Qtd. Acumulada</TableHead>
                        <TableHead className="text-right">Preço Médio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tradesWithRunning.map((trade) => (
                        <TableRow key={trade.id}>
                          <TableCell>
                            <Badge
                              variant={
                                trade.movement_type === 'BUY' || trade.movement_type === 'BONUS' ? 'default' :
                                  trade.movement_type === 'SELL' || trade.movement_type === 'AMORTIZATION' ? 'destructive' :
                                    'secondary'
                              }
                            >
                              {trade.movement_type === 'BUY' ? 'Compra' :
                                trade.movement_type === 'BONUS' ? 'Bonificação' :
                                  trade.movement_type === 'SELL' ? 'Venda' :
                                    trade.movement_type === 'AMORTIZATION' ? 'Amortização' :
                                      trade.movement_type === 'SPLIT' ? 'Desdobramento' :
                                        'Grupamento'}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDateBR(trade.trade_date)}</TableCell>
                          <TableCell className="text-right">
                            {formatNumber(trade.quantity, 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrencyBRL(trade.price)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrencyBRL(trade.total_value)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatNumber(trade.runningQuantity, 0)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrencyBRL(trade.runningAveragePrice)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}