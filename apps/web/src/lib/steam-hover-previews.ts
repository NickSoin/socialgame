export type SteamHoverPreviewRecord = {
  active: boolean;
  kind: string;
  position: number;
  storage_bucket: string;
  storage_path: string;
};

export function getSteamHoverPreviewUrl(record: SteamHoverPreviewRecord) {
  if (!record.active || record.kind !== "screenshot" || ![1, 2].includes(record.position)) return null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;
  try {
    const path = record.storage_path.split("/").map(encodeURIComponent).join("/");
    return new URL(
      `/storage/v1/object/public/${encodeURIComponent(record.storage_bucket)}/${path}`,
      supabaseUrl,
    ).toString();
  } catch {
    return null;
  }
}

export function getSteamHoverPreviews(records: readonly SteamHoverPreviewRecord[] | null | undefined) {
  return (records ?? [])
    .slice()
    .sort((left, right) => left.position - right.position)
    .flatMap((record) => {
      const url = getSteamHoverPreviewUrl(record);
      return url ? [url] : [];
    })
    .slice(0, 2);
}
