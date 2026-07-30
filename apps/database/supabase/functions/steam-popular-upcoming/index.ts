import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const PAGE_SIZE = 100;
const PAGE_COUNT = 2;
const CACHE_CONTROL = "public, max-age=900, s-maxage=1800, stale-while-revalidate=3600";

function steamPopularUpcomingUrl(start: number) {
  const url = new URL("https://store.steampowered.com/search/results/");
  url.searchParams.set("query", "");
  url.searchParams.set("start", String(start));
  url.searchParams.set("count", String(PAGE_SIZE));
  url.searchParams.set("dynamic_data", "");
  url.searchParams.set("sort_by", "_ASC");
  url.searchParams.set("filter", "popularcomingsoon");
  url.searchParams.set("snr", "1_7_7_popularcomingsoon_7");
  url.searchParams.set("infinite", "1");
  url.searchParams.set("l", "english");
  url.searchParams.set("cc", "us");
  return url;
}

function headers(extra: HeadersInit = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": CACHE_CONTROL,
    "Content-Type": "application/json; charset=utf-8",
    ...extra,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: headers({
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      }),
    });
  }

  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: headers({ Allow: "GET, OPTIONS" }),
    });
  }

  try {
    const pages = await Promise.all(
      Array.from({ length: PAGE_COUNT }, async (_, pageIndex) => {
        const response = await fetch(steamPopularUpcomingUrl(pageIndex * PAGE_SIZE), {
          headers: {
            Accept: "application/json",
            "Accept-Language": "en-US,en;q=0.9",
            "User-Agent": "NextHitMarket/1.0 (+https://nexthitmarket.com)",
          },
        });
        if (!response.ok) throw new Error(`Steam returned ${response.status}`);
        return (await response.json()) as { results_html?: string };
      }),
    );

    return new Response(
      JSON.stringify({ results_html: pages.map((page) => page.results_html ?? "").join("") }),
      { status: 200, headers: headers() },
    );
  } catch (error) {
    console.error("Could not load Steam popular upcoming games.", error);
    return new Response(JSON.stringify({ error: "Steam popular upcoming unavailable" }), {
      status: 502,
      headers: headers({ "Cache-Control": "public, max-age=60, s-maxage=60" }),
    });
  }
});
