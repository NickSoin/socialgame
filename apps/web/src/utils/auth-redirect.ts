const REDIRECT_BASE_URL = "https://auth-redirect.invalid";
const ENCODED_PATH_SEPARATOR = /%(?:2f|5c)/i;

export const DEFAULT_AUTH_REDIRECT = "/";

/**
 * Accepts only same-origin absolute paths for post-auth redirects.
 * URLSearchParams already decodes its values once, so decoding again here
 * would both risk exceptions and make encoded redirect attacks easier.
 */
export function sanitizeAuthRedirect(
  redirect: string | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT,
): string {
  if (!redirect?.startsWith("/") || redirect.startsWith("//")) {
    return fallback;
  }

  const path = redirect.split(/[?#]/, 1)[0];
  if (redirect.includes("\\") || ENCODED_PATH_SEPARATOR.test(path)) {
    return fallback;
  }

  try {
    const url = new URL(redirect, REDIRECT_BASE_URL);
    if (url.origin !== REDIRECT_BASE_URL) {
      return fallback;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
