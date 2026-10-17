import { expect, test } from '@playwright/test';
import { login, recoveryLinkHash, testCredentials } from './support/test-account';

// Supabase calls that would send an email or change the test account's password are intercepted
const RECOVER_ENDPOINT = '**/auth/v1/recover**';
const UPDATE_USER_ENDPOINT = '**/auth/v1/user**';

test.describe('forgot password on the login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.fill('#email', testCredentials().email);
    await page.getByRole('button', { name: 'Esqueci minha senha' }).click();
  });

  test('requests a reset link for the typed email', async ({ page }) => {
    let redirectTo = '';
    await page.route(RECOVER_ENDPOINT, (route) => {
      redirectTo = new URL(route.request().url()).searchParams.get('redirect_to') ?? '';
      return route.fulfill({ status: 200, json: {} });
    });

    await expect(page.locator('#forgot-email')).toHaveValue(testCredentials().email);
    await page.getByRole('button', { name: 'Enviar link' }).click();

    await expect(page.getByText(/enviamos um link para redefinir a senha/)).toBeVisible();
    expect(redirectTo).toMatch(/\/redefinir-senha$/);

    await page.getByRole('button', { name: 'Voltar para o login' }).click();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });

  test('explains the hourly email cap', async ({ page }) => {
    await page.route(RECOVER_ENDPOINT, (route) =>
      route.fulfill({ status: 429, json: { code: 429, error_code: 'over_email_send_rate_limit', msg: 'email rate limit exceeded' } })
    );
    await page.getByRole('button', { name: 'Enviar link' }).click();
    await expect(page.getByText('O limite de envio de e-mails foi atingido. Tente de novo em até uma hora.')).toBeVisible();
  });

  test('explains the per-minute request limit', async ({ page }) => {
    await page.route(RECOVER_ENDPOINT, (route) =>
      route.fulfill({
        status: 429,
        json: { code: 429, error_code: 'over_request_rate_limit', msg: 'For security purposes, you can only request this after 60 seconds.' },
      })
    );
    await page.getByRole('button', { name: 'Enviar link' }).click();
    await expect(page.getByText('Muitas tentativas. Aguarde um minuto e tente de novo.')).toBeVisible();
  });
});

test.describe('reset password page', () => {
  test('a reset link landing on the Site URL opens the new password form', async ({ page }) => {
    // Supabase falls back to the Site URL when /redefinir-senha isn't an allowed redirect
    await page.goto('/' + (await recoveryLinkHash()));
    await expect(page).toHaveURL('/redefinir-senha');
    await expect(page.getByText(`Crie uma nova senha para ${testCredentials().email}`)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Salvar nova senha' })).toBeVisible();
  });

  test('without a session, says the link is invalid', async ({ page }) => {
    await page.goto('/redefinir-senha');
    await expect(page.getByText('Link inválido ou expirado')).toBeVisible();
    await page.getByRole('button', { name: 'Voltar para o login' }).click();
    await expect(page).toHaveURL('/auth');
  });

  test.describe('with a session', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
      await page.goto('/redefinir-senha');
    });

    test('rejects a confirmation that does not match', async ({ page }) => {
      await page.fill('#new-password', 'nova-senha-1');
      await page.fill('#confirm-password', 'nova-senha-2');
      await page.getByRole('button', { name: 'Salvar nova senha' }).click();
      await expect(page.getByText('As senhas não conferem.')).toBeVisible();
    });

    test('rejects reusing the current password (real Supabase call, no change)', async ({ page }) => {
      const { password } = testCredentials();
      await page.fill('#new-password', password);
      await page.fill('#confirm-password', password);
      await page.getByRole('button', { name: 'Salvar nova senha' }).click();
      await expect(page.getByText('A nova senha precisa ser diferente da atual.')).toBeVisible();
    });

    test('saves the new password and opens the app', async ({ page }) => {
      // Answer the password update with the unchanged user, so the test account keeps its password
      await page.route(UPDATE_USER_ENDPOINT, async (route) => {
        if (route.request().method() !== 'PUT') return route.continue();
        return route.fulfill({ response: await route.fetch({ method: 'GET' }) });
      });

      await page.fill('#new-password', 'nova-senha-123');
      await page.fill('#confirm-password', 'nova-senha-123');
      await page.getByRole('button', { name: 'Salvar nova senha' }).click();

      await expect(page.getByText('Senha alterada com sucesso!')).toBeVisible();
      await expect(page).toHaveURL('/');
    });
  });
});
