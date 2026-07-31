import {
  formatSteamReleaseLabel,
  normalizeSteamReleaseDate,
} from "./steam-release-date.ts";
import { normalizeSteamGenres } from "./steam-tags.ts";

const TRUSTED_IMAGE_HOSTS = new Set([
  "shared.fastly.steamstatic.com",
  "shared.akamai.steamstatic.com",
  "cdn.akamai.steamstatic.com",
  "steamcdn-a.akamaihd.net",
]);

export type SteamAppDetails = {
  imageUrl: string;
  releaseDate: string | null;
  releaseLabel: string;
  released: boolean;
  tags: string[];
};

export function fallbackSteamHeaderImage(appId: number) {
  return `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`;
}

export async function fetchSteamAppDetails(appId: number): Promise<SteamAppDetails | null> {
  const url = new URL("https://store.steampowered.com/api/appdetails");
  url.searchParams.set("appids", String(appId));
  url.searchParams.set("cc", "us");
  url.searchParams.set("l", "english");

  try {
    const payload = await fetchJsonWithRetry<Record<string, {
      success?: boolean;
      data?: {
        header_image?: unknown;
        genres?: unknown;
        release_date?: { coming_soon?: unknown; date?: unknown };
      };
    }>>(url.toString(), 2);
    const app = payload[String(appId)];
    if (!app?.success || !app.data) return null;

    const releaseDate = normalizeSteamReleaseDate(app.data.release_date?.date);
    return {
      imageUrl: trustedImageUrl(app.data.header_image) ?? fallbackSteamHeaderImage(appId),
      releaseDate,
      releaseLabel: formatSteamReleaseLabel(releaseDate),
      released: app.data.release_date?.coming_soon === false,
      tags: normalizeSteamGenres(app.data.genres),
    };
  } catch (error) {
    console.warn(`Could not refresh Steam details for app ${appId}`, error);
    return null;
  }
}

export function applySteamAppDetails<
  T extends {
    lifecycle_status: string;
    wishlist_rank: number | null;
    wishlist_estimate: string | null;
    is_wishlisted: boolean;
    released_at: string | null;
  },
>(row: T, details: SteamAppDetails, refreshedAt: string): T & {
  image_url: string;
  release_date: string | null;
  release_label: string;
  tags: string[];
  steam_data_updated_at: string;
  steam_data_attempted_at: string;
} {
  const released = details.released;
  return {
    ...row,
    image_url: details.imageUrl,
    release_date: details.releaseDate,
    release_label: details.releaseLabel,
    tags: details.tags,
    lifecycle_status: released ? "released" : "upcoming",
    wishlist_rank: released ? null : row.wishlist_rank,
    wishlist_estimate: released ? null : row.wishlist_estimate,
    is_wishlisted: released ? false : row.is_wishlisted,
    released_at: released
      ? details.releaseDate
        ? `${details.releaseDate}T00:00:00.000Z`
        : refreshedAt
      : null,
    steam_data_updated_at: refreshedAt,
    steam_data_attempted_at: refreshedAt,
  };
}

async function fetchJsonWithRetry<T>(url: string, attempts: number): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(url, {
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent": "NextHitMarket/1.0 (+https://nexthitmarket.com)",
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} from Steam`);
      return await response.json() as T;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await delay(400 * attempt);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError;
}

function trustedImageUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && TRUSTED_IMAGE_HOSTS.has(url.hostname)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
