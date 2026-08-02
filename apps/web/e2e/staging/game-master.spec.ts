import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

const rootEmail = process.env.STAGING_E2E_ROOT_EMAIL ?? 'playwright-root@staging.local';
const rootPassword = 'Playwright-root-123!';

test.beforeAll(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error('Staging browser-test credentials are missing.');
  const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1_000 });
  if (listed.error) throw listed.error;
  const existing = listed.data.users.find((user) => user.email === rootEmail);
  const saved = existing
    ? await admin.auth.admin.updateUserById(existing.id, { password: rootPassword, email_confirm: true })
    : await admin.auth.admin.createUser({ email: rootEmail, password: rootPassword, email_confirm: true });
  if (saved.error) throw saved.error;
});

async function signIn(page: import('@playwright/test').Page) {
  await page.getByLabel('Email', { exact: true }).fill(rootEmail);
  await page.getByLabel('Password', { exact: true }).fill(rootPassword);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('/internal/game-master');
}

test('universal root account can open staging and role admin', async ({ page }, testInfo) => {
  await page.goto('/internal/game-master');
  await expect(page).toHaveURL(/\/login\?next=%2Finternal%2Fgame-master$/);
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'NextHit Market staging', exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('game-master.png') });

  await page.goto('/internal/staging-admin');
  await expect(page.getByRole('heading', { name: 'User role administration', exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('role-admin.png') });
});
