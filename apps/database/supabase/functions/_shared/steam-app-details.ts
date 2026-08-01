import { normalizeSteamReleaseMetadata, type SteamReleasePrecision } from "./steam-release-date.ts";
import { normalizeSteamAppType } from "./steam-catalog-eligibility.ts";
import { extractSteamStoreTags, normalizeSteamGenres, type SteamStoreTagExtraction } from "./steam-tags.ts";
import {
  selectSteamScreenshots,
  trustedSteamImageUrl,
  type SteamScreenshot,
} from "./steam-media.ts";

const TRUSTED_STORE_HOSTS = new Set(["store.steampowered.com"]);
const TRUSTED_COMMUNITY_HOSTS = new Set(["steamcommunity.com"]);

export type SteamAppDetails = {
  appType: string;
  imageUrl: string;
  releaseDate: string | null;
  releaseLabel: string;
  releaseText: string | null;
  releasePrecision: SteamReleasePrecision;
  releaseInvalid: boolean;
  comingSoon: boolean | null;
  released: boolean;
  genreFallback: string[];
  screenshots: SteamScreenshot[];
};

export class SteamFetchError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number | null = null,
    public readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "SteamFetchError";
  }
}

export function fallbackSteamHeaderImage(appId: number) {
  return `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`;
}

export async function fetchSteamAppDetails(appId: number): Promise<SteamAppDetails> {
  const url = new URL("https://store.steampowered.com/api/appdetails");
  url.searchParams.set("appids", String(appId));
  url.searchParams.set("cc", "us");
  url.searchParams.set("l", "english");

  const payload = await fetchJsonWithRetry<Record<string, {
    success?: boolean;
    data?: {
      type?: unknown;
      header_image?: unknown;
      genres?: unknown;
      screenshots?: unknown;
      release_date?: { coming_soon?: unknown; date?: unknown };
    };
  }>>(url, 3);
  const app = payload[String(appId)];
  if (!app?.success || !app.data) {
    throw new SteamFetchError("app_not_available", `Steam appdetails has no data for app ${appId}`, 404);
  }
  const appType = normalizeSteamAppType(app.data.type);
  if (!appType) {
    throw new SteamFetchError("missing_app_type", `Steam appdetails has no valid type for app ${appId}`);
  }

  const release = normalizeSteamReleaseMetadata(app.data.release_date?.date);
  const comingSoon = typeof app.data.release_date?.coming_soon === "boolean"
    ? app.data.release_date.coming_soon
    : null;
  return {
    appType,
    imageUrl: trustedSteamImageUrl(app.data.header_image) ?? fallbackSteamHeaderImage(appId),
    releaseDate: release.exactDate,
    releaseLabel: release.label,
    releaseText: release.rawText,
    releasePrecision: release.precision,
    releaseInvalid: release.invalid,
    comingSoon,
    released: comingSoon === false,
    genreFallback: normalizeSteamGenres(app.data.genres),
    screenshots: selectSteamScreenshots(app.data.screenshots),
  };
}

export async function fetchSteamStoreTags(appId: number): Promise<SteamStoreTagExtraction> {
  const url = new URL(`https://store.steampowered.com/app/${appId}/`);
  url.searchParams.set("cc", "us");
  url.searchParams.set("l", "english");
  const response = await fetchWithRetry(url, 3, {
    Accept: "text/html,application/xhtml+xml",
    Cookie: "birthtime=315532801; lastagecheckage=1-January-1980; mature_content=1; wants_mature_content=1",
  });
  assertTrustedFinalUrl(response.url, TRUSTED_STORE_HOSTS);
  return extractSteamStoreTags(await response.text());
}

export async function fetchSteamFollowerCount(appId: number): Promise<number | null> {
  const url = new URL(`https://steamcommunity.com/games/${appId}/memberslistxml/`);
  url.searchParams.set("xml", "1");
  const response = await fetchWithRetry(
    url,
    3,
    { Accept: "application/xml,text/xml" },
    TRUSTED_COMMUNITY_HOSTS,
  );
  assertTrustedFinalUrl(response.url, TRUSTED_COMMUNITY_HOSTS);
  const xml = await response.text();
  const rawCount = xml.match(/<memberCount>\s*(?:<!\[CDATA\[)?\s*([\d,]+)\s*(?:\]\]>)?\s*<\/memberCount>/i)?.[1];
  if (!rawCount) {
    if (!/<groupDetails>/i.test(xml)) return null;
    throw new SteamFetchError("invalid_followers_xml", `Steam returned malformed followers XML for app ${appId}`);
  }
  const count = Number(rawCount.replaceAll(",", ""));
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new SteamFetchError("invalid_follower_count", `Steam returned an invalid follower count for app ${appId}`);
  }
  return count;
}

export function applySteamAppDetails<
  T extends {
    lifecycle_status: string;
    wishlist_rank: number | null;
    wishlist_estimate: string | null;
    is_wishlisted: boolean;
    released_at: string | null;
    tags?: string[];
    tag_source?: string;
  },
>(row: T, details: SteamAppDetails, refreshedAt: string): T & {
  image_url: string;
  release_date: string | null;
  release_label: string;
  release_text: string | null;
  release_precision: SteamReleasePrecision;
  steam_coming_soon: boolean | null;
  release_metadata_updated_at: string;
  steam_app_type: string;
  classification_updated_at: string;
  tags: string[];
  tag_source: string;
  steam_data_updated_at: string;
  steam_data_attempted_at: string;
} {
  const released = details.released;
  const keepStoreTags = row.tag_source === "steam_store_tags" && (row.tags?.length ?? 0) > 0;
  const fallbackTags = details.genreFallback;
  return {
    ...row,
    image_url: details.imageUrl,
    release_date: details.releaseDate,
    release_label: details.releaseLabel,
    release_text: details.releaseText,
    release_precision: details.releasePrecision,
    steam_coming_soon: details.comingSoon,
    release_metadata_updated_at: refreshedAt,
    steam_app_type: details.appType,
    classification_updated_at: refreshedAt,
    tags: keepStoreTags ? row.tags ?? [] : fallbackTags,
    tag_source: keepStoreTags
      ? "steam_store_tags"
      : fallbackTags.length ? "appdetails_genres_fallback" : "none",
    lifecycle_status: released ? "released" : "upcoming",
    wishlist_rank: released ? null : row.wishlist_rank,
    wishlist_estimate: released ? null : row.wishlist_estimate,
    is_wishlisted: released ? false : row.is_wishlisted,
    released_at: released
      ? row.released_at ?? refreshedAt
      : null,
    steam_data_updated_at: refreshedAt,
    steam_data_attempted_at: refreshedAt,
  };
}

async function fetchJsonWithRetry<T>(url: URL, attempts: number): Promise<T> {
  const response = await fetchWithRetry(url, attempts, { Accept: "application/json" });
  assertTrustedFinalUrl(response.url, TRUSTED_STORE_HOSTS);
  try {
    return await response.json() as T;
  } catch {
    throw new SteamFetchError("invalid_json", "Steam returned malformed JSON", response.status);
  }
}

async function fetchWithRetry(
  url: URL,
  attempts: number,
  headers: Record<string, string>,
  trustedHosts = TRUSTED_STORE_HOSTS,
) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(url, {
        cache: "no-store",
        credentials: "omit",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          ...headers,
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent": "NextHitMarket/1.0 (+https://nexthitmarket.com)",
        },
      });
      assertTrustedFinalUrl(response.url, trustedHosts);
      if (response.ok) return response;
      const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
      const retryable = response.status === 429 || response.status >= 500;
      const error = new SteamFetchError(
        response.status === 429 ? "rate_limited" : `http_${response.status}`,
        `HTTP ${response.status} from Steam`,
        response.status,
        retryAfter,
      );
      if (!retryable) throw error;
      lastError = error;
      if (attempt < attempts) await delay(retryDelay(attempt, retryAfter));
    } catch (error) {
      lastError = error instanceof SteamFetchError
        ? error
        : new SteamFetchError(
          error instanceof DOMException && error.name === "AbortError" ? "timeout" : "network_error",
          error instanceof Error ? error.message : String(error),
        );
      if (error instanceof SteamFetchError && error.status !== null && error.status < 500 && error.status !== 429) {
        throw error;
      }
      if (attempt < attempts) await delay(retryDelay(attempt, null));
    } finally {
      clearTimeout(timeoutId);
    }
  }
  throw lastError;
}

function assertTrustedFinalUrl(value: string, hosts: Set<string>) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !hosts.has(url.hostname)) {
    throw new SteamFetchError("untrusted_redirect", `Steam redirected to untrusted host ${url.hostname}`);
  }
}

function parseRetryAfter(value: string | null) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(Math.ceil(seconds), 3600);
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.min(Math.max(Math.ceil((date - Date.now()) / 1000), 0), 3600);
}

function retryDelay(attempt: number, retryAfterSeconds: number | null) {
  if (retryAfterSeconds !== null) return retryAfterSeconds * 1000;
  const base = Math.min(400 * 2 ** (attempt - 1), 5000);
  return base + Math.floor(Math.random() * Math.max(100, base / 4));
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
