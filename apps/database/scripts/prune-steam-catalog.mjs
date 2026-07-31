import { createClient } from "@supabase/supabase-js";

const options = parseArguments(process.argv.slice(2));
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY.");

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const games = await fetchAllRows(
  "steam_games",
  "steam_app_id,name,lifecycle_status,release_date,steam_app_type",
);
const existingExclusions = await fetchAllRows(
  "steam_catalog_exclusions",
  "steam_app_id,reason,steam_app_type,release_date",
);
const exclusionByAppId = new Map(
  existingExclusions.map((exclusion) => [Number(exclusion.steam_app_id), exclusion]),
);
const candidates = games.flatMap((game) => {
  const existingExclusion = exclusionByAppId.get(Number(game.steam_app_id));
  const oldRelease = game.lifecycle_status === "released"
    && typeof game.release_date === "string"
    && game.release_date < options.cutoff;
  const nonGame = typeof game.steam_app_type === "string" && game.steam_app_type !== "game";
  if (!existingExclusion && !oldRelease && !nonGame) return [];
  return [{
    steam_app_id: Number(game.steam_app_id),
    name: String(game.name).slice(0, 250),
    reason: existingExclusion?.reason ?? (oldRelease ? "released_before_cutoff" : "non_game"),
    steam_app_type: existingExclusion?.steam_app_type ?? game.steam_app_type,
    release_date: existingExclusion?.release_date ?? game.release_date,
    source: "catalog_cleanup",
    excluded_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  }];
});
const candidateIds = candidates.map((candidate) => candidate.steam_app_id);
const mediaRows = await selectByIds("steam_game_media", "steam_app_id,storage_path", candidateIds);
const marketRows = await selectByIds("steam_forecast_markets", "id,steam_app_id", candidateIds);
const betRows = await selectByIds("steam_bets", "id,steam_app_id", candidateIds);

const summary = {
  mode: options.apply ? "apply" : "dry-run",
  cutoff: options.cutoff,
  catalogRowsBefore: games.length,
  candidates: candidates.length,
  oldReleases: candidates.filter((candidate) => candidate.reason === "released_before_cutoff").length,
  nonGames: candidates.filter((candidate) => candidate.reason === "non_game").length,
  linkedMedia: mediaRows.length,
  linkedMarkets: marketRows.length,
  linkedBets: betRows.length,
};

if (!options.apply) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  for (const rows of chunks(candidates, 200)) {
    const { error } = await supabase
      .from("steam_catalog_exclusions")
      .upsert(rows, { onConflict: "steam_app_id" });
    if (error) throw error;
  }

  const storagePaths = mediaRows.map((row) => row.storage_path);
  for (const paths of chunks(storagePaths, 100)) {
    const { error } = await supabase.storage.from("steam-game-media").remove(paths);
    if (error) throw error;
  }

  await deleteByIds("steam_bets", candidateIds);
  await deleteByIds("steam_forecast_markets", candidateIds);
  await deleteByIds("steam_games", candidateIds);

  if (marketRows.length) {
    const { error } = await supabase.rpc("rebuild_steam_leaderboard_stats");
    if (error) throw error;
  }

  const remainingGames = await fetchAllRows("steam_games", "steam_app_id");
  console.log(JSON.stringify({
    ...summary,
    deletedGames: games.length - remainingGames.length,
    catalogRowsAfter: remainingGames.length,
  }, null, 2));
}

async function fetchAllRows(table, select) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from(table).select(select).range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) break;
  }
  return rows;
}

async function selectByIds(table, select, ids) {
  const rows = [];
  for (const appIds of chunks(ids, 200)) {
    const { data, error } = await supabase.from(table).select(select).in("steam_app_id", appIds);
    if (error) throw error;
    rows.push(...(data ?? []));
  }
  return rows;
}

async function deleteByIds(table, ids) {
  for (const appIds of chunks(ids, 200)) {
    const { error } = await supabase.from(table).delete().in("steam_app_id", appIds);
    if (error) throw error;
  }
}

function chunks(values, size) {
  const result = [];
  for (let offset = 0; offset < values.length; offset += size) {
    result.push(values.slice(offset, offset + size));
  }
  return result;
}

function parseArguments(args) {
  let apply = false;
  let cutoff = "2026-07-30";
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") continue;
    if (arg === "--apply") {
      apply = true;
      continue;
    }
    if (arg === "--cutoff") {
      cutoff = args[index + 1] ?? "";
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff) || Number.isNaN(Date.parse(`${cutoff}T00:00:00Z`))) {
    throw new Error("--cutoff must use YYYY-MM-DD.");
  }
  return { apply, cutoff };
}
