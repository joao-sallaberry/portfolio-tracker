// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown } from 'lucide-react';
import { useTradeOperations } from '@/hooks/use-portfolio-data';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrencyBRL, formatDateBR, formatNumber, formatPercent } from '@/lib/formatters';
import { ASSET_CLASSES, getAssetName } from '@/lib/asset-classifier';
import { ASSET_CLASS_COLORS, ASSET_CLASS_LABELS } from '@/lib/asset-class-colors';
import { calculateClosedPositions, calculatePositions } from '@/lib/portfolio-calculations';
import { searchPositions, sortPositions, type PositionSortKey, type SortConfig } from '@/lib/list-filters';
import { cn } from '@/lib/utils';

const COLUMNS: { key: PositionSortKey; label: string; align: 'left' | 'right' }[] = [
  { key: 'ticker', label: 'Ativo', align: 'left' },
  { key: 'quantity', label: 'Quantidade', align: 'right' },
  { key: 'avgPrice', label: 'Preço médio', align: 'right' },
  { key: 'totalValue', label: 'Custo total', align: 'right' },
];

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card px-6 py-5">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

export default function Posicao() {
  const { data: trades, isLoading } = useTradeOperations();
  const [sort, setSort] = useState<SortConfig<PositionSortKey>>({ key: 'totalValue', direction: 'desc' });
  const [query, setQuery] = useState('');
  const [showClosed, setShowClosed] = useState(false);

  const positions = useMemo(() => calculatePositions(trades), [trades]);
  const closedPositions = useMemo(() => calculateClosedPositions(trades), [trades]);
  const totalCost = positions.reduce((sum, p) => sum + p.totalValue, 0);
  const visible = useMemo(() => sortPositions(searchPositions(positions, query), sort), [positions, query, sort]);

  const classes = ASSET_CLASSES.map((assetClass) => {
    const ofClass = positions.filter((p) => p.assetClass === assetClass);
    const cost = ofClass.reduce((sum, p) => sum + p.totalValue, 0);
    return { assetClass, cost, share: totalCost > 0 ? cost / totalCost : 0, rows: visible.filter((p) => p.assetClass === assetClass) };
  }).filter((c) => c.rows.length > 0 || (!query && positions.some((p) => p.assetClass === c.assetClass)));

  // Numbers sort from the largest first; a second click flips the direction
  const handleSort = (key: PositionSortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: key === 'ticker' ? 'asc' : 'desc' },
    );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-3xl font-bold tracking-tight">Posição</h1>
          <p className="text-sm text-muted-foreground">Quantidade e preço médio de cada ativo em carteira</p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="busca-ativo" className="text-xs font-semibold">Buscar ativo</Label>
          <Input
            id="busca-ativo"
            type="search"
            placeholder="Ticker ou nome"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 w-60 rounded-[10px] bg-card"
          />
        </div>
      </header>

      <section aria-label="Resumo" className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-3">
        <Stat label="Custo total">
          <span className="font-display text-[28px] leading-tight font-bold tracking-tight">
            {isLoading ? <Skeleton className="h-8 w-40" /> : formatCurrencyBRL(totalCost)}
          </span>
        </Stat>
        <Stat label="Ativos em carteira">
          <span className="font-display text-[28px] leading-tight font-bold tracking-tight">
            {isLoading ? <Skeleton className="h-8 w-12" /> : positions.length}
          </span>
        </Stat>
        <Stat label="Por classe">
          <div className="mt-1 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted">
            {ASSET_CLASSES.map((assetClass) => {
              const cost = positions.filter((p) => p.assetClass === assetClass).reduce((sum, p) => sum + p.totalValue, 0);
              return cost > 0 && totalCost > 0 ? (
                <div key={assetClass} style={{ flexGrow: cost / totalCost, backgroundColor: ASSET_CLASS_COLORS[assetClass] }} />
              ) : null;
            })}
          </div>
          <span className="text-sm text-muted-foreground">
            {classes.length === 0
              ? 'Nenhuma posição'
              : classes.map((c) => `${ASSET_CLASS_LABELS[c.assetClass]} ${formatPercent(c.share)}`).join(' · ')}
          </span>
        </Stat>
      </section>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : positions.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">Nenhuma posição encontrada</p>
      ) : classes.every((c) => c.rows.length === 0) ? (
        <p className="py-8 text-center text-muted-foreground">Nenhum ativo corresponde a “{query.trim()}”</p>
      ) : (
        classes
          .filter((c) => c.rows.length > 0)
          .map(({ assetClass, cost, rows }) => (
            <section key={assetClass} aria-label={ASSET_CLASS_LABELS[assetClass]} className="overflow-hidden rounded-xl border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
                <div className="flex items-center gap-2.5">
                  <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: ASSET_CLASS_COLORS[assetClass] }} />
                  <h2 className="text-base font-semibold tracking-normal">{ASSET_CLASS_LABELS[assetClass]}</h2>
                  <span className="text-sm text-muted-foreground">
                    {rows.length} {rows.length === 1 ? 'ativo' : 'ativos'}
                  </span>
                </div>
                <span className="font-bold">{formatCurrencyBRL(cost)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="bg-muted/40 text-xs tracking-wide text-muted-foreground uppercase">
                      {COLUMNS.map((column) => (
                        <th
                          key={column.key}
                          scope="col"
                          aria-sort={sort.key === column.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                          className={cn('px-4 py-2.5 font-semibold first:pl-6', column.align === 'right' ? 'text-right' : 'text-left')}
                        >
                          <button
                            type="button"
                            onClick={() => handleSort(column.key)}
                            className={cn('inline-flex items-center gap-1 uppercase', sort.key === column.key && 'text-foreground')}
                          >
                            {column.label}
                            {sort.key === column.key &&
                              (sort.direction === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                          </button>
                        </th>
                      ))}
                      <th scope="col" className="w-56 py-2.5 pr-6 pl-8 text-left font-semibold">% da carteira</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((position) => {
                      const share = totalCost > 0 ? position.totalValue / totalCost : 0;
                      return (
                        <tr key={position.ticker} className="border-t">
                          <td className="py-2.5 pr-4 pl-6">
                            <span className="font-mono text-[13px] font-semibold">{position.ticker}</span>
                            {getAssetName(position.ticker) && (
                              <span className="ml-2 text-muted-foreground">{getAssetName(position.ticker)}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">{formatNumber(position.quantity, 0)}</td>
                          <td className="px-4 py-2.5 text-right">{formatCurrencyBRL(position.avgPrice)}</td>
                          <td className="px-4 py-2.5 text-right font-semibold">{formatCurrencyBRL(position.totalValue)}</td>
                          <td className="py-2.5 pr-6 pl-8">
                            {position.totalValue < 0 ? (
                              <div className="flex items-center justify-between gap-2.5">
                                <span
                                  title="As restituições de capital somam mais que o custo das compras"
                                  className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-stone-700"
                                >
                                  Restituição &gt; custo
                                </span>
                                <span className="w-12 text-right">{formatPercent(share)}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2.5">
                                <div className="h-1.5 flex-1 rounded-full bg-muted">
                                  <div
                                    className="h-1.5 rounded-full"
                                    style={{ width: `${Math.min(share * 100, 100)}%`, backgroundColor: ASSET_CLASS_COLORS[assetClass] }}
                                  />
                                </div>
                                <span className="w-12 text-right">{formatPercent(share)}</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))
      )}

      {!isLoading && closedPositions.length > 0 && (
        <section className="rounded-xl border border-dashed">
          <button
            type="button"
            aria-expanded={showClosed}
            onClick={() => setShowClosed((open) => !open)}
            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold">Posições encerradas</span>
              <span className="text-sm text-muted-foreground">
                {closedPositions.length} {closedPositions.length === 1 ? 'ativo vendido' : 'ativos vendidos'} por completo
              </span>
            </span>
            <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', showClosed && 'rotate-180')} />
          </button>
          {showClosed && (
            <ul className="border-t px-5 py-2">
              {closedPositions.map((closed) => (
                <li key={closed.ticker} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>
                    <span className="font-mono text-[13px] font-semibold">{closed.ticker}</span>
                    <span className="ml-2 text-muted-foreground">{ASSET_CLASS_LABELS[closed.assetClass]}</span>
                  </span>
                  <span className="text-muted-foreground">encerrada em {formatDateBR(closed.closedOn)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
