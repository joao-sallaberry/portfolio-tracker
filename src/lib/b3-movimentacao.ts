import * as XLSX from 'xlsx';
import { extractTicker, normalizeTicker, parseNumberBR } from './formatters';
import { parseExcelDate, type DividendEventRow, type TradeOperationRow } from './xlsx-parser';

/**
 * B3 "Extrato de Movimentação" (Área do Investidor > Extratos > Movimentação). It mixes every
 * custody event; only part of it is imported:
 * - dividends, JCP, FII income and reimbursements become dividend events;
 * - splits, bonus shares, amortizations, capital returns and redemptions become trades;
 * - buys and sells are NOT taken from here: "Transferência - Liquidação" also covers shares
 *   going to and coming back from lending, at reference prices. They come from the trades
 *   ("Negociação") statement instead.
 */

const COLUMNS = ['Entrada/Saída', 'Data', 'Movimentação', 'Produto', 'Instituição', 'Quantidade', 'Preço unitário', 'Valor da Operação'];

export const MOVIMENTACAO_MARKET = 'Movimentação B3';

const normalize = (text: string) => text.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');

const DIVIDEND_TYPES = ['Dividendo', 'Juros Sobre Capital Próprio', 'Rendimento', 'Reembolso'];

const TRADE_TYPES: Record<string, TradeOperationRow['movementType']> = {
  [normalize('Desdobro')]: 'SPLIT',
  [normalize('Bonificação em Ativos')]: 'BONUS',
  [normalize('Amortização')]: 'AMORTIZATION',
  [normalize('Restituição de Capital')]: 'AMORTIZATION',
  [normalize('Resgate')]: 'SELL',
};

/** Movements that don't change the imported data, or are imported from another statement. */
const IGNORED_TYPES = new Set(
  [
    'Transferência - Liquidação', // buys/sells come from the trades statement; also lending legs
    'Transferência', // custody moving between brokers
    'Empréstimo', // shares lent and returned, and the lending fee
    'Fração em Ativos', // fractions left over from corporate events...
    'Leilão de Fração', // ...and their auction: fractions are left out altogether
    'Direito de Subscrição',
    'Direitos de Subscrição - Não Exercido',
    'Cessão de Direitos',
    'Cessão de Direitos - Solicitada',
    'APLICAÇÃO', // fixed income
    'RESGATE ANTECIPADO',
  ].map(normalize)
);

/** "Atualização" sometimes adds shares (e.g. a fund merger) and sometimes just restates the position. */
const NEEDS_REVIEW_TYPE = normalize('Atualização');

const TICKER = /^[A-Z0-9]{4}\d{1,2}$/;

export interface MovimentacaoResult {
  dividends: DividendEventRow[];
  trades: TradeOperationRow[];
  /** Ignored rows by movement type */
  ignored: Record<string, number>;
  errors: string[];
  warnings: string[];
  totalRows: number;
}

/** Classifies the rows of the statement (first row = header). */
export function parseMovimentacaoRows(rows: unknown[][]): MovimentacaoResult {
  const result: MovimentacaoResult = { dividends: [], trades: [], ignored: {}, errors: [], warnings: [], totalRows: 0 };
  const ignore = (type: string) => {
    result.ignored[type] = (result.ignored[type] ?? 0) + 1;
  };

  const headers = (rows[0] ?? []).map((h) => normalize(String(h ?? '')));
  const index = Object.fromEntries(COLUMNS.map((c) => [c, headers.indexOf(normalize(c))]));
  const missing = COLUMNS.filter((c) => index[c] === -1);
  if (missing.length) {
    result.errors.push(`Colunas não encontradas: ${missing.join(', ')}. Use o extrato de Movimentação da Área do Investidor da B3.`);
    return result;
  }

  rows.slice(1).forEach((row, i) => {
    if (!row || row.every((cell) => cell === undefined || cell === null || cell === '')) return;
    result.totalRows++;
    const line = i + 2;
    const cell = (column: string) => row[index[column]];

    const movement = String(cell('Movimentação') ?? '').trim();
    const key = normalize(movement);
    const isCredit = normalize(String(cell('Entrada/Saída') ?? '')) === 'credito';
    const productRaw = String(cell('Produto') ?? '').trim();
    const ticker = normalizeTicker(extractTicker(productRaw));
    const date = parseExcelDate(cell('Data'));
    const institution = String(cell('Instituição') ?? '').trim();
    const quantity = parseNumberBR(cell('Quantidade') as string | number);
    const price = parseNumberBR(cell('Preço unitário') as string | number);
    const value = parseNumberBR(cell('Valor da Operação') as string | number);

    if (IGNORED_TYPES.has(key) || key.endsWith(' - transferido')) return ignore(movement);
    // Fixed income (CDB, Tesouro...) isn't tracked by the app
    if (!TICKER.test(ticker)) return ignore(`${movement} (renda fixa ou outro produto)`);

    if (!date) {
      result.warnings.push(`Linha ${line}: data inválida, não importada (${movement} ${ticker})`);
      return;
    }

    if (key === NEEDS_REVIEW_TYPE) {
      result.warnings.push(
        `Linha ${line}: Atualização de ${ticker} (${quantity}) em ${String(cell('Data'))} não foi importada. Se trouxe ações novas (ex.: incorporação), lance manualmente em Negociações.`
      );
      return;
    }

    const dividendType = DIVIDEND_TYPES.find((type) => normalize(type) === key);
    if (dividendType && isCredit) {
      result.dividends.push({ productRaw, ticker, paymentDate: date, eventType: dividendType, institution, quantity, unitPrice: price, netValue: value });
      return;
    }

    const movementType = TRADE_TYPES[key];
    if (movementType && isCredit) {
      if (movementType === 'BONUS') {
        // Only whole shares: the fraction is removed and auctioned (both ignored)
        const wholeShares = Math.floor(quantity + 1e-9);
        if (wholeShares === 0) return ignore(movement);
        result.trades.push({ tradeDate: date, movementType, movementTypeRaw: movement, market: MOVIMENTACAO_MARKET, maturity: null, institution, ticker, quantity: wholeShares, price: 0, totalValue: 0 });
        result.warnings.push(
          `Linha ${line}: bonificação de ${wholeShares} ${ticker} importada com custo zero. Edite o valor em Negociações com o custo atribuído pela empresa.`
        );
        return;
      }
      const isSplit = movementType === 'SPLIT';
      result.trades.push({
        tradeDate: date,
        movementType,
        movementTypeRaw: movement,
        market: MOVIMENTACAO_MARKET,
        maturity: null,
        institution,
        ticker,
        quantity,
        price: isSplit ? 0 : price,
        totalValue: isSplit ? 0 : value,
      });
      return;
    }

    result.warnings.push(`Linha ${line}: movimentação não reconhecida, não importada: ${movement} (${isCredit ? 'crédito' : 'débito'}, ${ticker})`);
  });

  return result;
}

export function parseMovimentacaoFile(file: File): Promise<MovimentacaoResult> {
  return file.arrayBuffer().then((buffer) => {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return parseMovimentacaoRows(XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true }) as unknown[][]);
  });
}
