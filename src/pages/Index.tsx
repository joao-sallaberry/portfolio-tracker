import { useDividendEvents, useTradeOperations } from '@/hooks/use-portfolio-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrencyBRL, formatCurrencyCompactBRL, formatNumber, parseISODateLocal } from '@/lib/formatters';
import { BarChart3, Wallet, TrendingUp, Activity, PieChart } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, Legend } from 'recharts';
import { AssetClass } from '@/lib/asset-classifier';
import { calculatePositions } from '@/lib/portfolio-calculations';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';

const CHART_COLORS = [
  'hsl(160, 84%, 39%)',
  'hsl(199, 89%, 48%)',
  'hsl(262, 83%, 58%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 84%, 60%)',
  'hsl(280, 65%, 60%)',
  'hsl(120, 60%, 45%)',
  'hsl(45, 90%, 55%)',
];

export default function Index() {
  const { data: trades, isLoading: tradesLoading } = useTradeOperations();

  const { data: dividends, isLoading: dividendsLoading } = useDividendEvents();

  const isLoading = tradesLoading || dividendsLoading;
  const currentYear = new Date().getFullYear();

  // Database dates are YYYY-MM-DD; parse them as local dates so day 1 doesn't fall into the previous month
  const yearOf = (date: string) => parseISODateLocal(date)?.getFullYear();

  // Cost basis of the current positions (same calculation as the Posição page)
  const positions = calculatePositions(trades);
  const netInvested = positions.reduce((sum, p) => sum + p.totalValue, 0);

  const totalDividends = dividends?.reduce((sum, d) => sum + Number(d.net_value), 0) || 0;
  
  const dividendsThisYear = dividends
    ?.filter(d => yearOf(d.payment_date) === currentYear)
    .reduce((sum, d) => sum + Number(d.net_value), 0) || 0;

  const operationsThisYear = trades
    ?.filter(t => yearOf(t.trade_date) === currentYear)
    .length || 0;

  // Monthly dividends chart data
  const monthlyDividends = dividends?.reduce((acc, d) => {
    const date = parseISODateLocal(d.payment_date);
    if (!date) return acc;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    acc[key] = (acc[key] || 0) + Number(d.net_value);
    return acc;
  }, {} as Record<string, number>) || ({} as Record<string, number>);

  const monthlyData = Object.entries(monthlyDividends)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, value]) => ({
      month: month.split('-')[1] + '/' + month.split('-')[0].slice(2),
      value,
    }));

  // Top tickers by dividends
  const tickerDividends = dividends?.reduce((acc, d) => {
    acc[d.ticker] = (acc[d.ticker] || 0) + Number(d.net_value);
    return acc;
  }, {} as Record<string, number>) || ({} as Record<string, number>);

  const topTickers = (Object.entries(tickerDividends) as Array<[string, number]>)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([ticker, value], index) => ({
      ticker,
      value,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));

  // Portfolio distribution by asset class
  const classInvested = positions.reduce((acc, p) => {
    acc[p.assetClass] = (acc[p.assetClass] || 0) + p.totalValue;
    return acc;
  }, {} as Record<AssetClass, number>);

  const portfolioDistribution = (Object.entries(classInvested) as Array<[AssetClass, number]>)
    .filter(([, value]) => value > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([assetClass, value], index) => ({
      name: assetClass,
      value,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));

  const hasData = (trades && trades.length > 0) || (dividends && dividends.length > 0);

  if (!isLoading && !hasData) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
          <BarChart3 className="h-10 w-10 text-primary" />
        </div>
        <h1 className="mb-2 text-3xl font-bold">Bem-vindo ao seu Portfólio</h1>
        <p className="mb-6 max-w-md text-muted-foreground">
          Importe seus extratos da corretora para visualizar seus investimentos, proventos e desempenho.
        </p>
        <Button asChild size="lg">
          <Link to="/importar">Importar Dados</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Visão Geral</h1>
        <p className="mt-2 text-muted-foreground">
          Resumo do seu portfólio de investimentos
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Total Investido
            </CardDescription>
            <CardTitle className="text-2xl">
              {isLoading ? <Skeleton className="h-8 w-32" /> : formatCurrencyBRL(netInvested)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Custo das posições atuais
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Total em Proventos
            </CardDescription>
            <CardTitle className="text-2xl text-primary">
              {isLoading ? <Skeleton className="h-8 w-32" /> : formatCurrencyBRL(totalDividends)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Desde o início
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Proventos em {currentYear}
            </CardDescription>
            <CardTitle className="text-2xl">
              {isLoading ? <Skeleton className="h-8 w-32" /> : formatCurrencyBRL(dividendsThisYear)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Ano corrente
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Operações em {currentYear}
            </CardDescription>
            <CardTitle className="text-2xl">
              {isLoading ? <Skeleton className="h-8 w-16" /> : formatNumber(operationsThisYear, 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Compras e vendas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Dividends */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Proventos por Mês
            </CardTitle>
            <CardDescription>Últimos 12 meses</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatCurrencyCompactBRL}
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrencyBRL(value)}
                    labelFormatter={(label) => `Mês: ${label}`}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar 
                    dataKey="value" 
                    name="Proventos" 
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                Sem dados para exibir
              </div>
            )}
          </CardContent>
        </Card>

        {/* Portfolio Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-primary" />
              Distribuição do Portfólio
            </CardTitle>
            <CardDescription>Por classe de ativo</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : portfolioDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPie>
                  <Pie
                    data={portfolioDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {portfolioDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip 
                    formatter={(value: number) => formatCurrencyBRL(value)}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                </RechartsPie>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                Sem dados para exibir
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Tickers by Dividends */}
      <Card>
        <CardHeader>
          <CardTitle>Proventos por Ativo (Top 8)</CardTitle>
          <CardDescription>Maiores pagadores de proventos</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : topTickers.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topTickers} layout="vertical">
                <XAxis 
                  type="number"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatCurrencyCompactBRL}
                />
                <YAxis 
                  dataKey="ticker" 
                  type="category"
                  tick={{ fontSize: 12, fontFamily: 'monospace' }}
                  tickLine={false}
                  axisLine={false}
                  width={80}
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrencyBRL(value)}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="value" name="Proventos" radius={[0, 4, 4, 0]}>
                  {topTickers.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-muted-foreground">
              Sem dados para exibir
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
