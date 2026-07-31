export const STEAM_GAME_HERO_ASPECT_RATIO = 460 / 215;

export function getSteamGameHeroUrl(appId: number) {
  return `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`;
}
