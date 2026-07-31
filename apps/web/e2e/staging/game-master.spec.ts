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
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(rootEmail);
  await page.getByLabel('Password', { exact: true }).fill(rootPassword);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('/');
}

test('root can run the simulation console and open role admin', async ({ page }, testInfo) => {
  await page.goto('/internal/game-master');
  await expect(page).toHaveURL(/\/login$/);
  await signIn(page);
  await page.goto('/internal/game-master');
  await expect(page.getByText('NextHit Game Master Console')).toBeVisible();

  const answers = ['Browser Sandbox', 'Browser lifecycle run', '2026-08-01T00:00:00.000Z', '321'];
  page.on('dialog', async (dialog) => dialog.accept(answers.shift() ?? ''));
  await page.getByRole('button', { name: 'Blank', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Browser Sandbox/ })).toBeVisible();

  await page.getByRole('button', { name: 'Markets', exact: true }).click();
  const gameAnswers = ['Browser Test Game', '2026-08-08T00:00:00.000Z', '5200', '800', '24.99'];
  page.removeAllListeners('dialog');
  page.on('dialog', async (dialog) => dialog.accept(gameAnswers.shift() ?? ''));
  await page.getByRole('button', { name: 'Game + 3 markets', exact: true }).click();
  await expect(page.locator('.gm-market-list article').filter({ hasText: 'Browser Test Game' }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Players', exact: true }).click();
  await page.getByLabel('Count', { exact: true }).fill('4');
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  await expect(page.getByText('@player_0004', { exact: true })).toBeVisible();
  const batchControls = page.locator('.gm-control-forms form').nth(2);
  await batchControls.locator('select').nth(2).selectOption('opening');
  await batchControls.locator('input[type="number"]').fill('1');
  await page.getByRole('button', { name: 'Preview & schedule', exact: true }).click();

  await page.getByRole('button', { name: 'Simulations', exact: true }).click();
  await page.getByRole('button', { name: '+1 day', exact: true }).click();
  await expect(page.getByText('Snapshots').first()).toBeVisible();

  await page.getByRole('button', { name: 'Markets', exact: true }).click();
  await page.getByRole('button', { name: 'Lock', exact: true }).first().click();
  await page.locator('.gm-market-list article').first().locator('input').fill('5200');
  await page.getByRole('button', { name: 'Resolve', exact: true }).first().click();
  await page.getByRole('button', { name: 'Leaderboard', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Score Inspector', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Formula comparison', exact: true })).toBeVisible();
  await expect(page.locator('.gm-table--leaderboard .gm-table-row')).toHaveCount(4);
  await expect(page.locator('.gm-score-table .gm-table-row').first()).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('game-master.png') });

  await page.getByRole('link', { name: 'Role Admin', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'User role administration', exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('role-admin.png') });
});
