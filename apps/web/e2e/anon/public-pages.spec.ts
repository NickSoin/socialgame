import { expect, test } from '@playwright/test';

test.describe.parallel('Anonymous user public pages', () => {
  test('can browse live Steam markets', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL('/');
    await expect(
      page.getByRole('heading', { name: 'Call the nextbig play.' }).first(),
    ).toBeVisible();
    await expect(page.locator('.market-card')).not.toHaveCount(0);
    await expect(page.getByText(/play-money/i).first()).toBeVisible();
  });

  test('can view both leaderboards', async ({ page }) => {
    await page.goto('/leaderboards');

    await expect(
      page.getByRole('heading', { name: /proof, not hot takes/i }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Coin leaders' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Accuracy leaders' })).toBeVisible();
  });

  test('can access the login page', async ({ page }) => {
    await page.goto('/login');

    await expect(page).toHaveURL('/login');
    await expect(page.getByText('Sign in to NextHit Market')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Magic Link' })).toBeVisible();
  });

  test('can access the sign-up page', async ({ page }) => {
    await page.goto('/sign-up');

    await expect(page).toHaveURL('/sign-up');
    await expect(page.getByText('Create your NextHit Market account')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Magic Link' })).toBeVisible();
  });
});
