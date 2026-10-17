import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TRADE_OPERATIONS_KEY, useTradeOperations, type TradeOperation } from '@/hooks/use-portfolio-data';
import { usePagination } from '@/hooks/use-pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDateBR, formatCurrencyBRL, formatNumber, parseISODateLocal, normalizeTicker } from '@/lib/formatters';
import { classifyAsset, AssetClass } from '@/lib/asset-classifier';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp, TrendingDown, X, Pencil } from 'lucide-react';
import { PaginationControls } from '@/components/PaginationControls';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const ITEMS_PER_PAGE = 50;

// Number inputs hold strings while the user edits them
type EditableTrade = Omit<TradeOperation, 'quantity' | 'price' | 'total_value'> & {
  quantity: number | string;
  price: number | string;
  total_value: number | string;
};

export default function Negociacoes() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [tickerFilter, setTickerFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [editingTrade, setEditingTrade] = useState<EditableTrade | null>(null);

  const { data: tradesAsc, isLoading } = useTradeOperations();
  // Newest first for display
  const trades = useMemo(() => (tradesAsc ? [...tradesAsc].reverse() : undefined), [tradesAsc]);

  const toggleExcludeFromIr = useMutation({
    mutationFn: async ({ id, exclude_from_ir }: { id: string; exclude_from_ir: boolean }) => {
      const { error } = await supabase.from('trade_operations').update({ exclude_from_ir }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRADE_OPERATIONS_KEY });
    },
  });

  const updateTrade = useMutation({
    mutationFn: async (updatedTrade: EditableTrade) => {
      const { id, trade_date, movement_type, movement_type_raw, ticker, institution, quantity, price, total_value } = updatedTrade;
      const toNumber = (value: number | string, invalidMessage: string) => {
        const n = typeof value === 'number' ? value : Number(value);
        if (value === '' || !Number.isFinite(n)) throw new Error(invalidMessage);
        return n;
      };
      const payload = {
        trade_date,
        movement_type,
        movement_type_raw,
        ticker: normalizeTicker(ticker),
        institution,
        quantity: toNumber(quantity, 'Quantidade inválida.'),
        price: toNumber(price, 'Preço inválido.'),
        total_value: toNumber(total_value, 'Valor total inválido.'),
      };
      const { error } = await supabase.from('trade_operations').update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRADE_OPERATIONS_KEY });
      toast({
        title: "Negociação atualizada",
        description: "A negociação foi salva com sucesso.",
      });
      setEditingTrade(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: `Não foi possível atualizar a negociação. ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTrade) updateTrade.mutate(editingTrade);
  };

  // Extract unique values for filters
  const uniqueTickers = useMemo(() => {
    if (!trades) return [];
    return [...new Set(trades.map(t => t.ticker))].sort();
  }, [trades]);

  const uniqueTypes = useMemo(() => {
    if (!trades) return [];
    return [...new Set(trades.map(t => t.movement_type))].sort();
  }, [trades]);

  const uniqueClasses = useMemo(() => {
    if (!trades) return [];
    const classes = trades.map(t => classifyAsset(t.ticker));
    return [...new Set(classes)].sort() as AssetClass[];
  }, [trades]);

  const filteredTrades = useMemo(() => {
    if (!trades) return [];

    return trades.filter(t => {
      const tradeDate = parseISODateLocal(t.trade_date) ?? new Date(t.trade_date);

      // Start date filter
      if (startDate && tradeDate < startDate) return false;

      // End date filter
      if (endDate && tradeDate > endDate) return false;

      // Type filter
      if (typeFilter !== 'all' && t.movement_type !== typeFilter) return false;

      // Ticker filter
      if (tickerFilter !== 'all' && t.ticker !== tickerFilter) return false;

      // Class filter
      if (classFilter !== 'all' && classifyAsset(t.ticker) !== classFilter) return false;

      return true;
    });
  }, [trades, startDate, endDate, typeFilter, tickerFilter, classFilter]);

  // Back to page 1 whenever the filters change
  const { currentPage, setCurrentPage, pageItems: paginatedTrades } = usePagination(
    filteredTrades,
    ITEMS_PER_PAGE,
    JSON.stringify([startDate, endDate, typeFilter, tickerFilter, classFilter])
  );

  const totalBuys = filteredTrades.filter(t => t.movement_type === 'BUY' || t.movement_type === 'BONUS').reduce((sum, t) => sum + Number(t.total_value), 0);
  const totalSells = filteredTrades.filter(t => t.movement_type === 'SELL' || t.movement_type === 'AMORTIZATION').reduce((sum, t) => sum + Number(t.total_value), 0);

  const hasActiveFilters = startDate || endDate || typeFilter !== 'all' || tickerFilter !== 'all' || classFilter !== 'all';

  const clearFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setTypeFilter('all');
    setTickerFilter('all');
    setClassFilter('all');
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'BUY': return 'Compra';
      case 'SELL': return 'Venda';
      case 'BONUS': return 'Bonificação';
      case 'AMORTIZATION': return 'Amortização';
      case 'SPLIT': return 'Desdobramento';
      case 'REVERSE_SPLIT': return 'Grupamento';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Negociações</h1>
        <p className="mt-2 text-muted-foreground">
          Histórico de compras e vendas de ativos
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total em Compras</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl text-success">
              <TrendingUp className="h-5 w-5" />
              {isLoading ? <Skeleton className="h-8 w-32" /> : formatCurrencyBRL(totalBuys)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total em Vendas</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl text-destructive">
              <TrendingDown className="h-5 w-5" />
              {isLoading ? <Skeleton className="h-8 w-32" /> : formatCurrencyBRL(totalSells)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de Operações</CardDescription>
            <CardTitle className="text-2xl">
              {isLoading ? <Skeleton className="h-8 w-16" /> : filteredTrades.length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Histórico de Negociações</CardTitle>
              <CardDescription>
                {filteredTrades.length} operações registradas
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Type Filter */}
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {uniqueTypes.map(type => (
                    <SelectItem key={type} value={type}>{getTypeLabel(type)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

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

              {/* Class Filter */}
              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Classe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as classes</SelectItem>
                  {uniqueClasses.map(cls => (
                    <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Start Date Filter */}
              <Input
                type="date"
                value={startDate ? format(startDate, "yyyy-MM-dd") : ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    setStartDate(undefined);
                  } else {
                    setStartDate(new Date(val + 'T00:00:00'));
                  }
                }}
                className={cn("w-[140px]", !startDate && "text-muted-foreground")}
              />

              {/* End Date Filter */}
              <Input
                type="date"
                value={endDate ? format(endDate, "yyyy-MM-dd") : ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    setEndDate(undefined);
                  } else {
                    setEndDate(new Date(val + 'T00:00:00'));
                  }
                }}
                className={cn("w-[140px]", !endDate && "text-muted-foreground")}
              />

              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button variant="ghost" size="icon" onClick={clearFilters}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredTrades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <TrendingUp className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="text-lg font-medium">Nenhuma negociação encontrada</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasActiveFilters ? 'Tente ajustar os filtros' : 'Importe seu extrato para ver suas operações'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Ativo</TableHead>
                      <TableHead>Classe</TableHead>
                      <TableHead>Instituição</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead className="text-right">Preço</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                      <TableHead className="min-w-[7.5rem] text-center whitespace-normal leading-tight">
                        Excluir do IR
                      </TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTrades.map((trade) => (
                      <TableRow key={trade.id}>
                        <TableCell>{formatDateBR(trade.trade_date)}</TableCell>
                        <TableCell>
                          <span className={trade.movement_type === 'BUY' || trade.movement_type === 'BONUS' ? 'text-success font-medium' : 'text-destructive font-medium'}>
                            {trade.movement_type_raw}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono font-medium">{trade.ticker}</TableCell>
                        <TableCell>{classifyAsset(trade.ticker)}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{trade.institution}</TableCell>
                        <TableCell className="text-right font-mono">{formatNumber(Number(trade.quantity), 0)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrencyBRL(Number(trade.price))}</TableCell>
                        <TableCell className="text-right font-mono font-medium">{formatCurrencyBRL(Number(trade.total_value))}</TableCell>
                        <TableCell className="text-center">
                          {trade.movement_type === 'SELL' ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex justify-center">
                                  <Switch
                                    checked={Boolean(trade.exclude_from_ir)}
                                    disabled={toggleExcludeFromIr.isPending}
                                    onCheckedChange={(checked) =>
                                      toggleExcludeFromIr.mutate({ id: trade.id, exclude_from_ir: checked })
                                    }
                                    aria-label="Excluir venda do cálculo de Imposto de Renda"
                                    className={cn(
                                      'data-[state=checked]:border-destructive data-[state=checked]:bg-destructive',
                                    )}
                                  />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-xs">
                                Quando ativo, a venda aparece em Imposto de Renda mas não entra em totais, isenção de
                                R$ 20 mil nem prejuízo acumulado. O preço médio do ativo continua sendo calculado com
                                esta venda.
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingTrade({ ...trade })}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <PaginationControls
                currentPage={currentPage}
                pageSize={ITEMS_PER_PAGE}
                totalItems={filteredTrades.length}
                itemLabel="operações"
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingTrade} onOpenChange={(open) => !open && setEditingTrade(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Negociação</DialogTitle>
          </DialogHeader>
          {editingTrade && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input 
                    type="date" 
                    value={editingTrade.trade_date ? editingTrade.trade_date.split('T')[0] : ''} 
                    onChange={(e) => setEditingTrade({ ...editingTrade, trade_date: e.target.value })} 
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select 
                    value={editingTrade.movement_type} 
                    onValueChange={(val) => setEditingTrade({ 
                      ...editingTrade, 
                      movement_type: val, 
                      movement_type_raw: getTypeLabel(val) 
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BUY">Compra</SelectItem>
                      <SelectItem value="SELL">Venda</SelectItem>
                      <SelectItem value="BONUS">Bonificação</SelectItem>
                      <SelectItem value="AMORTIZATION">Amortização</SelectItem>
                      <SelectItem value="SPLIT">Desdobramento</SelectItem>
                      <SelectItem value="REVERSE_SPLIT">Grupamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ativo</Label>
                  <Input 
                    value={editingTrade.ticker} 
                    onChange={(e) => setEditingTrade({ ...editingTrade, ticker: e.target.value.toUpperCase() })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Instituição</Label>
                  <Input 
                    value={editingTrade.institution} 
                    onChange={(e) => setEditingTrade({ ...editingTrade, institution: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input 
                    type="number" 
                    step="0.000001"
                    value={editingTrade.quantity} 
                    onChange={(e) => setEditingTrade({ ...editingTrade, quantity: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preço</Label>
                  <Input 
                    type="number" 
                    step="0.01"
                    value={editingTrade.price} 
                    onChange={(e) => setEditingTrade({ ...editingTrade, price: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Valor Total</Label>
                  <Input 
                    type="number" 
                    step="0.01"
                    value={editingTrade.total_value} 
                    onChange={(e) => setEditingTrade({ ...editingTrade, total_value: e.target.value })}
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingTrade(null)}>Cancelar</Button>
                <Button type="submit" disabled={updateTrade.isPending}>Salvar</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
