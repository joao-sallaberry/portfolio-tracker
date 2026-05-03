// Brazilian Portuguese formatters for dates and currency

export function parseISODateLocal(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Accept both date-only (YYYY-MM-DD) and full ISO (YYYY-MM-DDTHH:mm:ss...)
  const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);

  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const d = new Date(year, month - 1, day);
    return isNaN(d.getTime()) ? null : d;
  }

  // Fallback for other formats
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDateBR(date: Date | string): string {
  const d = typeof date === 'string' ? (parseISODateLocal(date) ?? new Date(date)) : date;

  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatCompactNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${formatNumber(value / 1_000_000, 1)}M`;
  }
  if (value >= 1_000) {
    return `${formatNumber(value / 1_000, 1)}K`;
  }
  return formatNumber(value, 0);
}

export function parseDateBR(dateStr: string): Date | null {
  // Parse DD/MM/YYYY or DD/MM/YY format
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  let year = parseInt(parts[2], 10);
  
  // Convert 2-digit year to 4-digit (years up to 50 → 2000s, 51+ → 1900s)
  if (year < 100) {
    year = year <= 50 ? 2000 + year : 1900 + year;
  }
  
  const date = new Date(year, month, day);
  if (isNaN(date.getTime())) return null;
  
  return date;
}

export function parseNumberBR(value: string | number): number {
  if (typeof value === 'number') return value;
  
  // Remove thousand separators (.) and replace decimal comma with dot
  const cleaned = value
    .toString()
    .trim()
    .replace(/\./g, '')
    .replace(',', '.');
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function extractTicker(productRaw: string): string {
  // Try to extract ticker from "ABEV3 - AMBEV S.A." format
  const dashIndex = productRaw.indexOf(' - ');
  if (dashIndex > 0) {
    return productRaw.substring(0, dashIndex).trim();
  }
  
  // Fallback to first word
  const firstSpace = productRaw.indexOf(' ');
  if (firstSpace > 0) {
    return productRaw.substring(0, firstSpace).trim();
  }
  
  return productRaw.trim();
}

export function normalizeMovementType(type: string): 'BUY' | 'SELL' | 'SPLIT' | 'REVERSE_SPLIT' | 'BONUS' | 'AMORTIZATION' | 'UNKNOWN' {
  const normalized = type.toLowerCase().trim();
  if (normalized.includes('compra') || normalized === 'buy') {
    return 'BUY';
  }
  if (normalized.includes('venda') || normalized === 'sell') {
    return 'SELL';
  }
  if (normalized.includes('bonifica') || normalized === 'bonus') {
    return 'BONUS';
  }
  if (normalized.includes('desdobramento') || normalized === 'split') {
    return 'SPLIT';
  }
  if (normalized.includes('grupamento') || normalized === 'reverse_split') {
    return 'REVERSE_SPLIT';
  }
  if (normalized.includes('amortiza') || normalized === 'amortization') {
    return 'AMORTIZATION';
  }
  return 'UNKNOWN';
}

export function parseCurrencyBR(value: string): number {
  if (!value) return 0;
  // Remove "R$" prefix and parse as Brazilian number
  const cleaned = value
    .toString()
    .trim()
    .replace(/^R\$\s*/, '')
    .replace(/\./g, '')
    .replace(',', '.');
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function parseDateBRShort(dateStr: string): Date | null {
  // Parse DD/MM/YY format (short year)
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  let year = parseInt(parts[2], 10);
  
  // Convert 2-digit year to 4-digit (years up to 50 → 2000s, 51+ → 1900s)
  if (year < 100) {
    year = year <= 50 ? 2000 + year : 1900 + year;
  }
  
  const date = new Date(year, month, day);
  if (isNaN(date.getTime())) return null;
  
  return date;
}
