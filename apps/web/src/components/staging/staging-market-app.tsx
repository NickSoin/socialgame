'use client';

import {
  CalendarDays,
  Check,
  ChevronDown,
  CircleCheckBig,
  CircleDot,
  LockKeyhole,
  Search,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
  Trophy,
  UserPlus,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { Brand } from '@/components/gamecast/brand';
import { GameHero } from '@/components/steambets/game-hero';
import {
  parseSteamBetDraft,
  sanitizeSteamBetDraft,
  type SteamBetTarget,
  type SteamBetTargetKey,
  type SteamUpcomingGame,
} from '@/lib/steam-bets';
import type {
  StagingWorkspaceData,
  StagingWorkspaceGame,
  StagingWorkspacePlayer,
} from '@/lib/staging/market-workspace-types';

type FeedMode = 'upcoming' | 'trending' | 'locked' | 'completed' | 'involved';
type ForecastStatus = 'open' | 'resolved';

const compactNumber = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const pointNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

const DEFAULT_RESOLUTION_VALUES: Record<SteamBetTargetKey, string> = {
  first_weekend_ccu: '2000',
  first_month_reviews: '1200',
  full_price_us: '12',
  launch_discount: '10',
};

const TABS: Array<{ id: FeedMode; label: string; icon: typeof TrendingUp }> = [
  { id: 'trending', label: 'Trending', icon: TrendingUp },
  { id: 'upcoming', label: 'Popular upcoming', icon: CalendarDays },
  { id: 'locked', label: 'Locked', icon: LockKeyhole },
  { id: 'completed', label: 'Completed', icon: CircleCheckBig },
  { id: 'involved', label: 'My forecasts', icon: CircleDot },
];

function formatAverage(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—';
  return compactNumber.format(value);
}

function mergeGameState(
  game: SteamUpcomingGame,
  state: StagingWorkspaceGame | undefined,
  activePlayerId: string | null,
): SteamUpcomingGame {
  return {
    ...game,
    lifecycleStatus: state?.locked || state?.completed ? 'released' : 'upcoming',
    targets: game.targets.map((target) => {
      const market = state?.markets.find((item) => item.metricType === target.key);
      return {
        ...target,
        averageValue: market?.averageValue ?? null,
        averageHistory: [],
        predictionCount: market?.predictionCount ?? 0,
        userValue: market?.forecasts.find((forecast) => forecast.playerId === activePlayerId)?.value ?? null,
        userPercentile: null,
        marketStatus: market?.status ?? 'open',
        actualValue: market?.actualValue ?? null,
      };
    }),
  };
}

function StagingSearch({ query, onChange }: { query: string; onChange: (value: string) => void }) {
  return (
    <div className="sb-search-command sb-staging-search">
      <form className="sb-search" role="search" onSubmit={(event) => event.preventDefault()}>
        <span className="sb-search__submit" aria-hidden="true"><Search size={21} /></span>
        <input
          aria-label="Search games"
          autoComplete="off"
          placeholder="Search games..."
          value={query}
          onChange={(event) => onChange(event.target.value)}
        />
        {query ? (
          <button className="sb-search__clear" type="button" aria-label="Clear search" onClick={() => onChange('')}>
            <X size={18} aria-hidden="true" />
          </button>
        ) : null}
      </form>
    </div>
  );
}

function PlayerMenu({
  activePlayerId,
  disabled,
  onAdd,
  onDelete,
  onSelect,
  players,
}: {
  activePlayerId: string | null;
  disabled: boolean;
  onAdd: (displayName: string) => void;
  onDelete: (playerId: string) => void;
  onSelect: (playerId: string) => void;
  players: StagingWorkspacePlayer[];
}) {
  const [displayName, setDisplayName] = useState('');
  const active = players.find((player) => player.id === activePlayerId) ?? null;

  return (
    <details className="sb-account-menu sb-staging-player-menu">
      <summary aria-label={`Artificial player menu${active ? ` for ${active.displayName}` : ''}`}>
        <span className="sb-account-menu__avatar"><UserRound size={21} aria-hidden="true" /></span>
        <ChevronDown size={17} aria-hidden="true" />
      </summary>
      <div className="sb-account-menu__panel sb-staging-player-menu__panel">
        <div className="sb-staging-player-menu__heading">
          <strong>Artificial users</strong>
          <small>{players.length}</small>
        </div>
        <div className="sb-staging-player-list">
          {players.map((player) => (
            <div className={player.id === activePlayerId ? 'is-active' : undefined} key={player.id}>
              <button type="button" disabled={disabled} onClick={() => onSelect(player.id)}>
                <span>{player.displayName}</span>
                <small>@{player.username}</small>
              </button>
              <button
                className="sb-staging-player-delete"
                type="button"
                disabled={disabled}
                aria-label={`Delete ${player.displayName}`}
                title={`Delete ${player.displayName}`}
                onClick={() => onDelete(player.id)}
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
          ))}
          {!players.length ? <p>Add an artificial user to start making forecasts.</p> : null}
        </div>
        <form
          className="sb-staging-player-add"
          onSubmit={(event) => {
            event.preventDefault();
            if (!displayName.trim()) return;
            onAdd(displayName);
            setDisplayName('');
          }}
        >
          <input
            aria-label="New artificial user name"
            maxLength={80}
            placeholder="New player name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <button type="submit" disabled={disabled || !displayName.trim()} title="Add artificial user">
            <UserPlus size={17} aria-hidden="true" />
          </button>
        </form>
      </div>
    </details>
  );
}

function ManipulationPanel({
  activePlayerId,
  disabled,
  game,
  onCommand,
  onResolutionValueChange,
  players,
  resolutionValue,
  target,
}: {
  activePlayerId: string | null;
  disabled: boolean;
  game: SteamUpcomingGame;
  onCommand: (command: Record<string, unknown>, message: string) => void;
  onResolutionValueChange: (value: string) => void;
  players: StagingWorkspacePlayer[];
  resolutionValue: string;
  target: SteamBetTarget;
}) {
  const [playerId, setPlayerId] = useState(activePlayerId ?? players[0]?.id ?? '');
  const [manualValue, setManualValue] = useState('');
  const [batchCount, setBatchCount] = useState('25');
  const [minimum, setMinimum] = useState('0');
  const [maximum, setMaximum] = useState(
    target.key === 'full_price_us' ? '69.99' : target.key === 'launch_discount' ? '100' : '10000',
  );

  useEffect(() => {
    if (activePlayerId) setPlayerId(activePlayerId);
  }, [activePlayerId]);

  useEffect(() => {
    if (!players.some((player) => player.id === playerId)) setPlayerId(players[0]?.id ?? '');
  }, [playerId, players]);

  if (target.marketStatus !== 'open') return null;
  const parsedManual = parseSteamBetDraft(target.key, manualValue);
  const parsedCount = Number(batchCount);
  const parsedMinimum = Number(minimum);
  const parsedMaximum = Number(maximum);
  const batchIsValid = Number.isSafeInteger(parsedCount)
    && parsedCount > 0
    && parsedCount <= 2_000
    && Number.isFinite(parsedMinimum)
    && Number.isFinite(parsedMaximum)
    && parsedMinimum >= 0
    && parsedMaximum >= 0;

  return (
    <div className="sb-manipulation-drawer">
      <button
        className="sb-manipulation-drawer__tail"
        type="button"
        aria-label={`Open game manipulation for ${target.label}`}
        title="Game manipulation"
      >
        <SlidersHorizontal size={14} aria-hidden="true" />
      </button>
      <div className="sb-manipulation-drawer__panel">
        <strong>Game manipulation</strong>
        <div className="sb-manipulation-row">
          <select aria-label={`Artificial user for ${game.name} ${target.label}`} value={playerId} onChange={(event) => setPlayerId(event.target.value)}>
            {players.map((player) => <option value={player.id} key={player.id}>{player.displayName}</option>)}
          </select>
          <input
            aria-label={`${game.name} manual ${target.label} value`}
            inputMode={target.step === 1 ? 'numeric' : 'decimal'}
            maxLength={target.maxLength}
            placeholder="Value"
            value={manualValue}
            onChange={(event) => setManualValue(sanitizeSteamBetDraft(target.key, event.target.value))}
          />
          <button
            type="button"
            aria-label={`Add forecast for ${game.name} ${target.label}`}
            disabled={disabled || !playerId || parsedManual === null}
            onClick={() => {
              if (parsedManual === null) return;
              onCommand({
                action: 'place_forecast',
                steamAppId: game.appId,
                playerId,
                metricType: target.key,
                rawValue: parsedManual,
              }, `Forecast added for ${players.find((player) => player.id === playerId)?.displayName ?? 'player'}.`);
              setManualValue('');
            }}
          >Add</button>
        </div>
        <span className="sb-manipulation-label">Random batch</span>
        <div className="sb-manipulation-batch">
          <label>Count<input aria-label={`${game.name} ${target.label} batch forecast count`} inputMode="numeric" value={batchCount} onChange={(event) => setBatchCount(event.target.value.replace(/\D/g, '').slice(0, 4))} /></label>
          <label>Min<input aria-label={`${game.name} ${target.label} batch minimum`} inputMode="decimal" value={minimum} onChange={(event) => setMinimum(event.target.value.replace(/[^\d.]/g, '').slice(0, 10))} /></label>
          <label>Max<input aria-label={`${game.name} ${target.label} batch maximum`} inputMode="decimal" value={maximum} onChange={(event) => setMaximum(event.target.value.replace(/[^\d.]/g, '').slice(0, 10))} /></label>
          <button
            type="button"
            aria-label={`Add batch forecasts for ${game.name} ${target.label}`}
            disabled={disabled || !batchIsValid}
            onClick={() => onCommand({
              action: 'batch_forecasts',
              steamAppId: game.appId,
              metricType: target.key,
              count: parsedCount,
              minimum: parsedMinimum,
              maximum: parsedMaximum,
            }, `${parsedCount} batch forecasts added.`)}
          >Add batch</button>
        </div>
        <label className="sb-manipulation-resolution">
          <span>Resolve result</span>
          <input
            aria-label={`${game.name} ${target.label} resolve result`}
            inputMode={target.step === 1 ? 'numeric' : 'decimal'}
            maxLength={target.maxLength}
            value={resolutionValue}
            onChange={(event) => onResolutionValueChange(sanitizeSteamBetDraft(target.key, event.target.value))}
          />
        </label>
      </div>
    </div>
  );
}

function StagingForecastField({
  activePlayerId,
  disabled,
  game,
  onCommand,
  onResolutionValueChange,
  players,
  resolutionValue,
  target,
}: {
  activePlayerId: string | null;
  disabled: boolean;
  game: SteamUpcomingGame;
  onCommand: (command: Record<string, unknown>, message: string) => void;
  onResolutionValueChange: (value: string) => void;
  players: StagingWorkspacePlayer[];
  resolutionValue: string;
  target: SteamBetTarget;
}) {
  const [draft, setDraft] = useState(target.userValue === null ? '' : String(target.userValue));
  const [editing, setEditing] = useState(false);
  const savedValue = target.userValue === null ? '' : String(target.userValue);

  useEffect(() => {
    setDraft(savedValue);
    setEditing(false);
  }, [activePlayerId, savedValue]);

  const parsedValue = parseSteamBetDraft(target.key, draft);
  const isOpen = game.lifecycleStatus === 'upcoming' && target.marketStatus === 'open';

  return (
    <div className="sb-staging-target-wrap">
      <form
        className={`sb-forecast-field${editing ? ' is-editing' : savedValue ? ' is-committed' : ' is-idle'}`}
        onSubmit={(event) => {
          event.preventDefault();
          if (!activePlayerId || parsedValue === null || !isOpen) return;
          onCommand({
            action: 'place_forecast',
            steamAppId: game.appId,
            playerId: activePlayerId,
            metricType: target.key,
            rawValue: parsedValue,
          }, 'Forecast saved.');
          setEditing(false);
        }}
      >
        <label htmlFor={`staging-${game.appId}-${target.key}`}>{target.label}</label>
        <div className="sb-forecast-field__body">
          <div className="sb-forecast-input">
            <input
              id={`staging-${game.appId}-${target.key}`}
              aria-label={`${target.label} for ${game.name}`}
              disabled={disabled || !activePlayerId || !isOpen}
              inputMode={target.step === 1 ? 'numeric' : 'decimal'}
              maxLength={target.maxLength}
              readOnly={!editing || !isOpen}
              value={draft}
              onChange={(event) => setDraft(sanitizeSteamBetDraft(target.key, event.target.value))}
              onFocus={() => {
                if (activePlayerId && isOpen) setEditing(true);
              }}
            />
          </div>
          <div className="sb-forecast-stats">
            <span>{formatAverage(target.averageValue)} Avg.</span>
            <span>{compactNumber.format(target.predictionCount)} Vol.</span>
          </div>
        </div>
        {target.marketStatus === 'resolved' ? (
          <p className="sb-forecast-result is-resolved">Actual {formatAverage(target.actualValue)}</p>
        ) : null}
        {editing ? (
          <div className="sb-bet-actions">
            <button className="sb-bet-action is-confirm" type="submit" disabled={disabled || parsedValue === null} title="Confirm prediction"><Check size={16} /></button>
            <button className="sb-bet-action is-cancel" type="button" disabled={disabled} title="Cancel" onClick={() => { setDraft(savedValue); setEditing(false); }}><X size={15} /></button>
          </div>
        ) : null}
      </form>
      <ManipulationPanel
        activePlayerId={activePlayerId}
        disabled={disabled}
        game={game}
        onCommand={onCommand}
        onResolutionValueChange={onResolutionValueChange}
        players={players}
        resolutionValue={resolutionValue}
        target={target}
      />
    </div>
  );
}

function StagingGameCard({
  activePlayerId,
  disabled,
  game,
  onCommand,
  players,
  priority,
}: {
  activePlayerId: string | null;
  disabled: boolean;
  game: SteamUpcomingGame;
  onCommand: (command: Record<string, unknown>, message: string) => void;
  players: StagingWorkspacePlayer[];
  priority: boolean;
}) {
  const [previewActive, setPreviewActive] = useState(false);
  const [resolutionValues, setResolutionValues] = useState(DEFAULT_RESOLUTION_VALUES);
  const completed = game.targets.every((target) => target.marketStatus === 'resolved' || target.marketStatus === 'void');
  const parsedResolutionValues = {
    first_weekend_ccu: parseSteamBetDraft('first_weekend_ccu', resolutionValues.first_weekend_ccu),
    first_month_reviews: parseSteamBetDraft('first_month_reviews', resolutionValues.first_month_reviews),
    full_price_us: parseSteamBetDraft('full_price_us', resolutionValues.full_price_us),
    launch_discount: parseSteamBetDraft('launch_discount', resolutionValues.launch_discount),
  };
  const canResolve = Object.values(parsedResolutionValues).every((value) => value !== null);

  return (
    <div className="sb-staging-card-row">
      <article className="sb-game-card" onMouseEnter={() => setPreviewActive(true)} onMouseLeave={() => setPreviewActive(false)}>
        <a className="sb-game-card__steam-link" href={`https://store.steampowered.com/app/${game.appId}/`} target="_blank" rel="noreferrer" aria-label={`Open ${game.name} on Steam`} />
        <GameHero
          appId={game.appId}
          followerCount={game.followerCount}
          followersUpdatedAt={game.followersUpdatedAt}
          imageUrl={game.imageUrl}
          name={game.name}
          previewActive={previewActive}
          previewUrls={game.previewUrls}
          priority={priority}
          wishlistRank={game.wishlistRank}
          wishlistRankUpdatedAt={game.wishlistRankUpdatedAt}
        />
        <div className="sb-game-card__content">
          <header className="sb-game-card__header">
            <div className="sb-game-card__title">
              <div className="sb-game-card__name"><h2>{game.name}</h2></div>
              {game.tags.length ? <p className="sb-game-card__tags">{game.tags.join(' · ')}</p> : null}
            </div>
            <time dateTime={game.releaseDate}>{completed ? 'Completed' : game.releaseLabel}</time>
          </header>
          <div className="sb-game-card__targets">
            {game.targets.map((target) => (
              <StagingForecastField
                activePlayerId={activePlayerId}
                disabled={disabled}
                game={game}
                key={target.key}
                onCommand={onCommand}
                onResolutionValueChange={(value) => setResolutionValues((current) => ({ ...current, [target.key]: value }))}
                players={players}
                resolutionValue={resolutionValues[target.key]}
                target={target}
              />
            ))}
          </div>
        </div>
      </article>
      <aside className="sb-resolve-panel" aria-label={`Game master controls for ${game.name}`}>
        <small>Game master</small>
        <button
          type="button"
          aria-label={completed ? `${game.name} resolved` : `Resolve ${game.name}`}
          disabled={disabled || completed || !canResolve}
          onClick={() => {
            if (!canResolve) return;
            onCommand({
              action: 'resolve_game',
              steamAppId: game.appId,
              actualValues: parsedResolutionValues,
            }, `${game.name} resolved and moved to Completed.`);
          }}
        >
          <CircleCheckBig size={17} aria-hidden="true" />
          {completed ? 'Resolved' : 'Resolve'}
        </button>
      </aside>
    </div>
  );
}

function StagingLeaderboard({ data, activePlayerId }: { data: StagingWorkspaceData; activePlayerId: string | null }) {
  return (
    <aside className="sb-leaderboard-card" aria-labelledby="staging-leaderboard-title">
      <div className="sb-leaderboard-card__title" id="staging-leaderboard-title">
        <span><Trophy size={18} aria-hidden="true" />Leaderboard</span>
      </div>
      {data.leaderboard.length ? (
        <ol className="sb-leaderboard-list">
          {data.leaderboard.slice(0, 10).map((row) => (
            <li className={row.playerId === activePlayerId ? 'is-viewer' : undefined} key={row.playerId}>
              <span className="sb-leaderboard-rank">{row.rank}</span>
              <span>{row.displayName}</span>
              <strong>{pointNumber.format(row.points)} pts</strong>
            </li>
          ))}
        </ol>
      ) : <p className="sb-leaderboard-card__empty">Add a player to begin.</p>}
    </aside>
  );
}

export function StagingMarketApp({ initialData }: { initialData: StagingWorkspaceData }) {
  const [data, setData] = useState(initialData);
  const [activePlayerId, setActivePlayerId] = useState<string | null>(initialData.players[0]?.id ?? null);
  const [mode, setMode] = useState<FeedMode>('upcoming');
  const [forecastStatus, setForecastStatus] = useState<ForecastStatus>('open');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function refresh(preferredPlayerId?: string | null) {
    const response = await fetch('/api/internal/game-master', { cache: 'no-store' });
    const payload = await response.json() as StagingWorkspaceData & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? 'Could not refresh staging.');
    setData(payload);
    setActivePlayerId((current) => {
      const preferred = preferredPlayerId === undefined ? current : preferredPlayerId;
      return payload.players.some((player) => player.id === preferred) ? preferred : payload.players[0]?.id ?? null;
    });
    return payload;
  }

  function command(payload: Record<string, unknown>, success: string, preferredPlayerId?: string | null) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const response = await fetch('/api/internal/game-master', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...payload, simulationId: data.simulation.id }),
        });
        const body = await response.json() as { error?: string; result?: { id?: string } };
        if (!response.ok) throw new Error(body.error ?? 'Staging command failed.');
        const preferred = payload.action === 'add_player' ? body.result?.id ?? preferredPlayerId : preferredPlayerId;
        await refresh(preferred);
        setNotice(success);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Staging command failed.');
      }
    });
  }

  const stateByAppId = useMemo(() => new Map(data.games.map((game) => [game.steamAppId, game])), [data.games]);
  const activeLeaderboard = data.leaderboard.find((row) => row.playerId === activePlayerId);
  const activeBetCount = data.games.reduce((total, game) => total + game.markets.reduce(
    (marketTotal, market) => marketTotal + (market.forecasts.some((forecast) => forecast.playerId === activePlayerId) ? 1 : 0),
    0,
  ), 0);

  const games = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('en-US');
    let candidates = data.catalogGames.filter((game) => {
      const state = stateByAppId.get(game.appId);
      const predictionCount = state?.markets.reduce((sum, market) => sum + market.predictionCount, 0) ?? 0;
      if (normalizedQuery) return game.name.toLocaleLowerCase('en-US').includes(normalizedQuery);
      if (mode === 'upcoming') return data.popularAppIds.includes(game.appId) && !state?.locked && !state?.completed;
      if (mode === 'locked') return state?.locked && !state.completed;
      if (mode === 'completed') return state?.completed;
      if (mode === 'involved') {
        const hasPlayerForecast = state?.markets.some((market) => market.forecasts.some((forecast) => forecast.playerId === activePlayerId));
        if (!hasPlayerForecast) return false;
        return forecastStatus === 'resolved'
          ? state?.markets.some((market) => market.status === 'resolved')
          : state?.markets.some((market) => market.status !== 'resolved' && market.status !== 'void');
      }
      return !state?.locked && !state?.completed
        && game.lifecycleStatus === 'upcoming'
        && (predictionCount > 0 || data.trendingAppIds.includes(game.appId));
    });
    if (!normalizedQuery && mode === 'upcoming') {
      const order = new Map(data.popularAppIds.map((appId, index) => [appId, index]));
      candidates = candidates.sort((left, right) => (order.get(left.appId) ?? 9999) - (order.get(right.appId) ?? 9999));
    }
    if (!normalizedQuery && mode === 'trending') {
      const baselineOrder = new Map(data.trendingAppIds.map((appId, index) => [appId, index]));
      candidates = candidates.sort((left, right) => {
        const leftCount = stateByAppId.get(left.appId)?.markets.reduce((sum, market) => sum + market.predictionCount, 0) ?? 0;
        const rightCount = stateByAppId.get(right.appId)?.markets.reduce((sum, market) => sum + market.predictionCount, 0) ?? 0;
        return rightCount - leftCount
          || (baselineOrder.get(left.appId) ?? Number.MAX_SAFE_INTEGER) - (baselineOrder.get(right.appId) ?? Number.MAX_SAFE_INTEGER);
      });
    }
    return candidates.map((game) => mergeGameState(game, stateByAppId.get(game.appId), activePlayerId));
  }, [activePlayerId, data.catalogGames, data.popularAppIds, data.trendingAppIds, forecastStatus, mode, query, stateByAppId]);

  return (
    <div className="sb-staging-app">
      {isPending ? <div className="sb-staging-progress" aria-label="Updating staging data" /> : null}
      <div className="sb-staging-badge">STAGING · GAME MASTER</div>
      <header className="sb-header">
        <a className="sb-skip-link" href="#main-content">Skip to games</a>
        <div className="sb-shell sb-header__inner">
          <Brand href="/internal/game-master" />
          <StagingSearch query={query} onChange={setQuery} />
          <div className="sb-header-stats" aria-label="Artificial player stats">
            <span><strong>Bets</strong><b>{activeBetCount}</b></span>
            <span><strong>Points</strong><b>{pointNumber.format(activeLeaderboard?.points ?? 0)}</b></span>
          </div>
          <PlayerMenu
            activePlayerId={activePlayerId}
            disabled={isPending}
            players={data.players}
            onSelect={setActivePlayerId}
            onAdd={(displayName) => command({ action: 'add_player', displayName }, `${displayName} added.`)}
            onDelete={(playerId) => command({ action: 'delete_player', playerId }, 'Artificial player deleted.', playerId === activePlayerId ? null : activePlayerId)}
          />
        </div>
        <nav className="sb-categories" aria-label="Staging game list">
          <div className="sb-shell sb-categories__inner">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button className={mode === id ? 'is-active' : undefined} key={id} type="button" onClick={() => { setMode(id); setQuery(''); if (id === 'involved') setForecastStatus('open'); }}>
                <Icon size={21} strokeWidth={1.8} aria-hidden="true" />{label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <div className="sb-shell sb-page sb-staging-page">
        {error ? <div className="sb-staging-toast is-error" role="alert">{error}<button type="button" onClick={() => setError(null)}><X size={15} /></button></div> : null}
        {notice ? <div className="sb-staging-toast is-success" role="status">{notice}<button type="button" onClick={() => setNotice(null)}><X size={15} /></button></div> : null}
        <div className="sb-page-grid">
          <main className="sb-feed-column" id="main-content">
            <h1 className="sr-only">NextHit Market staging</h1>
            {mode === 'involved' ? (
              <nav className="sb-forecast-status-tabs" aria-label="Forecast status">
                <button className={forecastStatus === 'open' ? 'is-active' : undefined} type="button" onClick={() => setForecastStatus('open')}>Open</button>
                <button className={forecastStatus === 'resolved' ? 'is-active' : undefined} type="button" onClick={() => setForecastStatus('resolved')}>Resolved</button>
              </nav>
            ) : null}
            {games.length ? (
              <div className="sb-game-list">
                {games.map((game, index) => (
                  <StagingGameCard
                    activePlayerId={activePlayerId}
                    disabled={isPending}
                    game={game}
                    key={game.appId}
                    onCommand={command}
                    players={data.players}
                    priority={index === 0}
                  />
                ))}
              </div>
            ) : (
              <div className="sb-empty">
                <h1>{query ? 'No games found' : mode === 'locked' ? 'No locked games yet' : mode === 'completed' ? 'No completed games yet' : mode === 'involved' ? 'No forecasts here' : 'No games yet'}</h1>
                <p>{mode === 'locked' ? 'Released games with unresolved markets appear here.' : mode === 'completed' ? 'Resolve every market to move a game here.' : 'Use the game manipulation controls to populate staging.'}</p>
              </div>
            )}
          </main>
          <StagingLeaderboard activePlayerId={activePlayerId} data={data} />
        </div>
      </div>
    </div>
  );
}
