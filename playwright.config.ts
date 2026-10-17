import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const PORT = 4173;

// Prefer a system Chromium (PLAYWRIGHT_CHROMIUM_PATH, or Ubuntu's snap) so Playwright doesn't
// need to download browsers; fall back to the bundled one (`npx playwright install chromium`).
const systemChromium = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? ['/snap/bin/chromium', '/usr/bin/chromium'].find(existsSync);

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  // All tests share one test account, so they run one at a time, in order
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  outputDir: 'test-results',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    launchOptions: systemChromium ? { executablePath: systemChromium } : {},
  },
  // Test the production build, not the dev server
  webServer: {
    command: `vite build --outDir .e2e-dist --emptyOutDir && vite preview --outDir .e2e-dist --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
