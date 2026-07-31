import { expect, request, type Page } from "@playwright/test";

const INBUCKET_URL = "http://localhost:54324";
const TEST_PASSWORD = "Test-password-123!";

interface InbucketMessage {
  ID: string;
  Created: string;
}

export interface InbucketMessageDetail {
  Text: string;
}

export async function getLatestEmailForAddress(
  emailAddress: string,
  textIncludes?: string,
): Promise<InbucketMessageDetail | null> {
  const mailbox = emailAddress.split("@")[0];
  const mailboxQuery = encodeURIComponent(mailbox);
  const requestContext = await request.newContext();

  try {
    for (let attempt = 0; attempt < 20; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      const response = await requestContext
        .get(`${INBUCKET_URL}/api/v1/search?query=${mailboxQuery}&limit=20`)
        .catch(() => null);
      if (!response?.ok()) continue;

      const body = (await response.json().catch(() => null)) as {
        messages?: InbucketMessage[];
      } | null;
      const messages = body?.messages ?? [];
      if (!messages.length) continue;

      const sortedMessages = [...messages].sort(
        (a, b) => new Date(b.Created).getTime() - new Date(a.Created).getTime(),
      );

      for (const message of sortedMessages) {
        const detailResponse = await requestContext
          .get(`${INBUCKET_URL}/api/v1/message/${message.ID}`)
          .catch(() => null);
        if (!detailResponse?.ok()) continue;

        const detail = (await detailResponse
          .json()
          .catch(() => null)) as InbucketMessageDetail | null;
        if (detail?.Text && (!textIncludes || detail.Text.includes(textIncludes))) {
          return detail;
        }
      }
    }
    return null;
  } finally {
    await requestContext.dispose();
  }
}

export function extractConfirmationLink(
  text: string,
  siteURL: string,
  redirectPath = "/auth/callback",
): string | null {
  const urls = text.match(/https?:\/\/[^\s<>"')\]]+/gi) ?? [];

  for (const rawURL of urls) {
    try {
      const link = new URL(rawURL.replaceAll("&amp;", "&"));
      if (link.pathname !== "/auth/v1/verify") continue;

      link.searchParams.set("redirect_to", new URL(redirectPath, siteURL).toString());
      return link.toString();
    } catch {
      // Keep looking when an email contains a malformed or unrelated URL.
    }
  }

  return null;
}

export async function signupUserHelper({
  page,
  emailAddress,
}: {
  page: Page;
  emailAddress: string;
}): Promise<void> {
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(emailAddress);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  const emailDetail = await getLatestEmailForAddress(emailAddress);
  if (!emailDetail) throw new Error("No confirmation email received");

  const link = extractConfirmationLink(emailDetail.Text, page.url());
  if (!link) throw new Error("Could not find confirmation link in email");

  await page.goto(link);
  await page.waitForURL((url) => url.pathname === "/", { timeout: 30000 });
}
