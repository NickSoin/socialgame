import { test, expect } from '@playwright/test';

test.describe.parallel('Logged-in user page access', () => {
  test('can access dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/dashboard');
    await expect(
      page.getByRole('heading', { name: 'Read. Commit. Score.' }),
    ).toBeVisible();
  });

  test('can access private items', async ({ page }) => {
    await page.goto('/private-items');
    await expect(page).toHaveURL('/dashboard');
    await expect(
      page.getByRole('heading', { name: 'Read. Commit. Score.' }),
    ).toBeVisible();
  });

  test('can access home page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/');
    await expect(
      page.getByRole('heading', { name: 'Call the nextbig play.' }).first(),
    ).toBeVisible();
  });

  test('can access about page', async ({ page }) => {
    await page.goto('/about');
    await expect(page).toHaveURL('/#how-it-works');
    await expect(
      page.getByRole('heading', { name: 'Simple rules. Public score.' }),
    ).toBeVisible();
  });
});
