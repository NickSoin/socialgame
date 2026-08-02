'use client';

import { FormEvent, useState, useTransition } from 'react';
import { ArrowLeft, Search, ShieldCheck, UserMinus, UserPlus } from 'lucide-react';

type AdminData = {
  users: Array<{
    id: string;
    email: string;
    username: string | null;
    displayName: string | null;
    role: 'user' | 'game_designer' | 'root';
    roleSource: 'default' | 'root assignment' | 'pending assignment' | 'root environment';
    lastRoleChangeAt: string | null;
    verified: boolean;
    createdAt: string;
    lastSignInAt: string | null;
  }>;
  pending: Array<{ id: string; email: string; role: string; status: string; requested_at: string; claimed_at: string | null; revoked_at: string | null }>;
  audit: Array<{ id: number; actor_email: string | null; action: string; target_email: string | null; previous_role: string | null; new_role: string | null; metadata: unknown; created_at: string }>;
  query: string;
};

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value));
}

export function RoleAdminConsole({ initialData, principal }: { initialData: AdminData; principal: { email: string } }) {
  const [data, setData] = useState(initialData);
  const [query, setQuery] = useState(initialData.query);
  const [grantEmail, setGrantEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function refresh(search = query) {
    const response = await fetch(`/api/internal/role-admin?q=${encodeURIComponent(search)}`, { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? 'Could not load roles.');
    setData(payload);
  }

  function mutate(payload: Record<string, unknown>, success: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const response = await fetch('/api/internal/role-admin', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? 'Role change failed.');
        await refresh();
        setNotice(success);
        if (payload.action === 'grant') setGrantEmail('');
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Role change failed.');
      }
    });
  }

  function search(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try { await refresh(query); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Search failed.'); }
    });
  }

  return <div className="ra-app">
    <header className="ra-topbar"><div><span>NH</span><strong>NextHit Staging Role Admin</strong><b>ROOT ONLY</b></div><div><a href="/internal/game-master"><ArrowLeft size={14} />Game Master</a><span>{principal.email}</span></div></header>
    <main className="ra-main">
      <div className="ra-heading"><div><h1>User role administration</h1><p>Roles are rechecked from staging DB on every privileged request. Root remains environment-derived.</p></div><ShieldCheck size={32} /></div>
      {error ? <div className="gm-message gm-message--error" role="alert">{error}</div> : null}
      {notice ? <div className="gm-message gm-message--success" role="status">{notice}</div> : null}

      <section className="ra-panel">
        <div className="ra-panel-heading"><div><h2>Users</h2><p>Search verified staging accounts by email, username or public name.</p></div><form onSubmit={search}><Search size={15} /><input aria-label="Search users" placeholder="Search users…" value={query} onChange={(event) => setQuery(event.target.value)} /><button disabled={isPending} type="submit">Search</button></form></div>
        <div className="ra-users-table"><div className="gm-table-head"><span>User</span><span>Email</span><span>Role / source</span><span>Status</span><span>Last role change</span><span>Actions</span></div>{data.users.map((user) => <div className="gm-table-row" key={user.id}><span><strong>{user.displayName ?? 'No public name'}</strong><small>@{user.username ?? 'not-set'}</small></span><span>{user.email}</span><span><b className={`ra-role ra-role--${user.role}`}>{user.role}</b><small>{user.roleSource}</small></span><span>{user.verified ? 'Verified' : 'Unverified'}</span><span>{formatDate(user.lastRoleChangeAt)}</span><span>{user.role === 'root' ? <small>Environment controlled</small> : user.role === 'game_designer' ? <button className="ra-revoke" disabled={isPending} type="button" onClick={() => window.confirm(`Revoke game_designer access from ${user.email}?\nThe user will lose access to the Game Master Console.`) && mutate({ action: 'revoke', userId: user.id }, 'Role revoked immediately.')}><UserMinus size={14} />Revoke</button> : <button disabled={isPending || !user.verified} type="button" onClick={() => window.confirm(`Grant game_designer access to ${user.email}?\nThis gives access to the staging Game Master Console and simulation data.`) && mutate({ action: 'grant', email: user.email }, 'Role granted immediately.')}><UserPlus size={14} />Grant</button>}</span></div>)}</div>
      </section>

      <div className="ra-grid">
        <section className="ra-panel">
          <div className="ra-panel-heading"><div><h2>Grant by email</h2><p>If the account does not exist yet, a pending assignment is created.</p></div></div>
          <form className="ra-grant-form" onSubmit={(event) => { event.preventDefault(); if (window.confirm(`Grant game_designer access to ${grantEmail}?\nIf this email is not registered, a pending assignment will be created.`)) mutate({ action: 'grant', email: grantEmail }, 'Role or pending assignment created.'); }}><input required type="email" placeholder="designer@example.com" value={grantEmail} onChange={(event) => setGrantEmail(event.target.value)} /><button disabled={isPending} type="submit"><UserPlus size={15} />Grant Game Designer</button></form>
          <div className="ra-pending"><h3>Pending assignments</h3>{data.pending.filter((item) => item.status === 'pending').length ? data.pending.filter((item) => item.status === 'pending').map((item) => <article key={item.id}><div><strong>{item.email}</strong><small>Requested {formatDate(item.requested_at)}</small></div><span>{item.role}</span><button className="ra-revoke" disabled={isPending} type="button" onClick={() => window.confirm(`Cancel the pending game_designer assignment for ${item.email}?`) && mutate({ action: 'revoke_pending', assignmentId: item.id }, 'Pending assignment revoked.')}><UserMinus size={14} />Cancel</button></article>) : <p>No pending assignments.</p>}</div>
        </section>

        <section className="ra-panel">
          <div className="ra-panel-heading"><div><h2>Immutable audit log</h2><p>Successful changes and denied access attempts.</p></div></div>
          <div className="ra-audit">{data.audit.map((entry) => <article key={entry.id}><time>{formatDate(entry.created_at)}</time><strong>{entry.action}</strong><span>{entry.actor_email ?? 'system'} → {entry.target_email ?? '—'}</span><small>{entry.previous_role ?? '—'} → {entry.new_role ?? '—'}</small></article>)}</div>
        </section>
      </div>
    </main>
  </div>;
}
