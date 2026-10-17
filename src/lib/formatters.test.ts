import { describe, it, expect } from 'vitest';
import { formatCurrencyCompactBRL, normalizeTicker } from './formatters';

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
