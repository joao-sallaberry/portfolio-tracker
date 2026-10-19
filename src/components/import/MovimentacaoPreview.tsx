import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { MovimentacaoResult } from '@/lib/b3-movimentacao';
import { PreviewRows } from './PreviewTable';

const PREVIEW_ROWS = 20;

interface MovimentacaoPreviewProps {
  result: MovimentacaoResult;
  onConfirm: () => void;
  onCancel: () => void;
  isImporting?: boolean;
}

export function MovimentacaoPreview({ result, onConfirm, onCancel, isImporting = false }: MovimentacaoPreviewProps) {
  const { dividends, trades, ignored, errors, warnings, totalRows } = result;
  const ignoredTotal = Object.values(ignored).reduce((sum, n) => sum + n, 0);
  const hasErrors = errors.length > 0;
  const nothingToImport = dividends.length + trades.length === 0;

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Prévia: Movimentações (B3)</CardTitle>
            <CardDescription>
              {totalRows} linhas • {dividends.length} proventos • {trades.length} eventos • {ignoredTotal} ignoradas
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onCancel} disabled={isImporting}>
              Cancelar
            </Button>
            <Button onClick={onConfirm} disabled={hasErrors || nothingToImport || isImporting}>
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                'Confirmar importação'
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasErrors && (
          <div className="rounded-lg bg-destructive/10 p-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Erros encontrados</span>
            </div>
            <ul className="mt-2 list-inside list-disc text-sm text-destructive">
              {errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="rounded-lg bg-warning/10 p-4">
            <div className="flex items-center gap-2 text-warning">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Revise ({warnings.length})</span>
            </div>
            <ul className="mt-2 max-h-48 list-inside list-disc space-y-1 overflow-y-auto text-sm text-muted-foreground">
              {warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {!hasErrors && !nothingToImport && (
          <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-success">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-medium">
              {dividends.length} proventos e {trades.length} eventos prontos para importação. Linhas já cadastradas são ignoradas.
            </span>
          </div>
        )}

        {ignoredTotal > 0 && (
          <details className="rounded-lg border p-3 text-sm">
            <summary className="cursor-pointer text-muted-foreground">
              {ignoredTotal} linhas não importadas (compras e vendas vêm do extrato de Negociações)
            </summary>
            <ul className="mt-2 grid gap-x-12 gap-y-1 sm:grid-cols-2">
              {Object.entries(ignored)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <li key={type} className="flex justify-between gap-4 text-muted-foreground">
                    <span>{type}</span>
                    <span className="font-mono">{count}</span>
                  </li>
                ))}
            </ul>
          </details>
        )}

        {trades.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Eventos ({trades.length})</h3>
            <PreviewRows type="negociacao" data={trades.slice(0, PREVIEW_ROWS)} />
          </section>
        )}

        {dividends.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Proventos ({dividends.length})</h3>
            <PreviewRows type="proventos" data={dividends.slice(0, PREVIEW_ROWS)} />
            {dividends.length > PREVIEW_ROWS && (
              <p className="text-center text-sm text-muted-foreground">
                Exibindo os primeiros {PREVIEW_ROWS} de {dividends.length} proventos
              </p>
            )}
          </section>
        )}
      </CardContent>
    </Card>
  );
}
