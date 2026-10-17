import { expect, test as base, type Page } from '@playwright/test';
import { YEAR, dividendsXlsx, tradesCsv } from './support/fixtures';
import { login, resetTestAccount } from './support/test-account';

// Fails any test whose page throws an uncaught error
const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await use(errors);
      expect(errors, 'uncaught page errors').toEqual([]);
    },
    { auto: true },
  ],
});

// The tests build on each other's data: run in order, stop at the first failure
test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await resetTestAccount();
});

test.beforeEach(async ({ page }) => {
  await login(page);
});

async function importFile(page: Page, card: 'Proventos' | 'Negociações', file: { name: string; mimeType: string; buffer: Buffer }) {
  await page.goto('/importar');
  const inputs = page.locator('input[type=file]');
  await inputs.first().waitFor({ state: 'attached' });
  // The trades card is the only one that accepts CSV
  const tradesIndex = (await inputs.nth(0).getAttribute('accept'))?.includes('.csv') ? 0 : 1;
  await inputs.nth(card === 'Negociações' ? tradesIndex : 1 - tradesIndex).setInputFiles(file);
  await page.getByRole('button', { name: 'Confirmar importação' }).click();
}

const monthCard = (page: Page, month: string) => page.locator('.bg-card').filter({ hasText: new RegExp(`${month} ${YEAR}`, 'i') });

test('imports trades and dividends, and skips duplicates on re-import', async ({ page }) => {
  await importFile(page, 'Negociações', tradesCsv());
  await expect(page.getByText('9 novas negociações importadas (0 duplicadas ignoradas).')).toBeVisible();

  await importFile(page, 'Negociações', tradesCsv());
  await expect(page.getByText('Todas as 9 negociações já estavam cadastradas.')).toBeVisible();

  await importFile(page, 'Proventos', dividendsXlsx());
  await expect(page.getByText('60 novos proventos importados (0 duplicados ignorados).')).toBeVisible();
});

test('positions merge fractional tickers and drop sold-out assets', async ({ page }) => {
  await page.goto('/posicao');
  const petr4 = page.getByRole('row').filter({ hasText: 'PETR4' });
  await expect(petr4).toHaveCount(1);
  await expect(petr4).toContainText('100');
  await expect(petr4).toContainText('R$ 30,00');
  await expect(page.getByRole('row').filter({ hasText: 'EGIE3' })).toContainText('R$ 37,06');
  await expect(page.getByText('PETR4F')).toHaveCount(0);
  await expect(page.getByText('HYPE3')).toHaveCount(0);
});

test('dashboard uses the position cost and counts day-1 payments in their own year', async ({ page }) => {
  const card = (title: string | RegExp) => page.locator('.bg-card').filter({ hasText: title });
  await expect(card('Total Investido')).toContainText('R$ 5.964,80');
  // 01/01 and 15/02 of YEAR; parsing dates as UTC would move 01/01 into the previous year
  await expect(card(`Proventos em ${YEAR}`)).toContainText('R$ 136,00');
  await expect(card('Total em Proventos')).toContainText('R$ 1.360,00');

  // Charts actually draw: monthly dividends (12 bars) and top payers (3 bars), plus the pie
  await expect(card('Proventos por Mês').locator('.recharts-bar-rectangle')).toHaveCount(12);
  await expect(card('Proventos por Ativo').locator('.recharts-bar-rectangle')).toHaveCount(3);
  await expect(card('Distribuição do Portfólio').locator('.recharts-pie-sector')).not.toHaveCount(0);
  // Axes use compact currency (small values used to round to "R$ 0k")
  await expect(card('Proventos por Mês')).not.toContainText('0k');
  await expect(card('Proventos por Mês')).toContainText(/R\$\s20/);
});

test('IR taxes the consolidated month, carries the loss and saves the initial loss', async ({ page }) => {
  await page.goto('/imposto-renda');
  const january = monthCard(page, 'janeiro');
  const february = monthCard(page, 'fevereiro');

  // January nets to a loss even though its gains come first: no tax, loss carried forward
  await expect(january).toContainText('L/P: -R$ 2.096,30');
  await expect(january).toContainText('Prej. Acum.: -R$ 2.096,30');
  await expect(january).toContainText('Imposto: R$ 0,00');
  // February: 15% of R$ 8.000,00 - R$ 2.096,30
  await expect(february).toContainText(/Imposto: R\$\s885,5[56]/);
  // Tax is shown per month only
  await expect(january.getByRole('columnheader', { name: 'Imposto' })).toHaveCount(0);

  const saved = page.waitForResponse((r) => r.url().includes('/rest/v1/ir_initial_losses') && r.request().method() === 'POST');
  await page.fill('#initial-loss', '1000');
  await page.keyboard.press('Tab');
  expect((await saved).ok()).toBe(true);
  await expect(page.locator('#initial-loss')).toHaveValue(/^R\$\s1\.000,00$/);

  await page.reload();
  await expect(page.locator('#initial-loss')).toHaveValue(/^R\$\s1\.000,00$/);
  await expect(january).toContainText('Prej. Acum.: -R$ 3.096,30');
  // 15% of R$ 8.000,00 - R$ 3.096,30
  await expect(february).toContainText(/Imposto: R\$\s735,5[56]/);
});

test('dividends are paginated and the total covers every filtered row', async ({ page }) => {
  await page.goto('/proventos');
  await expect(page.getByText('Mostrando 1 a 50 de 60 proventos')).toBeVisible();
  // The monthly chart draws bars, and hovering one shows the month's values by asset class
  const bar = page.locator('.recharts-bar-rectangle').first();
  await expect(bar).toBeVisible();
  await bar.hover();
  const tooltip = page.locator('.recharts-tooltip-wrapper');
  await expect(tooltip).toContainText(/Ações\s*R\$\s18,00/); // EGIE3 + PETR4
  await expect(tooltip).toContainText(/FIIs\s*R\$\s50,00/); // MXRF11
  await expect(tooltip).not.toContainText('R$ 0,00'); // classes without dividends are left out
  await expect(page.locator('tbody tr')).toHaveCount(50);
  await expect(page.locator('tfoot')).toContainText('R$ 1.360,00');

  await page.getByRole('button', { name: 'Próximo' }).click();
  await expect(page.getByText('Mostrando 51 a 60 de 60 proventos')).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(10);
  await expect(page.locator('tfoot')).toContainText('R$ 1.360,00');

  // Changing the sorting goes back to the first page
  await page.getByRole('columnheader', { name: /Valor Líquido/ }).click();
  await expect(page.getByText('Mostrando 1 a 50 de 60 proventos')).toBeVisible();
});

test('unknown routes show the 404 page, and logged-out users are sent to login', async ({ page, browser }) => {
  await page.goto('/rota-que-nao-existe');
  await expect(page.getByText('Página não encontrada')).toBeVisible();
  await page.getByRole('link', { name: 'Voltar para a Visão Geral' }).click();
  await expect(page).toHaveURL('/');

  const loggedOut = await browser.newPage({ baseURL: test.info().project.use.baseURL });
  await loggedOut.goto('/imposto-renda');
  await expect(loggedOut).toHaveURL('/auth');
  await loggedOut.close();
});
