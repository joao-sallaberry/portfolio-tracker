import * as XLSX from 'xlsx';

/** Data is dated relative to the current year, since the IR page and the dashboard default to it. */
export const YEAR = new Date().getFullYear();

/**
 * Simplified trades CSV. January of YEAR nets to a loss (gains listed before larger losses on
 * the same day); February has a gain that the January loss offsets. PETR4F is a fractional-market
 * buy that must merge into PETR4. Left in the portfolio: PETR4 100 @ 30,00 and EGIE3 80 @ 37,06.
 */
export function tradesCsv() {
  const csv = `Ticker,Data,Preço un.,Qtd,Tipo
HYPE3,10/06/${YEAR - 1},"21,67",290,Compra
EGIE3,10/06/${YEAR - 1},"37,06",500,Compra
PETR4F,10/06/${YEAR - 1},"30,00",100,Compra
PETR4,11/06/${YEAR - 1},"30,00",1000,Compra
HYPE3,12/01/${YEAR},"23,41",200,Venda
EGIE3,12/01/${YEAR},"30,86",20,Venda
HYPE3,12/01/${YEAR},"23,40",90,Venda
EGIE3,12/01/${YEAR},"30,87",400,Venda
PETR4,10/02/${YEAR},"38,00",1000,Venda
`;
  return { name: 'negociacoes.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') };
}

/**
 * B3-style dividends XLSX: 60 rows (20 months x 3 tickers, R$ 68,00 per month) ending in
 * February of YEAR, paid alternately on the 1st and the 15th. In YEAR: 01/01 and 15/02.
 */
export function dividendsXlsx() {
  const rows: (string | number)[][] = [['Produto', 'Pagamento', 'Tipo de Evento', 'Instituição', 'Quantidade', 'Preço unitário', 'Valor líquido']];
  const tickers: [string, number][] = [
    ['EGIE3 - ENGIE BRASIL ENERGIA S.A.', 80],
    ['PETR4 - PETROLEO BRASILEIRO S.A. PETROBRAS', 100],
    ['MXRF11 - MAXI RENDA FII', 500],
  ];
  for (let i = 0; i < 20; i++) {
    const d = new Date(YEAR - 2, 6 + i, i % 2 === 0 ? 1 : 15);
    const date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    for (const [produto, qty] of tickers) rows.push([produto, date, 'Rendimento', 'XP INVESTIMENTOS', qty, 0.1, Math.round(qty * 10) / 100]);
  }
  return xlsxFile('proventos.xlsx', 'Proventos', rows);
}

/**
 * B3 "Movimentação" statement: one new dividend, one identical to a row of dividendsXlsx (must be
 * skipped as already stored), a split and a fractional bonus of ITSA4 (100 + 10 whole shares), an
 * "Atualização" (warning only) and rows that are ignored (settlement, lending, fraction auction).
 */
export function movimentacaoXlsx() {
  const rows: (string | number)[][] = [
    ['Entrada/Saída', 'Data', 'Movimentação', 'Produto', 'Instituição', 'Quantidade', 'Preço unitário', 'Valor da Operação'],
    ['Credito', `15/03/${YEAR}`, 'Rendimento', 'MXRF11 - MAXI RENDA FII', 'XP INVESTIMENTOS', 500, 0.12, 60],
    ['Credito', `01/07/${YEAR - 2}`, 'Rendimento', 'EGIE3 - ENGIE BRASIL ENERGIA S.A.', 'XP INVESTIMENTOS', 80, 0.1, 8],
    ['Credito', `01/04/${YEAR}`, 'Desdobro', 'ITSA4 - ITAUSA S.A.', 'XP INVESTIMENTOS', 100, '-', '-'],
    ['Credito', `02/04/${YEAR}`, 'Bonificação em Ativos', 'ITSA4 - ITAUSA S.A.', 'XP INVESTIMENTOS', 10.75, '-', '-'],
    ['Credito', `02/07/${YEAR}`, 'Atualização', 'HGLG11 - PÁTRIA LOG', 'XP INVESTIMENTOS', 35.08, '-', '-'],
    ['Credito', `16/04/${YEAR}`, 'Transferência - Liquidação', 'AZZA3 - AZZAS 2154 S.A.', 'XP INVESTIMENTOS', 160, 23.61, 3777.6],
    ['Credito', `16/04/${YEAR}`, 'Empréstimo', 'EVEN3 - EVEN CONSTRUTORA', 'XP INVESTIMENTOS', 0, '-', 7.13],
    ['Credito', `20/04/${YEAR}`, 'Leilão de Fração', 'ITSA4 - ITAUSA S.A.', 'XP INVESTIMENTOS', 0.75, 10, 7.5],
  ];
  return xlsxFile('movimentacao.xlsx', 'Movimentação', rows);
}

/**
 * The same ITSA4 capital return in both statements: the dividends statement lists it next to a
 * JCP payment and must turn it into an amortization, which the movements statement then finds
 * already stored.
 */
export function capitalReturnFiles() {
  const proventos = xlsxFile('proventos-restituicao.xlsx', 'Proventos', [
    ['Produto', 'Pagamento', 'Tipo de Evento', 'Instituição', 'Quantidade', 'Preço unitário', 'Valor líquido'],
    ['ITSA4 - ITAUSA S.A.', `10/05/${YEAR}`, 'Juros Sobre Capital Próprio', 'XP INVESTIMENTOS', 110, 0.02, 1.87],
    ['ITSA4 - ITAUSA S.A.', `10/05/${YEAR}`, 'Restituição de Capital', 'XP INVESTIMENTOS', 110, 0.1, 11],
  ]);
  const movimentacao = xlsxFile('movimentacao-restituicao.xlsx', 'Movimentação', [
    ['Entrada/Saída', 'Data', 'Movimentação', 'Produto', 'Instituição', 'Quantidade', 'Preço unitário', 'Valor da Operação'],
    ['Credito', `10/05/${YEAR}`, 'Restituição de Capital', 'ITSA4 - ITAUSA S.A.', 'XP INVESTIMENTOS', 110, 0.1, 11],
  ]);
  return { proventos, movimentacao };
}

function xlsxFile(name: string, sheetName: string, rows: (string | number)[][]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName);
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return { name, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer };
}
