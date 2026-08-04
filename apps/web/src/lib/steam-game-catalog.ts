import {
  STEAM_BET_TARGETS,
  type SteamBetAveragePoint,
  type SteamBetTargetKey,
  type SteamUpcomingGame,
} from "./steam-bets";
import { getSteamHoverPreviews, type SteamHoverPreviewRecord } from "./steam-hover-previews";

export type SteamGameCatalogRecord = {
  steam_app_id: number;
  name: string;
  image_url: string;
  release_date: string | null;
  release_label: string;
  tags: string[];
  lifecycle_status: string;
  pre_release_rank: number | null;
  wishlist_rank: number | null;
  source_updated_at?: string | null;
  follower_count?: number | null;
  followers_updated_at?: string | null;
  average_forecast_history?: unknown;
  steam_game_media?: SteamHoverPreviewRecord[] | null;
};

function getAverageHistory(
  value: unknown,
  targetKey: SteamBetTargetKey,
): SteamBetAveragePoint[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const rawPoints = (value as Record<string, unknown>)[targetKey];
  if (!Array.isArray(rawPoints)) return [];

  return rawPoints.slice(-30).flatMap((point) => {
    if (!point || typeof point !== "object" || Array.isArray(point)) return [];
    const at = "at" in point && typeof point.at === "string" ? point.at : null;
    const averageValue = "average_value" in point ? Number(point.average_value) : Number.NaN;
    return at && Number.isFinite(averageValue) ? [{ at, averageValue }] : [];
  });
}

export function toSteamUpcomingGame(row: SteamGameCatalogRecord): SteamUpcomingGame {
  return {
    appId: Number(row.steam_app_id),
    name: row.name,
    lifecycleStatus: row.lifecycle_status === "released" ? "released" : "upcoming",
    imageUrl: row.image_url,
    previewUrls: getSteamHoverPreviews(row.steam_game_media),
    releaseDate: row.release_date ? `${row.release_date}T00:00:00.000Z` : "TBA",
    releaseLabel: row.release_label || "TBA",
    tags: row.tags.filter((tag) => tag.trim()).slice(0, 5),
    wishlistRank: row.wishlist_rank ?? row.pre_release_rank,
    wishlistRankUpdatedAt: row.source_updated_at ?? null,
    followerCount: row.follower_count ?? null,
    followersUpdatedAt: row.followers_updated_at ?? null,
    targets: STEAM_BET_TARGETS.map((target) => ({
      ...target,
      averageValue: null,
      averageHistory: getAverageHistory(row.average_forecast_history, target.key),
      predictionCount: 0,
      userValue: null,
      userPercentile: null,
      marketStatus: "open",
      lockAt: null,
      actualValue: null,
      actualPercentile: null,
      points: 0,
      scoredDays: 0,
    })),
  };
}
