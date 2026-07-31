const STEAM_HOVER_PREVIEWS: Readonly<Record<number, readonly string[]>> = {
  1368140: ["/game-previews/1368140-1.webp", "/game-previews/1368140-2.webp"],
  3738830: ["/game-previews/3738830-1.webp", "/game-previews/3738830-2.webp"],
};

export function getSteamHoverPreviews(appId: number): readonly string[] {
  return STEAM_HOVER_PREVIEWS[appId] ?? [];
}
