// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';
import { classifyAsset, getAssetName } from './asset-classifier';

describe('classifyAsset', () => {
  it('classifies by the first 4 characters', () => {
    expect(classifyAsset('PETR4')).toBe('Ação');
    expect(classifyAsset('MXRF11')).toBe('FII');
    expect(classifyAsset('BOVA11')).toBe('ETF');
    expect(classifyAsset('ZZZZ3')).toBe('Outro');
  });
});

describe('getAssetName', () => {
  it('names stocks by ticker, other share classes by their base, and funds by base', () => {
    expect(getAssetName('PETR4')).toBe('Petrobras');
    expect(getAssetName('egie3')).toBe('Engie');
    expect(getAssetName('MXRF11')).toBe('FII MAXI REN');
    expect(getAssetName('ZZZZ3')).toBeNull();
  });
});
