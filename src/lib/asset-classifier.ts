// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Asset classifier utility
 * Classifies tickers into: Ações, ETFs, FIIs or Outro
 * Data sourced from CSV files in src/data/
 */

// Import raw CSV data (Vite handles this with ?raw suffix)
import acoesRaw from '@/data/Acoes.csv?raw';
import etfsRaw from '@/data/ETFs.csv?raw';
import fiisRaw from '@/data/FIIs.csv?raw';
import fiInfrasRaw from '@/data/FI-Infras.csv?raw';
import fipsRaw from '@/data/FIPs.csv?raw';

export type AssetClass = 'Ação' | 'ETF' | 'FII' | 'FI-Infra' | 'FIP' | 'Outro';

/** Every class, in display order. */
export const ASSET_CLASSES: AssetClass[] = ['Ação', 'FII', 'ETF', 'FI-Infra', 'FIP', 'Outro'];

// Parse CSV and extract ticker codes (base 4-char codes)
function extractTickerBases(csvContent: string, tickerColumn: number, delimiter: string): Set<string> {
  const lines = csvContent.trim().split('\n');
  const bases = new Set<string>();

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Handle CSV with quoted fields
    let columns: string[];
    if (line.includes('"')) {
      columns = line.match(/("([^"]*)"|[^,;]+)/g)?.map(c => c.replace(/^"|"$/g, '')) || [];
    } else {
      columns = line.split(delimiter);
    }

    const ticker = columns[tickerColumn]?.trim();
    if (ticker) {
      // Extract base code (first 4 chars, uppercase)
      const base = ticker.slice(0, 4).toUpperCase();
      if (base.length === 4) {
        bases.add(base);
      }
    }
  }

  return bases;
}

// Build lookup sets from CSV data
const acoesBases = extractTickerBases(acoesRaw, 0, ',');
const etfsBases = extractTickerBases(etfsRaw, 2, ';');
const fiisBases = extractTickerBases(fiisRaw, 2, ';');
const fiInfrasBases = extractTickerBases(fiInfrasRaw, 2, ';');
const fipsBases = extractTickerBases(fipsRaw, 2, ';');

// Asset names: stocks by full ticker (falling back to the 4-char base), funds by base.
// The fund CSVs are Latin-1 read as UTF-8, so names with a mangled accent are left out.
function extractNames(csvContent: string, tickerColumn: number, nameColumn: number, delimiter: string, byBase: boolean) {
  const names = new Map<string, string>();
  for (const line of csvContent.trim().split('\n').slice(1)) {
    const columns = line.includes('"')
      ? line.match(/("([^"]*)"|[^,;]+)/g)?.map((c) => c.replace(/^"|"$/g, '')) ?? []
      : line.split(delimiter);
    const ticker = columns[tickerColumn]?.trim().toUpperCase();
    const name = columns[nameColumn]?.trim();
    if (!ticker || !name || name.includes('\uFFFD')) continue;
    const key = byBase ? ticker.slice(0, 4) : ticker;
    if (!names.has(key)) names.set(key, name);
  }
  return names;
}

const stockNames = extractNames(acoesRaw, 0, 1, ',', false);
const stockBaseNames = new Map([...stockNames].map(([ticker, name]): [string, string] => [ticker.slice(0, 4), name]).reverse());
const fundNames = new Map([
  ...extractNames(fipsRaw, 2, 1, ';', true),
  ...extractNames(fiInfrasRaw, 2, 1, ';', true),
  ...extractNames(fiisRaw, 2, 1, ';', true),
  ...extractNames(etfsRaw, 2, 1, ';', true),
]);

/** Company or fund name of a ticker ("Petrobras", "FII MAXI REN"), or null when unknown. */
export function getAssetName(ticker: string): string | null {
  const normalized = ticker.trim().toUpperCase();
  const base = normalized.slice(0, 4);
  return stockNames.get(normalized) ?? fundNames.get(base) ?? stockBaseNames.get(base) ?? null;
}

/**
 * Classify a ticker into its asset class
 * @param ticker - The ticker symbol (e.g., "PETR4", "XPML11", "BOVA11")
 * @returns The asset class: 'Ação', 'ETF', 'FII', or 'Outro'
 */
export function classifyAsset(ticker: string): AssetClass {
  if (!ticker) return 'Outro';

  // Extract base code (first 4 chars, uppercase)
  const base = ticker.trim().slice(0, 4).toUpperCase();

  // Check each category (order matters - more specific funds first)
  if (etfsBases.has(base)) return 'ETF';
  if (fiisBases.has(base)) return 'FII';
  if (fiInfrasBases.has(base)) return 'FI-Infra';
  if (fipsBases.has(base)) return 'FIP';
  if (acoesBases.has(base)) return 'Ação';

  return 'Outro';
}

/**
 * Get all base codes for a given asset class
 */
export function getAssetBases(assetClass: AssetClass): string[] {
  switch (assetClass) {
    case 'Ação': return Array.from(acoesBases);
    case 'ETF': return Array.from(etfsBases);
    case 'FII': return Array.from(fiisBases);
    case 'FI-Infra': return Array.from(fiInfrasBases);
    case 'FIP': return Array.from(fipsBases);
    default: return [];
  }
}

/**
 * Get stats about loaded asset data
 */
export function getAssetStats() {
  return {
    acoes: acoesBases.size,
    etfs: etfsBases.size,
    fiis: fiisBases.size,
    fiInfras: fiInfrasBases.size,
    fips: fipsBases.size,
  };
}
