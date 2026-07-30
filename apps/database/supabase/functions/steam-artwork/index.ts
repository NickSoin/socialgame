import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const MAX_STEAM_APP_ID = 999_999_999_999;
const TRUSTED_STEAM_IMAGE_HOSTS = new Set([
  "shared.fastly.steamstatic.com",
  "shared.akamai.steamstatic.com",
  "cdn.akamai.steamstatic.com",
  "steamcdn-a.akamaihd.net",
]);
const CACHE_CONTROL = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000";

type SteamAppDetailsResponse = Record<
  string,
  {
    success?: boolean;
    data?: {
      header_image?: unknown;
    };
  }
>;

function trustedSteamImageUrl(value: unknown) {
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" && TRUSTED_STEAM_IMAGE_HOSTS.has(url.hostname)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function responseHeaders(extra: HeadersInit = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": CACHE_CONTROL,
    ...extra,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: responseHeaders({
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      }),
    });
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: responseHeaders({ Allow: "GET, HEAD, OPTIONS" }),
    });
  }

  const appId = Number(new URL(request.url).searchParams.get("appId"));
  if (!Number.isInteger(appId) || appId <= 0 || appId > MAX_STEAM_APP_ID) {
    return new Response("Invalid Steam app id", {
      status: 400,
      headers: responseHeaders(),
    });
  }

  const detailsUrl = new URL("https://store.steampowered.com/api/appdetails");
  detailsUrl.searchParams.set("appids", String(appId));
  detailsUrl.searchParams.set("cc", "us");
  detailsUrl.searchParams.set("l", "english");

  try {
    const response = await fetch(detailsUrl, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": "NextHitMarket/1.0 (+https://nexthitmarket.com)",
      },
      redirect: "follow",
    });
    if (!response.ok) throw new Error(`Steam returned ${response.status}`);

    const payload = (await response.json()) as SteamAppDetailsResponse;
    const app = payload[String(appId)];
    const imageUrl = trustedSteamImageUrl(app?.data?.header_image);
    if (!imageUrl) {
      return new Response("Steam artwork not found", {
        status: 404,
        headers: responseHeaders(),
      });
    }

    return new Response(null, {
      status: 307,
      headers: responseHeaders({ Location: imageUrl }),
    });
  } catch (error) {
    console.error(`Could not resolve Steam artwork for app ${appId}.`, error);
    return new Response("Steam artwork unavailable", {
      status: 502,
      headers: responseHeaders({ "Cache-Control": "public, max-age=300, s-maxage=300" }),
    });
  }
});
