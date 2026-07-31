import { expect, test } from "@playwright/test";
import {
  extractConfirmationLink,
  getLatestEmailForAddress,
  signupUserHelper,
} from "../_helpers/signup.helper";

const RECOVERED_PASSWORD = "Recovered-password-456!";

test.describe("Anonymous user password recovery", () => {
  test("can replace a forgotten password and sign in again", async ({ page }) => {
    const emailAddress = `recovery${Date.now()}@example.com`;

    await signupUserHelper({ page, emailAddress });
    await page.context().clearCookies();

    await page.goto("/forgot-password");
    await page.getByLabel("Email address").fill(emailAddress);
    await page.getByRole("button", { name: "Reset password" }).click();
    await expect(page.getByText("Reset password link sent")).toBeVisible();

    const recoveryEmail = await getLatestEmailForAddress(emailAddress, "type=recovery");
    if (!recoveryEmail) throw new Error("No password recovery email received");

    const recoveryLink = extractConfirmationLink(
      recoveryEmail.Text,
      page.url(),
      "/auth/callback?next=/update-password",
    );
    if (!recoveryLink) throw new Error("Could not find password recovery link");

    await page.goto(recoveryLink);
    await page.waitForURL(/\/update-password(?:[/?#]|$)/, { timeout: 30000 });
    await page.getByLabel("Create your new Password").fill(RECOVERED_PASSWORD);
    await page.getByRole("button", { name: "Confirm Password" }).click();
    await page.waitForURL((url) => url.pathname === "/", { timeout: 30000 });

    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByLabel("Email").fill(emailAddress);
    await page.getByLabel("Password").fill(RECOVERED_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.waitForURL((url) => url.pathname === "/", { timeout: 30000 });
    await expect(
      page.getByRole("heading", {
        name: /Popular upcoming Steam games|No games yet/,
      }),
    ).toBeVisible();
  });
});
