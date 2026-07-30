import { expect, test } from '@playwright/test';

test.describe.serial('NextHit Market authenticated flows', () => {
  test('starts with a protected play-money account', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(
      page.getByRole('heading', { name: /read\. commit\. score/i }),
    ).toBeVisible();
    await expect(page.getByText(/1,000/).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Prediction history' })).toBeVisible();
  });

  test('places a prediction and records it in history', async ({ page }) => {
    await page.goto('/');
    const marketLinks = page.locator('.market-card h3 a');
    await expect(marketLinks.first()).toBeVisible();
    const question = (await marketLinks.first().innerText()).trim();
    await marketLinks.first().click();

    await page.getByRole('button', { name: /^YES/i }).click();
    await page.getByLabel('Stake in platform coins').fill('75');
    await page.getByRole('button', { name: 'Predict YES' }).click();
    await expect(page.getByText(/prediction locked/i)).toBeVisible();

    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: question })).toBeVisible();
    await expect(page.getByText('75', { exact: true })).toBeVisible();
  });

  test('updates only the permitted public profile fields', async ({ page }) => {
    await page.goto('/settings/profile');
    const uniqueUsername = `caster_${Date.now()}`;

    await page.getByLabel('Username').fill(uniqueUsername);
    await page.getByLabel('Display name').fill('QA Game Caster');
    await page.getByLabel('Bio').fill('Testing Steam predictions with play coins.');
    await page.getByRole('button', { name: /Mage avatar/i }).click();
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByText('Profile saved.')).toBeVisible();

    await page.goto(`/u/${uniqueUsername}`);
    await expect(page.getByRole('heading', { name: 'QA Game Caster' })).toBeVisible();
    await expect(page.getByText(/testing steam predictions/i)).toBeVisible();
  });

  test('appears on the public coin leaderboard', async ({ page }) => {
    await page.goto('/leaderboards');
    await expect(page.getByText('QA Game Caster').first()).toBeVisible();
  });
});
