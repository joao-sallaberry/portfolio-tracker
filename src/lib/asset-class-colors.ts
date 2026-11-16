// SPDX-License-Identifier: AGPL-3.0-or-later

import type { AssetClass } from './asset-classifier';

/** Color of each asset class in charts and legends (the --chart-* tokens in index.css). */
export const ASSET_CLASS_COLORS: Record<AssetClass, string> = {
  'Ação': 'hsl(var(--chart-1))',
  'FII': 'hsl(var(--chart-2))',
  'ETF': 'hsl(var(--chart-3))',
  'FI-Infra': 'hsl(var(--chart-4))',
  'FIP': 'hsl(var(--chart-5))',
  'Outro': 'hsl(var(--chart-6))',
};
