"use server";

import { z } from "zod";
import { getSteamFeedPageData } from "@/data/steam-feed-page";

const loadSteamFeedPageSchema = z.object({
  mode: z.enum(["upcoming", "trending", "locked", "completed", "involved"]),
  page: z.number().int().positive().max(1_000),
  query: z.string().trim().max(80),
  status: z.enum(["open", "resolved"]),
});

export async function loadSteamFeedPage(input: z.infer<typeof loadSteamFeedPageSchema>) {
  const parsedInput = loadSteamFeedPageSchema.parse(input);
  const result = await getSteamFeedPageData(parsedInput);

  if (parsedInput.mode === "involved" && !result.isAuthenticated) {
    throw new Error("Authentication required.");
  }

  return { games: result.games, hasMore: result.hasMore };
}
