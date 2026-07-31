'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import {
  Archive, BookmarkCheck, Bot, Clock3, Copy, Download, FastForward,
  FileClock, Gauge, LockKeyhole, Pause, Play, Plus, Radio, RotateCcw, ShieldCheck,
  SlidersHorizontal, Trophy, Upload, Users,
} from 'lucide-react';

type Tab = 'simulations' | 'presets' | 'players' | 'markets' | 'leaderboard' | 'events';
type ConsoleData = {
  presets: ReadonlyArray<{ key: string; name: string; description: string; players: number }>;
  simulations: Array<{ id: string; name: string; status: string; simulation_time: string; preset_key: string | null; random_seed: number; updated_at: string }>;
  selected: null | {
    simulation: { id: string; name: string; description: string; status: string; simulation_time: string; preset_key: string | null; random_seed: number };
    games: Array<{ id: string; name: string; release_at: string | null; scenario_values: Record<string, number> }>;
    markets: Array<{ id: string; game_id: string; metric_type: string; status: string; lock_at: string | null; resolve_after: string | null; void_reason?: string | null }>;
    players: Array<{ id: string; username: string; display_name: string; behavior: string; skill: number }>;
    forecasts: Array<{ id: string; market_id: string; player_id: string; raw_value: number; valid_from: string; valid_to: string | null; source: string }>;
    snapshots: Array<{ id: string; market_id: string; snapshot_at: string; eligible_prediction_count: number; crowd_percentile: number | null }>;
    snapshotStats: Array<{ id: string; market_id: string; snapshot_at: string; eligible_prediction_count: number; mean: number | null; median: number | null; minimum: number | null; maximum: number | null; standardDeviation: number | null; status: string }>;
    results: Array<{ id: string; market_id: string; actual_raw_value: number; result_version: number }>;
    events: Array<{ id: number; event_type: string; event_at: string; created_at: string; payload: Record<string, unknown>; market_id: string | null; player_id: string | null }>;
    checkpoints: Array<{ id: string; name: string; simulation_time: string; created_at: string }>;
    leaderboard: Array<{ rank: number; playerId: string; username: string; displayName: string; points: number; scoredDays: number; resolvedMarkets: number; averagePoints: number; positiveMarkets: number; negativeMarkets: number }>;
    leaderboardByMetric: Record<string, Array<{ rank: number; playerId: string; username: string; displayName: string; points: number; scoredDays: number; resolvedMarkets: number; averagePoints: number; positiveMarkets: number; negativeMarkets: number }>>;
    marketStats: Record<string, { participantCount: number; currentForecast: number | null; snapshotCount: number; actualResult: number | null; scoringStatus: string }>;
    formulaComparison: Array<{ formulaKey: string; label: string; leaderboard: Array<{ rank: number; playerId: string; username: string; displayName: string; points: number }> }>;
    scoreInspector: Array<{ id: string; player: string; game: string; metric: string; user_percentile: number; crowd_without_user_percentile: number; actual_percentile: number; user_error: number; crowd_error: number; points: number }>;
    nextScheduledAt: string | null;
  };
};

const navItems: Array<{ id: Tab; label: string; icon: typeof Gauge }> = [
  { id: 'simulations', label: 'Simulations', icon: Gauge },
  { id: 'presets', label: 'Presets', icon: SlidersHorizontal },
  { id: 'players', label: 'Players', icon: Users },
  { id: 'markets', label: 'Markets', icon: FileClock },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { id: 'events', label: 'Event Log', icon: Clock3 },
];

const metricLabels: Record<string, string> = {
  first_weekend_ccu: 'First weekend peak CCU',
  first_month_reviews: 'First month total reviews',
  full_price_us: 'Full price in US',
};

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium', timeStyle: 'medium', timeZone: 'UTC',
  }).format(new Date(value));
}

function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);
}

function Status({ value }: { value: string }) {
  return <span className={`gm-status gm-status--${value}`}>{value}</span>;
}

export function GameMasterConsole({
  initialData,
  principal,
}: {
  initialData: ConsoleData;
  principal: { email: string; role: string; isRoot: boolean };
}) {
  const [data, setData] = useState(initialData);
  const [tab, setTab] = useState<Tab>('simulations');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [impersonated, setImpersonated] = useState<{ id: string; username: string } | null>(null);
  const [marketValues, setMarketValues] = useState<Record<string, string>>({});
  const importInput = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const selected = data.selected;
  const simulationId = selected?.simulation.id;
  const gameById = useMemo(() => new Map(selected?.games.map((game) => [game.id, game]) ?? []), [selected?.games]);

  async function refresh(id = simulationId) {
    const params = id ? `?simulationId=${encodeURIComponent(id)}` : '';
    const response = await fetch(`/api/internal/game-master${params}`, { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? 'Could not refresh console.');
    setData(payload);
  }

  function command(payload: Record<string, unknown>, success: string, nextId?: (result: Record<string, unknown>) => string | undefined) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const response = await fetch('/api/internal/game-master', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? 'Command failed.');
        const targetId = nextId?.(body.result as Record<string, unknown>) ?? simulationId;
        await refresh(targetId);
        setNotice(success);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Command failed.');
      }
    });
  }

  function createSimulation(presetKey: string, defaultName: string) {
    const name = window.prompt('Simulation name', defaultName);
    if (!name) return;
    const seedInput = window.prompt('Deterministic random seed', String(Date.now() % 2_147_483_647));
    const seed = Number(seedInput);
    command({ action: 'create', name, presetKey, seed: Number.isSafeInteger(seed) && seed > 0 ? seed : undefined }, 'Simulation created.', (result) => String(result.id ?? ''));
  }

  function createBlankSimulation() {
    const name = window.prompt('Blank simulation name', 'Untitled simulation');
    if (!name) return;
    const description = window.prompt('Description', 'Designer-controlled gameplay simulation') ?? undefined;
    const startAt = window.prompt('Starting time (ISO 8601, blank = current hour)', '') || undefined;
    const seedInput = window.prompt('Deterministic random seed', String(Date.now() % 2_147_483_647));
    const seed = Number(seedInput);
    command({ action: 'create_blank', name, description, startAt, seed: Number.isSafeInteger(seed) && seed > 0 ? seed : undefined }, 'Blank simulation created.', (result) => String(result.id ?? ''));
  }

  async function importExport(file: File) {
    try {
      const payload = JSON.parse(await file.text()) as unknown;
      command({ action: 'import', payload }, 'Simulation imported.', (result) => String(result.id ?? ''));
    } catch {
      setError('The selected file is not valid NextHit simulation JSON.');
    } finally {
      if (importInput.current) importInput.current.value = '';
    }
  }

  const totals = selected ? {
    markets: selected.markets.length,
    players: selected.players.length,
    forecasts: selected.forecasts.length,
    snapshots: selected.snapshots.length,
    points: selected.leaderboard.reduce((sum, row) => sum + row.points, 0),
  } : null;

  return (
    <div className="gm-app">
      {impersonated ? (
        <div className="gm-impersonation-banner">
          Simulation mode · Impersonating <strong>{impersonated.username}</strong> · {selected?.simulation.name ?? 'simulation'} · {selected ? formatDate(selected.simulation.simulation_time) : '—'}
          <button type="button" onClick={() => simulationId && command({ action: 'end_impersonate', simulationId, playerId: impersonated.id }, 'Player preview ended.', () => { setImpersonated(null); return simulationId; })}>Exit impersonation</button>
        </div>
      ) : null}
      <header className="gm-topbar">
        <div className="gm-brand"><span>NH</span><strong>NextHit Game Master Console</strong><b>STAGING</b></div>
        <div className="gm-clock">
          <small>Simulated Time (UTC)</small>
          <strong>{selected ? formatDate(selected.simulation.simulation_time) : 'No simulation selected'}</strong>
        </div>
        <div className="gm-run-controls">
          <button disabled={!simulationId || isPending} type="button" onClick={() => simulationId && command({ action: 'run', simulationId }, 'Simulation running.')}><Play size={14} />Run</button>
          <button disabled={!simulationId || isPending} type="button" onClick={() => simulationId && command({ action: 'pause', simulationId }, 'Simulation paused.')}><Pause size={14} />Pause</button>
        </div>
        <div className="gm-user"><span>{principal.email.slice(0, 2).toUpperCase()}</span><div><strong>{principal.email}</strong><small>{principal.role}</small></div></div>
      </header>

      <aside className="gm-sidebar">
        <nav aria-label="Game Master sections">
          {navItems.map((item) => {
            const Icon = item.icon;
            return <button className={tab === item.id ? 'is-active' : undefined} key={item.id} type="button" onClick={() => setTab(item.id)}><Icon size={17} />{item.label}</button>;
          })}
        </nav>
        {principal.isRoot ? <a className="gm-role-link" href="/internal/staging-admin"><ShieldCheck size={17} />Role Admin</a> : null}
      </aside>

      <main className="gm-main">
        {error ? <div className="gm-message gm-message--error" role="alert">{error}</div> : null}
        {notice ? <div className="gm-message gm-message--success" role="status">{notice}</div> : null}
        {!selected ? (
          <section className="gm-empty">
            <Gauge size={30} />
            <h1>Create your first simulation</h1>
            <p>Start from a deterministic preset. All data stays inside the staging database.</p>
            <div className="gm-empty-actions"><button type="button" onClick={() => createSimulation(data.presets[0].key, data.presets[0].name)}><Plus size={16} />From preset</button><button type="button" onClick={createBlankSimulation}><Plus size={16} />Blank simulation</button></div>
          </section>
        ) : (
          <>
            <div className="gm-heading-row">
              <div>
                <div className="gm-breadcrumbs">Simulations / {selected.simulation.name}</div>
                <label className="gm-simulation-picker"><span>Active simulation</span><select aria-label="Select simulation" value={selected.simulation.id} onChange={(event) => { startTransition(async () => { try { await refresh(event.target.value); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not switch simulation.'); } }); }}>{data.simulations.map((simulation) => <option key={simulation.id} value={simulation.id}>{simulation.name} · {simulation.status}</option>)}</select></label>
                <h1>{selected.simulation.name} <Status value={selected.simulation.status} /></h1>
                <p>{selected.simulation.description} · Seed {selected.simulation.random_seed}</p>
              </div>
              <div className="gm-toolbar">
                <button disabled={isPending} type="button" onClick={createBlankSimulation}><Plus size={14} />Blank</button>
                <button disabled={isPending} type="button" onClick={() => command({ action: 'advance', simulationId, seconds: 3_600 }, 'Advanced one hour.')}>+1 hour</button>
                <button disabled={isPending} type="button" onClick={() => command({ action: 'advance', simulationId, seconds: 86_400 }, 'Advanced one day.')}>+1 day</button>
                <button disabled={isPending} type="button" onClick={() => command({ action: 'advance', simulationId, seconds: 604_800 }, 'Advanced one week.')}>+7 days</button>
                <button disabled={isPending} type="button" onClick={() => command({ action: 'next_event', simulationId }, 'Advanced to next event.')}><FastForward size={14} />Next event</button>
                <button disabled={isPending} type="button" onClick={() => command({ action: 'checkpoint', simulationId }, 'Checkpoint saved.')}><BookmarkCheck size={14} />Checkpoint</button>
                <button disabled={isPending} type="button" onClick={() => command({ action: 'clone', simulationId }, 'Simulation cloned.', (result) => String(result.id ?? simulationId))}><Copy size={14} />Clone</button>
                <button disabled={isPending} type="button" onClick={() => importInput.current?.click()}><Upload size={14} />Import</button>
                <input ref={importInput} hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importExport(file); }} />
                <a href={`/api/internal/game-master?simulationId=${simulationId}&export=json`}><Download size={14} />JSON</a>
                <a href={`/api/internal/game-master?simulationId=${simulationId}&export=forecasts_csv`}><Download size={14} />Forecasts</a>
                <a href={`/api/internal/game-master?simulationId=${simulationId}&export=snapshots_csv`}><Download size={14} />Snapshots</a>
                <a href={`/api/internal/game-master?simulationId=${simulationId}&export=scores_csv`}><Download size={14} />Scores</a>
              </div>
            </div>

            <div className="gm-kpis">
              <div><small>Simulated Time</small><strong>{formatDate(selected.simulation.simulation_time)}</strong></div>
              <div><small>Markets</small><strong>{totals?.markets}</strong></div>
              <div><small>Active players</small><strong>{totals?.players}</strong></div>
              <div><small>Forecast versions</small><strong>{totals?.forecasts}</strong></div>
              <div><small>Snapshots</small><strong>{totals?.snapshots}</strong></div>
              <div><small>Competition points</small><strong>{formatNumber(totals?.points ?? 0)}</strong></div>
            </div>

            {tab === 'simulations' ? <SimulationOverview data={selected} gameById={gameById} onCommand={command} isPending={isPending} marketValues={marketValues} setMarketValues={setMarketValues} /> : null}
            {tab === 'presets' ? (
              <section className="gm-section">
                <div className="gm-section-heading"><div><h2>Scenario presets</h2><p>Each run is deterministic for a fixed seed.</p></div></div>
                <div className="gm-preset-list">{data.presets.map((preset) => <article key={preset.key}><div><h3>{preset.name}</h3><p>{preset.description}</p><small>{preset.players} seeded players · {preset.key}</small></div><button type="button" onClick={() => createSimulation(preset.key, preset.name)}><Plus size={14} />Create</button></article>)}</div>
              </section>
            ) : null}
            {tab === 'players' ? (
              <section className="gm-section">
                <div className="gm-section-heading"><div><h2>Simulation players</h2><p>Safe synthetic profiles, never Supabase Auth users.</p></div></div>
                <PlayerControlForms data={selected} onCommand={command} isPending={isPending} />
                <div className="gm-table gm-table--players"><div className="gm-table-head"><span>Player</span><span>Behaviour</span><span>Skill</span><span>Forecasts</span><span>Actions</span></div>{selected.players.map((player) => <div className="gm-table-row" key={player.id}><span><strong>{player.display_name}</strong><small>@{player.username}</small></span><span>{player.behavior}</span><span>{Math.round(player.skill * 100)}%</span><span>{selected.forecasts.filter((forecast) => forecast.player_id === player.id).length}</span><span className="gm-player-actions"><button disabled={isPending} type="button" onClick={() => command({ action: 'impersonate', simulationId, playerId: player.id }, `Previewing ${player.username}.`, (result) => { setImpersonated({ id: String(result.playerId), username: String(result.username) }); return simulationId; })}>Preview</button><button disabled={isPending} type="button" onClick={() => window.confirm(`Reset forecasts for ${player.display_name}?`) && command({ action: 'reset_player', simulationId, playerId: player.id }, `${player.username} reset.`)}>Reset</button><button disabled={isPending} type="button" onClick={() => window.confirm(`Disable ${player.display_name}?`) && command({ action: 'disable_player', simulationId, playerId: player.id }, `${player.username} disabled.`)}>Disable</button></span></div>)}</div>
              </section>
            ) : null}
            {tab === 'markets' ? <MarketsPanel data={selected} gameById={gameById} onCommand={command} isPending={isPending} marketValues={marketValues} setMarketValues={setMarketValues} /> : null}
            {tab === 'leaderboard' ? <LeaderboardPanel data={selected} /> : null}
            {tab === 'events' ? <EventLog events={selected.events} markets={selected.markets} players={selected.players} gameById={gameById} /> : null}
          </>
        )}
      </main>
    </div>
  );
}

function PlayerControlForms({ data, onCommand, isPending }: {
  data: NonNullable<ConsoleData['selected']>;
  onCommand: (payload: Record<string, unknown>, success: string) => void;
  isPending: boolean;
}) {
  const [count, setCount] = useState('10');
  const [prefix, setPrefix] = useState('Player');
  const [behavior, setBehavior] = useState('mixed');
  const [skill, setSkill] = useState('mixed');
  const [playerId, setPlayerId] = useState(data.players[0]?.id ?? '');
  const [marketId, setMarketId] = useState(data.markets.find((market) => market.status === 'open')?.id ?? '');
  const [value, setValue] = useState('');
  const [forecastAt, setForecastAt] = useState('');
  const [distribution, setDistribution] = useState('around_actual');
  const [timing, setTiming] = useState('uniform');
  const [density, setDensity] = useState('0.8');
  const [centre, setCentre] = useState('');
  const openMarkets = data.markets.filter((market) => market.status === 'open');
  const gameMap = new Map(data.games.map((game) => [game.id, game]));
  const skillRange = skill === 'novice' ? [0.1, 0.4] : skill === 'expert' ? [0.75, 1] : skill === 'average' ? [0.4, 0.75] : [0.1, 1];
  return <div className="gm-control-forms">
    <form onSubmit={(event) => { event.preventDefault(); onCommand({ action: 'generate_players', simulationId: data.simulation.id, count: Number(count), prefix, behavior: behavior === 'mixed' ? undefined : behavior, skillMin: skillRange[0], skillMax: skillRange[1], avatarMode: 'generated-initials' }, `Generated ${count} players.`); }}>
      <strong>Seed players</strong><label>Count<input inputMode="numeric" min="1" max="500" type="number" value={count} onChange={(event) => setCount(event.target.value)} /></label><label>Display prefix<input maxLength={24} value={prefix} onChange={(event) => setPrefix(event.target.value)} /></label><label>Behaviour<select value={behavior} onChange={(event) => setBehavior(event.target.value)}><option value="mixed">Mixed</option><option value="follower">Market follower</option><option value="contrarian">Contrarian</option><option value="expert">Expert</option><option value="late">Late follower</option><option value="random">Random</option><option value="outlier">Outlier</option></select></label><label>Skill<select value={skill} onChange={(event) => setSkill(event.target.value)}><option value="mixed">Mixed</option><option value="novice">Novice</option><option value="average">Average</option><option value="expert">Expert</option></select></label><button disabled={isPending} type="submit"><Bot size={14} />Generate</button>
    </form>
    <form onSubmit={(event) => { event.preventDefault(); if (playerId && marketId && Number.isFinite(Number(value))) onCommand({ action: 'submit_forecast', simulationId: data.simulation.id, playerId, marketId, rawValue: Number(value), at: forecastAt ? new Date(forecastAt).toISOString() : undefined }, 'Manual forecast saved.'); }}>
      <strong>Manual forecast</strong><label>Player<select value={playerId} onChange={(event) => setPlayerId(event.target.value)}>{data.players.map((player) => <option key={player.id} value={player.id}>{player.display_name} · @{player.username}</option>)}</select></label><label>Open market<select value={marketId} onChange={(event) => setMarketId(event.target.value)}>{openMarkets.map((market) => <option key={market.id} value={market.id}>{gameMap.get(market.game_id)?.name} · {metricLabels[market.metric_type]}</option>)}</select></label><label>Raw value<input required inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} /></label><label>Timestamp (optional)<input type="datetime-local" value={forecastAt} onChange={(event) => setForecastAt(event.target.value)} /></label><button disabled={isPending || !playerId || !marketId} type="submit">Save forecast</button>
    </form>
    <form onSubmit={(event) => { event.preventDefault(); onCommand({ action: 'generate_forecasts', simulationId: data.simulation.id, marketId: marketId || undefined, density: Number(density), distribution, timing, center: centre ? Number(centre) : undefined }, 'Forecast batch scheduled.'); }}>
      <strong>Batch forecasts</strong><label>Market<select value={marketId} onChange={(event) => setMarketId(event.target.value)}><option value="">All open markets</option>{openMarkets.map((market) => <option key={market.id} value={market.id}>{gameMap.get(market.game_id)?.name} · {metricLabels[market.metric_type]}</option>)}</select></label><label>Distribution<select value={distribution} onChange={(event) => setDistribution(event.target.value)}><option value="around_actual">Around actual</option><option value="around_consensus">Around consensus</option><option value="fixed">Fixed</option><option value="uniform">Uniform</option><option value="normal">Normal</option><option value="log_normal">Log-normal</option></select></label><label>Centre (optional)<input inputMode="decimal" value={centre} onChange={(event) => setCentre(event.target.value)} /></label><label>Timing<select value={timing} onChange={(event) => setTiming(event.target.value)}><option value="opening">At opening</option><option value="uniform">Uniform</option><option value="early">Early-heavy</option><option value="late">Late-heavy</option></select></label><label>Participation<input max="1" min="0.01" step="0.01" type="number" value={density} onChange={(event) => setDensity(event.target.value)} /></label><button disabled={isPending} type="submit">Preview & schedule</button>
    </form>
    <div className="gm-forecast-history"><strong>Recent forecast versions</strong>{data.forecasts.slice(0, 20).map((forecast) => { const market = data.markets.find((candidate) => candidate.id === forecast.market_id); const player = data.players.find((candidate) => candidate.id === forecast.player_id); return <div key={forecast.id}><span>{player?.display_name ?? 'Unknown'} · {market ? metricLabels[market.metric_type] : 'Unknown'} · {formatNumber(forecast.raw_value)} <small>{formatDate(forecast.valid_from)}{forecast.valid_to ? ` → ${formatDate(forecast.valid_to)}` : ' · active'}</small></span><button disabled={isPending} type="button" onClick={() => window.confirm('Delete this unscored forecast version?') && onCommand({ action: 'delete_forecast', simulationId: data.simulation.id, forecastId: forecast.id }, 'Forecast version deleted.')}>Delete</button></div>; })}</div>
  </div>;
}

function SimulationOverview({ data, gameById, onCommand, isPending, marketValues, setMarketValues }: {
  data: NonNullable<ConsoleData['selected']>;
  gameById: Map<string, ConsoleData['selected'] extends infer _ ? { id: string; name: string; release_at: string | null; scenario_values: Record<string, number> } : never>;
  onCommand: (payload: Record<string, unknown>, success: string) => void;
  isPending: boolean;
  marketValues: Record<string, string>;
  setMarketValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  return <div className="gm-dashboard-grid">
    <div className="gm-stack">
      <EventLog events={data.events.slice(0, 12)} markets={data.markets} players={data.players} gameById={gameById} compact />
      <LeaderboardPanel data={data} compact />
    </div>
    <div className="gm-stack">
      <section className="gm-section gm-controls-panel">
        <div className="gm-section-heading"><div><h2>Simulation controls</h2><p>External email, analytics and webhooks are disabled.</p></div><Status value={data.simulation.status} /></div>
        <dl><div><dt>Random seed</dt><dd>{data.simulation.random_seed}</dd></div><div><dt>Next scheduled forecast</dt><dd>{formatDate(data.nextScheduledAt)}</dd></div><div><dt>Current checkpoint</dt><dd>{data.checkpoints[0]?.name ?? 'None'}</dd></div></dl>
        <div className="gm-danger-actions"><button disabled={isPending} type="button" onClick={() => onCommand({ action: 'generate_forecasts', simulationId: data.simulation.id, density: 1 }, 'Forecast batch scheduled.')}><Bot size={14} />Generate forecasts</button><button disabled={isPending} type="button" onClick={() => onCommand({ action: 'snapshot', simulationId: data.simulation.id }, 'Snapshots created.')}><Clock3 size={14} />Run snapshot</button><button disabled={isPending} type="button" onClick={() => { const label = window.prompt('External signal label'); if (label) { const raw = window.prompt('Optional numeric signal value', '1'); onCommand({ action: 'signal', simulationId: data.simulation.id, label, value: raw === null || raw === '' ? undefined : Number(raw) }, 'External signal applied.'); } }}><Radio size={14} />Add signal</button><button disabled={isPending} type="button" onClick={() => window.confirm('Reset to the initial checkpoint?') && onCommand({ action: 'reset', simulationId: data.simulation.id }, 'Simulation reset.')}><RotateCcw size={14} />Reset</button><button disabled={isPending} type="button" onClick={() => window.confirm('Archive this simulation?') && onCommand({ action: 'archive', simulationId: data.simulation.id }, 'Simulation archived.')}><Archive size={14} />Archive</button></div>
        <div className="gm-checkpoint-list"><strong>Checkpoints</strong>{data.checkpoints.map((checkpoint) => <div key={checkpoint.id}><span><b>{checkpoint.name}</b><small>{formatDate(checkpoint.simulation_time)}</small></span><button disabled={isPending} type="button" onClick={() => window.confirm(`Restore ${checkpoint.name}? Current mutable state will be replaced.`) && onCommand({ action: 'reset', simulationId: data.simulation.id, checkpointId: checkpoint.id }, `Restored ${checkpoint.name}.`)}>Restore</button><button disabled={isPending} type="button" onClick={() => onCommand({ action: 'clone_checkpoint', simulationId: data.simulation.id, checkpointId: checkpoint.id }, `Cloned ${checkpoint.name}.`)}><Copy size={12} />Clone</button></div>)}</div>
      </section>
      <MarketsPanel data={data} gameById={gameById} onCommand={onCommand} isPending={isPending} marketValues={marketValues} setMarketValues={setMarketValues} compact />
      <ScoreInspector data={data} compact />
    </div>
  </div>;
}

function MarketsPanel({ data, gameById, onCommand, isPending, marketValues, setMarketValues, compact = false }: {
  data: NonNullable<ConsoleData['selected']>;
  gameById: Map<string, { id: string; name: string; release_at: string | null; scenario_values: Record<string, number> }>;
  onCommand: (payload: Record<string, unknown>, success: string) => void;
  isPending: boolean;
  marketValues: Record<string, string>;
  setMarketValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  compact?: boolean;
}) {
  const markets = compact ? data.markets.slice(0, 6) : data.markets;
  function addGame() {
    const name = window.prompt('Game name');
    if (!name) return;
    const releaseAt = window.prompt('Release time (ISO 8601, blank = +30 days)', '');
    const ccu = Number(window.prompt('Scenario: first weekend peak CCU', '10000'));
    const reviews = Number(window.prompt('Scenario: first month total reviews', '2500'));
    const price = Number(window.prompt('Scenario: full price in US', '29.99'));
    if (![ccu, reviews, price].every(Number.isFinite)) return;
    onCommand({ action: 'create_game', simulationId: data.simulation.id, name, releaseAt: releaseAt || undefined, scenarioValues: { first_weekend_ccu: ccu, first_month_reviews: reviews, full_price_us: price }, createMarkets: true }, 'Game and markets created.');
  }
  function cloneCatalogGame() {
    const steamAppId = Number(window.prompt('Steam app ID from the staging catalog'));
    if (!Number.isSafeInteger(steamAppId) || steamAppId <= 0) return;
    const ccu = Number(window.prompt('Scenario: first weekend peak CCU', '10000'));
    const reviews = Number(window.prompt('Scenario: first month total reviews', '2500'));
    const price = Number(window.prompt('Scenario: full price in US', '29.99'));
    if (![ccu, reviews, price].every(Number.isFinite)) return;
    onCommand({ action: 'clone_catalog_game', simulationId: data.simulation.id, steamAppId, scenarioValues: { first_weekend_ccu: ccu, first_month_reviews: reviews, full_price_us: price } }, 'Catalog game cloned with three markets.');
  }
  return <section className="gm-section">
    <div className="gm-section-heading"><div><h2>Market status inspector</h2><p>{data.markets.filter((market) => market.status === 'open').length} open · {data.markets.filter((market) => market.status === 'locked').length} locked · {data.markets.filter((market) => market.status === 'resolved').length} resolved</p></div>{!compact ? <div className="gm-section-actions"><button disabled={isPending} type="button" onClick={addGame}><Plus size={14} />Game + 3 markets</button><button disabled={isPending} type="button" onClick={cloneCatalogGame}><Copy size={14} />Clone catalog game</button></div> : null}</div>
    {!compact ? <MarketControlForms data={data} onCommand={onCommand} isPending={isPending} /> : null}
    <div className="gm-market-list">{markets.map((market) => {
      const game = gameById.get(market.game_id);
      const input = marketValues[market.id] ?? String(game?.scenario_values[market.metric_type] ?? '');
      return <article key={market.id}>
        <div><strong>{game?.name ?? 'Unknown game'}</strong><small>{metricLabels[market.metric_type] ?? market.metric_type}</small><small>{data.marketStats[market.id]?.participantCount ?? 0} participants · Forecast {data.marketStats[market.id]?.currentForecast === null ? '—' : formatNumber(data.marketStats[market.id]?.currentForecast ?? 0)} · {data.marketStats[market.id]?.snapshotCount ?? 0} snapshots · Result {data.marketStats[market.id]?.actualResult === null ? '—' : formatNumber(data.marketStats[market.id]?.actualResult ?? 0)} · {data.marketStats[market.id]?.scoringStatus ?? 'not_scored'}</small></div>
        <Status value={market.status} />
        <span className="gm-market-time">Lock {formatDate(market.lock_at)}</span>
        <input aria-label={`Actual value for ${game?.name ?? 'market'}`} disabled={market.status === 'open' || market.status === 'void'} inputMode="decimal" value={input} onChange={(event) => setMarketValues((current) => ({ ...current, [market.id]: event.target.value }))} />
        <div className="gm-market-actions">{market.status === 'open' ? <button disabled={isPending} type="button" onClick={() => onCommand({ action: 'lock', simulationId: data.simulation.id, marketId: market.id }, 'Market locked.')}><LockKeyhole size={12} />Lock</button> : market.status === 'locked' ? <><button disabled={isPending} type="button" onClick={() => onCommand({ action: 'resolve', simulationId: data.simulation.id, marketId: market.id, actualValue: Number(input) }, 'Market resolved.')}>Resolve</button><button disabled={isPending} type="button" onClick={() => onCommand({ action: 'unlock', simulationId: data.simulation.id, marketId: market.id }, 'Market unlocked.')}>Unlock</button></> : market.status === 'resolved' ? <><button disabled={isPending} type="button" onClick={() => onCommand({ action: 'correct', simulationId: data.simulation.id, marketId: market.id, actualValue: Number(input), note: 'Corrected from Game Master Console' }, 'Result corrected.')}>Correct</button><button disabled={isPending} type="button" onClick={() => window.confirm('Reset derived scores for this market?') && onCommand({ action: 'reset_scores', simulationId: data.simulation.id, marketId: market.id }, 'Scores reset.')}>Scores</button></> : <button disabled={isPending} type="button" onClick={() => onCommand({ action: 'open_market', simulationId: data.simulation.id, marketId: market.id }, 'Market opened.')}>Open</button>}<button disabled={isPending} type="button" onClick={() => { const reason = window.prompt('Void reason'); if (reason) onCommand({ action: 'void', simulationId: data.simulation.id, marketId: market.id, reason }, 'Market voided.'); }}>Void</button>{!compact ? <><button disabled={isPending} type="button" onClick={() => window.confirm('Reset this market and remove all simulation forecasts, snapshots, results, and scores?') && onCommand({ action: 'reset_market', simulationId: data.simulation.id, marketId: market.id }, 'Market reset.')}>Reset</button><button className="is-danger" disabled={isPending} type="button" onClick={() => window.confirm('Permanently delete this test market?') && onCommand({ action: 'delete_market', simulationId: data.simulation.id, marketId: market.id }, 'Market deleted.')}>Delete</button></> : null}</div>
      </article>;
    })}</div>{!compact ? <SnapshotSummary data={data} gameById={gameById} /> : null}
  </section>;
}

function MarketControlForms({ data, onCommand, isPending }: {
  data: NonNullable<ConsoleData['selected']>;
  onCommand: (payload: Record<string, unknown>, success: string) => void;
  isPending: boolean;
}) {
  const [gameId, setGameId] = useState(data.games[0]?.id ?? '');
  const [metricType, setMetricType] = useState('first_weekend_ccu');
  const [lockAt, setLockAt] = useState('');
  const [resolveAfter, setResolveAfter] = useState('');
  const [releaseAt, setReleaseAt] = useState('');
  const [snapshotUntil, setSnapshotUntil] = useState(new Date(data.simulation.simulation_time).toISOString().slice(0, 16));
  const [snapshotMarket, setSnapshotMarket] = useState('');
  const [signalMarket, setSignalMarket] = useState(data.markets.find((market) => market.status === 'open')?.id ?? '');
  const [signalLabel, setSignalLabel] = useState('Major streamer coverage');
  const [signalTarget, setSignalTarget] = useState('');
  const [signalStrength, setSignalStrength] = useState('0.6');
  const marketName = (market: NonNullable<ConsoleData['selected']>['markets'][number]) => `${data.games.find((game) => game.id === market.game_id)?.name ?? 'Unknown'} · ${metricLabels[market.metric_type]}`;
  return <div className="gm-control-forms gm-control-forms--markets">
    <form onSubmit={(event) => { event.preventDefault(); if (gameId) onCommand({ action: 'create_market', simulationId: data.simulation.id, gameId, metricType, lockAt: lockAt ? new Date(lockAt).toISOString() : undefined, resolveAfter: resolveAfter ? new Date(resolveAfter).toISOString() : undefined }, 'Market created.'); }}><strong>Create market</strong><label>Game<select value={gameId} onChange={(event) => setGameId(event.target.value)}>{data.games.map((game) => <option key={game.id} value={game.id}>{game.name}</option>)}</select></label><label>Metric<select value={metricType} onChange={(event) => setMetricType(event.target.value)}>{Object.entries(metricLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Lock time<input type="datetime-local" value={lockAt} onChange={(event) => setLockAt(event.target.value)} /></label><label>Resolve after<input type="datetime-local" value={resolveAfter} onChange={(event) => setResolveAfter(event.target.value)} /></label><button disabled={isPending || !gameId} type="submit">Create market</button></form>
    <form onSubmit={(event) => { event.preventDefault(); if (gameId && releaseAt) onCommand({ action: 'update_game', simulationId: data.simulation.id, gameId, releaseAt: new Date(releaseAt).toISOString() }, 'Game release date and market timing updated.'); }}><strong>Edit game timing</strong><label>Game<select value={gameId} onChange={(event) => setGameId(event.target.value)}>{data.games.map((game) => <option key={game.id} value={game.id}>{game.name}</option>)}</select></label><label>Release date/time<input required type="datetime-local" value={releaseAt} onChange={(event) => setReleaseAt(event.target.value)} /></label><button disabled={isPending || !gameId || !releaseAt} type="submit">Update release</button></form>
    <form onSubmit={(event) => { event.preventDefault(); onCommand({ action: 'snapshot_batch', simulationId: data.simulation.id, until: new Date(snapshotUntil).toISOString() }, 'Snapshot batch completed.'); }}><strong>Snapshot operations</strong><label>Until simulation time<input type="datetime-local" value={snapshotUntil} onChange={(event) => setSnapshotUntil(event.target.value)} /></label><label>Optional market<select value={snapshotMarket} onChange={(event) => setSnapshotMarket(event.target.value)}><option value="">All markets</option>{data.markets.map((market) => <option key={market.id} value={market.id}>{marketName(market)}</option>)}</select></label><button disabled={isPending} type="submit">Run until date</button><button disabled={isPending} type="button" onClick={() => onCommand({ action: 'snapshot', simulationId: data.simulation.id }, 'Snapshot created at current test time.')}>Run now</button><button disabled={isPending} type="button" onClick={() => window.confirm('Delete the latest unscored snapshot?') && onCommand({ action: 'delete_latest_snapshot', simulationId: data.simulation.id, marketId: snapshotMarket || undefined }, 'Latest unscored snapshot deleted.')}>Delete latest</button><button disabled={isPending} type="button" onClick={() => window.confirm('Rebuild all unscored snapshots from forecast history?') && onCommand({ action: 'rebuild_snapshots', simulationId: data.simulation.id }, 'Snapshots rebuilt.')}>Rebuild</button></form>
    <form onSubmit={(event) => { event.preventDefault(); onCommand({ action: 'signal', simulationId: data.simulation.id, label: signalLabel, marketId: signalMarket || undefined, targetValue: signalTarget ? Number(signalTarget) : undefined, strength: Number(signalStrength), affectedBehaviors: ['follower', 'late'] }, 'Signal triggered and affected bots updated.'); }}><strong>Simulated information event</strong><label>Event name<input required value={signalLabel} onChange={(event) => setSignalLabel(event.target.value)} /></label><label>Affected market<select value={signalMarket} onChange={(event) => setSignalMarket(event.target.value)}><option value="">Log only</option>{data.markets.filter((market) => market.status === 'open').map((market) => <option key={market.id} value={market.id}>{marketName(market)}</option>)}</select></label><label>Target value<input inputMode="decimal" value={signalTarget} onChange={(event) => setSignalTarget(event.target.value)} /></label><label>Strength<input max="1" min="0" step="0.1" type="number" value={signalStrength} onChange={(event) => setSignalStrength(event.target.value)} /></label><button disabled={isPending} type="submit"><Radio size={14} />Trigger event</button></form>
  </div>;
}

function LeaderboardPanel({ data, compact = false }: { data: NonNullable<ConsoleData['selected']>; compact?: boolean }) {
  const [metric, setMetric] = useState('all');
  const source = data.leaderboardByMetric[metric] ?? data.leaderboard;
  const rows = compact ? source.slice(0, 10) : source;
  return <section className="gm-section"><div className="gm-section-heading"><div><h2>Leaderboard {compact ? '(Top 10)' : ''}</h2><p>Canonical leave-one-out competition points.</p></div><div className="gm-section-actions">{!compact ? <select aria-label="Leaderboard metric" value={metric} onChange={(event) => setMetric(event.target.value)}><option value="all">All metrics</option><option value="first_weekend_ccu">CCU</option><option value="first_month_reviews">Reviews</option><option value="full_price_us">Price</option></select> : null}<a href={`/api/internal/game-master?simulationId=${data.simulation.id}&export=csv`}><Download size={14} />CSV</a></div></div><div className="gm-table gm-table--leaderboard"><div className="gm-table-head"><span>Rank</span><span>Player</span><span>Points</span><span>Avg/day</span><span>Markets</span><span>+ / −</span></div>{rows.length ? rows.map((row) => <div className="gm-table-row" key={row.playerId}><strong>#{row.rank}</strong><span><strong>{row.displayName}</strong><small>@{row.username}</small></span><strong>{formatNumber(row.points)}</strong><span>{formatNumber(row.averagePoints)}</span><span>{row.resolvedMarkets}</span><span>{row.positiveMarkets} / {row.negativeMarkets}</span></div>) : <p className="gm-table-empty">Resolve a market with at least two players in a snapshot to generate scores.</p>}</div>{!compact ? <><FormulaComparison data={data} /><ScoreInspector data={data} /></> : null}</section>;
}

function SnapshotSummary({ data, gameById }: { data: NonNullable<ConsoleData['selected']>; gameById: Map<string, { id: string; name: string }> }) {
  const marketMap = new Map(data.markets.map((market) => [market.id, market]));
  return <div className="gm-snapshot-summary"><div className="gm-section-heading"><div><h2>Snapshot analysis</h2><p>Mean, median and spread use stored snapshot members.</p></div></div><div className="gm-table gm-table--snapshots"><div className="gm-table-head"><span>Simulation time</span><span>Market</span><span>N</span><span>Mean</span><span>Median</span><span>Min–max</span><span>Std dev</span><span>Status</span></div>{data.snapshotStats.slice(0, 100).map((snapshot) => { const market = marketMap.get(snapshot.market_id); const game = market ? gameById.get(market.game_id) : null; return <div className="gm-table-row" key={snapshot.id}><span>{formatDate(snapshot.snapshot_at)}</span><span><strong>{game?.name ?? 'Unknown game'}</strong><small>{market ? metricLabels[market.metric_type] : 'Unknown metric'}</small></span><span>{snapshot.eligible_prediction_count}</span><span>{snapshot.mean === null ? '—' : formatNumber(snapshot.mean)}</span><span>{snapshot.median === null ? '—' : formatNumber(snapshot.median)}</span><span>{snapshot.minimum === null ? '—' : `${formatNumber(snapshot.minimum)}–${formatNumber(snapshot.maximum ?? 0)}`}</span><span>{snapshot.standardDeviation === null ? '—' : formatNumber(snapshot.standardDeviation)}</span><Status value={snapshot.status} /></div>; })}</div></div>;
}

function FormulaComparison({ data }: { data: NonNullable<ConsoleData['selected']> }) {
  return <section className="gm-formula-comparison"><div className="gm-section-heading"><div><h2>Formula comparison</h2><p>Read-only alternatives. Canonical scoring remains unchanged.</p></div></div><div className="gm-formula-grid">{data.formulaComparison.map((formula) => <article key={formula.formulaKey}><strong>{formula.label}</strong><small>{formula.formulaKey}</small>{formula.leaderboard.slice(0, 5).map((row) => <div key={row.playerId}><span>#{row.rank} {row.displayName}</span><b>{formatNumber(row.points)}</b></div>)}</article>)}</div></section>;
}

function ScoreInspector({ data, compact = false }: { data: NonNullable<ConsoleData['selected']>; compact?: boolean }) {
  const rows = compact ? data.scoreInspector.slice(0, 6) : data.scoreInspector;
  const values = rows.map((row) => Number(row.points));
  const total = values.reduce((sum, value) => sum + value, 0);
  return <section className="gm-section gm-score-inspector"><div className="gm-section-heading"><div><h2>Score Inspector</h2><p>Points = abs(actual − crowd without player) − abs(actual − player).</p></div></div>{!compact && values.length ? <div className="gm-score-summary"><span>Positive <b>{values.filter((value) => value > 0).length}</b></span><span>Negative <b>{values.filter((value) => value < 0).length}</b></span><span>Zero <b>{values.filter((value) => value === 0).length}</b></span><span>Total <b>{formatNumber(total)}</b></span><span>Average <b>{formatNumber(total / values.length)}</b></span><span>Best / worst <b>{formatNumber(Math.max(...values))} / {formatNumber(Math.min(...values))}</b></span></div> : null}<div className="gm-score-table"><div className="gm-table-head"><span>Player / market</span><span>Forecast</span><span>Crowd w/o</span><span>Actual</span><span>User error</span><span>Crowd error</span><span>Points</span></div>{rows.length ? rows.map((row) => <div className="gm-table-row" key={row.id}><span><strong>{row.player}</strong><small>{row.game} · {metricLabels[row.metric] ?? row.metric}</small></span><span>{formatNumber(row.user_percentile)}%</span><span>{formatNumber(row.crowd_without_user_percentile)}%</span><span>{formatNumber(row.actual_percentile)}%</span><span>{formatNumber(row.user_error)}</span><span>{formatNumber(row.crowd_error)}</span><strong className={row.points >= 0 ? 'is-positive' : 'is-negative'}>{row.points >= 0 ? '+' : ''}{formatNumber(row.points)}</strong></div>) : <p className="gm-table-empty">No current score run yet.</p>}</div></section>;
}

function EventLog({ events, markets, players, gameById, compact = false }: { events: NonNullable<ConsoleData['selected']>['events']; markets: NonNullable<ConsoleData['selected']>['markets']; players: NonNullable<ConsoleData['selected']>['players']; gameById: Map<string, { id: string; name: string }>; compact?: boolean }) {
  const [eventType, setEventType] = useState('');
  const [marketId, setMarketId] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [search, setSearch] = useState('');
  const marketMap = new Map(markets.map((market) => [market.id, market]));
  const eventTypes = [...new Set(events.map((event) => event.event_type))].sort();
  const filtered = compact ? events : events.filter((event) => {
    if (eventType && event.event_type !== eventType) return false;
    if (marketId && event.market_id !== marketId) return false;
    if (playerId && event.player_id !== playerId) return false;
    return !search || JSON.stringify(event).toLowerCase().includes(search.toLowerCase());
  });
  return <section className="gm-section"><div className="gm-section-heading"><div><h2>Lifecycle timeline</h2><p>Immutable event log · newest first</p></div></div>{!compact ? <div className="gm-event-filters"><input aria-label="Search events" placeholder="Search event details" value={search} onChange={(event) => setSearch(event.target.value)} /><select aria-label="Event type" value={eventType} onChange={(event) => setEventType(event.target.value)}><option value="">All event types</option>{eventTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select><select aria-label="Event market" value={marketId} onChange={(event) => setMarketId(event.target.value)}><option value="">All markets</option>{markets.map((market) => <option key={market.id} value={market.id}>{gameById.get(market.game_id)?.name ?? market.metric_type} · {metricLabels[market.metric_type]}</option>)}</select><select aria-label="Event player" value={playerId} onChange={(event) => setPlayerId(event.target.value)}><option value="">All players</option>{players.map((player) => <option key={player.id} value={player.id}>@{player.username}</option>)}</select></div> : null}<div className="gm-event-table"><div className="gm-table-head"><span>Simulation / real time</span><span>Event</span><span>Market</span><span>Details</span></div>{filtered.map((event) => { const market = event.market_id ? marketMap.get(event.market_id) : null; const game = market ? gameById.get(market.game_id) : null; return <div className="gm-table-row" key={event.id}><span><strong>{formatDate(event.event_at)}</strong><small>Recorded {formatDate(event.created_at)}</small></span><strong>{event.event_type}</strong><span>{game?.name ?? '—'}</span><code>{JSON.stringify(event.payload).slice(0, compact ? 90 : 220)}</code></div>; })}</div></section>;
}
