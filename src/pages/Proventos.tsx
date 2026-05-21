import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { formatDateBR, formatCurrencyBRL, formatNumber, parseISODateLocal } from '@/lib/formatters';
import { classifyAsset, AssetClass } from '@/lib/asset-classifier';
import { Wallet, CalendarIcon, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend } from 'recharts';

const ASSET_CLASSES: AssetClass[] = ['Ação', 'FII', 'ETF', 'FI-Infra', 'FIP', 'Outro'];

const CHART_COLORS: Record<AssetClass, string> = {
  'Ação': 'hsl(160 84% 39%)',
  'FII': 'hsl(199 89% 48%)',
  'ETF': 'hsl(262 83% 58%)',
  'FI-Infra': 'hsl(340 82% 52%)',
  'FIP': 'hsl(24 95% 53%)',
  'Outro': 'hsl(38 92% 50%)',
};

export default function Proventos() {
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [datePreset, setDatePreset] = useState<string>('all');
  const [eventType, setEventType] = useState<string>('all');
  const [assetClass, setAssetClass] = useState<string>('all');
  const [tickerFilter, setTickerFilter] = useState<string>('all');
  const [chartAssetClasses, setChartAssetClasses] = useState<AssetClass[]>([...ASSET_CLASSES]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const { data: dividends, isLoading } = useQuery({
    queryKey: ['dividend-events'],
    queryFn: async () => {
      // Fetch all rows (PostgREST paginates responses; default max is 1000 rows per request)
      const pageSize = 1000;
      let from = 0;
      const all: any[] = [];

      while (true) {
        const { data, error } = await supabase
          .from('dividend_events')
          .select('*')
          .order('payment_date', { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) throw error;
        all.push(...(data ?? []));

        if (!data || data.length < pageSize) break;
        from += pageSize;
      }

      return all;
    },
  });

  // Get unique event types for the filter
  const eventTypes = useMemo(() => {
    return [...new Set(dividends?.map(d => d.event_type) || [])].sort();
  }, [dividends]);

  // Get unique tickers for the filter
  const uniqueTickers = useMemo(() => {
    return [...new Set(dividends?.map(d => d.ticker) || [])].sort();
  }, [dividends]);

  // Filter dividends based on selected filters
  const filteredDividends = useMemo(() => {
    if (!dividends) return [];

    return dividends.filter(d => {
      const paymentDate = parseISODateLocal(d.payment_date) ?? new Date(d.payment_date);

      // Date range filter
      if (startDate && paymentDate < startDate) return false;
      if (endDate && paymentDate > endDate) return false;

      // Event type filter
      if (eventType !== 'all' && d.event_type !== eventType) return false;

      // Asset class filter
      if (assetClass !== 'all' && classifyAsset(d.ticker) !== assetClass) return false;

      // Ticker filter
      if (tickerFilter !== 'all' && d.ticker !== tickerFilter) return false;

      return true;
    });
  }, [dividends, startDate, endDate, eventType, assetClass, tickerFilter]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedDividends = useMemo(() => {
    if (!sortConfig) return filteredDividends;

    return [...filteredDividends].sort((a, b) => {
      let aValue: any = a[sortConfig.key as keyof typeof a];
      let bValue: any = b[sortConfig.key as keyof typeof b];

      // Custom values for sorting
      if (sortConfig.key === 'assetClass') {
        aValue = classifyAsset(a.ticker);
        bValue = classifyAsset(b.ticker);
      } else if (sortConfig.key === 'payment_date') {
        aValue = new Date(a.payment_date).getTime();
        bValue = new Date(b.payment_date).getTime();
      } else if (['quantity', 'unit_price', 'net_value'].includes(sortConfig.key)) {
        aValue = Number(aValue);
        bValue = Number(bValue);
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredDividends, sortConfig]);

  const totalDividends = filteredDividends.reduce((sum, d) => sum + Number(d.net_value), 0);
  const currentYear = new Date().getFullYear();
  const dividendsThisYear = filteredDividends
    .filter(d => (parseISODateLocal(d.payment_date) ?? new Date(d.payment_date)).getFullYear() === currentYear)
    .reduce((sum, d) => sum + Number(d.net_value), 0);

  const hasActiveFilters = startDate || endDate || eventType !== 'all' || assetClass !== 'all' || tickerFilter !== 'all';

  const clearFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setDatePreset('all');
    setEventType('all');
    setAssetClass('all');
    setTickerFilter('all');
  };

  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();
    switch (preset) {
      case 'all':
        setStartDate(undefined);
        setEndDate(undefined);
        break;
      case 'current_month':
        setStartDate(new Date(now.getFullYear(), now.getMonth(), 1));
        setEndDate(new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59));
        break;
      case 'last_month':
        setStartDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
        setEndDate(new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59));
        break;
      case 'current_year':
        setStartDate(new Date(now.getFullYear(), 0, 1));
        setEndDate(new Date(now.getFullYear(), 11, 31, 23, 59, 59));
        break;
      case 'last_year':
        setStartDate(new Date(now.getFullYear() - 1, 0, 1));
        setEndDate(new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59));
        break;
      case 'past_year': {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(now.getFullYear() - 1);
        setStartDate(oneYearAgo);
        setEndDate(now);
        break;
      }
      case 'past_5_years': {
        const fiveYearsAgo = new Date();
        fiveYearsAgo.setFullYear(now.getFullYear() - 5);
        setStartDate(fiveYearsAgo);
        setEndDate(now);
        break;
      }
    }
  };

  const handleStartDateChange = (date: Date | undefined) => {
    setStartDate(date);
    setDatePreset('custom');
  };

  const handleEndDateChange = (date: Date | undefined) => {
    setEndDate(date);
    setDatePreset('custom');
  };

  // Chart data: monthly dividends grouped by asset class
  const monthlyChartData = useMemo(() => {
    if (!filteredDividends) return [];

    const monthlyData: Record<string, Record<AssetClass, number>> = {};

    filteredDividends.forEach(d => {
      const paymentDate = parseISODateLocal(d.payment_date) ?? new Date(d.payment_date);
      const monthKey = format(paymentDate, 'yyyy-MM');
      const assetClass = classifyAsset(d.ticker) as AssetClass;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { 'Ação': 0, 'FII': 0, 'ETF': 0, 'FI-Infra': 0, 'FIP': 0, 'Outro': 0 };
      }
      monthlyData[monthKey][assetClass] += Number(d.net_value);
    });

    // Sort by month and convert to array
    return Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, values]) => {
        // Parse date locally to avoid timezone offset issues
        const [year, monthNum] = month.split('-').map(Number);
        const localDate = new Date(year, monthNum - 1, 1);
        return {
          month: format(localDate, 'MMM/yy', { locale: ptBR }),
          ...values,
        };
      });
  }, [filteredDividends]);

  const toggleChartAssetClass = (assetClass: AssetClass) => {
    setChartAssetClasses(prev =>
      prev.includes(assetClass)
        ? prev.filter(c => c !== assetClass)
        : [...prev, assetClass]
    );
  };

  const chartConfig = {
    'Ação': { label: 'Ações', color: CHART_COLORS['Ação'] },
    'FII': { label: 'FIIs', color: CHART_COLORS['FII'] },
    'ETF': { label: 'ETFs', color: CHART_COLORS['ETF'] },
    'FI-Infra': { label: 'FI-Infra', color: CHART_COLORS['FI-Infra'] },
    'FIP': { label: 'FIP', color: CHART_COLORS['FIP'] },
    'Outro': { label: 'Outros', color: CHART_COLORS['Outro'] },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Proventos</h1>
        <p className="mt-2 text-muted-foreground">
          Dividendos, JCP e outros rendimentos recebidos
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total em Proventos</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl text-primary">
              <Wallet className="h-5 w-5" />
              {isLoading ? <Skeleton className="h-8 w-32" /> : formatCurrencyBRL(totalDividends)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Proventos em {currentYear}</CardDescription>
            <CardTitle className="text-2xl">
              {isLoading ? <Skeleton className="h-8 w-32" /> : formatCurrencyBRL(dividendsThisYear)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de Eventos</CardDescription>
            <CardTitle className="text-2xl">
              {isLoading ? <Skeleton className="h-8 w-16" /> : filteredDividends.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tipos de Evento</CardDescription>
            <CardTitle className="text-2xl">
              {isLoading ? <Skeleton className="h-8 w-16" /> : eventTypes.length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Monthly Dividends Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Proventos por Mês</CardTitle>
          <CardDescription>Distribuição mensal de proventos por classe de ativo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Chart Class Filter */}
          <div className="flex flex-wrap items-center gap-4">
            {ASSET_CLASSES.map((cls) => (
              <div key={cls} className="flex items-center gap-2">
                <Checkbox
                  id={`chart-${cls}`}
                  checked={chartAssetClasses.includes(cls)}
                  onCheckedChange={() => toggleChartAssetClass(cls)}
                />
                <label
                  htmlFor={`chart-${cls}`}
                  className="flex items-center gap-2 text-sm font-medium cursor-pointer"
                >
                  <div
                    className="h-3 w-3 rounded-sm"
                    style={{ backgroundColor: CHART_COLORS[cls] }}
                  />
                  {cls}
                </label>
              </div>
            ))}
          </div>

          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : monthlyChartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Wallet className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Nenhum dado para exibir</p>
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={monthlyChartData}>
                <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis
                  tickFormatter={(value) => formatCurrencyBRL(value)}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={80}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatCurrencyBRL(Number(value))}
                    />
                  }
                />
                {chartAssetClasses.includes('Ação') && (
                  <Bar dataKey="Ação" stackId="a" fill={CHART_COLORS['Ação']} radius={[0, 0, 0, 0]} />
                )}
                {chartAssetClasses.includes('FII') && (
                  <Bar dataKey="FII" stackId="a" fill={CHART_COLORS['FII']} radius={[0, 0, 0, 0]} />
                )}
                {chartAssetClasses.includes('ETF') && (
                  <Bar dataKey="ETF" stackId="a" fill={CHART_COLORS['ETF']} radius={[0, 0, 0, 0]} />
                )}
                {chartAssetClasses.includes('FI-Infra') && (
                  <Bar dataKey="FI-Infra" stackId="a" fill={CHART_COLORS['FI-Infra']} radius={[0, 0, 0, 0]} />
                )}
                {chartAssetClasses.includes('FIP') && (
                  <Bar dataKey="FIP" stackId="a" fill={CHART_COLORS['FIP']} radius={[0, 0, 0, 0]} />
                )}
                {chartAssetClasses.includes('Outro') && (
                  <Bar dataKey="Outro" stackId="a" fill={CHART_COLORS['Outro']} radius={[4, 4, 0, 0]} />
                )}
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Proventos</CardTitle>
          <CardDescription>
            {filteredDividends.length} eventos {hasActiveFilters ? 'filtrados' : 'registrados'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Date Preset Filter */}
            <Select value={datePreset} onValueChange={handleDatePresetChange}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo o período</SelectItem>
                <SelectItem value="current_month">Mês atual</SelectItem>
                <SelectItem value="last_month">Mês passado</SelectItem>
                <SelectItem value="current_year">Ano atual</SelectItem>
                <SelectItem value="last_year">Ano passado</SelectItem>
                <SelectItem value="past_year">Último ano</SelectItem>
                <SelectItem value="past_5_years">Últimos 5 anos</SelectItem>
                <SelectItem value="custom" disabled className="hidden">Personalizado</SelectItem>
              </SelectContent>
            </Select>

            {/* Start Date Filter */}
            <Input
              type="date"
              value={startDate ? format(startDate, "yyyy-MM-dd") : ""}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) {
                  handleStartDateChange(undefined);
                } else {
                  handleStartDateChange(new Date(val + 'T00:00:00'));
                }
              }}
              className={cn("w-[160px]", !startDate && "text-muted-foreground")}
            />

            {/* End Date Filter */}
            <Input
              type="date"
              value={endDate ? format(endDate, "yyyy-MM-dd") : ""}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) {
                  handleEndDateChange(undefined);
                } else {
                  handleEndDateChange(new Date(val + 'T00:00:00'));
                }
              }}
              className={cn("w-[160px]", !endDate && "text-muted-foreground")}
            />

            {/* Ticker Filter */}
            <Select value={tickerFilter} onValueChange={setTickerFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Ativo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os ativos</SelectItem>
                {uniqueTickers.map(ticker => (
                  <SelectItem key={ticker} value={ticker}>{ticker}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Event Type Filter */}
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo de evento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {eventTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Asset Class Filter */}
            <Select value={assetClass} onValueChange={setAssetClass}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Classe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas classes</SelectItem>
                <SelectItem value="Ação">Ação</SelectItem>
                <SelectItem value="ETF">ETF</SelectItem>
                <SelectItem value="FII">FII</SelectItem>
                <SelectItem value="FI-Infra">FI-Infra</SelectItem>
                <SelectItem value="FIP">FIP</SelectItem>
                <SelectItem value="Outro">Outro</SelectItem>
              </SelectContent>
            </Select>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10">
                <X className="mr-1 h-4 w-4" />
                Limpar filtros
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !filteredDividends || filteredDividends.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Wallet className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="text-lg font-medium">
                {hasActiveFilters ? 'Nenhum provento encontrado com os filtros aplicados' : 'Nenhum provento encontrado'}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasActiveFilters ? 'Tente ajustar os filtros' : 'Importe seu extrato para ver seus proventos'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('ticker')}>
                      <div className="flex items-center gap-1">Ativo {sortConfig?.key === 'ticker' ? (sortConfig.direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />) : <ArrowUpDown className="h-4 w-4 opacity-50" />}</div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('assetClass')}>
                      <div className="flex items-center gap-1">Classe {sortConfig?.key === 'assetClass' ? (sortConfig.direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />) : <ArrowUpDown className="h-4 w-4 opacity-50" />}</div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('payment_date')}>
                      <div className="flex items-center gap-1">Data Pagamento {sortConfig?.key === 'payment_date' ? (sortConfig.direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />) : <ArrowUpDown className="h-4 w-4 opacity-50" />}</div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('event_type')}>
                      <div className="flex items-center gap-1">Tipo {sortConfig?.key === 'event_type' ? (sortConfig.direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />) : <ArrowUpDown className="h-4 w-4 opacity-50" />}</div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('institution')}>
                      <div className="flex items-center gap-1">Instituição {sortConfig?.key === 'institution' ? (sortConfig.direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />) : <ArrowUpDown className="h-4 w-4 opacity-50" />}</div>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('quantity')}>
                      <div className="flex items-center justify-end gap-1">Quantidade {sortConfig?.key === 'quantity' ? (sortConfig.direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />) : <ArrowUpDown className="h-4 w-4 opacity-50" />}</div>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('unit_price')}>
                      <div className="flex items-center justify-end gap-1">Preço Unit. {sortConfig?.key === 'unit_price' ? (sortConfig.direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />) : <ArrowUpDown className="h-4 w-4 opacity-50" />}</div>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('net_value')}>
                      <div className="flex items-center justify-end gap-1">Valor Líquido {sortConfig?.key === 'net_value' ? (sortConfig.direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />) : <ArrowUpDown className="h-4 w-4 opacity-50" />}</div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedDividends.map((dividend) => (
                    <TableRow key={dividend.id}>
                      <TableCell className="font-mono font-medium">{dividend.ticker}</TableCell>
                      <TableCell>{classifyAsset(dividend.ticker)}</TableCell>
                      <TableCell>{formatDateBR(dividend.payment_date)}</TableCell>
                      <TableCell>{dividend.event_type}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{dividend.institution}</TableCell>
                      <TableCell className="text-right font-mono">{formatNumber(Number(dividend.quantity), 0)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrencyBRL(Number(dividend.unit_price))}</TableCell>
                      <TableCell className="text-right font-mono font-medium text-primary">{formatCurrencyBRL(Number(dividend.net_value))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={7} className="text-right font-medium">Total</TableCell>
                    <TableCell className="text-right font-mono font-bold text-primary">{formatCurrencyBRL(totalDividends)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}