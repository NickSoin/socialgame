import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

const WAYBACK_TIMEMAP_URL = "https://web.archive.org/web/timemap/json";
const USER_AGENT = "SteamGambling peak-CCU research/1.0";
const CHARTS_URL_PATTERN = /^https?:\/\/steamdb\.info\/app\/(\d+)\/charts\/?$/i;

type CatalogEntry = {
  appId: number;
  sourceUrl: string;
  discoveredFrom: string;
};

type PrefixResult = {
  prefix: string;
  discovered: number;
  completedAt: string;
};

type PeakResult = {
  appId: number;
  name: string | null;
  allTimePeak: number | null;
  peakAt: string | null;
  archiveTimestamp: string | null;
  archivedUrl: string | null;
  sourceUrl: string;
  status: "ok" | "no_capture" | "parse_failed" | "request_failed";
  attemptedAt: string;
  error?: string;
};

type ProgressPhase = "catalog" | "scraping" | "complete";

const { values } = parseArgs({
  options: {
    "output-dir": { type: "string", default: "steamdb-all-time-peaks" },
    concurrency: { type: "string", default: "2" },
    "wayback-delay-ms": { type: "string", default: "3000" },
    "prefix-start": { type: "string", default: "100" },
    "prefix-end": { type: "string", default: "999" },
    "max-prefixes": { type: "string" },
    "max-games": { type: "string" },
    "skip-small-appids": { type: "boolean", default: false },
    "catalog-only": { type: "boolean", default: false },
  },
});

const outputDirectory = resolve(values["output-dir"]);
const concurrency = parsePositiveInteger(values.concurrency, "concurrency");
const waybackDelayMs = parsePositiveInteger(values["wayback-delay-ms"], "wayback-delay-ms");
const prefixStart = parseIntegerInRange(values["prefix-start"], "prefix-start", 100, 999);
const prefixEnd = parseIntegerInRange(values["prefix-end"], "prefix-end", 100, 999);
const maxPrefixes = parseOptionalPositiveInteger(values["max-prefixes"], "max-prefixes");
const maxGames = parseOptionalPositiveInteger(values["max-games"], "max-games");
const skipSmallAppIds = values["skip-small-appids"];
const catalogOnly = values["catalog-only"];

if (prefixStart > prefixEnd) throw new Error("--prefix-start must not exceed --prefix-end");

const catalogPath = join(outputDirectory, "catalog.jsonl");
const completedPrefixesPath = join(outputDirectory, "completed-prefixes.jsonl");
const prefixErrorsPath = join(outputDirectory, "prefix-errors.jsonl");
const resultsPath = join(outputDirectory, "peaks.jsonl");
const csvPath = join(outputDirectory, "peaks.csv");
const summaryPath = join(outputDirectory, "summary.json");
const progressPath = join(outputDirectory, "progress.json");

function parsePositiveInteger(value: string | undefined, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return parsed;
}

function parseOptionalPositiveInteger(value: string | undefined, name: string): number | null {
  return value === undefined ? null : parsePositiveInteger(value, name);
}

function parseIntegerInRange(
  value: string | undefined,
  name: string,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`--${name} must be an integer from ${minimum} through ${maximum}`);
  }
  return parsed;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

let waybackGate = Promise.resolve();
let nextWaybackRequestAt = 0;

async function waitForWaybackSlot(url: string): Promise<void> {
  if (!new URL(url).hostname.endsWith("archive.org")) return;

  const slot = waybackGate.then(async () => {
    const wait = Math.max(0, nextWaybackRequestAt - Date.now());
    if (wait > 0) await sleep(wait);
    nextWaybackRequestAt = Date.now() + waybackDelayMs;
  });
  waybackGate = slot.catch(() => undefined);
  await slot;
}

async function fetchWithRetry(url: string, attempts = 7): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await waitForWaybackSlot(url);
      const response = await fetch(url, {
        headers: { Accept: "application/json,text/html;q=0.9,*/*;q=0.8", "User-Agent": USER_AGENT },
        redirect: "follow",
        signal: AbortSignal.timeout(60_000),
      });

      if (response.ok || (response.status < 500 && response.status !== 429)) return response;

      lastError = new Error(`HTTP ${response.status}`);
      const retryAfter = Number(response.headers.get("retry-after"));
      await response.body?.cancel();
      const delay =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1_000
          : Math.min(60_000, 2_000 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 750);
      await sleep(delay);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(Math.min(60_000, 2_000 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 750));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function readJsonLines<T>(path: string): Promise<T[]> {
  try {
    const contents = await readFile(path, "utf8");
    const parsed: T[] = [];
    for (const [index, line] of contents.split(/\r?\n/).entries()) {
      if (!line) continue;
      try {
        parsed.push(JSON.parse(line) as T);
      } catch {
        console.warn(`Ignoring malformed JSONL line ${index + 1} in ${path}`);
      }
    }
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function appendJsonLines(path: string, valuesToAppend: unknown[]): Promise<void> {
  if (valuesToAppend.length === 0) return;
  await appendFile(
    path,
    `${valuesToAppend.map((value) => JSON.stringify(value)).join("\n")}\n`,
    "utf8",
  );
}

function buildPrefixTimemapUrl(prefix: string): string {
  const query = new URL(WAYBACK_TIMEMAP_URL);
  query.searchParams.set("url", `https://steamdb.info/app/${prefix}/`);
  query.searchParams.set("matchType", "prefix");
  query.searchParams.append("filter", "statuscode:200");
  query.searchParams.append("filter", "mimetype:text/html");
  query.searchParams.append(
    "filter",
    String.raw`original:^https?://steamdb\.info/app/[0-9]+/charts/?$`,
  );
  query.searchParams.set("collapse", "urlkey");
  return query.toString();
}

async function enumeratePrefix(prefix: string): Promise<CatalogEntry[]> {
  const response = await fetchWithRetry(buildPrefixTimemapUrl(prefix));
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`Wayback timemap returned HTTP ${response.status}`);

  const rows = (await response.json()) as string[][];
  if (!Array.isArray(rows) || !Array.isArray(rows[0])) {
    throw new Error("Wayback timemap returned an unexpected payload");
  }

  const header = rows[0];
  const originalIndex = header.indexOf("original");
  if (originalIndex < 0) throw new Error("Wayback timemap did not include an original column");

  const entries = new Map<number, CatalogEntry>();
  for (const row of rows.slice(1)) {
    const original = row[originalIndex];
    const match = original?.match(CHARTS_URL_PATTERN);
    if (!match) continue;

    const appId = Number(match[1]);
    const candidate = { appId, sourceUrl: original, discoveredFrom: prefix };
    const existing = entries.get(appId);
    if (!existing || (!existing.sourceUrl.startsWith("https:") && original.startsWith("https:"))) {
      entries.set(appId, candidate);
    }
  }

  return [...entries.values()].sort((a, b) => a.appId - b.appId);
}

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePeak(html: string): {
  name: string | null;
  peak: number | null;
  peakAt: string | null;
} {
  const heading = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const name = heading
    ? decodeHtml(heading)
    : title
      ? decodeHtml(title).replace(/\s*[·|-]\s*SteamDB.*$/i, "")
      : null;

  const semanticMatch = html.match(
    /had an all-time peak of\s+([\d,]+)\s+concurrent players(?:\s+on\s+([^.<]+))?/i,
  );
  if (semanticMatch) {
    return {
      name,
      peak: Number(semanticMatch[1].replaceAll(",", "")),
      peakAt: semanticMatch[2]?.trim() ?? null,
    };
  }

  const listMatch = html.match(
    /<li[^>]*>\s*<strong[^>]*>([\d,]+)<\/strong>\s*all-time peak(?:\s*<relative-time[^>]*datetime="([^"]+)")?/i,
  );
  if (listMatch) {
    return {
      name,
      peak: Number(listMatch[1].replaceAll(",", "")),
      peakAt: listMatch[2] ?? null,
    };
  }

  const textMatch = decodeHtml(html).match(/([\d,]+)\s+all-time peak/i);
  return {
    name,
    peak: textMatch ? Number(textMatch[1].replaceAll(",", "")) : null,
    peakAt: null,
  };
}

function archiveTimestamp(response: Response): string | null {
  const urlTimestamp = response.url.match(/\/web\/(\d{14})(?:id_)?\//)?.[1];
  if (urlTimestamp) return urlTimestamp;

  const mementoDate = response.headers.get("memento-datetime");
  if (!mementoDate) return null;
  const date = new Date(mementoDate);
  if (Number.isNaN(date.valueOf())) return null;
  return date.toISOString().replace(/[-:T]/g, "").slice(0, 14);
}

async function scrapeGame(entry: CatalogEntry): Promise<PeakResult> {
  const attemptedAt = new Date().toISOString();
  const latestArchivedUrl = `https://web.archive.org/web/2id_/${entry.sourceUrl}`;

  try {
    const response = await fetchWithRetry(latestArchivedUrl);
    if (response.status === 404) {
      return {
        appId: entry.appId,
        name: null,
        allTimePeak: null,
        peakAt: null,
        archiveTimestamp: null,
        archivedUrl: null,
        sourceUrl: entry.sourceUrl,
        status: "no_capture",
        attemptedAt,
      };
    }
    if (!response.ok) throw new Error(`Wayback replay returned HTTP ${response.status}`);

    const parsed = parsePeak(await response.text());
    return {
      appId: entry.appId,
      name: parsed.name,
      allTimePeak: parsed.peak,
      peakAt: parsed.peakAt,
      archiveTimestamp: archiveTimestamp(response),
      archivedUrl: response.url,
      sourceUrl: entry.sourceUrl,
      status: parsed.peak === null ? "parse_failed" : "ok",
      attemptedAt,
    };
  } catch (error) {
    return {
      appId: entry.appId,
      name: null,
      allTimePeak: null,
      peakAt: null,
      archiveTimestamp: null,
      archivedUrl: null,
      sourceUrl: entry.sourceUrl,
      status: "request_failed",
      attemptedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  return /[",\r\n]/.test(stringValue) ? `"${stringValue.replaceAll('"', '""')}"` : stringValue;
}

async function writeCsv(results: PeakResult[]): Promise<void> {
  const columns: (keyof PeakResult)[] = [
    "appId",
    "name",
    "allTimePeak",
    "peakAt",
    "archiveTimestamp",
    "status",
    "archivedUrl",
    "sourceUrl",
    "attemptedAt",
    "error",
  ];
  const lines = [
    columns.join(","),
    ...results
      .toSorted((a, b) => a.appId - b.appId)
      .map((result) => columns.map((column) => csvCell(result[column])).join(",")),
  ];
  await writeAtomically(csvPath, `${lines.join("\n")}\n`);
}

async function writeAtomically(path: string, contents: string): Promise<void> {
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, contents, "utf8");
  await rename(temporaryPath, path);
}

function statusCounts(results: Iterable<PeakResult>): Record<PeakResult["status"], number> {
  const counts = { ok: 0, no_capture: 0, parse_failed: 0, request_failed: 0 };
  for (const result of results) counts[result.status] += 1;
  return counts;
}

async function main(): Promise<void> {
  await mkdir(outputDirectory, { recursive: true });

  const previousProgress = await readFile(progressPath, "utf8")
    .then((contents) => JSON.parse(contents) as { startedAt?: string })
    .catch(() => ({}));
  const startedAt = previousProgress.startedAt ?? new Date().toISOString();

  const catalog = new Map(
    (await readJsonLines<CatalogEntry>(catalogPath)).map((entry) => [entry.appId, entry]),
  );
  const completedPrefixes = new Set(
    (await readJsonLines<PrefixResult>(completedPrefixesPath)).map((result) => result.prefix),
  );
  const results = new Map(
    (await readJsonLines<PeakResult>(resultsPath)).map((result) => [result.appId, result]),
  );

  const allPrefixes = Array.from({ length: prefixEnd - prefixStart + 1 }, (_, index) =>
    String(prefixStart + index),
  );
  const requestedPrefixes = maxPrefixes === null ? allPrefixes : allPrefixes.slice(0, maxPrefixes);

  async function persistProgress(
    phase: ProgressPhase,
    selectedTotal: number | null = null,
  ): Promise<void> {
    const selectedIds =
      selectedTotal === null
        ? null
        : new Set(
            [...catalog.values()]
              .toSorted((a, b) => a.appId - b.appId)
              .slice(0, selectedTotal)
              .map((entry) => entry.appId),
          );
    const selectedResults =
      selectedIds === null
        ? []
        : [...results.values()].filter((result) => selectedIds.has(result.appId));
    const progress = {
      pid: process.pid,
      phase,
      startedAt,
      updatedAt: new Date().toISOString(),
      waybackDelayMs,
      catalog: {
        prefixesCompleted: requestedPrefixes.filter((prefix) => completedPrefixes.has(prefix))
          .length,
        prefixesTotal: requestedPrefixes.length,
        archivedChartPagesDiscovered: catalog.size,
      },
      scraping: {
        processed: selectedResults.filter((result) => result.status !== "request_failed").length,
        total: selectedTotal,
        statuses: statusCounts(selectedResults),
      },
      files: { catalogPath, resultsPath, csvPath, summaryPath },
    };
    await writeAtomically(progressPath, `${JSON.stringify(progress, null, 2)}\n`);
  }

  if (!skipSmallAppIds) {
    const smallEntries: CatalogEntry[] = [];
    for (let appId = 1; appId < 100; appId += 1) {
      if (catalog.has(appId)) continue;
      const entry = {
        appId,
        sourceUrl: `https://steamdb.info/app/${appId}/charts/`,
        discoveredFrom: "small-appid-candidate",
      };
      catalog.set(appId, entry);
      smallEntries.push(entry);
    }
    await appendJsonLines(catalogPath, smallEntries);
  }

  await persistProgress("catalog");
  console.log(
    `Catalog: ${completedPrefixes.size}/${requestedPrefixes.length} prefixes checkpointed; ` +
      `${catalog.size} chart-page candidates loaded.`,
  );

  while (requestedPrefixes.some((prefix) => !completedPrefixes.has(prefix))) {
    let failures = 0;

    for (const [index, prefix] of requestedPrefixes.entries()) {
      if (completedPrefixes.has(prefix)) continue;

      try {
        const discovered = await enumeratePrefix(prefix);
        const additions: CatalogEntry[] = [];
        for (const entry of discovered) {
          const existing = catalog.get(entry.appId);
          if (
            !existing ||
            (!existing.sourceUrl.startsWith("https:") && entry.sourceUrl.startsWith("https:"))
          ) {
            catalog.set(entry.appId, entry);
            additions.push(entry);
          }
        }
        await appendJsonLines(catalogPath, additions);

        const prefixResult = {
          prefix,
          discovered: discovered.length,
          completedAt: new Date().toISOString(),
        };
        await appendJsonLines(completedPrefixesPath, [prefixResult]);
        completedPrefixes.add(prefix);
        await persistProgress("catalog");
        console.log(
          `[catalog ${completedPrefixes.size}/${requestedPrefixes.length}] prefix=${prefix} ` +
            `found=${discovered.length} new=${additions.length} total=${catalog.size}`,
        );
      } catch (error) {
        failures += 1;
        const message = error instanceof Error ? error.message : String(error);
        await appendJsonLines(prefixErrorsPath, [
          { prefix, failedAt: new Date().toISOString(), error: message },
        ]);
        console.error(
          `[catalog ${index + 1}/${requestedPrefixes.length}] prefix=${prefix}: ${message}`,
        );
      }
    }

    if (failures > 0) {
      console.log(`${failures} catalog prefixes failed; retrying them in 60 seconds.`);
      await sleep(60_000);
    }
  }

  const selectedCatalog = [...catalog.values()]
    .toSorted((a, b) => a.appId - b.appId)
    .slice(0, maxGames ?? undefined);
  const selectedIds = new Set(selectedCatalog.map((entry) => entry.appId));
  const completed = new Map(
    [...results].filter(
      ([appId, result]) => selectedIds.has(appId) && result.status !== "request_failed",
    ),
  );

  await persistProgress(catalogOnly ? "complete" : "scraping", selectedCatalog.length);
  console.log(
    `Catalog complete: ${selectedCatalog.length} archived chart-page candidates selected; ` +
      `${completed.size} already parsed.`,
  );

  if (catalogOnly) return;

  const pending = selectedCatalog.filter((entry) => !completed.has(entry.appId));
  let cursor = 0;
  let commitGate = Promise.resolve();

  async function commitResult(result: PeakResult): Promise<void> {
    const commit = commitGate.then(async () => {
      results.set(result.appId, result);
      if (result.status !== "request_failed") completed.set(result.appId, result);
      await appendJsonLines(resultsPath, [result]);

      const processed = completed.size;
      console.log(
        `[peaks ${processed}/${selectedCatalog.length}] app=${result.appId} status=${result.status}` +
          (result.allTimePeak === null
            ? ""
            : ` peak=${result.allTimePeak.toLocaleString("en-US")}`),
      );

      if (processed % 10 === 0 || result.status === "request_failed") {
        await persistProgress("scraping", selectedCatalog.length);
      }
      if (processed > 0 && processed % 500 === 0) {
        await writeCsv([...completed.values()]);
      }
    });
    commitGate = commit.catch(() => undefined);
    await commit;
  }

  async function worker(): Promise<void> {
    while (cursor < pending.length) {
      const entry = pending[cursor];
      cursor += 1;
      await commitResult(await scrapeGame(entry));
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  await commitGate;

  const finalResults = selectedCatalog
    .map((entry) => results.get(entry.appId))
    .filter((result): result is PeakResult => result !== undefined);
  await writeCsv(finalResults);

  const summary = {
    generatedAt: new Date().toISOString(),
    source: "Latest Wayback Machine capture for each archived SteamDB /app/{appid}/charts/ page",
    catalogSize: selectedCatalog.length,
    resultCount: finalResults.length,
    statuses: statusCounts(finalResults),
    files: { catalogPath, resultsPath, csvPath },
  };
  await writeAtomically(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  await persistProgress("complete", selectedCatalog.length);

  console.log(`Finished: ${summary.statuses.ok}/${selectedCatalog.length} peaks parsed.`);
  console.log(`CSV:     ${csvPath}`);
  console.log(`JSONL:   ${resultsPath}`);
  console.log(`Summary: ${summaryPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
