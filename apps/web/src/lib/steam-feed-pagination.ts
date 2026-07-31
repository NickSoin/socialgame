import type { SteamFeedMode } from "./steam-feed";

export const STEAM_FEED_PAGE_SIZE = 12;

export function parseSteamFeedPage(value: string | undefined) {
  if (!value) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function getSteamFeedPageCount(total: number) {
  return Math.max(1, Math.ceil(Math.max(0, total) / STEAM_FEED_PAGE_SIZE));
}

export function paginateSteamFeed<T>(items: T[], page: number) {
  const offset = (page - 1) * STEAM_FEED_PAGE_SIZE;
  return items.slice(offset, offset + STEAM_FEED_PAGE_SIZE);
}

export function buildSteamFeedPageHref({
  mode,
  page,
  query = "",
  status = "open",
}: {
  mode: SteamFeedMode;
  page: number;
  query?: string;
  status?: string;
}) {
  const params = new URLSearchParams();
  const normalizedQuery = query.trim();
  if (normalizedQuery) params.set("q", normalizedQuery);
  if (mode === "involved" && status === "resolved") params.set("status", "resolved");
  if (page > 1) params.set("page", String(page));

  const path = mode === "upcoming" ? "/" : `/${mode}`;
  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}
