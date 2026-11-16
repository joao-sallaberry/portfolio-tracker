// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { BarChart3, Upload } from 'lucide-react';
import { useDividendEvents, useTradeOperations } from '@/hooks/use-portfolio-data';
import { initialLossKey, useInitialLosses } from '@/hooks/use-portfolio-mutations';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import {
  formatCurrencyBRL,
  formatCurrencyCompactBRL,
  formatDateBR,
  formatNumber,
  formatPercent,
  movementTypeLabel,
  parseISODateLocal,
} from '@/lib/formatters';
import { ASSET_CLASSES, type AssetClass } from '@/lib/asset-classifier';
import { ASSET_CLASS_COLORS, ASSET_CLASS_LABELS } from '@/lib/asset-class-colors';
import { calculatePositions } from '@/lib/portfolio-calculations';
import {
  allocationByClass,
  firstPaymentDate,
  getActivityYears,
  lastTwelveMonthsDividends,
  recentMovements,
  sumDividends,
  taxDueInYear,
  topPayers,
} from '@/lib/dashboard';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('flex flex-col gap-5 rounded-xl border bg-card p-6', className)}>{children}</section>;
}

function PanelHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold tracking-normal">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function Kpi({ label, value, detail, valueClassName }: { label: string; value: ReactNode; detail: ReactNode; valueClassName?: string }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border bg-card px-6 py-5">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className={cn('font-display text-[28px] leading-tight font-bold tracking-tight', valueClassName)}>{value}</span>
      <span className="text-sm text-muted-foreground">{detail}</span>
    </div>
  );
}

/** Number of shares a corporate event adds or removes, or the money a trade moved. */
function movementAmount(movement: { movement_type: string; quantity: number | string; total_value: number | string }) {
  const quantity = Number(movement.quantity);
  switch (movement.movement_type) {
    case 'SPLIT':
    case 'BONUS':
      if (Number(movement.total_value) === 0) return `+${formatNumber(quantity, 0)} ações`;
      return formatCurrencyBRL(Number(movement.total_value));
    case 'REVERSE_SPLIT':
      return `−${formatNumber(quantity, 0)} ações`;
    default:
      return formatCurrencyBRL(Number(movement.total_value));
  }
}

function movementBadgeClass(type: string) {
  if (type === 'BUY') return 'bg-accent text-accent-foreground';
  if (type === 'SELL') return 'bg-orange-50 text-orange-800';
  return 'bg-stone-100 text-stone-700';
}

export default function Index() {
  const { data: trades = [], isLoading: tradesLoading } = useTradeOperations();
  const { data: dividends = [], isLoading: dividendsLoading } = useDividendEvents();
  const { data: initialLosses = {} } = useInitialLosses();
  const isLoading = tradesLoading || dividendsLoading;

  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const withActivity = getActivityYears(trades, dividends);
    return [...new Set([currentYear, ...withActivity])].sort((a, b) => b - a).slice(0, 3).reverse();
  }, [trades, dividends, currentYear]);
  const [year, setYear] = useState(currentYear);

  const positions = useMemo(() => calculatePositions(trades), [trades]);
  const portfolioCost = positions.reduce((sum, p) => sum + p.totalValue, 0);
  const allocation = useMemo(() => allocationByClass(positions), [positions]);
  const largestClass = allocation.reduce((a, b) => (b.value > a.value ? b : a), allocation[0]);

  const dividendsInYear = sumDividends(dividends, year);
  const allDividends = sumDividends(dividends);
  const firstPayment = parseISODateLocal(firstPaymentDate(dividends));
  const taxDue = useMemo(
    () => taxDueInYear(trades, year, (group) => initialLosses[initialLossKey(group, year)] ?? 0),
    [trades, year, initialLosses],
  );

  const monthly = useMemo(() => lastTwelveMonthsDividends(dividends), [dividends]);
  const monthlyTotal = monthly.reduce((sum, m) => sum + m.total, 0);
  const chartClasses = ASSET_CLASSES.filter((c) => monthly.some((m) => m[c] !== undefined));
  const chartConfig = Object.fromEntries(
    ASSET_CLASSES.map((c) => [c, { label: ASSET_CLASS_LABELS[c], color: ASSET_CLASS_COLORS[c] }]),
  ) satisfies ChartConfig;

  const payers = useMemo(() => topPayers(dividends, 5), [dividends]);
  const latest = useMemo(() => recentMovements(trades, 5), [trades]);

  if (!isLoading && trades.length === 0 && dividends.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-accent">
          <BarChart3 className="size-10 text-primary" />
        </div>
        <h1 className="mb-2 font-display text-3xl font-bold">Bem-vindo ao seu Portfólio</h1>
        <p className="mb-6 max-w-md text-muted-foreground">
          Importe seus extratos da corretora para visualizar seus investimentos, proventos e desempenho.
        </p>
        <Button asChild size="lg">
          <Link to="/importar">Importar Dados</Link>
        </Button>
      </div>
    );
  }

  const value = (content: ReactNode, width = 'w-32') => (isLoading ? <Skeleton className={cn('h-8', width)} /> : content);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-3xl font-bold tracking-tight">Visão Geral</h1>
          <p className="text-sm text-muted-foreground">Custo da carteira, proventos e imposto do ano</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div role="group" aria-label="Ano" className="flex rounded-[10px] bg-secondary p-[3px]">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                aria-pressed={y === year}
                onClick={() => setYear(y)}
                className={cn(
                  'h-[34px] rounded-lg px-3.5 text-sm font-medium text-muted-foreground transition-colors',
                  y === year && 'bg-card font-semibold text-foreground shadow-xs',
                )}
              >
                {y}
              </button>
            ))}
          </div>
          <Button asChild className="h-10 rounded-[10px]">
            <Link to="/importar">
              <Upload />
              Importar extrato
            </Link>
          </Button>
        </div>
      </header>

      <section aria-label="Indicadores" className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 xl:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))]">
        <div className="flex flex-col gap-3.5 rounded-xl bg-hero px-6 py-5 text-white">
          <span className="text-sm font-medium text-hero-foreground">Carteira a preço de custo</span>
          <span className="font-display text-[38px] leading-none font-bold tracking-tight">
            {isLoading ? <Skeleton className="h-9 w-48 bg-white/10" /> : formatCurrencyBRL(portfolioCost)}
          </span>
          {!isLoading && positions.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs font-medium">
              <span className="rounded-full bg-white/10 px-2.5 py-1">
                {positions.length} {positions.length === 1 ? 'ativo' : 'ativos'}
              </span>
              <span className="rounded-full bg-white/10 px-2.5 py-1">
                {formatPercent(largestClass.share)} em {ASSET_CLASS_LABELS[largestClass.assetClass].toLowerCase()}
              </span>
            </div>
          )}
        </div>
        <Kpi
          label={`Proventos em ${year}`}
          value={value(formatCurrencyBRL(dividendsInYear.total))}
          valueClassName="text-primary"
          detail={`${dividendsInYear.count} ${dividendsInYear.count === 1 ? 'pagamento' : 'pagamentos'}`}
        />
        <Kpi
          label={firstPayment ? `Proventos desde ${format(firstPayment, 'MMM/yy', { locale: ptBR })}` : 'Proventos recebidos'}
          value={value(formatCurrencyBRL(allDividends.total))}
          detail={`${allDividends.count} ${allDividends.count === 1 ? 'pagamento' : 'pagamentos'}`}
        />
        <Kpi
          label={`IR devido em ${year}`}
          value={value(formatCurrencyBRL(taxDue))}
          valueClassName={taxDue > 0 ? 'text-orange-800' : undefined}
          detail={
            <Link to="/imposto-renda" className="font-semibold text-primary hover:underline">
              Ver apuração mensal →
            </Link>
          }
        />
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeading
            title="Proventos por mês"
            description={`Últimos 12 meses · ${formatCurrencyBRL(monthlyTotal)}`}
            action={
              <div className="flex flex-wrap gap-4 text-sm">
                {chartClasses.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: ASSET_CLASS_COLORS[c] }} />
                    {ASSET_CLASS_LABELS[c]}
                  </span>
                ))}
              </div>
            }
          />
          {isLoading ? (
            <Skeleton className="h-[240px] w-full" />
          ) : (
            <ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full">
              <BarChart data={monthly} margin={{ left: 0, right: 0, top: 4 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={formatCurrencyCompactBRL} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={56} />
                <ChartTooltip
                  cursor={{ fill: 'hsl(var(--muted))' }}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel}
                      formatter={(v, name, item) => (
                        <div className="flex w-full items-center gap-2">
                          <span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
                          <span className="text-muted-foreground">{ASSET_CLASS_LABELS[name as AssetClass] ?? name}</span>
                          <span className="ml-auto font-medium text-foreground">{formatCurrencyBRL(Number(v))}</span>
                        </div>
                      )}
                    />
                  }
                />
                {chartClasses.map((c, i) => (
                  <Bar
                    key={c}
                    dataKey={c}
                    stackId="dividends"
                    fill={ASSET_CLASS_COLORS[c]}
                    radius={i === chartClasses.length - 1 ? [4, 4, 0, 0] : 0}
                    maxBarSize={36}
                  />
                ))}
              </BarChart>
            </ChartContainer>
          )}
        </Panel>

        <Panel>
          <PanelHeading title="Alocação por classe" description="Pelo custo das posições" />
          <div
            role="img"
            aria-label={allocation
              .filter((a) => a.share > 0)
              .map((a) => `${ASSET_CLASS_LABELS[a.assetClass]} ${formatPercent(a.share)}`)
              .join(', ')}
            className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted"
          >
            {allocation
              .filter((a) => a.share > 0)
              .map((a) => (
                <div key={a.assetClass} style={{ flexGrow: a.share, backgroundColor: ASSET_CLASS_COLORS[a.assetClass] }} />
              ))}
          </div>
          <ul className="flex flex-col">
            {allocation
              .filter((a) => a.assetClass !== 'Outro' || a.positions > 0)
              .map((a) => (
                <li key={a.assetClass} className="flex items-center gap-3 border-b py-2.5 last:border-b-0">
                  <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: ASSET_CLASS_COLORS[a.assetClass] }} />
                  {a.positions > 0 ? (
                    <>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm font-semibold">{ASSET_CLASS_LABELS[a.assetClass]}</span>
                        <span className="text-xs text-muted-foreground">
                          {a.positions} {a.positions === 1 ? 'ativo' : 'ativos'}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-semibold">{formatCurrencyBRL(a.value)}</span>
                        <span className="text-xs text-muted-foreground">{formatPercent(a.share)}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-muted-foreground">{ASSET_CLASS_LABELS[a.assetClass]}</span>
                      <span className="text-sm text-muted-foreground">0%</span>
                    </>
                  )}
                </li>
              ))}
          </ul>
          <Link to="/posicao" className="mt-auto text-sm font-semibold text-primary hover:underline">
            Ver posição completa →
          </Link>
        </Panel>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-3">
        <Panel>
          <PanelHeading title="Maiores pagadores" description="Proventos desde o início" />
          {payers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum provento recebido.</p>
          ) : (
            <ul className="flex flex-col gap-3.5">
              {payers.map((p) => (
                <li key={p.ticker} className="flex flex-col gap-1.5">
                  <div className="flex justify-between gap-3 text-sm">
                    <span>
                      <span className="font-mono font-semibold">{p.ticker}</span>
                      <span className="text-muted-foreground"> · {ASSET_CLASS_LABELS[p.assetClass]}</span>
                    </span>
                    <span className="font-semibold">{formatCurrencyBRL(p.value)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${Math.max((p.value / payers[0].value) * 100, 1)}%`, backgroundColor: ASSET_CLASS_COLORS[p.assetClass] }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="gap-2 lg:col-span-2">
          <PanelHeading
            title="Últimas movimentações"
            description="Operações e eventos corporativos"
            action={
              <Link to="/negociacoes" className="text-sm font-semibold text-primary hover:underline">
                Ver todas →
              </Link>
            }
          />
          {latest.length === 0 ? (
            <p className="pt-3 text-sm text-muted-foreground">Nenhuma negociação importada.</p>
          ) : (
            <div className="overflow-x-auto pt-2">
              <table className="w-full min-w-[480px] text-sm">
                <tbody>
                  {latest.map((t) => (
                    <tr key={t.id} className="border-t">
                      <td className="py-2.5 pr-4 text-muted-foreground">{formatDateBR(t.trade_date)}</td>
                      <td className="py-2.5 pr-4 font-mono font-semibold">{t.ticker}</td>
                      <td className="w-full py-2.5 pr-4">
                        <span className={cn('rounded-md px-2 py-0.5 text-xs font-semibold', movementBadgeClass(t.movement_type))}>
                          {movementTypeLabel(t.movement_type)}
                          {(t.movement_type === 'BUY' || t.movement_type === 'SELL') && ` · ${formatNumber(Number(t.quantity), 0)}`}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-semibold whitespace-nowrap">{movementAmount(t)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
