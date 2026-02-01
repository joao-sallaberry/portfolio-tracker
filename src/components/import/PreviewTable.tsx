import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { formatDateBR, formatCurrencyBRL, formatNumber } from '@/lib/formatters';
import type { DividendEventRow, TradeOperationRow } from '@/lib/xlsx-parser';

interface PreviewTableProps<T> {
  title: string;
  data: T[];
  errors: string[];
  warnings: string[];
  totalRows: number;
  onConfirm: () => void;
  onCancel: () => void;
  isImporting?: boolean;
  type: 'proventos' | 'negociacao';
}

export function PreviewTable<T extends DividendEventRow | TradeOperationRow>({
  title,
  data,
  errors,
  warnings,
  totalRows,
  onConfirm,
  onCancel,
  isImporting = false,
  type,
}: PreviewTableProps<T>) {
  const previewData = data.slice(0, 20);
  const hasErrors = errors.length > 0;

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>
              {totalRows} linhas encontradas • {data.length} registros válidos
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onCancel} disabled={isImporting}>
              Cancelar
            </Button>
            <Button onClick={onConfirm} disabled={hasErrors || isImporting}>
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
        {errors.length > 0 && (
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
              <span className="font-medium">Avisos ({warnings.length})</span>
            </div>
            <ul className="mt-2 max-h-32 list-inside list-disc overflow-y-auto text-sm text-muted-foreground">
              {warnings.slice(0, 10).map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
              {warnings.length > 10 && (
                <li>... e mais {warnings.length - 10} avisos</li>
              )}
            </ul>
          </div>
        )}

        {data.length > 0 && !hasErrors && (
          <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-success">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-medium">
              {data.length} registros prontos para importação
            </span>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {type === 'proventos' ? (
                  <>
                    <TableHead>Ativo</TableHead>
                    <TableHead>Data Pagamento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Instituição</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead className="text-right">Preço Unit.</TableHead>
                    <TableHead className="text-right">Valor Líquido</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead>Mercado</TableHead>
                    <TableHead>Instituição</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewData.map((row, i) => (
                <TableRow key={i}>
                  {type === 'proventos' ? (
                    <>
                      <TableCell className="font-mono font-medium">{(row as DividendEventRow).ticker}</TableCell>
                      <TableCell>{formatDateBR((row as DividendEventRow).paymentDate)}</TableCell>
                      <TableCell>{(row as DividendEventRow).eventType}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{(row as DividendEventRow).institution}</TableCell>
                      <TableCell className="text-right font-mono">{formatNumber((row as DividendEventRow).quantity, 0)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrencyBRL((row as DividendEventRow).unitPrice)}</TableCell>
                      <TableCell className="text-right font-mono font-medium">{formatCurrencyBRL((row as DividendEventRow).netValue)}</TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell>{formatDateBR((row as TradeOperationRow).tradeDate)}</TableCell>
                      <TableCell>
                        <span className={
                          (row as TradeOperationRow).movementType === 'BUY' || (row as TradeOperationRow).movementType === 'BONUS' ? 'text-success' : 
                          (row as TradeOperationRow).movementType === 'SELL' || (row as TradeOperationRow).movementType === 'AMORTIZATION' ? 'text-destructive' : 
                          'text-muted-foreground'
                        }>
                          {(row as TradeOperationRow).movementTypeRaw}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono font-medium">{(row as TradeOperationRow).ticker}</TableCell>
                      <TableCell className="max-w-[120px] truncate">{(row as TradeOperationRow).market}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{(row as TradeOperationRow).institution}</TableCell>
                      <TableCell className="text-right font-mono">{formatNumber((row as TradeOperationRow).quantity, 0)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrencyBRL((row as TradeOperationRow).price)}</TableCell>
                      <TableCell className="text-right font-mono font-medium">{formatCurrencyBRL((row as TradeOperationRow).totalValue)}</TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {data.length > 20 && (
          <p className="text-center text-sm text-muted-foreground">
            Exibindo primeiros 20 de {data.length} registros
          </p>
        )}
      </CardContent>
    </Card>
  );
}
