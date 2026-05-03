import * as XLSX from 'xlsx';
import { parseDateBR, parseDateBRShort, parseNumberBR, parseCurrencyBR, extractTicker, normalizeMovementType } from './formatters';

export interface DividendEventRow {
  productRaw: string;
  ticker: string;
  paymentDate: Date | null;
  eventType: string;
  institution: string;
  quantity: number;
  unitPrice: number;
  netValue: number;
  hasErrors?: boolean;
  errorMessages?: string[];
}

export interface TradeOperationRow {
  tradeDate: Date | null;
  movementType: 'BUY' | 'SELL' | 'SPLIT' | 'REVERSE_SPLIT' | 'BONUS' | 'AMORTIZATION' | 'UNKNOWN';
  movementTypeRaw: string;
  market: string;
  maturity: string | null;
  institution: string;
  ticker: string;
  quantity: number;
  price: number;
  totalValue: number;
  hasErrors?: boolean;
  errorMessages?: string[];
}

export interface ParseResult<T> {
  data: T[];
  errors: string[];
  warnings: string[];
  totalRows: number;
}

const PROVENTOS_COLUMNS = [
  'Produto',
  'Pagamento',
  'Tipo de Evento',
  'Instituição',
  'Quantidade',
  'Preço unitário',
  'Valor líquido',
];

const NEGOCIACAO_COLUMNS = [
  'Data do Negócio',
  'Tipo de Movimentação',
  'Mercado',
  'Prazo/Vencimento',
  'Instituição',
  'Código de Negociação',
  'Quantidade',
  'Preço',
  'Valor',
];

function normalizeColumnName(name: string): string {
  return name.toString().toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function findColumnIndex(headers: string[], targetColumn: string): number {
  const normalizedTarget = normalizeColumnName(targetColumn);
  return headers.findIndex(h => normalizeColumnName(h) === normalizedTarget);
}

function parseExcelDate(value: unknown): Date | null {
  if (!value) return null;
  
  // If it's a Date object
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  
  // If it's a number (Excel serial date)
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return new Date(date.y, date.m - 1, date.d);
    }
    return null;
  }
  
  // If it's a string in DD/MM/YYYY format
  if (typeof value === 'string') {
    return parseDateBR(value);
  }
  
  return null;
}

export function parseProventosFile(file: File): Promise<ParseResult<DividendEventRow>> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        // Don't use cellDates to avoid timezone issues - parse dates manually
        const workbook = XLSX.read(data, { type: 'array', cellDates: false });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
        
        if (jsonData.length < 2) {
          resolve({ data: [], errors: ['Arquivo vazio ou sem dados'], warnings: [], totalRows: 0 });
          return;
        }
        
        const headers = jsonData[0] as string[];
        const errors: string[] = [];
        const warnings: string[] = [];
        
        // Validate required columns
        const missingColumns: string[] = [];
        const columnIndexes: Record<string, number> = {};
        
        for (const col of PROVENTOS_COLUMNS) {
          const idx = findColumnIndex(headers, col);
          if (idx === -1) {
            missingColumns.push(col);
          } else {
            columnIndexes[col] = idx;
          }
        }
        
        if (missingColumns.length > 0) {
          resolve({
            data: [],
            errors: [`Colunas obrigatórias não encontradas: ${missingColumns.join(', ')}`],
            warnings: [],
            totalRows: 0,
          });
          return;
        }
        
        const parsedRows: DividendEventRow[] = [];
        
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as unknown[];
          if (!row || row.length === 0 || row.every(cell => !cell)) continue;
          
          try {
            const productRaw = String(row[columnIndexes['Produto']] || '').trim();
            const paymentDate = parseExcelDate(row[columnIndexes['Pagamento']]);
            const eventType = String(row[columnIndexes['Tipo de Evento']] || '').trim();
            const institution = String(row[columnIndexes['Instituição']] || '').trim();
            const quantity = parseNumberBR(row[columnIndexes['Quantidade']] as string | number);
            const unitPrice = parseNumberBR(row[columnIndexes['Preço unitário']] as string | number);
            const netValue = parseNumberBR(row[columnIndexes['Valor líquido']] as string | number);
            
            const rowErrors: string[] = [];
            if (!productRaw) rowErrors.push('Produto não informado');
            if (!paymentDate) rowErrors.push('Data de pagamento inválida ou não informada');
            if (!eventType) rowErrors.push('Tipo de evento não informado');
            
            parsedRows.push({
              productRaw,
              ticker: extractTicker(productRaw),
              paymentDate,
              eventType,
              institution,
              quantity,
              unitPrice,
              netValue,
              hasErrors: rowErrors.length > 0,
              errorMessages: rowErrors,
            });
            
            if (rowErrors.length > 0) {
              warnings.push(`Linha ${i + 1}: ${rowErrors.join(', ')}`);
            }
          } catch (err) {
            warnings.push(`Linha ${i + 1}: erro ao processar - ${err}`);
          }
        }
        
        resolve({
          data: parsedRows,
          errors,
          warnings,
          totalRows: jsonData.length - 1,
        });
      } catch (err) {
        resolve({
          data: [],
          errors: [`Erro ao ler arquivo: ${err}`],
          warnings: [],
          totalRows: 0,
        });
      }
    };
    
    reader.onerror = () => {
      resolve({
        data: [],
        errors: ['Erro ao ler arquivo'],
        warnings: [],
        totalRows: 0,
      });
    };
    
    reader.readAsArrayBuffer(file);
  });
}

export function parseNegociacaoFile(file: File): Promise<ParseResult<TradeOperationRow>> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        // Don't use cellDates to avoid timezone issues - parse dates manually
        const workbook = XLSX.read(data, { type: 'array', cellDates: false });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
        
        if (jsonData.length < 2) {
          resolve({ data: [], errors: ['Arquivo vazio ou sem dados'], warnings: [], totalRows: 0 });
          return;
        }
        
        const headers = jsonData[0] as string[];
        const errors: string[] = [];
        const warnings: string[] = [];
        
        // Validate required columns
        const missingColumns: string[] = [];
        const columnIndexes: Record<string, number> = {};
        
        for (const col of NEGOCIACAO_COLUMNS) {
          const idx = findColumnIndex(headers, col);
          if (idx === -1) {
            missingColumns.push(col);
          } else {
            columnIndexes[col] = idx;
          }
        }
        
        if (missingColumns.length > 0) {
          resolve({
            data: [],
            errors: [`Colunas obrigatórias não encontradas: ${missingColumns.join(', ')}`],
            warnings: [],
            totalRows: 0,
          });
          return;
        }
        
        const parsedRows: TradeOperationRow[] = [];
        
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as unknown[];
          if (!row || row.length === 0 || row.every(cell => !cell)) continue;
          
          try {
            const tradeDate = parseExcelDate(row[columnIndexes['Data do Negócio']]);
            const movementTypeRaw = String(row[columnIndexes['Tipo de Movimentação']] || '').trim();
            const market = String(row[columnIndexes['Mercado']] || '').trim();
            const maturityRaw = row[columnIndexes['Prazo/Vencimento']];
            const maturity = maturityRaw && maturityRaw !== '-' ? String(maturityRaw).trim() : null;
            const institution = String(row[columnIndexes['Instituição']] || '').trim();
            const ticker = String(row[columnIndexes['Código de Negociação']] || '').trim();
            const quantity = parseNumberBR(row[columnIndexes['Quantidade']] as string | number);
            const price = parseNumberBR(row[columnIndexes['Preço']] as string | number);
            const totalValue = parseNumberBR(row[columnIndexes['Valor']] as string | number);
            
            const rowErrors: string[] = [];
            if (!tradeDate) rowErrors.push('Data do negócio inválida ou não informada');
            if (!movementTypeRaw) rowErrors.push('Tipo de movimentação não informado');
            if (!ticker) rowErrors.push('Código de negociação não informado');
            
            const movementType = normalizeMovementType(movementTypeRaw);
            if (movementTypeRaw && movementType === 'UNKNOWN') {
              rowErrors.push(`Tipo de movimentação desconhecido: ${movementTypeRaw}`);
            }
            
            parsedRows.push({
              tradeDate,
              movementType,
              movementTypeRaw,
              market,
              maturity,
              institution,
              ticker,
              quantity,
              price,
              totalValue,
              hasErrors: rowErrors.length > 0,
              errorMessages: rowErrors,
            });
            
            if (rowErrors.length > 0) {
              warnings.push(`Linha ${i + 1}: ${rowErrors.join(', ')}`);
            }
          } catch (err) {
            warnings.push(`Linha ${i + 1}: erro ao processar - ${err}`);
          }
        }
        
        resolve({
          data: parsedRows,
          errors,
          warnings,
          totalRows: jsonData.length - 1,
        });
      } catch (err) {
        resolve({
          data: [],
          errors: [`Erro ao ler arquivo: ${err}`],
          warnings: [],
          totalRows: 0,
        });
      }
    };
    
    reader.onerror = () => {
      resolve({
        data: [],
        errors: ['Erro ao ler arquivo'],
        warnings: [],
        totalRows: 0,
      });
    };
    
    reader.readAsArrayBuffer(file);
  });
}

// CSV Simplificado: Ticker, Data, Preço un., Qtd, Tipo
const CSV_SIMPLE_COLUMNS = ['Ticker', 'Data', 'Preço un.', 'Qtd', 'Tipo'];

function detectFileFormat(file: File): 'xlsx' | 'csv' {
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ext === 'csv' ? 'csv' : 'xlsx';
}

function parseCSVContent(content: string): string[][] {
  const lines = content.split(/\r?\n/);
  return lines.map(line => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  });
}

export function parseNegociacaoFileAuto(file: File): Promise<ParseResult<TradeOperationRow>> {
  const format = detectFileFormat(file);
  
  if (format === 'csv') {
    return parseNegociacaoCSV(file);
  }
  return parseNegociacaoFile(file);
}

function parseNegociacaoCSV(file: File): Promise<ParseResult<TradeOperationRow>> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const rows = parseCSVContent(content);
        
        if (rows.length < 2) {
          resolve({ data: [], errors: ['Arquivo vazio ou sem dados'], warnings: [], totalRows: 0 });
          return;
        }
        
        const headers = rows[0];
        const errors: string[] = [];
        const warnings: string[] = [];
        
        // Check if it's the simple format
        const isSimpleFormat = headers.some(h => 
          h.toLowerCase().includes('ticker') || 
          h.toLowerCase().includes('tipo')
        );
        
        if (!isSimpleFormat) {
          resolve({
            data: [],
            errors: ['Formato de CSV não reconhecido. Use o formato: Ticker, Data, Preço un., Qtd, Tipo'],
            warnings: [],
            totalRows: 0,
          });
          return;
        }
        
        // Find column indexes
        const tickerIdx = headers.findIndex(h => h.toLowerCase().includes('ticker'));
        const dataIdx = headers.findIndex(h => h.toLowerCase() === 'data');
        const precoIdx = headers.findIndex(h => h.toLowerCase().includes('preço') || h.toLowerCase().includes('preco'));
        const qtdIdx = headers.findIndex(h => h.toLowerCase().includes('qtd') || h.toLowerCase().includes('quantidade'));
        const tipoIdx = headers.findIndex(h => h.toLowerCase() === 'tipo');
        
        if (tickerIdx === -1 || dataIdx === -1 || tipoIdx === -1) {
          resolve({
            data: [],
            errors: ['Colunas obrigatórias não encontradas: Ticker, Data, Tipo'],
            warnings: [],
            totalRows: 0,
          });
          return;
        }
        
        const parsedRows: TradeOperationRow[] = [];
        
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0 || row.every(cell => !cell)) continue;
          
          try {
            const ticker = row[tickerIdx]?.trim();
            const dateStr = row[dataIdx]?.trim();
            const priceStr = row[precoIdx] || '0';
            const qtyStr = row[qtdIdx] || '0';
            const tipoRaw = row[tipoIdx]?.trim();
            
            if (!ticker && !dateStr && !tipoRaw) {
              // Skip empty rows silently
              continue;
            }
            
            const rowErrors: string[] = [];
            if (!ticker) rowErrors.push('Ticker vazio');
            if (!dateStr) rowErrors.push('Data vazia');
            if (!tipoRaw) rowErrors.push('Tipo vazio');
            
            // Parse date (try both DD/MM/YYYY and DD/MM/YY)
            let tradeDate = dateStr ? parseDateBR(dateStr) : null;
            if (!tradeDate && dateStr) {
              tradeDate = parseDateBRShort(dateStr);
            }
            
            if (dateStr && !tradeDate) {
              rowErrors.push(`Data inválida: "${dateStr}"`);
            }
            
            const price = parseCurrencyBR(priceStr);
            const quantity = parseNumberBR(qtyStr);
            const movementType = normalizeMovementType(tipoRaw || '');
            const totalValue = price * quantity;
            
            if (tipoRaw && movementType === 'UNKNOWN') {
              rowErrors.push(`Tipo de movimentação desconhecido: ${tipoRaw}`);
            }
            
            parsedRows.push({
              tradeDate,
              movementType,
              movementTypeRaw: tipoRaw || '',
              market: 'Bovespa',
              maturity: null,
              institution: 'Importação Manual',
              ticker: ticker || '',
              quantity,
              price,
              totalValue,
              hasErrors: rowErrors.length > 0,
              errorMessages: rowErrors,
            });
            
            if (rowErrors.length > 0) {
              warnings.push(`Linha ${i + 1}: ${rowErrors.join(', ')}`);
            }
          } catch (err) {
            warnings.push(`Linha ${i + 1}: erro ao processar - ${err}`);
          }
        }
        
        resolve({
          data: parsedRows,
          errors,
          warnings,
          totalRows: rows.length - 1,
        });
      } catch (err) {
        resolve({
          data: [],
          errors: [`Erro ao ler arquivo: ${err}`],
          warnings: [],
          totalRows: 0,
        });
      }
    };
    
    reader.onerror = () => {
      resolve({
        data: [],
        errors: ['Erro ao ler arquivo'],
        warnings: [],
        totalRows: 0,
      });
    };
    
    reader.readAsText(file, 'UTF-8');
  });
}
