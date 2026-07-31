export const STEAM_CATALOG_RELEASE_CUTOFF = "2026-07-30";

export type SteamCatalogExclusionReason = "released_before_cutoff" | "non_game";

type CatalogEligibilityDetails = {
  appType: string;
  released: boolean;
  releaseDate: string | null;
  releaseText: string | null;
  releasePrecision: "exact" | "month" | "quarter" | "year" | "tba";
};

const MONTHS = new Map([
  ["jan", 1], ["feb", 2], ["mar", 3], ["apr", 4], ["may", 5], ["jun", 6],
  ["jul", 7], ["aug", 8], ["sep", 9], ["oct", 10], ["nov", 11], ["dec", 12],
]);

export function normalizeSteamAppType(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
  return /^[a-z0-9_]{1,40}$/.test(normalized) ? normalized : null;
}

export function getSteamCatalogExclusionReason(
  details: CatalogEligibilityDetails,
  cutoff = STEAM_CATALOG_RELEASE_CUTOFF,
): SteamCatalogExclusionReason | null {
  if (details.appType !== "game") return "non_game";
  if (!details.released) return null;
  if (details.releaseDate) {
    return details.releaseDate < cutoff ? "released_before_cutoff" : null;
  }

  const upperBound = releasePeriodUpperBound(details.releaseText, details.releasePrecision);
  return upperBound && upperBound < cutoff ? "released_before_cutoff" : null;
}

function releasePeriodUpperBound(
  releaseText: string | null,
  precision: CatalogEligibilityDetails["releasePrecision"],
) {
  if (!releaseText || precision === "exact" || precision === "tba") return null;
  const year = Number(releaseText.match(/\b(\d{4})\b/)?.[1]);
  if (!Number.isInteger(year)) return null;

  if (precision === "year") return `${year}-12-31`;
  if (precision === "quarter") {
    const quarter = Number(releaseText.match(/\bQ([1-4])\b/i)?.[1]);
    if (!Number.isInteger(quarter)) return null;
    const month = quarter * 3;
    return `${year}-${String(month).padStart(2, "0")}-${daysInMonth(year, month)}`;
  }
  if (precision === "month") {
    const monthName = releaseText.match(/[A-Za-z]+/)?.[0] ?? "";
    const month = MONTHS.get(monthName.slice(0, 3).toLowerCase());
    if (!month) return null;
    return `${year}-${String(month).padStart(2, "0")}-${daysInMonth(year, month)}`;
  }
  return null;
}

function daysInMonth(year: number, month: number) {
  return String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0");
}
