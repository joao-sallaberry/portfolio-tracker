import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Wallet, TrendingUp, Trash2 } from 'lucide-react';
import { FileUploadCard } from '@/components/import/FileUploadCard';
import { PreviewTable } from '@/components/import/PreviewTable';
import { parseProventosFile, parseNegociacaoFileAuto, type DividendEventRow, type TradeOperationRow, type ParseResult } from '@/lib/xlsx-parser';
import { dividendKey, rowsToInsert, tradeKey } from '@/lib/import-dedupe';
import { formatISODateLocal } from '@/lib/formatters';
import { supabase } from '@/integrations/supabase/client';
import { DIVIDEND_EVENTS_KEY, TRADE_OPERATIONS_KEY, fetchAllDividendEvents, fetchAllTradeOperations } from '@/hooks/use-portfolio-data';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type ImportState = 'idle' | 'parsing' | 'preview' | 'importing' | 'success' | 'error';

interface FlowState<T> {
  state: ImportState;
  parseResult: T | null;
  message: string;
}

const IDLE = { state: 'idle', parseResult: null, message: '' } as const;

const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message :
    (typeof err === 'object' && err !== null && 'message' in err) ? String((err as { message: unknown }).message) :
      String(err);

async function currentUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');
  return user.id;
}

/** Inserts the dividend events that aren't stored yet; returns how many were inserted. */
async function insertNewDividends(rows: DividendEventRow[], userId: string) {
  const candidates = rows
    .filter((row) => !row.hasErrors)
    .map((row) => ({
      product_raw: row.productRaw,
      ticker: row.ticker,
      payment_date: row.paymentDate ? formatISODateLocal(row.paymentDate) : '',
      event_type: row.eventType,
      institution: row.institution,
      quantity: row.quantity,
      unit_price: row.unitPrice,
      net_value: row.netValue,
      user_id: userId,
    }));
  // All stored rows, paginated (a plain select stops at 1000 rows)
  const newRows = rowsToInsert(await fetchAllDividendEvents(), candidates, dividendKey, dividendKey);
  if (newRows.length) {
    const { error } = await supabase.from('dividend_events').insert(newRows);
    if (error) throw error;
  }
  return { inserted: newRows.length, total: candidates.length };
}

/** Inserts the trades that aren't stored yet; returns how many were inserted. */
async function insertNewTrades(rows: TradeOperationRow[], userId: string) {
  const candidates = rows
    .filter((row) => !row.hasErrors)
    .map((row) => ({
      trade_date: row.tradeDate ? formatISODateLocal(row.tradeDate) : '',
      movement_type: row.movementType,
      movement_type_raw: row.movementTypeRaw,
      market: row.market,
      maturity: row.maturity,
      institution: row.institution,
      ticker: row.ticker,
      quantity: row.quantity,
      price: row.price,
      total_value: row.totalValue,
      user_id: userId,
    }));
  const newRows = rowsToInsert(await fetchAllTradeOperations(), candidates, tradeKey, tradeKey);
  if (newRows.length) {
    const { error } = await supabase.from('trade_operations').insert(newRows);
    if (error) throw error;
  }
  return { inserted: newRows.length, total: candidates.length };
}

export default function Import() {
  const queryClient = useQueryClient();
  const [proventos, setProventos] = useState<FlowState<ParseResult<DividendEventRow>>>(IDLE);
  const [negociacao, setNegociacao] = useState<FlowState<ParseResult<TradeOperationRow>>>(IDLE);

  const parseInto = async <T extends { errors: string[] }>(
    file: File,
    parse: (file: File) => Promise<T>,
    setFlow: (flow: FlowState<T>) => void,
  ) => {
    setFlow({ state: 'parsing', parseResult: null, message: '' });
    try {
      const result = await parse(file);
      setFlow({ state: 'preview', parseResult: result, message: result.errors[0] ?? '' });
    } catch (err) {
      setFlow({ state: 'error', parseResult: null, message: `Erro ao processar arquivo: ${err}` });
    }
  };

  const handleProventosFile = (file: File) => parseInto(file, parseProventosFile, setProventos);
  const handleNegociacaoFile = (file: File) => parseInto(file, parseNegociacaoFileAuto, setNegociacao);

  const confirmProventosImport = async () => {
    if (!proventos.parseResult) return;
    setProventos((prev) => ({ ...prev, state: 'importing' }));

    try {
      const { inserted, total } = await insertNewDividends(proventos.parseResult.data, await currentUserId());
      if (inserted === 0) {
        setProventos({ state: 'success', parseResult: null, message: `Todos os ${total} proventos já estavam cadastrados.` });
        toast.info('Nenhum dado novo para importar.');
        return;
      }
      queryClient.invalidateQueries({ queryKey: DIVIDEND_EVENTS_KEY });
      setProventos({
        state: 'success',
        parseResult: null,
        message: `${inserted} novos proventos importados (${total - inserted} duplicados ignorados).`,
      });
      toast.success(`${inserted} importados com sucesso!`);
    } catch (err) {
      setProventos((prev) => ({ ...prev, state: 'error', message: `Erro ao importar: ${errorMessage(err)}` }));
      toast.error('Erro ao importar proventos');
    }
  };

  const confirmNegociacaoImport = async () => {
    if (!negociacao.parseResult) return;
    setNegociacao((prev) => ({ ...prev, state: 'importing' }));

    try {
      const { inserted, total } = await insertNewTrades(negociacao.parseResult.data, await currentUserId());
      if (inserted === 0) {
        setNegociacao({ state: 'success', parseResult: null, message: `Todas as ${total} negociações já estavam cadastradas.` });
        toast.info('Nenhuma negociação nova.');
        return;
      }
      queryClient.invalidateQueries({ queryKey: TRADE_OPERATIONS_KEY });
      setNegociacao({
        state: 'success',
        parseResult: null,
        message: `${inserted} novas negociações importadas (${total - inserted} duplicadas ignoradas).`,
      });
      toast.success(`${inserted} importadas com sucesso!`);
    } catch (err) {
      setNegociacao((prev) => ({ ...prev, state: 'error', message: `Erro ao importar: ${errorMessage(err)}` }));
      toast.error('Erro ao importar negociações');
    }
  };

  const cancelProventosPreview = () => setProventos(IDLE);
  const cancelNegociacaoPreview = () => setNegociacao(IDLE);

  const clearProventosHistory = async () => {
    try {
      const { error } = await supabase.from('dividend_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: DIVIDEND_EVENTS_KEY });
      toast.success('Histórico de proventos limpo com sucesso!');
    } catch (err) {
      toast.error('Erro ao limpar histórico de proventos');
    }
  };

  const clearNegociacaoHistory = async () => {
    try {
      const { error } = await supabase.from('trade_operations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: TRADE_OPERATIONS_KEY });
      toast.success('Histórico de negociações limpo com sucesso!');
    } catch (err) {
      toast.error('Erro ao limpar histórico de negociações');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Importar Dados</h1>
        <p className="mt-2 text-muted-foreground">
          Importe seus extratos da corretora para visualizar seu portfólio
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <FileUploadCard
          title="Proventos Recebidos"
          description="Dividendos, JCP, rendimentos e outros proventos"
          icon={<Wallet className="h-6 w-6" />}
          onFileSelect={handleProventosFile}
          isLoading={proventos.state === 'parsing'}
          status={
            proventos.state === 'success' ? 'success' :
              proventos.state === 'error' ? 'error' : 'idle'
          }
          statusMessage={proventos.message}
        />

        <FileUploadCard
          title="Negociações"
          description="Compras, vendas, desdobramentos e grupamentos (XLSX ou CSV)"
          icon={<TrendingUp className="h-6 w-6" />}
          onFileSelect={handleNegociacaoFile}
          isLoading={negociacao.state === 'parsing'}
          status={
            negociacao.state === 'success' ? 'success' :
              negociacao.state === 'error' ? 'error' : 'idle'
          }
          statusMessage={negociacao.message}
          acceptFormats=".xlsx,.xls,.csv"
        />
      </div>

      <div className="flex flex-wrap gap-4">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="text-destructive hover:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Limpar Histórico de Proventos
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Limpar Histórico de Proventos</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja apagar todos os proventos importados? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={clearProventosHistory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Limpar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="text-destructive hover:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Limpar Histórico de Negociações
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Limpar Histórico de Negociações</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja apagar todas as negociações importadas? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={clearNegociacaoHistory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Limpar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {(proventos.state === 'preview' || proventos.state === 'importing') && proventos.parseResult && (
        <PreviewTable
          title="Prévia: Proventos Recebidos"
          data={proventos.parseResult.data}
          errors={proventos.parseResult.errors}
          warnings={proventos.parseResult.warnings}
          totalRows={proventos.parseResult.totalRows}
          onConfirm={confirmProventosImport}
          onCancel={cancelProventosPreview}
          isImporting={proventos.state === 'importing'}
          type="proventos"
        />
      )}

      {(negociacao.state === 'preview' || negociacao.state === 'importing') && negociacao.parseResult && (
        <PreviewTable
          title="Prévia: Negociações"
          data={negociacao.parseResult.data}
          errors={negociacao.parseResult.errors}
          warnings={negociacao.parseResult.warnings}
          totalRows={negociacao.parseResult.totalRows}
          onConfirm={confirmNegociacaoImport}
          onCancel={cancelNegociacaoPreview}
          isImporting={negociacao.state === 'importing'}
          type="negociacao"
        />
      )}
    </div>
  );
}
