import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

function readEnvFile(file: string): Record<string, string> {
  const fullPath = path.join(ROOT, file);
  if (!existsSync(fullPath)) return {};
  return Object.fromEntries(
    readFileSync(fullPath, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const i = line.indexOf('=');
        return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
      })
  );
}

const env = { ...readEnvFile('.env'), ...readEnvFile('.env.test.local'), ...process.env } as Record<string, string | undefined>;

/**
 * Credentials of the dedicated test account (TEST_USER_EMAIL / TEST_USER_PASSWORD, from the
 * environment or .env.test.local). The tests wipe this account's data, so they refuse to run
 * against an account whose email doesn't look like a test account.
 */
export function testCredentials() {
  const email = env.TEST_USER_EMAIL;
  const password = env.TEST_USER_PASSWORD;
  if (!email || !password) {
    throw new Error('Set TEST_USER_EMAIL and TEST_USER_PASSWORD (in .env.test.local) to a dedicated test account.');
  }
  if (!/test/i.test(email)) {
    throw new Error(`Refusing to run: the e2e tests delete all data of ${email}, which doesn't look like a test account.`);
  }
  return { email, password };
}

/** Deletes every trade, dividend and initial loss of the test account (RLS limits it to that account). */
export async function resetTestAccount() {
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are required (see .env.example).');

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.signInWithPassword(testCredentials());
  if (error) throw new Error(`Test account login failed: ${error.message}`);
  const userId = data.user.id;

  for (const table of ['trade_operations', 'dividend_events', 'ir_initial_losses'] as const) {
    const { error: deleteError } = await supabase.from(table).delete().eq('user_id', userId);
    if (deleteError) throw new Error(`Could not clear ${table}: ${deleteError.message}`);
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
    expect(count, `${table} should be empty after reset`).toBe(0);
  }
  await supabase.auth.signOut();
}

export async function login(page: Page) {
  const { email, password } = testCredentials();
  await page.goto('/auth');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL('/');
}
