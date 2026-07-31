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
  const [savedDraft, setSavedDraft] = useState(
    target.userValue === null ? "" : String(target.userValue),
  );
  const [savedPercentile, setSavedPercentile] = useState(target.userPercentile);
  const [errorMessage, setErrorMessage] = useState("");
  const submittedValue = useRef<string | null>(
    target.userValue === null ? null : String(target.userValue),
  );
  const inputId = `steam-bet-${appId}-${target.key}`;

  const { execute, status } = useAction(placeSteamBetAction, {
    onExecute: () => setErrorMessage(""),
    onSuccess: ({ data }) => {
      if (submittedValue.current === null) return;
      setDraft(String(submittedValue.current));
      setSavedDraft(String(submittedValue.current));
      setSavedPercentile(data?.percentile_value === undefined ? null : Number(data.percentile_value));
      setMode("committed");
    },
    onError: ({ error }) => {
      setErrorMessage(error.serverError ?? "Try this prediction again.");
    },
  });

  const value = parseSteamBetDraft(target.key, draft);
  const isValid = value !== null;
  const canEdit = target.marketStatus === "open";
  const hasSavedValue = savedDraft !== "";

  return (
    <form
      className={`sb-forecast-field is-${mode}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (!isAuthenticated || !canEdit || mode !== "editing" || !isValid || status === "executing") return;
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
            aria-readonly={mode === "committed" || !canEdit}
            autoComplete="off"
            disabled={!isAuthenticated || !canEdit}
            inputMode={target.step === 1 ? "numeric" : "decimal"}
            maxLength={target.maxLength}
            name={`${appId}-${target.key}`}
            pattern={target.step === 1 ? "[0-9]*" : "[0-9]+([.][0-9]+)?"}
            readOnly={mode === "committed" || !canEdit}
            type="text"
            value={draft}
            onChange={(event) => {
              setDraft(sanitizeSteamBetDraft(target.key, event.target.value));
            }}
            onFocus={() => {
              if (mode !== "editing" && isAuthenticated && canEdit) setMode("editing");
            }}
          />
        </div>
        <div className="sb-forecast-stats" aria-label={`${target.label} market stats`}>
          <span>{formatAverage(target.averageValue)} Avg.</span>
          <span>{compactNumber.format(target.predictionCount)} Vol.</span>
        </div>
      </div>
      {hasSavedValue && target.marketStatus === "open" && savedPercentile !== null && (
        <p className="sb-forecast-result">P{Math.round(savedPercentile)} percentile</p>
      )}
      {target.marketStatus === "locked" && (
        <p className="sb-forecast-result">Locked{savedPercentile === null ? "" : ` · P${Math.round(savedPercentile)}`}</p>
      )}
      {target.marketStatus === "resolved" && (
        <p
          className="sb-forecast-result is-resolved"
          title={`Across ${target.scoredDays} scored day${target.scoredDays === 1 ? "" : "s"}: distance of the other players' average from the result, minus your distance from the result.`}
        >
          Actual {formatAverage(target.actualValue)} · {target.points >= 0 ? "+" : ""}{target.points.toFixed(1)} pts
        </p>
      )}
      {target.marketStatus === "void" && <p className="sb-forecast-result">Void</p>}
      {mode === "editing" && (
        <div className="sb-bet-actions">
          <button
            aria-label={`Confirm ${target.label} prediction`}
            className="sb-bet-action is-confirm"
            disabled={!isValid || status === "executing"}
            title="Confirm prediction"
            type="submit"
          >
            ✓
          </button>
          <button
            aria-label={`Cancel ${target.label} prediction`}
            className="sb-bet-action is-cancel"
            disabled={status === "executing"}
            title="Cancel"
            type="button"
            onClick={() => {
              submittedValue.current = savedDraft === "" ? null : savedDraft;
              setDraft(savedDraft);
              setErrorMessage("");
              setMode(savedDraft === "" ? "idle" : "committed");
            }}
          >
            ×
          </button>
        </div>
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
  const [previewActive, setPreviewActive] = useState(false);

  return (
    <article
      className="sb-game-card"
      onMouseEnter={() => setPreviewActive(true)}
      onMouseLeave={() => setPreviewActive(false)}
    >
      <a
        aria-label={`Open ${game.name} on Steam`}
        className="sb-game-card__steam-link"
        href={`https://store.steampowered.com/app/${game.appId}/`}
        rel="noreferrer"
        target="_blank"
      />
      <GameHero
        appId={game.appId}
        name={game.name}
        previewActive={previewActive}
        priority={priority}
        wishlistRank={game.wishlistRank}
      />
      <div className="sb-game-card__content">
        <header className="sb-game-card__header">
          <div className="sb-game-card__title">
            <div className="sb-game-card__name">
              <h2>{game.name}</h2>
            </div>
            {game.tags.length > 0 && <p className="sb-game-card__tags">{game.tags.join(" · ")}</p>}
          </div>
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
