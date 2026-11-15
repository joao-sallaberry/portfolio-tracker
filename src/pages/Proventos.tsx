import { useState, useMemo } from 'react';
import { useDividendEvents } from '@/hooks/use-portfolio-data';
import { usePagination } from '@/hooks/use-pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { formatDateBR, formatCurrencyBRL, formatNumber, parseISODateLocal } from '@/lib/formatters';
import { ASSET_CLASSES, classifyAsset, type AssetClass } from '@/lib/asset-classifier';
import {
  ALL,
  filterDividends,
  getDatePresetRange,
  monthlyDividendsByAssetClass,
  nextSortConfig,
  sortDividends,
  sumNetValue,
  uniqueSorted,
  type DatePreset,
  type DividendSortKey,
  type SortConfig,
} from '@/lib/list-filters';
import { Wallet, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { PaginationControls } from '@/components/PaginationControls';

const ITEMS_PER_PAGE = 50;
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis } from 'recharts';


const CHART_COLORS: Record<AssetClass, string> = {
  'Ação': 'hsl(160 84% 39%)',
  'FII': 'hsl(199 89% 48%)',
  'ETF': 'hsl(262 83% 58%)',
  'FI-Infra': 'hsl(340 82% 52%)',
  'FIP': 'hsl(24 95% 53%)',
  'Outro': 'hsl(38 92% 50%)',
};

interface SortableHeadProps {
  label: string;
  sortKey: DividendSortKey;
  sort: SortConfig<DividendSortKey> | null;
  onSort: (key: DividendSortKey) => void;
  align?: 'left' | 'right';
}

function SortableHead({ label, sortKey, sort, onSort, align = 'left' }: SortableHeadProps) {
  const Icon = sort?.key !== sortKey ? ArrowUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown;
  return (
    <TableHead className={cn('cursor-pointer hover:bg-muted/50', align === 'right' && 'text-right')} onClick={() => onSort(sortKey)}>
      <div className={cn('flex items-center gap-1', align === 'right' && 'justify-end')}>
        {label} <Icon className={cn('h-4 w-4', sort?.key !== sortKey && 'opacity-50')} />
      </div>
    </TableHead>
  );
}

export default function Proventos() {
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [datePreset, setDatePreset] = useState<DatePreset | 'custom'>('all');
  const [eventType, setEventType] = useState<string>('all');
  const [assetClass, setAssetClass] = useState<string>('all');
  const [tickerFilter, setTickerFilter] = useState<string>('all');
  const [chartAssetClasses, setChartAssetClasses] = useState<AssetClass[]>([...ASSET_CLASSES]);
  const [sortConfig, setSortConfig] = useState<SortConfig<DividendSortKey> | null>(null);

  const { data: dividendsAsc, isLoading } = useDividendEvents();
  // Newest first for display
  const dividends = useMemo(() => (dividendsAsc ? [...dividendsAsc].reverse() : undefined), [dividendsAsc]);

  const eventTypes = useMemo(() => uniqueSorted((dividends ?? []).map((d) => d.event_type)), [dividends]);
  const uniqueTickers = useMemo(() => uniqueSorted((dividends ?? []).map((d) => d.ticker)), [dividends]);

  const filteredDividends = useMemo(
    () => filterDividends(dividends ?? [], { startDate, endDate, eventType, assetClass, ticker: tickerFilter }),
    [dividends, startDate, endDate, eventType, assetClass, tickerFilter],
  );

  const handleSort = (key: DividendSortKey) => setSortConfig((current) => nextSortConfig(current, key));

  const sortedDividends = useMemo(() => sortDividends(filteredDividends, sortConfig), [filteredDividends, sortConfig]);

  // Back to page 1 whenever the filters or the sorting change
  const { currentPage, setCurrentPage, pageItems: paginatedDividends } = usePagination(
    sortedDividends,
    ITEMS_PER_PAGE,
    JSON.stringify([startDate, endDate, eventType, assetClass, tickerFilter, sortConfig])
  );

  const totalDividends = sumNetValue(filteredDividends);
  const currentYear = new Date().getFullYear();
  const dividendsThisYear = sumNetValue(filteredDividends, currentYear);

  const hasActiveFilters = startDate || endDate || eventType !== ALL || assetClass !== ALL || tickerFilter !== ALL;

  const clearFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setDatePreset('all');
    setEventType('all');
    setAssetClass('all');
    setTickerFilter('all');
  };

  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const range = getDatePresetRange(preset);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  };

  const handleStartDateChange = (date: Date | undefined) => {
    setStartDate(date);
    setDatePreset('custom');
  };

  const handleEndDateChange = (date: Date | undefined) => {
    setEndDate(date);
    setDatePreset('custom');
  };

  const monthlyChartData = useMemo(() => monthlyDividendsByAssetClass(filteredDividends), [filteredDividends]);

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
                      formatter={(value, name, item) => (
                        <div className="flex w-full items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
                          <span className="text-muted-foreground">{chartConfig[name as AssetClass]?.label ?? name}</span>
                          <span className="ml-auto font-mono font-medium tabular-nums text-foreground">
                            {formatCurrencyBRL(Number(value))}
                          </span>
                        </div>
                      )}
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
              onChange={(e) => handleStartDateChange(parseISODateLocal(e.target.value) ?? undefined)}
              className={cn("w-[160px]", !startDate && "text-muted-foreground")}
            />

            {/* End Date Filter */}
            <Input
              type="date"
              value={endDate ? format(endDate, "yyyy-MM-dd") : ""}
              onChange={(e) => handleEndDateChange(parseISODateLocal(e.target.value) ?? undefined)}
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
            <>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHead label="Ativo" sortKey="ticker" sort={sortConfig} onSort={handleSort} />
                      <SortableHead label="Classe" sortKey="assetClass" sort={sortConfig} onSort={handleSort} />
                      <SortableHead label="Data Pagamento" sortKey="payment_date" sort={sortConfig} onSort={handleSort} />
                      <SortableHead label="Tipo" sortKey="event_type" sort={sortConfig} onSort={handleSort} />
                      <SortableHead label="Instituição" sortKey="institution" sort={sortConfig} onSort={handleSort} />
                      <SortableHead label="Quantidade" sortKey="quantity" sort={sortConfig} onSort={handleSort} align="right" />
                      <SortableHead label="Preço Unit." sortKey="unit_price" sort={sortConfig} onSort={handleSort} align="right" />
                      <SortableHead label="Valor Líquido" sortKey="net_value" sort={sortConfig} onSort={handleSort} align="right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedDividends.map((dividend) => (
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
              <PaginationControls
                currentPage={currentPage}
                pageSize={ITEMS_PER_PAGE}
                totalItems={sortedDividends.length}
                itemLabel="proventos"
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}