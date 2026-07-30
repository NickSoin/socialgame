"use client";

import { useRef, useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { placeSteamBetAction } from "@/data/actions/gamecast-actions";
import type { SteamBetTarget, SteamUpcomingGame } from "@/lib/steam-bets";
import { parseSteamBetDraft, sanitizeSteamBetDraft } from "@/lib/steam-bets";
import { GameHero } from "./game-hero";

type ForecastFieldMode = "idle" | "editing" | "committed";

const compactNumber = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  notation: "compact",
});
function formatAverage(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1000) return compactNumber.format(value);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

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
    target.userValue === null ? "idle" : "committed",
  );
  const [draft, setDraft] = useState(target.userValue === null ? "" : String(target.userValue));
  const [errorMessage, setErrorMessage] = useState("");
  const submittedValue = useRef<string | null>(
    target.userValue === null ? null : String(target.userValue),
  );
  const inputId = `steam-bet-${appId}-${target.key}`;

  const { execute, status } = useAction(placeSteamBetAction, {
    onExecute: () => setErrorMessage(""),
    onSuccess: () => {
      if (submittedValue.current === null) return;
      setDraft(String(submittedValue.current));
      setMode("committed");
    },
    onError: ({ error }) => {
      setErrorMessage(error.serverError ?? "Try this prediction again.");
    },
  });

  const value = parseSteamBetDraft(target.key, draft);
  const isValid = value !== null;

  return (
    <form
      className={`sb-forecast-field is-${mode}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (!isAuthenticated || mode !== "editing" || !isValid || status === "executing") return;
        submittedValue.current = draft;
        execute({ steamAppId: appId, targetKey: target.key, value: draft });
      }}
    >
      <label htmlFor={inputId}>{target.label}</label>
      <div className="sb-forecast-field__body">
        <div className="sb-forecast-input">
          <input
            id={inputId}
            aria-label={`${target.label} for ${gameName}`}
            aria-readonly={mode === "committed"}
            autoComplete="off"
            disabled={!isAuthenticated}
            inputMode={target.step === 1 ? "numeric" : "decimal"}
            maxLength={target.maxLength}
            name={`${appId}-${target.key}`}
            pattern={target.step === 1 ? "[0-9]*" : "[0-9]+([.][0-9]+)?"}
            readOnly={mode === "committed"}
            type="text"
            value={draft}
            onChange={(event) => {
              setDraft(sanitizeSteamBetDraft(target.key, event.target.value));
            }}
            onFocus={() => {
              if (mode === "idle" && isAuthenticated) setMode("editing");
            }}
          />
        </div>
        <div className="sb-forecast-stats" aria-label={`${target.label} market stats`}>
          <span>{formatAverage(target.averageValue)} Avg.</span>
          <span>{compactNumber.format(target.predictionCount)} Vol.</span>
        </div>
      </div>
      {mode === "editing" && (
        <button
          className="sb-bet-approve"
          disabled={!isValid || status === "executing"}
          type="submit"
        >
          {status === "executing" ? "Saving…" : "Approve"}
        </button>
      )}
      {errorMessage && (
        <p className="sb-forecast-error" aria-live="polite">
          {errorMessage}
        </p>
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
      <GameHero
        appId={game.appId}
        name={game.name}
        priority={priority}
        wishlistRank={game.wishlistRank}
      />
      <div className="sb-game-card__content">
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
      </div>
    </article>
  );
}
