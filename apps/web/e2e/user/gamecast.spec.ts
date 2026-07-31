import { expect, test } from "@playwright/test";

test.describe("NextHit Market authenticated forecast surface", () => {
  test("keeps the authenticated session on the involved feed", async ({ page }) => {
    await page.goto("/involved");

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("navigation", { name: "Forecast status" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Resolved" })).toBeVisible();
  });
});
