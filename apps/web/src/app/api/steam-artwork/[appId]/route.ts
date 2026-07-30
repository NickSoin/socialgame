const MAX_STEAM_APP_ID = 999_999_999_999;
const TRUSTED_STEAM_IMAGE_HOSTS = new Set([
  'shared.fastly.steamstatic.com',
  'shared.akamai.steamstatic.com',
  'cdn.akamai.steamstatic.com',
  'steamcdn-a.akamaihd.net',
]);

type SteamAppDetailsResponse = Record<
  string,
  {
    success?: boolean;
    data?: {
      capsule_image?: unknown;
      header_image?: unknown;
    };
  }
>;

function trustedSteamImageUrl(value: unknown) {
  if (typeof value !== 'string') return null;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' && TRUSTED_STEAM_IMAGE_HOSTS.has(url.hostname)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

async function resolveFromSupabase(appId: number) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  const resolverUrl = new URL('/functions/v1/steam-artwork', supabaseUrl);
  if (!resolverUrl.hostname.endsWith('.supabase.co')) return null;
  resolverUrl.searchParams.set('appId', String(appId));

  const response = await fetch(resolverUrl, {
    cache: 'force-cache',
    redirect: 'manual',
  });
  if (response.status !== 307) {
    throw new Error(`Supabase artwork resolver returned ${response.status}`);
  }

  return trustedSteamImageUrl(response.headers.get('location'));
}

async function resolveFromSteam(appId: number) {
  const detailsUrl = new URL('https://store.steampowered.com/api/appdetails');
  detailsUrl.searchParams.set('appids', String(appId));
  detailsUrl.searchParams.set('cc', 'us');
  detailsUrl.searchParams.set('l', 'english');

  const response = await fetch(detailsUrl, {
    cache: 'force-cache',
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Steam returned ${response.status}`);

  const payload = (await response.json()) as SteamAppDetailsResponse;
  const app = payload[String(appId)];
  return (
    trustedSteamImageUrl(app?.data?.header_image) ?? trustedSteamImageUrl(app?.data?.capsule_image)
  );
}

export async function GET(_request: Request, { params }: { params: Promise<{ appId: string }> }) {
  const { appId: rawAppId } = await params;
  const appId = Number(rawAppId);

  if (!Number.isInteger(appId) || appId <= 0 || appId > MAX_STEAM_APP_ID) {
    return new Response('Invalid Steam app id', { status: 400 });
  }

  try {
    const imageUrl = (await resolveFromSupabase(appId)) ?? (await resolveFromSteam(appId));
    if (!imageUrl) return new Response('Steam artwork not found', { status: 404 });

    return new Response(null, {
      status: 307,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000',
        Location: imageUrl,
      },
    });
  } catch (error) {
    console.error(`Could not resolve Steam artwork for app ${appId}.`, error);
    return new Response('Steam artwork unavailable', {
      status: 502,
      headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' },
    });
  }
}
