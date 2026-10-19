import { describe, it, expect } from 'vitest';
import { MOVIMENTACAO_MARKET, parseMovimentacaoRows } from './b3-movimentacao';

const HEADER = ['Entrada/Saída', 'Data', 'Movimentação', 'Produto', 'Instituição', 'Quantidade', 'Preço unitário', 'Valor da Operação'];
const row = (dir: string, date: string, movement: string, product: string, qty: number | string, price: number | string = '-', value: number | string = '-') =>
  [dir, date, movement, product, 'CORRETORA X', qty, price, value];
const parse = (...rows: unknown[][]) => parseMovimentacaoRows([HEADER, ...rows]);

describe('parseMovimentacaoRows', () => {
  it('imports dividends, JCP, FII income and reimbursements as dividend events', () => {
    const result = parse(
      row('Credito', '15/01/2026', 'Rendimento', 'HGLG11 - PÁTRIA LOG', 58, 1.1, 63.8),
      row('Credito', '13/02/2026', 'Dividendo', 'COGN3 - COGNA EDUCACAO S.A', 1800, 0.066, 119.06),
      row('Credito', '14/04/2026', 'Juros Sobre Capital Próprio', 'VIVT3 - TELEFÔNICA BRASIL S.A', 240, 0.062, 12.64),
      row('Credito', '14/10/2026', 'Reembolso', 'LREN3 - LOJAS RENNER S.A.', 0, '-', 174.72),
    );

    expect(result.dividends.map((d) => [d.ticker, d.eventType, d.quantity, d.unitPrice, d.netValue])).toEqual([
      ['HGLG11', 'Rendimento', 58, 1.1, 63.8],
      ['COGN3', 'Dividendo', 1800, 0.066, 119.06],
      ['VIVT3', 'Juros Sobre Capital Próprio', 240, 0.062, 12.64],
      ['LREN3', 'Reembolso', 0, 0, 174.72],
    ]);
    expect(result.dividends[0].paymentDate).toEqual(new Date(2026, 0, 15));
    expect(result.trades).toEqual([]);
  });

  it('turns corporate events into trades', () => {
    const result = parse(
      row('Credito', '19/01/2026', 'Desdobro', 'RBFF11 - RIO BRAVO', 520),
      row('Credito', '07/10/2026', 'Amortização', 'NUIF11 - NU INFRA', 28, 1, 28),
      row('Credito', '14/07/2026', 'Restituição de Capital', 'VIVT3 - TELEFONICA', 240, 1.252, 300.41),
      row('Credito', '15/05/2026', 'Resgate', 'NEOE3 - NEOENERGIA S/A', 311, 34.02, 10580.22),
    );

    expect(result.trades.map((t) => [t.movementType, t.ticker, t.quantity, t.price, t.totalValue])).toEqual([
      ['SPLIT', 'RBFF11', 520, 0, 0],
      ['AMORTIZATION', 'NUIF11', 28, 1, 28],
      ['AMORTIZATION', 'VIVT3', 240, 1.252, 300.41],
      ['SELL', 'NEOE3', 311, 34.02, 10580.22],
    ]);
    expect(result.trades.every((t) => t.market === MOVIMENTACAO_MARKET)).toBe(true);
    expect(result.trades[0].movementTypeRaw).toBe('Desdobro');
  });

  it('imports only the whole shares of a bonus, at zero cost, with a warning', () => {
    const result = parse(
      row('Credito', '05/01/2026', 'Bonificação em Ativos', 'CYRE4 - CYRELA', 81.52),
      row('Credito', '02/01/2026', 'Bonificação em Ativos', 'RENT4 - LOCALIZA', 3.46),
      row('Credito', '02/01/2026', 'Bonificação em Ativos', 'ABCD3 - FRACAO SO', 0.4),
    );

    expect(result.trades.map((t) => [t.movementType, t.ticker, t.quantity, t.totalValue])).toEqual([
      ['BONUS', 'CYRE4', 81, 0],
      ['BONUS', 'RENT4', 3, 0],
    ]);
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0]).toMatch(/custo zero/);
    expect(result.ignored['Bonificação em Ativos']).toBe(1);
  });

  it('ignores buys, sells, transfers, lending, fractions, rights and fixed income', () => {
    const result = parse(
      row('Credito', '16/10/2026', 'Transferência - Liquidação', 'AZZA3 - AZZAS', 160, 23.61, 3777.6),
      row('Debito', '16/10/2026', 'Transferência - Liquidação', 'ABEV3 - AMBEV', 1076),
      row('Debito', '16/10/2026', 'Transferência', 'ABEV3 - AMBEV', 1076),
      row('Credito', '16/10/2026', 'Empréstimo', 'EVEN3 - EVEN', 0, '-', 7.13),
      row('Debito', '06/07/2026', 'Fração em Ativos', 'HGLG11 - PÁTRIA LOG', 0.08),
      row('Credito', '15/10/2026', 'Leilão de Fração', 'HGLG11 - PÁTRIA LOG', 0.08, 146.36, 11.41),
      row('Credito', '15/10/2026', 'Direito de Subscrição', 'BTLG12 - BTG LOG', 13),
      row('Debito', '01/02/2026', 'Dividendo - Transferido', 'JHSF3 - JHSF', 100, 0.1, 10),
      row('Debito', '03/09/2026', 'RESGATE ANTECIPADO', 'CDB - CDB82630CXA - ITAU UNIBANCO', 22353, 0.01, 223.58),
    );

    expect(result.dividends).toEqual([]);
    expect(result.trades).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.totalRows).toBe(9);
    expect(result.ignored['Transferência - Liquidação']).toBe(2);
    expect(result.ignored['Leilão de Fração']).toBe(1);
  });

  it('warns about "Atualização" and unknown movements instead of importing them', () => {
    const result = parse(
      row('Credito', '02/07/2026', 'Atualização', 'HGLG11 - PÁTRIA LOG', 35.08),
      row('Credito', '02/07/2026', 'Grupamento', 'ABCD3 - EMPRESA', 10),
    );

    expect(result.trades).toEqual([]);
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0]).toMatch(/Linha 2: Atualização de HGLG11 \(35\.08\)/);
    expect(result.warnings[1]).toMatch(/Linha 3: movimentação não reconhecida.*Grupamento/);
  });

  it('normalizes fractional-market tickers', () => {
    const result = parse(row('Credito', '13/02/2026', 'Dividendo', 'PETR4F - PETROBRAS', 10, 1, 10));
    expect(result.dividends[0].ticker).toBe('PETR4');
  });

  it('rejects a file without the expected columns', () => {
    const result = parseMovimentacaoRows([['Produto', 'Pagamento', 'Tipo de Evento'], ['X', 'Y', 'Z']]);
    expect(result.errors[0]).toMatch(/Colunas não encontradas/);
    expect(result.totalRows).toBe(0);
  });
});
