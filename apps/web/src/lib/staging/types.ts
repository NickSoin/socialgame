export const STAGING_METRICS = [
  'first_weekend_ccu',
  'first_month_reviews',
  'full_price_us',
] as const;

export type StagingMetric = (typeof STAGING_METRICS)[number];
export type StagingRole = 'user' | 'game_designer' | 'root';
export type SimulationStatus = 'draft' | 'running' | 'paused' | 'archived';
export type SimulationMarketStatus = 'open' | 'locked' | 'resolved' | 'void';
export type BotBehavior = 'follower' | 'contrarian' | 'expert' | 'late' | 'random' | 'outlier';

export type SimulationPreset = {
  key: string;
  name: string;
  description: string;
  players: number;
  games: Array<{
    name: string;
    releaseOffsetDays: number;
    values: Record<StagingMetric, number>;
  }>;
  behaviorWeights?: Partial<Record<BotBehavior, number>>;
  sparsity?: number;
  editRate?: number;
};

export type StagingPrincipal = {
  userId: string;
  email: string;
  role: StagingRole;
  isRoot: boolean;
};

export type SimulationCommand =
  | { action: 'create'; name: string; presetKey: string; seed?: number }
  | { action: 'create_blank'; name: string; description?: string; startAt?: string; seed?: number }
  | { action: 'run' | 'pause' | 'archive' | 'checkpoint' | 'clone'; simulationId: string }
  | { action: 'reset'; simulationId: string; checkpointId?: string }
  | { action: 'clone_checkpoint'; simulationId: string; checkpointId: string }
  | { action: 'set_time'; simulationId: string; at: string }
  | { action: 'advance_to_lock' | 'advance_to_resolution'; simulationId: string }
  | { action: 'advance'; simulationId: string; seconds: number }
  | { action: 'next_event'; simulationId: string }
  | { action: 'generate_players'; simulationId: string; count: number; prefix?: string; behavior?: BotBehavior; skillMin?: number; skillMax?: number; seed?: number; avatarMode?: string }
  | { action: 'generate_forecasts'; simulationId: string; density?: number; marketId?: string; distribution?: 'around_actual' | 'around_consensus' | 'fixed' | 'uniform' | 'normal' | 'log_normal'; center?: number; spread?: number; minimum?: number; maximum?: number; timing?: 'opening' | 'uniform' | 'early' | 'late' | 'specific' | 'event'; scheduledAt?: string }
  | { action: 'snapshot'; simulationId: string; at?: string }
  | { action: 'snapshot_batch'; simulationId: string; until: string }
  | { action: 'delete_latest_snapshot'; simulationId: string; marketId?: string }
  | { action: 'rebuild_snapshots'; simulationId: string }
  | { action: 'create_game'; simulationId: string; name: string; releaseAt?: string; scenarioValues: Record<StagingMetric, number>; createMarkets?: boolean }
  | { action: 'clone_catalog_game'; simulationId: string; steamAppId: number; scenarioValues: Record<StagingMetric, number> }
  | { action: 'update_game'; simulationId: string; gameId: string; name?: string; releaseAt?: string }
  | { action: 'create_market'; simulationId: string; gameId: string; metricType: StagingMetric; lockAt?: string; resolveAfter?: string }
  | { action: 'submit_forecast'; simulationId: string; marketId: string; playerId: string; rawValue: number; at?: string }
  | { action: 'delete_forecast'; simulationId: string; forecastId: string }
  | { action: 'reset_player' | 'disable_player'; simulationId: string; playerId: string }
  | { action: 'lock' | 'unlock' | 'open_market' | 'reset_market' | 'delete_market' | 'reset_scores'; simulationId: string; marketId: string }
  | { action: 'signal'; simulationId: string; label: string; description?: string; marketId?: string; targetValue?: number; value?: number; strength?: number; affectedBehaviors?: BotBehavior[] }
  | { action: 'resolve' | 'correct'; simulationId: string; marketId: string; actualValue: number; note?: string }
  | { action: 'void'; simulationId: string; marketId: string; reason: string }
  | { action: 'impersonate'; simulationId: string; playerId: string }
  | { action: 'end_impersonate'; simulationId: string; playerId: string }
  | { action: 'import'; payload: unknown };

export type StagingWorkspaceCommand =
  | { action: 'add_player'; simulationId: string; displayName: string }
  | { action: 'delete_player'; simulationId: string; playerId: string }
  | {
      action: 'place_forecast';
      simulationId: string;
      steamAppId: number;
      playerId: string;
      metricType: StagingMetric;
      rawValue: number;
    }
  | {
      action: 'batch_forecasts';
      simulationId: string;
      steamAppId: number;
      metricType: StagingMetric;
      count: number;
      minimum: number;
      maximum: number;
    }
  | {
      action: 'resolve_game';
      simulationId: string;
      steamAppId: number;
      actualValues: Record<StagingMetric, number>;
    };
