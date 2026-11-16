// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from 'react';
import { Wallet, TrendingUp, Trash2, ArrowLeftRight } from 'lucide-react';
import { FileUploadCard } from '@/components/import/FileUploadCard';
import { PreviewTable } from '@/components/import/PreviewTable';
import { MovimentacaoPreview } from '@/components/import/MovimentacaoPreview';
import { parseProventosFile, parseNegociacaoFileAuto, type TradeOperationRow, type ParseResult, type ProventosParseResult } from '@/lib/xlsx-parser';
import { parseMovimentacaoFile, type MovimentacaoResult } from '@/lib/b3-movimentacao';
import { useClearTable, useImportRows } from '@/hooks/use-portfolio-mutations';
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

export default function Import() {
  const importRows = useImportRows();
  const clearDividends = useClearTable('dividend_events');
  const clearTrades = useClearTable('trade_operations');
  const [proventos, setProventos] = useState<FlowState<ProventosParseResult>>(IDLE);
  const [negociacao, setNegociacao] = useState<FlowState<ParseResult<TradeOperationRow>>>(IDLE);
  const [movimentacao, setMovimentacao] = useState<FlowState<MovimentacaoResult>>(IDLE);

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
  const handleMovimentacaoFile = (file: File) => parseInto(file, parseMovimentacaoFile, setMovimentacao);

  const confirmProventosImport = async () => {
    if (!proventos.parseResult) return;
    setProventos((prev) => ({ ...prev, state: 'importing' }));

    try {
      // Capital returns go to trade_operations as amortizations
      const { dividends: { inserted, total }, trades: amortizations } = await importRows.mutateAsync({
        dividends: proventos.parseResult.data,
        trades: proventos.parseResult.trades,
      });
      if (inserted + amortizations.inserted === 0) {
        setProventos({ state: 'success', parseResult: null, message: `Todos os ${total + amortizations.total} registros já estavam cadastrados.` });
        toast.info('Nenhum dado novo para importar.');
        return;
      }
      const amortizationNote = amortizations.inserted ? ` ${amortizations.inserted} amortizações importadas em Negociações.` : '';
      setProventos({
        state: 'success',
        parseResult: null,
        message: `${inserted} novos proventos importados (${total - inserted} duplicados ignorados).${amortizationNote}`,
      });
      toast.success(`${inserted + amortizations.inserted} importados com sucesso!`);
    } catch (err) {
      setProventos((prev) => ({ ...prev, state: 'error', message: `Erro ao importar: ${errorMessage(err)}` }));
      toast.error('Erro ao importar proventos');
    }
  };

  const confirmNegociacaoImport = async () => {
    if (!negociacao.parseResult) return;
    setNegociacao((prev) => ({ ...prev, state: 'importing' }));

    try {
      const { trades: { inserted, total } } = await importRows.mutateAsync({ trades: negociacao.parseResult.data });
      if (inserted === 0) {
        setNegociacao({ state: 'success', parseResult: null, message: `Todas as ${total} negociações já estavam cadastradas.` });
        toast.info('Nenhuma negociação nova.');
        return;
      }
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

  const confirmMovimentacaoImport = async () => {
    if (!movimentacao.parseResult) return;
    setMovimentacao((prev) => ({ ...prev, state: 'importing' }));

    try {
      const { dividends, trades } = await importRows.mutateAsync({
        dividends: movimentacao.parseResult.dividends,
        trades: movimentacao.parseResult.trades,
      });

      const duplicates = dividends.total - dividends.inserted + trades.total - trades.inserted;
      setMovimentacao({
        state: 'success',
        parseResult: null,
        message: `${dividends.inserted} proventos e ${trades.inserted} eventos importados (${duplicates} já cadastrados ignorados).`,
      });
      if (dividends.inserted + trades.inserted === 0) toast.info('Nenhum dado novo para importar.');
      else toast.success(`${dividends.inserted + trades.inserted} importados com sucesso!`);
    } catch (err) {
      setMovimentacao((prev) => ({ ...prev, state: 'error', message: `Erro ao importar: ${errorMessage(err)}` }));
      toast.error('Erro ao importar movimentações');
    }
  };

  const cancelProventosPreview = () => setProventos(IDLE);
  const cancelNegociacaoPreview = () => setNegociacao(IDLE);
  const cancelMovimentacaoPreview = () => setMovimentacao(IDLE);

  const clearProventosHistory = () =>
    clearDividends.mutate(undefined, {
      onSuccess: () => toast.success('Histórico de proventos limpo com sucesso!'),
      onError: () => toast.error('Erro ao limpar histórico de proventos'),
    });

  const clearNegociacaoHistory = () =>
    clearTrades.mutate(undefined, {
      onSuccess: () => toast.success('Histórico de negociações limpo com sucesso!'),
      onError: () => toast.error('Erro ao limpar histórico de negociações'),
    });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Importar Dados</h1>
        <p className="mt-2 text-muted-foreground">
          Importe seus extratos da corretora para visualizar seu portfólio
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
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

        <FileUploadCard
          title="Movimentações (B3)"
          description="Extrato de movimentação da B3: proventos, desdobros, bonificações, amortizações e resgates"
          icon={<ArrowLeftRight className="h-6 w-6" />}
          onFileSelect={handleMovimentacaoFile}
          isLoading={movimentacao.state === 'parsing'}
          status={
            movimentacao.state === 'success' ? 'success' :
              movimentacao.state === 'error' ? 'error' : 'idle'
          }
          statusMessage={movimentacao.message}
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

      {(movimentacao.state === 'preview' || movimentacao.state === 'importing') && movimentacao.parseResult && (
        <MovimentacaoPreview
          result={movimentacao.parseResult}
          onConfirm={confirmMovimentacaoImport}
          onCancel={cancelMovimentacaoPreview}
          isImporting={movimentacao.state === 'importing'}
        />
      )}
    </div>
  );
}
