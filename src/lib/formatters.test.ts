import { describe, it, expect } from 'vitest';
import { normalizeTicker } from './formatters';

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
