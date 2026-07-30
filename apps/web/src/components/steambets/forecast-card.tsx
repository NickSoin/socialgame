'use client';

import { useRef, useState } from 'react';
import { useAction } from 'next-safe-action/hooks';
import { placeSteamBetAction } from '@/data/actions/gamecast-actions';
import type {
  SteamBetTarget,
  SteamUpcomingGame,
} from '@/lib/steam-bets';

type ForecastFieldMode = 'idle' | 'editing' | 'committed';

function ForecastField({
  appId,
  gameName,
  target,
  isAuthenticated,
}: {
  appId: number;
  gameName: string;
  target: SteamBetTarget;
  isAuthenticated: boolean;
}) {
  const [mode, setMode] = useState<ForecastFieldMode>(
    target.userValue === null ? 'idle' : 'committed',
  );
  const [draft, setDraft] = useState(
    target.userValue === null ? '' : String(target.userValue),
  );
  const [errorMessage, setErrorMessage] = useState('');
  const submittedValue = useRef<number | null>(target.userValue);
  const inputId = `steam-bet-${appId}-${target.key}`;

  const { execute, status } = useAction(placeSteamBetAction, {
    onExecute: () => setErrorMessage(''),
    onSuccess: () => {
      if (submittedValue.current === null) return;
      setDraft(String(submittedValue.current));
      setMode('committed');
    },
    onError: ({ error }) => {
      setErrorMessage(error.serverError ?? 'Try this prediction again.');
    },
  });

  const value = Number(draft);
  const isValid =
    draft.trim() !== '' &&
    Number.isFinite(value) &&
    value >= target.min &&
    value <= target.max;

  return (
    <form
      className={`sb-forecast-field is-${mode}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (!isAuthenticated || mode !== 'editing' || !isValid || status === 'executing') return;
        submittedValue.current = value;
        execute({ steamAppId: appId, targetKey: target.key, value });
      }}
    >
      <label htmlFor={inputId}>{target.label}</label>
      <div className="sb-forecast-input">
        <input
          id={inputId}
          aria-label={`${target.label} for ${gameName}`}
          aria-readonly={mode === 'committed'}
          autoComplete="off"
          disabled={!isAuthenticated}
          inputMode="decimal"
          max={target.max}
          min={target.min}
          name={`${appId}-${target.key}`}
          readOnly={mode === 'committed'}
          step={target.step}
          type="number"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={() => {
            if (mode === 'idle' && isAuthenticated) setMode('editing');
          }}
        />
      </div>
      {mode === 'editing' && (
        <button
          className="sb-make-bet"
          disabled={!isValid || status === 'executing'}
          type="submit"
        >
          {status === 'executing' ? 'Saving…' : 'Make bet'}
        </button>
      )}
      {errorMessage && (
        <p className="sb-forecast-error" aria-live="polite">{errorMessage}</p>
      )}
    </form>
  );
}

export function ForecastCard({
  game,
  isAuthenticated,
  priority = false,
}: {
  game: SteamUpcomingGame;
  isAuthenticated: boolean;
  priority?: boolean;
}) {
  return (
    <article className="sb-game-card">
      <div className="sb-game-card__image">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={`${game.name} artwork`}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          height={174}
          loading={priority ? 'eager' : 'lazy'}
          src={game.imageUrl}
          width={460}
        />
      </div>
      <header className="sb-game-card__header">
        <h2>{game.name}</h2>
        <time dateTime={game.releaseDate}>{game.releaseLabel}</time>
      </header>
      <div className="sb-game-card__targets">
        {game.targets.map((target) => (
          <ForecastField
            appId={game.appId}
            gameName={game.name}
            isAuthenticated={isAuthenticated}
            key={target.key}
            target={target}
          />
        ))}
      </div>
    </article>
  );
}
