import { useState } from 'react';
import { Wallet, TrendingUp, Trash2 } from 'lucide-react';
import { FileUploadCard } from '@/components/import/FileUploadCard';
import { PreviewTable } from '@/components/import/PreviewTable';
import { parseProventosFile, parseNegociacaoFileAuto, type DividendEventRow, type TradeOperationRow, type ParseResult } from '@/lib/xlsx-parser';
import { supabase } from '@/integrations/supabase/client';
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

interface ProventosState {
  state: ImportState;
  parseResult: ParseResult<DividendEventRow> | null;
  message: string;
}

interface NegociacaoState {
  state: ImportState;
  parseResult: ParseResult<TradeOperationRow> | null;
  message: string;
}

export default function Import() {
  const [proventos, setProventos] = useState<ProventosState>({
    state: 'idle',
    parseResult: null,
    message: '',
  });

  const [negociacao, setNegociacao] = useState<NegociacaoState>({
    state: 'idle',
    parseResult: null,
    message: '',
  });

  const handleProventosFile = async (file: File) => {
    setProventos({ state: 'parsing', parseResult: null, message: '' });

    try {
      const result = await parseProventosFile(file);

      if (result.errors.length > 0) {
        setProventos({
          state: 'preview',
          parseResult: result,
          message: result.errors[0],
        });
      } else {
        setProventos({
          state: 'preview',
          parseResult: result,
          message: '',
        });
      }
    } catch (err) {
      setProventos({
        state: 'error',
        parseResult: null,
        message: `Erro ao processar arquivo: ${err}`,
      });
    }
  };

  const handleNegociacaoFile = async (file: File) => {
    setNegociacao({ state: 'parsing', parseResult: null, message: '' });

    try {
      const result = await parseNegociacaoFileAuto(file);

      if (result.errors.length > 0) {
        setNegociacao({
          state: 'preview',
          parseResult: result,
          message: result.errors[0],
        });
      } else {
        setNegociacao({
          state: 'preview',
          parseResult: result,
          message: '',
        });
      }
    } catch (err) {
      setNegociacao({
        state: 'error',
        parseResult: null,
        message: `Erro ao processar arquivo: ${err}`,
      });
    }
  };

  const confirmProventosImport = async () => {
    if (!proventos.parseResult) return;

    setProventos(prev => ({ ...prev, state: 'importing' }));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // 1. Fetch existing data for comparison (Limit to relevant fields usually, but select * is fine for small datasets)
      // fetching all might be heavy for huge users, but for now it's okay.
      const { data: existingEvents } = await supabase
        .from('dividend_events')
        .select('*');

      const existingMap = new Map<string, number>();
      existingEvents?.forEach(ev => {
        const key = `${ev.ticker}-${ev.payment_date}-${ev.event_type}-${ev.quantity}-${ev.net_value}`;
        existingMap.set(key, (existingMap.get(key) || 0) + 1);
      });

      const rowsToInsert = [];
      const incomingMap = new Map<string, number>(); // Count usage within the file itself

      // Prepare rows for inserting
      const candidates = proventos.parseResult.data.map(row => ({
        product_raw: row.productRaw,
        ticker: row.ticker,
        payment_date: row.paymentDate.toISOString().split('T')[0],
        event_type: row.eventType,
        institution: row.institution,
        quantity: row.quantity,
        unit_price: row.unitPrice,
        net_value: row.netValue,
        user_id: user.id,
      }));

      for (const row of candidates) {
        const key = `${row.ticker}-${row.payment_date}-${row.event_type}-${row.quantity}-${row.net_value}`;

        const existingCount = existingMap.get(key) || 0;
        const usedCount = incomingMap.get(key) || 0;

        if (usedCount < existingCount) {
          // We found one match in DB that "absorbs" this file row
          // "Mark" it as matched by incrementing our usage count
          incomingMap.set(key, usedCount + 1);
          // Skip insertion
        } else {
          // We have more in file than in DB (or none in DB) -> Insert this one
          rowsToInsert.push(row);
          // Also increment usage in case there are 3 in file and 1 in DB
          incomingMap.set(key, usedCount + 1);
        }
      }

      if (rowsToInsert.length === 0) {
        setProventos({
          state: 'success',
          parseResult: null,
          message: `Todos os ${candidates.length} proventos já estavam cadastrados.`,
        });
        toast.info("Nenhum dado novo para importar.");
        return;
      }

      const { error } = await supabase
        .from('dividend_events')
        .insert(rowsToInsert);

      if (error) throw error;

      setProventos({
        state: 'success',
        parseResult: null,
        message: `${rowsToInsert.length} novos proventos importados (${candidates.length - rowsToInsert.length} duplicados ignorados).`,
      });
      toast.success(`${rowsToInsert.length} importados com sucesso!`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message :
        (typeof err === 'object' && err !== null && 'message' in err) ? String((err as { message: unknown }).message) :
          String(err);
      setProventos(prev => ({
        ...prev,
        state: 'error',
        message: `Erro ao importar: ${errorMessage}`,
      }));
      toast.error('Erro ao importar proventos');
    }
  };

  const confirmNegociacaoImport = async () => {
    if (!negociacao.parseResult) return;

    setNegociacao(prev => ({ ...prev, state: 'importing' }));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // 1. Fetch existing data
      const { data: existingTrades } = await supabase
        .from('trade_operations')
        .select('*');

      const existingMap = new Map<string, number>();
      existingTrades?.forEach(tr => {
        // Key excluding ID, created_at, etc
        const key = `${tr.trade_date}-${tr.movement_type}-${tr.ticker}-${tr.quantity}-${tr.total_value}`;
        existingMap.set(key, (existingMap.get(key) || 0) + 1);
      });

      const rowsToInsert = [];
      const incomingMap = new Map<string, number>();

      const candidates = negociacao.parseResult.data.map(row => ({
        trade_date: row.tradeDate.toISOString().split('T')[0],
        movement_type: row.movementType,
        movement_type_raw: row.movementTypeRaw,
        market: row.market,
        maturity: row.maturity,
        institution: row.institution,
        ticker: row.ticker,
        quantity: row.quantity,
        price: row.price,
        total_value: row.totalValue,
        user_id: user.id,
      }));

      for (const row of candidates) {
        const key = `${row.trade_date}-${row.movement_type}-${row.ticker}-${row.quantity}-${row.total_value}`;

        const existingCount = existingMap.get(key) || 0;
        const usedCount = incomingMap.get(key) || 0;

        if (usedCount < existingCount) {
          // Absorbed by existing record
          incomingMap.set(key, usedCount + 1);
        } else {
          // New record
          rowsToInsert.push(row);
          incomingMap.set(key, usedCount + 1);
        }
      }

      if (rowsToInsert.length === 0) {
        setNegociacao({
          state: 'success',
          parseResult: null,
          message: `Todas as ${candidates.length} negociações já estavam cadastradas.`,
        });
        toast.info("Nenhuma negociação nova.");
        return;
      }

      const { error } = await supabase
        .from('trade_operations')
        .insert(rowsToInsert);

      if (error) throw error;

      setNegociacao({
        state: 'success',
        parseResult: null,
        message: `${rowsToInsert.length} novas negociações importadas (${candidates.length - rowsToInsert.length} duplicadas ignoradas).`,
      });
      toast.success(`${rowsToInsert.length} importadas com sucesso!`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message :
        (typeof err === 'object' && err !== null && 'message' in err) ? String((err as { message: unknown }).message) :
          String(err);
      setNegociacao(prev => ({
        ...prev,
        state: 'error',
        message: `Erro ao importar: ${errorMessage}`,
      }));
      toast.error('Erro ao importar negociações');
    }
  };

  const cancelProventosPreview = () => {
    setProventos({ state: 'idle', parseResult: null, message: '' });
  };

  const cancelNegociacaoPreview = () => {
    setNegociacao({ state: 'idle', parseResult: null, message: '' });
  };

  const clearProventosHistory = async () => {
    try {
      const { error } = await supabase.from('dividend_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      toast.success('Histórico de proventos limpo com sucesso!');
    } catch (err) {
      toast.error('Erro ao limpar histórico de proventos');
    }
  };

  const clearNegociacaoHistory = async () => {
    try {
      const { error } = await supabase.from('trade_operations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
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
