import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

const STEAM_CHARTS_URL = "https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/";
const WAYBACK_TIMEMAP_URL = "https://web.archive.org/web/timemap/json";
const USER_AGENT = "SteamGambling peak-CCU research/1.0";

type SteamRank = {
  rank: number;
  appid: number;
};

type Capture = {
  timestamp: string;
  original: string;
};

type PeakResult = {
  rank: number;
  appId: number;
  name: string | null;
  allTimePeak: number | null;
  peakAt: string | null;
  archiveTimestamp: string | null;
  archivedUrl: string | null;
  sourceUrl: string;
  status: "ok" | "no_capture" | "parse_failed" | "request_failed";
  error?: string;
};

const { values } = parseArgs({
  options: {
    limit: { type: "string", default: "50" },
    concurrency: { type: "string", default: "2" },
    "wayback-delay-ms": { type: "string", default: "2000" },
    output: { type: "string", default: "steamdb-peak-ccu-sample-50.json" },
  },
});

const limit = parsePositiveInteger(values.limit, "limit");
const concurrency = parsePositiveInteger(values.concurrency, "concurrency");
const waybackDelayMs = parsePositiveInteger(values["wayback-delay-ms"], "wayback-delay-ms");
const outputPath = resolve(values.output);
const checkpointPath = `${outputPath}.jsonl`;
const csvPath = outputPath.replace(/\.json$/i, "") + ".csv";

function parsePositiveInteger(value: string | undefined, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive integer`);
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

async function fetchWithRetry(url: string, attempts = 5): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await waitForWaybackSlot(url);
      const response = await fetch(url, {
        headers: { Accept: "application/json,text/html;q=0.9,*/*;q=0.8", "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(45_000),
      });

      if (response.ok || (response.status < 500 && response.status !== 429)) return response;

      lastError = new Error(`HTTP ${response.status}`);
      const retryAfter = Number(response.headers.get("retry-after"));
      const delay = Number.isFinite(retryAfter)
        ? retryAfter * 1_000
        : Math.min(30_000, 1_500 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 500);
      await sleep(delay);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(Math.min(30_000, 1_500 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 500));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function getTopGames(count: number): Promise<SteamRank[]> {
  const response = await fetchWithRetry(STEAM_CHARTS_URL);
  if (!response.ok) throw new Error(`Steam charts returned HTTP ${response.status}`);

  const payload = (await response.json()) as { response?: { ranks?: SteamRank[] } };
  const ranks = payload.response?.ranks ?? [];
  if (ranks.length < count) throw new Error(`Steam charts returned only ${ranks.length} games`);
  return ranks.slice(0, count);
}

async function getLatestCapture(appId: number): Promise<Capture | null> {
  const sourceUrl = `https://steamdb.info/app/${appId}/charts/`;
  const query = new URLSearchParams({ url: sourceUrl });
  const response = await fetchWithRetry(`${WAYBACK_TIMEMAP_URL}?${query}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Wayback timemap returned HTTP ${response.status}`);

  const rows = (await response.json()) as string[][];
  const header = rows[0] ?? [];
  const timestampIndex = header.indexOf("timestamp");
  const originalIndex = header.indexOf("original");
  const mimeIndex = header.indexOf("mimetype");
  const statusIndex = header.indexOf("statuscode");

  if (timestampIndex < 0 || originalIndex < 0 || statusIndex < 0) {
    throw new Error("Wayback timemap returned an unexpected schema");
  }

  const captures = rows
    .slice(1)
    .filter((row) => row[statusIndex] === "200")
    .filter((row) => mimeIndex < 0 || row[mimeIndex] === "text/html")
    .map((row) => ({ timestamp: row[timestampIndex], original: row[originalIndex] }))
    .filter((capture) => /^https?:\/\/steamdb\.info\/app\/\d+\/charts\/?$/i.test(capture.original))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return captures.at(-1) ?? null;
}

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePeak(html: string): {
  name: string | null;
  peak: number | null;
  peakAt: string | null;
} {
  const heading = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const name = heading ? decodeHtml(heading) : null;

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
  return {
    name,
    peak: listMatch ? Number(listMatch[1].replaceAll(",", "")) : null,
    peakAt: listMatch?.[2] ?? null,
  };
}

async function scrapeGame(game: SteamRank): Promise<PeakResult> {
  const sourceUrl = `https://steamdb.info/app/${game.appid}/charts/`;

  try {
    const capture = await getLatestCapture(game.appid);
    if (!capture) {
      return {
        rank: game.rank,
        appId: game.appid,
        name: null,
        allTimePeak: null,
        peakAt: null,
        archiveTimestamp: null,
        archivedUrl: null,
        sourceUrl,
        status: "no_capture",
      };
    }

    const archivedUrl = `https://web.archive.org/web/${capture.timestamp}id_/${capture.original}`;
    const response = await fetchWithRetry(archivedUrl);
    if (!response.ok) throw new Error(`Wayback replay returned HTTP ${response.status}`);

    const parsed = parsePeak(await response.text());
    return {
      rank: game.rank,
      appId: game.appid,
      name: parsed.name,
      allTimePeak: parsed.peak,
      peakAt: parsed.peakAt,
      archiveTimestamp: capture.timestamp,
      archivedUrl,
      sourceUrl,
      status: parsed.peak === null ? "parse_failed" : "ok",
    };
  } catch (error) {
    return {
      rank: game.rank,
      appId: game.appid,
      name: null,
      allTimePeak: null,
      peakAt: null,
      archiveTimestamp: null,
      archivedUrl: null,
      sourceUrl,
      status: "request_failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function readCheckpoint(): Promise<Map<number, PeakResult>> {
  try {
    const contents = await readFile(checkpointPath, "utf8");
    const results = contents
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as PeakResult);
    return new Map(results.map((result) => [result.appId, result]));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Map();
    throw error;
  }
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  return /[",\r\n]/.test(stringValue) ? `"${stringValue.replaceAll('"', '""')}"` : stringValue;
}

async function writeOutputs(results: PeakResult[]): Promise<void> {
  const document = {
    generatedAt: new Date().toISOString(),
    selection: `Current Steam top ${limit} from ISteamChartsService/GetMostPlayedGames`,
    total: results.length,
    parsed: results.filter((result) => result.status === "ok").length,
    results,
  };

  const temporaryPath = `${outputPath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  await rename(temporaryPath, outputPath);

  const columns: (keyof PeakResult)[] = [
    "rank",
    "appId",
    "name",
    "allTimePeak",
    "peakAt",
    "archiveTimestamp",
    "status",
    "archivedUrl",
    "sourceUrl",
    "error",
  ];
  const lines = [
    columns.join(","),
    ...results.map((result) => columns.map((column) => csvCell(result[column])).join(",")),
  ];
  await writeFile(csvPath, `${lines.join("\n")}\n`, "utf8");
}

async function main(): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  const games = await getTopGames(limit);
  const checkpoint = await readCheckpoint();
  const completed = new Map(
    [...checkpoint].filter(([, result]) => result.status !== "request_failed"),
  );
  const pending = games.filter((game) => !completed.has(game.appid));

  console.log(`Selected ${games.length} games; ${completed.size} already checkpointed.`);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < pending.length) {
      const game = pending[cursor];
      cursor += 1;
      const result = await scrapeGame(game);
      completed.set(result.appId, result);
      await appendFile(checkpointPath, `${JSON.stringify(result)}\n`, "utf8");
      console.log(
        `[${completed.size}/${games.length}] #${result.rank} app ${result.appId}: ${result.status}` +
          (result.allTimePeak === null
            ? ""
            : ` peak=${result.allTimePeak.toLocaleString("en-US")}`),
      );
      await sleep(300 + Math.floor(Math.random() * 300));
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const ordered = games.map((game) => completed.get(game.appid)).filter(Boolean) as PeakResult[];
  await writeOutputs(ordered);

  const parsed = ordered.filter((result) => result.status === "ok").length;
  console.log(`Finished: ${parsed}/${ordered.length} peaks parsed.`);
  console.log(`JSON: ${outputPath}`);
  console.log(`CSV:  ${csvPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
