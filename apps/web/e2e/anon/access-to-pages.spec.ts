import { test, expect } from "@playwright/test";

test.describe.parallel("Anonymous user gated page access", () => {
  test("is redirected from dashboard to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/login/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("is redirected from private items to login", async ({ page }) => {
    await page.goto("/private-items");
    await expect(page).toHaveURL(/login/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  for (const protectedPath of [
    "/dashboard/new",
    "/settings/security",
    "/admin/markets",
    "/involved",
  ]) {
    test(`is redirected from ${protectedPath} to login`, async ({ page }) => {
      await page.goto(protectedPath);
      await expect(page).toHaveURL(/login/, { timeout: 10000 });
    });
  }
});
