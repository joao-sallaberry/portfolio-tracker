// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';
import { formatCurrencyCompactBRL, formatDateBR, formatISODateLocal, normalizeTicker, parseISODateLocal } from './formatters';

describe('normalizeTicker', () => {
  it('strips the fractional-market F suffix', () => {
    expect(normalizeTicker('PETR4F')).toBe('PETR4');
    expect(normalizeTicker('TAEE11F')).toBe('TAEE11');
    expect(normalizeTicker('AAPL34F')).toBe('AAPL34');
  });

  it('trims and uppercases', () => {
    expect(normalizeTicker(' petr4f ')).toBe('PETR4');
    expect(normalizeTicker('vale3')).toBe('VALE3');
  });

  it('leaves regular tickers untouched', () => {
    expect(normalizeTicker('PETR4')).toBe('PETR4');
    expect(normalizeTicker('MXRF11')).toBe('MXRF11');
    expect(normalizeTicker('KNCR11')).toBe('KNCR11');
  });

  it('only strips an F that follows the ticker digits', () => {
    expect(normalizeTicker('ABCF')).toBe('ABCF');
    expect(normalizeTicker('TESOURO SELIC')).toBe('TESOURO SELIC');
    expect(normalizeTicker('')).toBe('');
  });
});

describe('formatCurrencyCompactBRL', () => {
  // Intl separates "R$" from the number with a non-breaking space
  const plain = (value: number) => formatCurrencyCompactBRL(value).replace(/\s/g, ' ');

  it('keeps small values whole instead of rounding them to zero thousands', () => {
    expect(plain(0)).toBe('R$ 0');
    expect(plain(68)).toBe('R$ 68');
    expect(plain(999)).toBe('R$ 999');
  });

  it('abbreviates thousands and millions in Portuguese', () => {
    expect(plain(1000)).toBe('R$ 1 mil');
    expect(plain(1360)).toBe('R$ 1,4 mil');
    expect(plain(2_500_000)).toBe('R$ 2,5 mi');
  });
});

describe('formatISODateLocal', () => {
  it('formats the local calendar date, including late at night', () => {
    expect(formatISODateLocal(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(formatISODateLocal(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
});

describe('parseISODateLocal', () => {
  it('reads database dates as local midnight', () => {
    expect(parseISODateLocal('2025-01-01')).toEqual(new Date(2025, 0, 1));
    expect(parseISODateLocal('2025-01-01T23:30:00Z')).toEqual(new Date(2025, 0, 1));
  });

  it('rejects anything that is not a YYYY-MM-DD date', () => {
    expect(parseISODateLocal('')).toBeNull();
    expect(parseISODateLocal(null)).toBeNull();
    expect(parseISODateLocal('01/02/2025')).toBeNull();
    expect(parseISODateLocal('Jan 1, 2025')).toBeNull();
    expect(parseISODateLocal('2025-02-30')).toBeNull();
    expect(parseISODateLocal('2025-13-01')).toBeNull();
  });
});

describe('formatDateBR', () => {
  it('formats database dates without shifting the day', () => {
    expect(formatDateBR('2025-01-01')).toBe('01/01/2025');
    expect(formatDateBR(new Date(2025, 11, 31))).toBe('31/12/2025');
  });

  it('returns an unparsable string unchanged instead of "Invalid Date"', () => {
    expect(formatDateBR('sem data')).toBe('sem data');
  });
});
