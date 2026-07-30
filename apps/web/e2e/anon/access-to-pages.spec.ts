import { test, expect } from "@playwright/test";

test.describe.parallel("Anonymous user gated page access", () => {
  test("is redirected from dashboard to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/login/, { timeout: 10000 });
    await expect(page.getByText("Sign in to NextHit Market")).toBeVisible();
  });

  test("is redirected from private items to login", async ({ page }) => {
    await page.goto("/private-items");
    await expect(page).toHaveURL(/login/, { timeout: 10000 });
    await expect(page.getByText("Sign in to NextHit Market")).toBeVisible();
  });

  for (const protectedPath of [
    "/dashboard/new",
    "/profile/test-user",
    "/settings/security",
    "/admin/markets",
  ]) {
    test(`is redirected from ${protectedPath} to login`, async ({ page }) => {
      await page.goto(protectedPath);
      await expect(page).toHaveURL(/login/, { timeout: 10000 });
    });
  }
});
