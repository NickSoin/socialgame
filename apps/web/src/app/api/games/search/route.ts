import { NextResponse } from "next/server";
import { searchSteamCatalogGames } from "@/data/steam-game-catalog";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  if (!query) {
    return NextResponse.json(
      { games: [] },
      {
        headers: { "Cache-Control": "public, max-age=60, s-maxage=300" },
      },
    );
  }

  const games = await searchSteamCatalogGames(query, 8);
  return NextResponse.json(
    {
      games: games.map(({ appId, imageUrl, name, releaseLabel, wishlistRank }) => ({
        appId,
        imageUrl,
        name,
        releaseLabel,
        wishlistRank,
      })),
    },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
  );
}
