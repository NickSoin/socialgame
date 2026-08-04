const STEAM_STORE_HOST = "store.steampowered.com";
const STEAM_WEB_API_HOST = "api.steampowered.com";
const STEAMDB_HOST = "steamdb.info";
const USER_AGENT = "NextHitMarket/1.0 (+https://nexthitmarket.com)";

export type SteamResolutionMetric =
  | "first_weekend_ccu"
  | "first_month_reviews"
  | "full_price_us"
  | "launch_discount";

export type SteamResolutionValue = {
  value: number;
  sourceReference: string;
};

export class SteamResolutionSourceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "SteamResolutionSourceError";
  }
}

export function parseSteamReviewCount(payload: unknown): number {
  const value = (payload as { query_summary?: { total_reviews?: unknown } } | null)
    ?.query_summary?.total_reviews;
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new SteamResolutionSourceError(
      "invalid_review_count",
      "Steam reviews response did not contain a valid all-time review count",
    );
  }
  return count;
}

export function parseSteamDbAllTimePeak(html: string): number {
  const semanticMatch = html.match(
    /had an all-time peak of\s+([\d,]+)\s+concurrent players/i,
  );
  const listMatch = html.match(
    /<li[^>]*>\s*<strong[^>]*>([\d,]+)<\/strong>\s*all-time peak/i,
  );
  const textMatch = stripHtml(html).match(/([\d,]+)\s+all-time peak/i);
  const raw = semanticMatch?.[1] ?? listMatch?.[1] ?? textMatch?.[1];
  const peak = raw ? Number(raw.replaceAll(",", "")) : Number.NaN;
  if (!Number.isSafeInteger(peak) || peak < 0) {
    throw new SteamResolutionSourceError(
      "steamdb_peak_not_found",
      "SteamDB page did not contain a valid all-time peak",
    );
  }
  return peak;
}

export function parseSteamDbUsdBasePrice(html: string): number {
  const row = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)
    ?.find((candidate) => /U\.S\. Dollar/i.test(stripHtml(candidate)));
  if (!row) {
    throw new SteamResolutionSourceError(
      "steamdb_usd_row_not_found",
      "SteamDB page did not contain a U.S. Dollar price row",
    );
  }

  const regularPrice = row.match(/<(?:del|s)[^>]*>\s*\$\s*([\d,]+(?:\.\d{1,2})?)/i)?.[1];
  const visiblePrice = stripHtml(row).match(/\$\s*([\d,]+(?:\.\d{1,2})?)/)?.[1];
  const raw = regularPrice ?? visiblePrice;
  const price = raw ? Number(raw.replaceAll(",", "")) : Number.NaN;
  if (!Number.isFinite(price) || price < 0) {
    throw new SteamResolutionSourceError(
      "steamdb_usd_price_not_found",
      "SteamDB U.S. Dollar row did not contain a valid base price",
    );
  }
  return Math.round(price * 100) / 100;
}

export function parseSteamAppDetailsUsdBasePrice(payload: unknown, appId: number): number {
  const app = (payload as Record<string, {
    success?: unknown;
    data?: { is_free?: unknown; price_overview?: { initial?: unknown } };
  }> | null)?.[String(appId)];
  if (!app?.success || !app.data) {
    throw new SteamResolutionSourceError(
      "steam_price_not_available",
      `Steam appdetails has no price data for app ${appId}`,
    );
  }
  if (app.data.is_free === true) return 0;
  const initialCents = Number(app.data.price_overview?.initial);
  if (!Number.isSafeInteger(initialCents) || initialCents < 0) {
    throw new SteamResolutionSourceError(
      "steam_base_price_not_found",
      `Steam appdetails has no valid U.S. base price for app ${appId}`,
    );
  }
  return initialCents / 100;
}

export function parseSteamAppDetailsLaunchDiscount(payload: unknown, appId: number): number {
  const app = (payload as Record<string, {
    success?: unknown;
    data?: { is_free?: unknown; price_overview?: { discount_percent?: unknown } };
  }> | null)?.[String(appId)];
  if (!app?.success || !app.data) {
    throw new SteamResolutionSourceError(
      "steam_discount_not_available",
      `Steam appdetails has no discount data for app ${appId}`,
    );
  }
  if (app.data.is_free === true) return 0;
  const discountPercent = Number(app.data.price_overview?.discount_percent);
  if (!Number.isSafeInteger(discountPercent) || discountPercent < 0 || discountPercent > 100) {
    throw new SteamResolutionSourceError(
      "steam_launch_discount_not_found",
      `Steam appdetails has no valid launch discount for app ${appId}`,
    );
  }
  return discountPercent;
}

export function parseSteamCurrentPlayerCount(payload: unknown): number {
  const response = (payload as { response?: { result?: unknown; player_count?: unknown } } | null)
    ?.response;
  const count = Number(response?.player_count);
  if (Number(response?.result) !== 1 || !Number.isSafeInteger(count) || count < 0) {
    throw new SteamResolutionSourceError(
      "invalid_current_player_count",
      "Steam Web API did not contain a valid current player count",
    );
  }
  return count;
}

export async function fetchSteamCurrentPlayerCount(appId: number): Promise<SteamResolutionValue> {
  const url = new URL(
    `https://${STEAM_WEB_API_HOST}/ISteamUserStats/GetNumberOfCurrentPlayers/v1/`,
  );
  url.searchParams.set("appid", String(appId));
  const response = await fetchSource(url, STEAM_WEB_API_HOST);
  const payload = await response.json().catch(() => {
    throw new SteamResolutionSourceError(
      "invalid_current_players_json",
      "Steam returned malformed current-player JSON",
    );
  });
  return { value: parseSteamCurrentPlayerCount(payload), sourceReference: url.toString() };
}

export async function fetchSteamResolutionValue(
  metric: SteamResolutionMetric,
  appId: number,
): Promise<SteamResolutionValue> {
  if (!Number.isSafeInteger(appId) || appId <= 0) {
    throw new SteamResolutionSourceError("invalid_app_id", "Steam app id must be positive");
  }

  if (metric === "first_month_reviews") return fetchSteamReviews(appId);
  if (metric === "first_weekend_ccu") return fetchSteamDbPeak(appId);
  if (metric === "full_price_us") return fetchSteamBasePrice(appId);
  if (metric === "launch_discount") return fetchSteamLaunchDiscount(appId);
  throw new SteamResolutionSourceError("unsupported_metric", `Unsupported metric: ${metric}`);
}

async function fetchSteamReviews(appId: number): Promise<SteamResolutionValue> {
  const url = new URL(`https://${STEAM_STORE_HOST}/appreviews/${appId}`);
  url.searchParams.set("json", "1");
  url.searchParams.set("filter", "all");
  url.searchParams.set("language", "all");
  url.searchParams.set("review_type", "all");
  url.searchParams.set("purchase_type", "all");
  url.searchParams.set("filter_offtopic_activity", "0");
  url.searchParams.set("num_per_page", "1");
  const response = await fetchSource(url, STEAM_STORE_HOST);
  const payload = await response.json().catch(() => {
    throw new SteamResolutionSourceError("invalid_reviews_json", "Steam returned malformed reviews JSON");
  });
  return { value: parseSteamReviewCount(payload), sourceReference: url.toString() };
}

async function fetchSteamDbPeak(appId: number): Promise<SteamResolutionValue> {
  const url = new URL(`https://${STEAMDB_HOST}/app/${appId}/charts/`);
  const response = await fetchSource(url, STEAMDB_HOST);
  return { value: parseSteamDbAllTimePeak(await response.text()), sourceReference: url.toString() };
}

async function fetchSteamBasePrice(appId: number): Promise<SteamResolutionValue> {
  const steamDbUrl = new URL(`https://${STEAMDB_HOST}/app/${appId}/`);
  try {
    const response = await fetchSource(steamDbUrl, STEAMDB_HOST);
    return {
      value: parseSteamDbUsdBasePrice(await response.text()),
      sourceReference: steamDbUrl.toString(),
    };
  } catch (steamDbError) {
    const steamUrl = new URL(`https://${STEAM_STORE_HOST}/api/appdetails`);
    steamUrl.searchParams.set("appids", String(appId));
    steamUrl.searchParams.set("cc", "us");
    steamUrl.searchParams.set("l", "english");
    const response = await fetchSource(steamUrl, STEAM_STORE_HOST);
    const payload = await response.json().catch(() => {
      throw new SteamResolutionSourceError("invalid_price_json", "Steam returned malformed appdetails JSON");
    });
    const value = parseSteamAppDetailsUsdBasePrice(payload, appId);
    const reason = steamDbError instanceof Error ? steamDbError.message : String(steamDbError);
    return {
      value,
      sourceReference: `${steamUrl.toString()}#initial-usd;steamdb-fallback=${encodeURIComponent(reason.slice(0, 160))}`,
    };
  }
}

async function fetchSteamLaunchDiscount(appId: number): Promise<SteamResolutionValue> {
  const url = new URL(`https://${STEAM_STORE_HOST}/api/appdetails`);
  url.searchParams.set("appids", String(appId));
  url.searchParams.set("cc", "us");
  url.searchParams.set("l", "english");
  const response = await fetchSource(url, STEAM_STORE_HOST);
  const payload = await response.json().catch(() => {
    throw new SteamResolutionSourceError(
      "invalid_discount_json",
      "Steam returned malformed launch-discount JSON",
    );
  });
  return {
    value: parseSteamAppDetailsLaunchDiscount(payload, appId),
    sourceReference: `${url.toString()}#launch-discount-percent`,
  };
}

async function fetchSource(url: URL, trustedHost: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      credentials: "omit",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: url.hostname === STEAMDB_HOST ? "text/html,application/xhtml+xml" : "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": USER_AGENT,
      },
    });
    const finalUrl = new URL(response.url);
    if (finalUrl.protocol !== "https:" || finalUrl.hostname !== trustedHost) {
      throw new SteamResolutionSourceError(
        "untrusted_redirect",
        `Resolution source redirected to untrusted host ${finalUrl.hostname}`,
      );
    }
    if (!response.ok) {
      const retryAfterSeconds = parseRetryAfter(response.headers.get("retry-after"));
      throw new SteamResolutionSourceError(
        response.status === 429 ? "rate_limited" : `http_${response.status}`,
        `Resolution source returned HTTP ${response.status}`,
        retryAfterSeconds,
      );
    }
    return response;
  } catch (error) {
    if (error instanceof SteamResolutionSourceError) throw error;
    throw new SteamResolutionSourceError(
      error instanceof DOMException && error.name === "AbortError" ? "timeout" : "network_error",
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseRetryAfter(value: string | null) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(Math.ceil(seconds), 86_400);
  const date = Date.parse(value);
  return Number.isNaN(date)
    ? null
    : Math.min(Math.max(Math.ceil((date - Date.now()) / 1000), 0), 86_400);
}

function stripHtml(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#36;|&dollar;/gi, "$")
    .replace(/\s+/g, " ");
}
