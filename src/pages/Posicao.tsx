import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrencyBRL, formatNumber } from '@/lib/formatters';
import { classifyAsset } from '@/lib/asset-classifier';
import { Briefcase } from 'lucide-react';

import { calculatePositions, type Position } from '@/lib/portfolio-calculations';

export default function Posicao() {
  const { data: trades, isLoading } = useQuery({
    queryKey: ['trade_operations_positions'],
    queryFn: async () => {
      const allData: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('trade_operations')
          .select('ticker, quantity, price, total_value, movement_type, trade_date')
          .order('trade_date', { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) throw error;
        if (data) {
          allData.push(...data);
          hasMore = data.length === pageSize;
          from += pageSize;
        } else {
          hasMore = false;
        }
      }
      return allData;
    },
  });

  const positions: Position[] = calculatePositions(trades);

  const totalPortfolio = positions.reduce((sum, p) => sum + p.totalValue, 0);

  // Group positions by asset class
  const positionsByClass = {
    'Ação': positions.filter((p) => p.assetClass === 'Ação'),
    'FII': positions.filter((p) => p.assetClass === 'FII'),
    'ETF': positions.filter((p) => p.assetClass === 'ETF'),
    'FI-Infra': positions.filter((p) => p.assetClass === 'FI-Infra'),
    'FIP': positions.filter((p) => p.assetClass === 'FIP'),
    'Outro': positions.filter((p) => p.assetClass === 'Outro'),
  };

  const renderTable = (classPositions: Position[], className: string) => {
    if (classPositions.length === 0) return null;
    const classTotal = classPositions.reduce((sum, p) => sum + p.totalValue, 0);

    return (
      <Card key={className}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            {className}
          </CardTitle>
          <span className="text-xl font-bold">{formatCurrencyBRL(classTotal)}</span>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead className="text-right">Preço Médio</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead className="text-right">% Carteira</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classPositions.map((position) => (
                <TableRow key={position.ticker}>
                  <TableCell className="font-mono font-medium">{position.ticker}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatNumber(position.quantity, 0)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrencyBRL(position.avgPrice)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {formatCurrencyBRL(position.totalValue)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatNumber((position.totalValue / totalPortfolio) * 100, 1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Posição</h1>
        <p className="text-muted-foreground">Quantidade e valor agregado de cada ativo</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Portfólio Total
          </CardTitle>
          {!isLoading && (
            <span className="text-2xl font-bold">{formatCurrencyBRL(totalPortfolio)}</span>
          )}
        </CardHeader>
      </Card>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : positions.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Nenhuma posição encontrada</p>
      ) : (
        <>
          {renderTable(positionsByClass['Ação'], 'Ações')}
          {renderTable(positionsByClass['FII'], 'Fundos Imobiliários')}
          {renderTable(positionsByClass['ETF'], 'ETFs')}
          {renderTable(positionsByClass['FI-Infra'], 'FI-Infra')}
          {renderTable(positionsByClass['FIP'], 'FIP')}
          {renderTable(positionsByClass['Outro'], 'Outros')}
        </>
      )}
    </div>
  );
}
