import { describe, it, expect } from 'vitest';
import { PROVENTOS_MARKET, parseProventosRows } from './xlsx-parser';

const HEADER = ['Produto', 'Pagamento', 'Tipo de Evento', 'Instituição', 'Quantidade', 'Preço unitário', 'Valor líquido'];
const parse = (...rows: unknown[][]) => parseProventosRows([HEADER, ...rows]);

describe('parseProventosRows', () => {
  it('parses dividend events', () => {
    const result = parse(['PETR4F - PETROBRAS', '20/05/2025', 'Dividendo', 'XP', 100, 0.5, 50]);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ ticker: 'PETR4', eventType: 'Dividendo', quantity: 100, unitPrice: 0.5, netValue: 50 });
    expect(result.data[0].paymentDate).toEqual(new Date(2025, 4, 20));
    expect(result.trades).toEqual([]);
  });

  it('turns capital returns into amortizations instead of dividends', () => {
    const result = parse(
      ['VIVT3 - TELEFONICA BRASIL S/A', '15/07/2025', 'Restituição de Capital', 'XP', 120, 1.23, 148],
      ['NUIF11 - NU INFRA', '07/10/2025', 'AMORTIZACAO', 'XP', 28, 1, 28],
      ['VIVT3 - TELEFONICA BRASIL S/A', '15/07/2025', 'Juros Sobre Capital Próprio', 'XP', 120, 0.1, 10.2],
    );

    expect(result.data.map((d) => d.eventType)).toEqual(['Juros Sobre Capital Próprio']);
    expect(result.trades.map((t) => [t.movementType, t.movementTypeRaw, t.ticker, t.quantity, t.price, t.totalValue])).toEqual([
      ['AMORTIZATION', 'Restituição de Capital', 'VIVT3', 120, 1.23, 148],
      ['AMORTIZATION', 'AMORTIZACAO', 'NUIF11', 28, 1, 28],
    ]);
    expect(result.trades[0]).toMatchObject({ market: PROVENTOS_MARKET, tradeDate: new Date(2025, 6, 15) });
    expect(result.warnings[0]).toMatch(/Linha 2: Restituição de Capital de VIVT3 será importada como amortização/);
    expect(result.totalRows).toBe(3);
  });

  it('keeps rows with errors as dividends so the preview shows them', () => {
    const result = parse(['VIVT3 - TELEFONICA', '', 'Restituição de Capital', 'XP', 120, 1.23, 148]);
    expect(result.trades).toEqual([]);
    expect(result.data[0].hasErrors).toBe(true);
  });

  it('rejects a file without the expected columns', () => {
    const result = parseProventosRows([['Produto', 'Data'], ['X', 'Y']]);
    expect(result.errors[0]).toMatch(/Colunas obrigatórias não encontradas/);
  });
});
