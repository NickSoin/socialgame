import { Suspense } from "react";
import { SteamFeedPage } from "@/components/steambets/steam-feed-page";

export default function LockedPage(props: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  return (
    <Suspense fallback={<div className="sb-shell sb-page sb-muted">Loading gamesâ€¦</div>}>
      <SteamFeedPage mode="locked" {...props} />
    </Suspense>
  );
}
