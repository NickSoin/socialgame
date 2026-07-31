import { createClient } from "@supabase/supabase-js";

const sourceUrl = requiredEnv("SOURCE_SUPABASE_URL");
const sourceKey = requiredEnv("SOURCE_SUPABASE_SECRET_KEY");
const targetUrl = requiredEnv("TARGET_SUPABASE_URL");
const targetKey = requiredEnv("TARGET_SUPABASE_SECRET_KEY");

if (new URL(sourceUrl).origin === new URL(targetUrl).origin) {
  throw new Error("Source and target Supabase projects must be different.");
}

const source = createAdminClient(sourceUrl, sourceKey);
const target = createAdminClient(targetUrl, targetKey);
const bucket = "steam-game-media";

const games = await fetchAllRows(source, "steam_games", "*", "steam_app_id");
await upsertInBatches(target, "steam_games", games, "steam_app_id");

const media = await fetchAllRows(source, "steam_game_media", "*", "steam_app_id");
await ensureMediaBucket(target);

const copiedMedia = [];
const mediaErrors = [];
await runPool(media, 8, async (row) => {
  const { data, error } = await source.storage.from(bucket).download(row.storage_path);
  if (error || !data) {
    mediaErrors.push({ path: row.storage_path, message: error?.message ?? "empty download" });
    return;
  }

  const { error: uploadError } = await target.storage.from(bucket).upload(
    row.storage_path,
    await data.arrayBuffer(),
    {
      cacheControl: "31536000",
      contentType: row.mime_type,
      upsert: true,
    },
  );
  if (uploadError) {
    mediaErrors.push({ path: row.storage_path, message: uploadError.message });
    return;
  }
  copiedMedia.push(row);
});

await upsertInBatches(target, "steam_game_media", copiedMedia, "id");

const [targetGames, targetPopular, targetMedia] = await Promise.all([
  countRows(target, "steam_games"),
  countRows(target, "steam_games", (query) => query
    .eq("is_popular_upcoming", true)
    .eq("lifecycle_status", "upcoming")
    .eq("is_wishlisted", true)),
  countRows(target, "steam_game_media"),
]);

console.log(JSON.stringify({
  sourceGames: games.length,
  targetGames,
  targetPopularUpcoming: targetPopular,
  sourceMedia: media.length,
  copiedMedia: copiedMedia.length,
  targetMedia,
  mediaErrors: mediaErrors.slice(0, 10),
  mediaErrorCount: mediaErrors.length,
}, null, 2));

if (targetGames < games.length) {
  throw new Error(`Catalog verification failed: expected at least ${games.length} games, found ${targetGames}.`);
}
if (targetPopular === 0) {
  throw new Error("Catalog verification failed: target has no Popular Upcoming games.");
}
if (mediaErrors.length) {
  throw new Error(`Media copy failed for ${mediaErrors.length} objects.`);
}

function createAdminClient(url, key) {
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name}.`);
  return value;
}

async function fetchAllRows(client, table, columns, orderColumn) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .order(orderColumn, { ascending: true })
      .range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) return rows;
  }
}

async function upsertInBatches(client, table, rows, onConflict) {
  for (const batch of chunks(rows, 200)) {
    const { error } = await client.from(table).upsert(batch, { onConflict });
    if (error) throw error;
  }
}

async function ensureMediaBucket(client) {
  const { data, error } = await client.storage.getBucket(bucket);
  if (data) return;
  if (error && !/not found/i.test(error.message)) throw error;
  const { error: createError } = await client.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: 25 * 1024,
    allowedMimeTypes: ["image/webp"],
  });
  if (createError && !/already exists/i.test(createError.message)) throw createError;
}

async function countRows(client, table, refine = (query) => query) {
  const query = refine(client.from(table).select("*", { count: "exact", head: true }));
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function runPool(items, concurrency, worker) {
  let cursor = 0;
  async function next() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
}

function chunks(values, size) {
  const result = [];
  for (let offset = 0; offset < values.length; offset += size) {
    result.push(values.slice(offset, offset + size));
  }
  return result;
}
