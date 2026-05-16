import { useState, useMemo, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDateBR, formatCurrencyBRL, formatNumber, parseISODateLocal } from '@/lib/formatters';
import { classifyAsset, AssetClass } from '@/lib/asset-classifier';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp, TrendingDown, CalendarIcon, X, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const ITEMS_PER_PAGE = 50;

export default function Negociacoes() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [tickerFilter, setTickerFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingTrade, setEditingTrade] = useState<any | null>(null);

  const { data: trades, isLoading } = useQuery({
    queryKey: ['trade-operations', 'v2'],
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
          .order('trade_date', { ascending: false })
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

  const toggleExcludeFromIr = useMutation({
    mutationFn: async ({ id, exclude_from_ir }: { id: string; exclude_from_ir: boolean }) => {
      const { error } = await supabase.from('trade_operations').update({ exclude_from_ir }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trade-operations'] });
    },
  });

  const updateTrade = useMutation({
    mutationFn: async (updatedTrade: any) => {
      const { id, trade_date, movement_type, movement_type_raw, ticker, institution, quantity, price, total_value } = updatedTrade;
      const payload = {
        trade_date,
        movement_type,
        movement_type_raw,
        ticker,
        institution,
        quantity,
        price,
        total_value,
      };
      const { error } = await supabase.from('trade_operations').update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trade-operations'] });
      toast({
        title: "Negociação atualizada",
        description: "A negociação foi salva com sucesso.",
      });
      setEditingTrade(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a negociação.",
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

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [startDate, endDate, typeFilter, tickerFilter, classFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredTrades.length / ITEMS_PER_PAGE);
  const paginatedTrades = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTrades.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredTrades, currentPage]);

  const totalBuys = filteredTrades.filter(t => t.movement_type === 'BUY' || t.movement_type === 'BONUS').reduce((sum, t) => sum + Number(t.total_value), 0);
  const totalSells = filteredTrades.filter(t => t.movement_type === 'SELL' || t.movement_type === 'AMORTIZATION').reduce((sum, t) => sum + Number(t.total_value), 0);

  const hasActiveFilters = startDate || endDate || typeFilter !== 'all' || tickerFilter !== 'all' || classFilter !== 'all';

  const clearFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setTypeFilter('all');
    setTickerFilter('all');
    setClassFilter('all');
    setCurrentPage(1);
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[140px] justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy") : "Data início"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              {/* End Date Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[140px] justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy") : "Data fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

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
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t pt-4 mt-4">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, filteredTrades.length)} de {filteredTrades.length} operações
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            className="w-9"
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Próximo
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
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
