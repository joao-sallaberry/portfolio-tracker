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
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Proventos');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return { name: 'proventos.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer };
}
