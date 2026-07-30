export const STEAM_GAME_HERO_ASPECT_RATIO = 460 / 215;

export function getSteamGameHeroUrl(appId: number) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  try {
    if (supabaseUrl && new URL(supabaseUrl).hostname.endsWith(".supabase.co")) {
      const resolverUrl = new URL("/functions/v1/steam-artwork", supabaseUrl);
      resolverUrl.searchParams.set("appId", String(appId));
      return resolverUrl.toString();
    }
  } catch {
    // The local route provides the same Steam header image in development.
  }

  return `/api/steam-artwork/${appId}`;
}
