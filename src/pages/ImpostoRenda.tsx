import { useState, useMemo, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
import {
  applyTradeToCostBasis,
  calculateCostBasis,
  EMPTY_COST_BASIS,
  getAveragePrice,
  sortTradesByDate,
} from '@/lib/portfolio-calculations';
import { calculateGrandTotals, calculateSalesByTaxGroup, TAX_GROUPS, type TaxGroup } from '@/lib/ir-calculations';
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

export default function ImpostoRenda() {
  const [selectedTicker, setSelectedTicker] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedTaxGroup, setSelectedTaxGroup] = useState<TaxGroup>('Ações e ETFs');
  const [selectedSalesYear, setSelectedSalesYear] = useState<string>(new Date().getFullYear().toString());

  // Initial accumulated loss per tax group and year, stored in ir_initial_losses
  const queryClient = useQueryClient();
  const [localInputValue, setLocalInputValue] = useState<string>('');

  const getInitialLossKey = (group: string, year: string | number) => `${group}-${year}`;

  const { data: initialLosses = {} } = useQuery({
    queryKey: ['ir-initial-losses'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ir_initial_losses').select('tax_group, year, amount');
      if (error) throw error;
      return Object.fromEntries(
        data.map((row) => [getInitialLossKey(row.tax_group, row.year), Number(row.amount)])
      ) as Record<string, number>;
    },
  });

  const saveInitialLoss = useMutation({
    mutationFn: async ({ group, year, amount }: { group: TaxGroup; year: string; amount: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      const { error } = await supabase.from('ir_initial_losses').upsert(
        { user_id: user.id, tax_group: group, year: parseInt(year), amount, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,tax_group,year' },
      );
      if (error) throw error;
    },
    // Update the cache right away so the calculation doesn't wait for the round trip
    onMutate: ({ group, year, amount }) => {
      queryClient.setQueryData<Record<string, number>>(['ir-initial-losses'], (prev) => ({
        ...prev,
        [getInitialLossKey(group, year)]: amount,
      }));
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar prejuízo acumulado: ${error.message}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['ir-initial-losses'] });
    },
  });

  const initialAccumulatedLoss = initialLosses[getInitialLossKey(selectedTaxGroup, selectedSalesYear)] ?? 0;

  // Sync the input when the stored value changes (e.g. switching years/groups)
  useEffect(() => {
    setLocalInputValue(initialAccumulatedLoss === 0 ? '' : formatCurrencyBRL(Math.abs(initialAccumulatedLoss)));
  }, [initialAccumulatedLoss]);

  const handleInputChange = (value: string) => {
    setLocalInputValue(value);
  };

  const handleInputBlur = () => {
    const numValue = parseFloat(localInputValue.replace(/[^\d,-]/g, '').replace(',', '.')) || 0;
    // Ensure it's negative or zero (it's a loss)
    const lossValue = numValue > 0 ? -numValue : numValue;

    // Re-format the display value
    setLocalInputValue(lossValue === 0 ? '' : formatCurrencyBRL(Math.abs(lossValue)));

    if (lossValue !== initialAccumulatedLoss) {
      saveInitialLoss.mutate({ group: selectedTaxGroup, year: selectedSalesYear, amount: lossValue });
    }
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

    const tickerTrades = trades.filter((t) => {
      const tradeDate = parseISODateLocal(t.trade_date);
      return t.ticker === selectedTicker && tradeDate && tradeDate <= endDate;
    });
    const basis = calculateCostBasis(tickerTrades);

    return {
      quantity: basis.quantity,
      totalValue: basis.totalCost,
      averagePrice: getAveragePrice(basis),
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

    let basis = EMPTY_COST_BASIS;

    return sortTradesByDate(trades.filter((t) => t.ticker === selectedTicker)).map((trade): TradeWithRunning => {
      basis = applyTradeToCostBasis(basis, trade);

      return {
        id: trade.id,
        trade_date: trade.trade_date,
        movement_type: trade.movement_type,
        quantity: Number(trade.quantity),
        price: Number(trade.price),
        total_value: Number(trade.total_value),
        runningQuantity: basis.quantity,
        runningAveragePrice: getAveragePrice(basis),
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
    return calculateSalesByTaxGroup(trades, selectedTaxGroup, parseInt(selectedSalesYear), initialAccumulatedLoss);
  }, [trades, selectedTaxGroup, selectedSalesYear, initialAccumulatedLoss]);

  const grandTotals = useMemo(() => calculateGrandTotals(salesByTaxGroup), [salesByTaxGroup]);

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