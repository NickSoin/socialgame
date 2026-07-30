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

function validIsoDate(year: number, month: number, day: number) {
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

export function normalizeSteamReleaseDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

  const iso = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return validIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const monthFirst = normalized.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (monthFirst) {
    const month = monthNumber(monthFirst[1]!);
    return month === null
      ? null
      : validIsoDate(Number(monthFirst[3]), month, Number(monthFirst[2]));
  }

  const dayFirst = normalized.match(/^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})$/);
  if (dayFirst) {
    const month = monthNumber(dayFirst[2]!);
    return month === null
      ? null
      : validIsoDate(Number(dayFirst[3]), month, Number(dayFirst[1]));
  }

  return null;
}

export function formatSteamReleaseLabel(isoDate: string | null) {
  if (!isoDate) return "TBA";
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf())) return "TBA";

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}
