import { expect, test } from "@playwright/test";

test.describe.parallel("Anonymous user public pages", () => {
  test("can browse the Steam forecast feed", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", {
        name: /Popular upcoming Steam games|No games yet/,
      }),
    ).toBeVisible();
  });

  test("can view the points leaderboard", async ({ page }) => {
    await page.goto("/leaderboard");

    await expect(page.getByRole("heading", { name: "Leaderboard" })).toBeVisible();
    await expect(page.getByRole("table", { name: "All leaderboard" })).toBeVisible();
  });

  test("can access the login page", async ({ page }) => {
    await page.goto("/login");

    await expect(page).toHaveURL("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("can access the sign-up page", async ({ page }) => {
    await page.goto("/sign-up");

    await expect(page).toHaveURL("/sign-up");
    await expect(page.getByRole("heading", { name: "Register" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
  });
});
