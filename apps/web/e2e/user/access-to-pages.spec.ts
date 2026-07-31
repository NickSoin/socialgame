import { expect, test } from "@playwright/test";

test.describe.parallel("Logged-in user page access", () => {
  test("can access the home feed", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", {
        name: /Popular upcoming Steam games|No games yet/,
      }),
    ).toBeVisible();
  });

  test("can access the protected forecast feed", async ({ page }) => {
    await page.goto("/involved");
    await expect(page).toHaveURL("/involved");
    await expect(
      page.getByRole("heading", {
        name: /My forecasts|No forecasts here/,
      }),
    ).toBeVisible();
  });

  test("can access the points leaderboard", async ({ page }) => {
    await page.goto("/leaderboard");
    await expect(page).toHaveURL("/leaderboard");
    await expect(page.getByRole("heading", { name: "Leaderboard" })).toBeVisible();
  });
});
