import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { StagingMarketApp } from '@/components/staging/staging-market-app';
import { requireStagingPagePrincipal, StagingAccessError } from '@/lib/staging/access';
import { getStagingWorkspaceData } from '@/lib/staging/market-workspace-service';

export default function GameMasterPage() {
  return <Suspense fallback={<WorkspaceLoading />}><GameMasterContent /></Suspense>;
}

async function GameMasterContent() {
  let principal;
  try {
    principal = await requireStagingPagePrincipal('game-master');
  } catch (error) {
    if (error instanceof StagingAccessError && error.status === 401) {
      redirect('/login?next=/internal/game-master');
    }
    if (error instanceof StagingAccessError && error.status === 404) notFound();
    return <AccessDenied message={error instanceof Error ? error.message : 'Access denied.'} />;
  }
  const data = await getStagingWorkspaceData(principal);
  return <StagingMarketApp initialData={data} />;
}

function WorkspaceLoading() {
  return (
    <main className="gm-access-denied" aria-busy="true">
      <h1>Loading NextHit Market staging...</h1>
      <p>Checking access and loading the isolated gameplay workspace.</p>
    </main>
  );
}

function AccessDenied({ message }: { message: string }) {
  return (
    <main className="gm-access-denied">
      <h1>Access denied</h1>
      <p>{message}</p>
      <a href="/">Return to NextHit Market</a>
    </main>
  );
}
