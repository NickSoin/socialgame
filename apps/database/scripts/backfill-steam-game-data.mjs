import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  optimizeSteamScreenshot,
  STEAM_SCREENSHOT_MAX_BYTES,
} from "./lib/optimize-steam-screenshot.mjs";

const options = parseArguments(process.argv.slice(2));
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const cronSecret = process.env.STEAM_SYNC_CRON_SECRET;
if (!supabaseUrl || !serviceKey) throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY.");
if (!options.dryRun && (!cronSecret || cronSecret.length < 32)) {
  throw new Error("Set a 32+ character STEAM_SYNC_CRON_SECRET for authenticated discovery.");
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const workerId = `node-${randomUUID()}`;
let run = null;
const summary = {
  selected: 0,
  succeeded: 0,
  partial: 0,
  unavailable: 0,
  failed: 0,
  released: 0,
  uploaded: 0,
  skippedUnchanged: 0,
  stillPending: 0,
};

if (options.dryRun) {
  let query = supabase
    .from("steam_games")
    .select("steam_app_id,name,wishlist_rank,is_popular_upcoming,release_precision,tag_source")
    .eq("is_wishlisted", true)
    .eq("lifecycle_status", "upcoming")
    .order("wishlist_rank", { ascending: true, nullsFirst: false })
    .limit(options.limit);
  if (options.appId) query = query.eq("steam_app_id", options.appId);
  const { data, error } = await query;
  if (error) throw error;
  console.log(JSON.stringify({ dryRun: true, selectedCount: data.length, games: data }, null, 2));
}

if (!options.dryRun) {
  await ensureBucket();
  const { data: startedRun, error: runError } = await supabase
    .from("steam_enrichment_runs")
    .insert({ worker_id: workerId, status: "running" })
    .select("id")
    .single();
  if (runError) throw runError;
  run = startedRun;

  try {
    const discovery = await invokeDiscovery();
    summary.released += Number(discovery.releasedCount ?? 0);
    summary.unavailable += Number(discovery.unavailableCount ?? 0);

    const { data: jobs, error: claimError } = await supabase.rpc("claim_steam_media_jobs", {
      p_limit: options.limit,
      p_worker_id: workerId,
      p_lease_seconds: 900,
      p_app_id: options.appId,
    });
    if (claimError) throw claimError;
    summary.selected = jobs.length;
    const results = await mapWithConcurrency(jobs, options.concurrency, processMediaJob);
    for (const result of results) {
      summary[result.status] += 1;
      summary.uploaded += result.uploaded;
      summary.skippedUnchanged += result.skippedUnchanged;
    }

    const { data: quality, error: qualityError } = await supabase.rpc(
      "get_steam_game_data_quality_report",
    );
    if (qualityError) throw qualityError;
    summary.stillPending = Number(quality?.[0]?.media_pending_count ?? 0);
    const status = summary.failed
      ? summary.succeeded || summary.partial
        ? "partial"
        : "error"
      : "success";
    await finishRun(status);
    console.log(
      JSON.stringify(
        { runId: run.id, workerId, discovery, summary, quality: quality?.[0] ?? null },
        null,
        2,
      ),
    );
  } catch (error) {
    await finishRun("error", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function invokeDiscovery() {
  const response = await fetch(new URL("/functions/v1/sync-steam-details", supabaseUrl), {
    method: "POST",
    headers: {
      apikey: serviceKey,
      "content-type": "application/json",
      "x-steam-sync-secret": cronSecret,
    },
    body: JSON.stringify({
      limit: options.limit,
      ...(options.appId ? { appId: options.appId } : {}),
    }),
    signal: AbortSignal.timeout(180_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(`Discovery failed (${response.status}): ${payload.error ?? "unknown error"}`);
  return payload;
}

async function processMediaJob(job) {
  const screenshots = Array.isArray(job.source_payload?.screenshots)
    ? job.source_payload.screenshots.filter(validScreenshot).slice(0, 2)
    : [];
  let uploaded = 0;
  let skippedUnchanged = 0;
  try {
    const { data: existing, error: existingError } = await supabase
      .from("steam_game_media")
      .select("id,position,original_source_url,storage_bucket,storage_path")
      .eq("steam_app_id", job.steam_app_id)
      .eq("kind", "screenshot")
      .eq("active", true);
    if (existingError) throw existingError;
    const existingByPosition = new Map(existing.map((item) => [item.position, item]));

    for (const screenshot of screenshots) {
      const current = existingByPosition.get(screenshot.position);
      if (current?.original_source_url === screenshot.sourceUrl) {
        skippedUnchanged += 1;
        continue;
      }
      const source = await downloadTrustedImage(screenshot.sourceUrl);
      const optimized = await optimizeSteamScreenshot(source);
      if (optimized.buffer.length > STEAM_SCREENSHOT_MAX_BYTES) {
        throw new Error(`optimizer_budget_exceeded:${optimized.buffer.length}`);
      }
      const checksum = createHash("sha256").update(optimized.buffer).digest("hex");
      const objectPath = `${job.steam_app_id}/screenshots/${screenshot.position}-${checksum.slice(0, 12)}.webp`;
      const { error: uploadError } = await supabase.storage
        .from("steam-game-media")
        .upload(objectPath, optimized.buffer, {
          contentType: "image/webp",
          cacheControl: "31536000",
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const { data: previous, error: publishError } = await supabase.rpc(
        "publish_steam_game_media",
        {
          p_steam_app_id: job.steam_app_id,
          p_position: screenshot.position,
          p_original_source_url: screenshot.sourceUrl,
          p_storage_bucket: "steam-game-media",
          p_storage_path: objectPath,
          p_byte_size: optimized.buffer.length,
          p_width: optimized.width,
          p_height: optimized.height,
          p_checksum_sha256: checksum,
          p_encoder_quality: optimized.quality,
          p_source_updated_at: new Date().toISOString(),
        },
      );
      if (publishError) {
        await supabase.storage.from("steam-game-media").remove([objectPath]);
        throw publishError;
      }
      uploaded += 1;
      console.log(
        JSON.stringify({
          appId: job.steam_app_id,
          position: screenshot.position,
          bytes: optimized.buffer.length,
          width: optimized.width,
          height: optimized.height,
          quality: optimized.quality,
          checksum,
        }),
      );
      const oldPath = previous?.[0]?.previous_storage_path;
      if (oldPath && oldPath !== objectPath) {
        const { error: cleanupError } = await supabase.storage
          .from("steam-game-media")
          .remove([oldPath]);
        if (cleanupError)
          console.warn("Old Steam media cleanup will be retried", {
            appId: job.steam_app_id,
            oldPath,
          });
      }
    }

    const positions = new Set(screenshots.map((item) => item.position));
    for (const old of existing) {
      if (positions.has(old.position)) continue;
      const { error } = await supabase
        .from("steam_game_media")
        .update({ active: false })
        .eq("id", old.id);
      if (error) throw error;
      const { error: cleanupError } = await supabase.storage
        .from(old.storage_bucket)
        .remove([old.storage_path]);
      if (cleanupError)
        console.warn("Retired Steam media cleanup will be retried", {
          appId: job.steam_app_id,
          path: old.storage_path,
        });
    }

    const status =
      screenshots.length >= 2 ? "complete" : screenshots.length === 1 ? "partial" : "not_available";
    const now = new Date().toISOString();
    const { error: stateError } = await supabase
      .from("steam_game_enrichment_state")
      .update({
        status,
        last_success_at: now,
        retry_after: null,
        consecutive_failures: 0,
        error_code: null,
        error_message: null,
        lease_owner: null,
        lease_expires_at: null,
      })
      .eq("steam_app_id", job.steam_app_id)
      .eq("component", "media")
      .eq("lease_owner", workerId);
    if (stateError) throw stateError;
    return {
      status:
        status === "complete" ? "succeeded" : status === "not_available" ? "unavailable" : status,
      uploaded,
      skippedUnchanged,
    };
  } catch (error) {
    const failures = Number(job.consecutive_failures ?? 0) + 1;
    const retrySeconds = Math.min(300 * 2 ** Math.min(failures - 1, 8), 86_400);
    const message = errorMessage(error);
    console.error("Steam media processing failed", {
      appId: job.steam_app_id,
      message,
    });
    await supabase
      .from("steam_game_enrichment_state")
      .update({
        status: "error",
        retry_after: new Date(Date.now() + retrySeconds * 1000).toISOString(),
        consecutive_failures: failures,
        error_code: errorCode(error),
        error_message: message,
        lease_owner: null,
        lease_expires_at: null,
      })
      .eq("steam_app_id", job.steam_app_id)
      .eq("component", "media")
      .eq("lease_owner", workerId);
    return { status: "failed", uploaded, skippedUnchanged };
  }
}

async function downloadTrustedImage(sourceUrl) {
  const parsed = new URL(sourceUrl);
  assertTrustedImageUrl(parsed);
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(parsed, {
        redirect: "follow",
        headers: { "user-agent": "NextHitMarket/1.0 (+https://nexthitmarket.com)" },
        signal: AbortSignal.timeout(20_000),
      });
      assertTrustedImageUrl(new URL(response.url));
      if (!response.ok) throw new Error(`screenshot_http_${response.status}`);
      const contentLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(contentLength) && contentLength > 20 * 1024 * 1024)
        throw new Error("screenshot_too_large");
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length || buffer.length > 20 * 1024 * 1024)
        throw new Error("screenshot_too_large");
      return buffer;
    } catch (error) {
      lastError = error;
      if (attempt < 3)
        await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** (attempt - 1)));
    }
  }
  throw lastError;
}

function assertTrustedImageUrl(url) {
  const hosts = new Set([
    "shared.fastly.steamstatic.com",
    "shared.akamai.steamstatic.com",
    "shared.cloudflare.steamstatic.com",
    "cdn.akamai.steamstatic.com",
    "steamcdn-a.akamaihd.net",
  ]);
  if (url.protocol !== "https:" || !hosts.has(url.hostname))
    throw new Error("untrusted_screenshot_url");
}

function validScreenshot(value) {
  return (
    value && (value.position === 1 || value.position === 2) && typeof value.sourceUrl === "string"
  );
}

async function ensureBucket() {
  const { data, error } = await supabase.storage.getBucket("steam-game-media");
  if (data) return;
  if (error && !/not found/i.test(error.message)) throw error;
  const { error: createError } = await supabase.storage.createBucket("steam-game-media", {
    public: true,
    fileSizeLimit: STEAM_SCREENSHOT_MAX_BYTES,
    allowedMimeTypes: ["image/webp"],
  });
  if (createError && !/already exists/i.test(createError.message)) throw createError;
}

async function finishRun(status, errorMessage = null) {
  await supabase
    .from("steam_enrichment_runs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      selected_count: summary.selected,
      succeeded_count: summary.succeeded,
      partial_count: summary.partial,
      unavailable_count: summary.unavailable,
      failed_count: summary.failed,
      released_count: summary.released,
      uploaded_count: summary.uploaded,
      skipped_unchanged_count: summary.skippedUnchanged,
      still_pending_count: summary.stillPending,
      error_message: errorMessage?.slice(0, 1000) ?? null,
    })
    .eq("id", run.id);
}

function errorCode(error) {
  const message = errorMessage(error).toLowerCase();
  if (message.includes("timeout")) return "timeout";
  if (message.includes("429")) return "rate_limited";
  if (message.includes("untrusted")) return "untrusted_source";
  if (message.includes("budget")) return "image_budget";
  return "media_processing_error";
}

function errorMessage(error) {
  const value =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String(error.message)
        : JSON.stringify(error);
  return (value || String(error)).replace(/\s+/g, " ").slice(0, 500);
}

function parseArguments(arguments_) {
  const parsed = { dryRun: false, limit: 100, appId: null, concurrency: 4 };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--") continue;
    if (argument === "--dry-run") parsed.dryRun = true;
    else if (argument === "--limit")
      parsed.limit = integerOption(arguments_[++index], "--limit", 1, 200);
    else if (argument === "--app-id")
      parsed.appId = integerOption(arguments_[++index], "--app-id", 1, 999_999_999_999);
    else if (argument === "--concurrency")
      parsed.concurrency = integerOption(arguments_[++index], "--concurrency", 1, 8);
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (parsed.appId) parsed.limit = 1;
  return parsed;
}

function integerOption(value, name, minimum, maximum) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return number;
}

async function mapWithConcurrency(values, concurrency, task) {
  const results = new Array(values.length);
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (nextIndex < values.length) {
        const index = nextIndex++;
        results[index] = await task(values[index]);
      }
    }),
  );
  return results;
}
