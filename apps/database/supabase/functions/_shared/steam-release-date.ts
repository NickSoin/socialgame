export type SteamReleasePrecision = "exact" | "month" | "quarter" | "year" | "tba";

export type SteamReleaseMetadata = {
  exactDate: string | null;
  label: string;
  precision: SteamReleasePrecision;
  rawText: string | null;
  invalid: boolean;
};

const MONTHS = new Map([
  ["jan", 1],
  ["feb", 2],
  ["mar", 3],
  ["apr", 4],
  ["may", 5],
  ["jun", 6],
  ["jul", 7],
  ["aug", 8],
  ["sep", 9],
  ["oct", 10],
  ["nov", 11],
  ["dec", 12],
]);

const VAGUE_RELEASE_TEXT = new Set([
  "coming soon",
  "to be announced",
  "tba",
  "tbd",
  "date to be announced",
  "not announced",
]);

function decodeTextEntities(value: string) {
  return value
    .replace(/&nbsp;|&#160;|&#xa0;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function cleanReleaseText(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = decodeTextEntities(value)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? cleaned.slice(0, 120) : null;
}

function validIsoDate(year: number, month: number, day: number) {
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const normalized = `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  const date = new Date(`${normalized}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(normalized)
    ? normalized
    : null;
}

function monthNumber(value: string) {
  return MONTHS.get(value.slice(0, 3).toLowerCase()) ?? null;
}

function exactLabel(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function normalizeSteamReleaseMetadata(value: unknown): SteamReleaseMetadata {
  const rawText = cleanReleaseText(value);
  if (!rawText || VAGUE_RELEASE_TEXT.has(rawText.toLowerCase().replace(/[.!]+$/, ""))) {
    return { exactDate: null, label: "TBA", precision: "tba", rawText, invalid: false };
  }

  const iso = rawText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const exactDate = validIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    return exactDate
      ? { exactDate, label: exactLabel(exactDate), precision: "exact", rawText, invalid: false }
      : { exactDate: null, label: "TBA", precision: "tba", rawText, invalid: true };
  }

  const monthFirst = rawText.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  const dayFirst = rawText.match(/^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})$/);
  if (monthFirst || dayFirst) {
    const month = monthNumber(monthFirst?.[1] ?? dayFirst?.[2] ?? "");
    const year = Number(monthFirst?.[3] ?? dayFirst?.[3]);
    const day = Number(monthFirst?.[2] ?? dayFirst?.[1]);
    const exactDate = month === null ? null : validIsoDate(year, month, day);
    return exactDate
      ? { exactDate, label: exactLabel(exactDate), precision: "exact", rawText, invalid: false }
      : { exactDate: null, label: "TBA", precision: "tba", rawText, invalid: true };
  }

  const monthOnly = rawText.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthOnly && monthNumber(monthOnly[1]!) !== null) {
    return { exactDate: null, label: rawText, precision: "month", rawText, invalid: false };
  }

  const quarter = rawText.match(/^Q([1-4])\s+(\d{4})$/i);
  if (quarter) {
    const label = `Q${quarter[1]} ${quarter[2]}`;
    return { exactDate: null, label, precision: "quarter", rawText, invalid: false };
  }

  if (/^\d{4}$/.test(rawText)) {
    return { exactDate: null, label: rawText, precision: "year", rawText, invalid: false };
  }

  if (/^[A-Za-z][A-Za-z .'-]{0,40}\s+\d{4}$/.test(rawText)) {
    return { exactDate: null, label: rawText, precision: "year", rawText, invalid: false };
  }

  return { exactDate: null, label: "TBA", precision: "tba", rawText, invalid: true };
}

export function normalizeSteamReleaseDate(value: unknown): string | null {
  return normalizeSteamReleaseMetadata(value).exactDate;
}

export function hasReachedSteamReleaseDate(
  exactDate: string | null,
  asOfDate = new Date().toISOString().slice(0, 10),
) {
  return exactDate === null || exactDate <= asOfDate;
}

export function isSteamReleaseConfirmed(
  comingSoon: boolean | null,
  exactDate: string | null,
  asOfDate = new Date().toISOString().slice(0, 10),
) {
  return comingSoon === false && hasReachedSteamReleaseDate(exactDate, asOfDate);
}

export function formatSteamReleaseLabel(isoDate: string | null) {
  return isoDate ? exactLabel(isoDate) : "TBA";
}
