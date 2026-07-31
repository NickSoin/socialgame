const MAX_TAGS = 5;
const MAX_TAG_LENGTH = 40;

export type SteamStoreTagExtraction = {
  tags: string[];
  outcome: "tags" | "no_tags" | "age_gate";
};

function decodeHtmlEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code[0] !== "#") return named[code.toLowerCase()] ?? entity;
    const numeric = code[1]?.toLowerCase() === "x"
      ? Number.parseInt(code.slice(2), 16)
      : Number.parseInt(code.slice(1), 10);
    return Number.isFinite(numeric) && numeric > 0 && numeric <= 0x10ffff
      ? String.fromCodePoint(numeric)
      : entity;
  });
}

function cleanTag(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = decodeHtmlEntities(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned && cleaned.length <= MAX_TAG_LENGTH ? cleaned : null;
}

function uniqueTags(values: Iterable<unknown>) {
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const tag = cleanTag(value);
    const key = tag?.toLocaleLowerCase("en-US");
    if (!tag || !key || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length >= MAX_TAGS) break;
  }
  return tags;
}

export function normalizeSteamGenres(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return uniqueTags(value.map((entry) => (
    entry && typeof entry === "object" && "description" in entry ? entry.description : null
  )));
}

function hasClass(attributes: string, className: string) {
  const match = attributes.match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  const classes = (match?.[1] ?? match?.[2] ?? match?.[3] ?? "").split(/\s+/);
  return classes.includes(className);
}

export function extractSteamStoreTags(html: string): SteamStoreTagExtraction {
  if (/\bid\s*=\s*["']agecheck_form["']|\bclass\s*=\s*["'][^"']*agegate_/i.test(html)) {
    return { tags: [], outcome: "age_gate" };
  }

  const rawTags: string[] = [];
  let cursor = 0;
  while (cursor < html.length && rawTags.length < MAX_TAGS * 3) {
    const start = html.indexOf("<", cursor);
    if (start < 0) break;
    const end = html.indexOf(">", start + 1);
    if (end < 0) break;
    const opening = html.slice(start + 1, end);
    const name = opening.match(/^\s*([a-z0-9]+)/i)?.[1]?.toLowerCase();
    cursor = end + 1;
    if (name !== "a" || !hasClass(opening, "app_tag") || hasClass(opening, "add_button")) continue;

    const closing = html.toLowerCase().indexOf("</a", cursor);
    if (closing < 0) break;
    rawTags.push(html.slice(cursor, closing));
    cursor = html.indexOf(">", closing + 3) + 1;
    if (cursor <= 0) break;
  }

  const tags = uniqueTags(rawTags);
  return { tags, outcome: tags.length ? "tags" : "no_tags" };
}
