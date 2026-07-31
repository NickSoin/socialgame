const MAX_TAGS = 5;
const MAX_TAG_LENGTH = 40;

export function normalizeSteamGenres(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const tags = new Set<string>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const description = "description" in entry ? entry.description : null;
    if (typeof description !== "string") continue;

    const tag = description.replace(/\s+/g, " ").trim();
    if (!tag || tag.length > MAX_TAG_LENGTH) continue;
    tags.add(tag);
    if (tags.size >= MAX_TAGS) break;
  }

  return [...tags];
}
