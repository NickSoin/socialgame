"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useAction } from "next-safe-action/hooks";
import { Line, LineChart } from "recharts";
import { placeSteamBetAction } from "@/data/actions/gamecast-actions";
import type { SteamBetTarget, SteamUpcomingGame } from "@/lib/steam-bets";
import { parseSteamBetDraft, sanitizeSteamBetDraft } from "@/lib/steam-bets";
import { GameHero } from "./game-hero";

type ForecastTileMode = "idle" | "editing" | "committed";

const wholeNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimalNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const compactNumber = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  notation: "compact",
});

function formatForecastValue(target: SteamBetTarget, value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  if (target.key === "full_price_us") return `$${decimalNumber.format(value)}`;
  if (target.key === "launch_discount") return `${wholeNumber.format(value)}%`;
  return Math.abs(value) >= 1_000_000 ? compactNumber.format(value) : wholeNumber.format(value);
}

function formatExecutionTime(value: string | null, fallback: string) {
  const resolvedValue = value ?? fallback;
  const date = new Date(resolvedValue);
  if (Number.isNaN(date.valueOf())) return "TBA";
  const pair = (part: number) => String(part).padStart(2, "0");
  return `${pair(date.getUTCHours())}:${pair(date.getUTCMinutes())} ${pair(date.getUTCDate())}/${pair(date.getUTCMonth() + 1)}/${String(date.getUTCFullYear()).slice(-2)}`;
}

function AverageSparkline({
  chartId,
  target,
}: {
  chartId: string;
  target: SteamBetTarget;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(180);
  const [mounted, setMounted] = useState(false);
  const data = useMemo(() => {
    const values = target.averageHistory
      .filter((point) => Number.isFinite(point.averageValue))
      .map((point) => point.averageValue);
    if (target.averageValue !== null && Number.isFinite(target.averageValue)) {
      values.push(target.averageValue);
    }
    if (!values.length) return [];
    if (values.length === 1) values.unshift(values[0]!);
    return values.map((average, index) => ({ index, average }));
  }, [target.averageHistory, target.averageValue]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const sync = () => setChartWidth(Math.max(80, Math.floor(element.getBoundingClientRect().width)));
    sync();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(sync);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      aria-label={`${target.label} average forecast trend`}
      className="sb-average-sparkline"
      ref={containerRef}
      role="img"
    >
      {data.length && mounted ? (
          <LineChart data={data} height={65} margin={{ top: 4, right: 2, bottom: 4, left: 2 }} width={chartWidth}>
            <Line
              dataKey="average"
              dot={false}
              id={chartId}
              isAnimationActive={false}
              stroke="#73cf9a"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              type="linear"
            />
          </LineChart>
      ) : data.length ? (
        <span aria-hidden="true" className="sb-average-sparkline__placeholder" />
      ) : (
        <span>No average yet</span>
      )}
    </div>
  );
}

function ForecastTile({
  appId,
  gameIsOpen,
  gameName,
  releaseDate,
  target,
  isAuthenticated,
}: {
  appId: number;
  gameIsOpen: boolean;
  gameName: string;
  releaseDate: string;
  target: SteamBetTarget;
  isAuthenticated: boolean;
}) {
  const [mode, setMode] = useState<ForecastTileMode>(
    target.userValue === null ? "idle" : "committed",
  );
  const [draft, setDraft] = useState(target.userValue === null ? "" : String(target.userValue));
  const [savedDraft, setSavedDraft] = useState(
    target.userValue === null ? "" : String(target.userValue),
  );
  const [errorMessage, setErrorMessage] = useState("");
  const submittedValue = useRef<string | null>(
    target.userValue === null ? null : String(target.userValue),
  );
  const inputId = `steam-bet-${appId}-${target.key}`;

  const { execute, status } = useAction(placeSteamBetAction, {
    onExecute: () => setErrorMessage(""),
    onSuccess: () => {
      if (submittedValue.current === null) return;
      setDraft(submittedValue.current);
      setSavedDraft(submittedValue.current);
      setMode("committed");
    },
    onError: ({ error }) => {
      setErrorMessage(error.serverError ?? "Try this forecast again.");
    },
  });

  const parsedDraft = parseSteamBetDraft(target.key, draft);
  const savedValue = parseSteamBetDraft(target.key, savedDraft);
  const isLocked = !gameIsOpen || target.marketStatus !== "open";
  const isEditing = mode === "editing" && !isLocked;
  const executionDateTime = target.lockAt ?? (releaseDate === "TBA" ? null : releaseDate);

  const cancelEditing = () => {
    submittedValue.current = savedDraft === "" ? null : savedDraft;
    setDraft(savedDraft);
    setErrorMessage("");
    setMode(savedDraft === "" ? "idle" : "committed");
  };

  return (
    <form
      className={`sb-forecast-tile is-${isLocked ? "locked" : mode}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (!isAuthenticated || isLocked || !isEditing || parsedDraft === null || status === "executing") return;
        submittedValue.current = draft;
        execute({ steamAppId: appId, targetKey: target.key, value: draft });
      }}
    >
      <header className="sb-forecast-tile__header">
        <h3>{target.label}</h3>
        <time dateTime={executionDateTime ?? undefined}>
          {formatExecutionTime(target.lockAt, releaseDate)}
        </time>
      </header>

      <div className="sb-forecast-tile__body">
        <AverageSparkline chartId={`steam-average-${appId}-${target.key}`} target={target} />
        <div className="sb-forecast-tile__stats" aria-label={`${target.label} market stats`}>
          <strong>{formatForecastValue(target, target.averageValue)}</strong>
          <span>{compactNumber.format(target.predictionCount)} forecasts</span>
        </div>
        <div className="sb-forecast-tile__action">
          {isLocked ? (
            <span className="sb-forecast-control is-locked">Locked</span>
          ) : isEditing ? (
            <div className="sb-forecast-editor">
              <label className="sr-only" htmlFor={inputId}>
                {target.label} for {gameName}
              </label>
              <input
                id={inputId}
                aria-label={`${target.label} for ${gameName}`}
                autoComplete="off"
                autoFocus
                disabled={!isAuthenticated || status === "executing"}
                inputMode={target.step === 1 ? "numeric" : "decimal"}
                maxLength={target.maxLength}
                name={`${appId}-${target.key}`}
                pattern={target.step === 1 ? "[0-9]*" : "[0-9]+([.][0-9]+)?"}
                type="text"
                value={draft}
                onChange={(event) => setDraft(sanitizeSteamBetDraft(target.key, event.target.value))}
                onKeyDown={(event) => {
                  if (event.key === "Escape") cancelEditing();
                }}
              />
              <button
                aria-label={`Confirm ${target.label} forecast`}
                disabled={parsedDraft === null || status === "executing"}
                title="Save forecast"
                type="submit"
              >
                <CheckIcon aria-hidden="true" />
              </button>
              <button
                aria-label={`Cancel ${target.label} forecast`}
                disabled={status === "executing"}
                title="Cancel"
                type="button"
                onClick={cancelEditing}
              >
                <XMarkIcon aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              aria-label={savedValue === null
                ? `Forecast ${target.label} for ${gameName}`
                : `Edit ${target.label} forecast for ${gameName}`}
              className={`sb-forecast-control ${savedValue === null ? "is-empty" : "is-saved"}`}
              disabled={!isAuthenticated}
              type="button"
              onClick={() => setMode("editing")}
            >
              {savedValue === null ? "Forecast" : formatForecastValue(target, savedValue)}
            </button>
          )}
        </div>
      </div>

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
  const [expanded, setExpanded] = useState(false);
  const primaryTargets = game.targets.slice(0, 2);
  const additionalTargets = game.targets.slice(2);
  const panelId = `steam-forecast-panel-${game.appId}`;
  const tileProps = {
    appId: game.appId,
    gameIsOpen: game.lifecycleStatus === "upcoming",
    gameName: game.name,
    isAuthenticated,
    releaseDate: game.releaseDate,
  };

  return (
    <article
      className={`sb-game-card${expanded ? " is-expanded" : ""}`}
      onMouseEnter={() => setPreviewActive(true)}
      onMouseLeave={() => setPreviewActive(false)}
    >
      <div className="sb-game-card__top">
        <a
          aria-label={`Open ${game.name} on Steam`}
          className="sb-game-card__steam-link"
          href={`https://store.steampowered.com/app/${game.appId}/`}
          rel="noreferrer"
          target="_blank"
        />
        <GameHero
          appId={game.appId}
          imageUrl={game.imageUrl}
          name={game.name}
          previewUrls={game.previewUrls}
          previewActive={previewActive}
          priority={priority}
          wishlistRank={game.wishlistRank}
          wishlistRankUpdatedAt={game.wishlistRankUpdatedAt}
          followerCount={game.followerCount}
          followersUpdatedAt={game.followersUpdatedAt}
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
          <div className="sb-game-card__targets is-primary">
            {primaryTargets.map((target) => (
              <ForecastTile key={target.key} target={target} {...tileProps} />
            ))}
          </div>
        </div>
        {additionalTargets.length > 0 && (
          <button
            aria-controls={panelId}
            aria-expanded={expanded}
            aria-label={`${expanded ? "Collapse" : "Expand"} all forecasts for ${game.name}`}
            className="sb-game-card__expand"
            type="button"
            onClick={() => setExpanded((value) => !value)}
          >
            <ChevronDownIcon aria-hidden="true" />
          </button>
        )}
      </div>

      {expanded && (
        <div className="sb-game-card__expanded-panel" id={panelId}>
          {additionalTargets.map((target) => (
            <ForecastTile key={target.key} target={target} {...tileProps} />
          ))}
        </div>
      )}
    </article>
  );
}
