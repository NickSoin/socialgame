import { STEAM_BET_TARGETS, type SteamUpcomingGame } from "./steam-bets";
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
  steam_game_media?: SteamHoverPreviewRecord[] | null;
};

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
    targets: STEAM_BET_TARGETS.map((target) => ({
      ...target,
      averageValue: null,
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
