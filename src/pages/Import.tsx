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
      const rows = proventos.parseResult.data.map(row => ({
        product_raw: row.productRaw,
        ticker: row.ticker,
        payment_date: row.paymentDate.toISOString().split('T')[0],
        event_type: row.eventType,
        institution: row.institution,
        quantity: row.quantity,
        unit_price: row.unitPrice,
        net_value: row.netValue,
      }));

      const { error } = await supabase
        .from('dividend_events')
        .insert(rows);

      if (error) throw error;

      setProventos({
        state: 'success',
        parseResult: null,
        message: `${rows.length} proventos importados com sucesso!`,
      });
      toast.success(`${rows.length} proventos importados com sucesso!`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 
        (typeof err === 'object' && err !== null && 'message' in err) ? String((err as {message: unknown}).message) : 
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
      const rows = negociacao.parseResult.data.map(row => ({
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
      }));

      const { error } = await supabase
        .from('trade_operations')
        .insert(rows);

      if (error) throw error;

      setNegociacao({
        state: 'success',
        parseResult: null,
        message: `${rows.length} negociações importadas com sucesso!`,
      });
      toast.success(`${rows.length} negociações importadas com sucesso!`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 
        (typeof err === 'object' && err !== null && 'message' in err) ? String((err as {message: unknown}).message) : 
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
