import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { RoleAdminConsole } from '@/components/staging/role-admin-console';
import { requireStagingPagePrincipal, StagingAccessError } from '@/lib/staging/access';
import { getRoleAdminData } from '@/lib/staging/role-admin-service';

export default function StagingAdminPage() {
  return <Suspense fallback={<AdminLoading />}><StagingAdminContent /></Suspense>;
}

async function StagingAdminContent() {
  let principal;
  try {
    principal = await requireStagingPagePrincipal('role-admin');
  } catch (error) {
    if (error instanceof StagingAccessError && error.status === 401) redirect('/login?next=/internal/staging-admin');
    if (error instanceof StagingAccessError && error.status === 404) notFound();
    return <main className="gm-access-denied"><h1>Access denied</h1><p>{error instanceof Error ? error.message : 'Root access required.'}</p><a href="/">Return to NextHit Market</a></main>;
  }
  const data = await getRoleAdminData();
  return <RoleAdminConsole initialData={data} principal={principal} />;
}

function AdminLoading() {
  return <main className="gm-access-denied" aria-busy="true"><h1>Loading Role Admin…</h1><p>Checking root access against the staging environment.</p></main>;
}
