-- =============================================================================
-- NextHit Market staging-only role administration and gameplay simulation
--
-- This file is composed only by apps/staging-database. It must never be linked
-- or pushed from apps/database, which owns the production Supabase project.
-- =============================================================================

CREATE TYPE public.staging_user_role AS ENUM ('user', 'game_designer');
CREATE TYPE public.staging_assignment_status AS ENUM ('pending', 'claimed', 'revoked');
CREATE TYPE public.simulation_status AS ENUM ('draft', 'running', 'paused', 'archived');
CREATE TYPE public.simulation_market_status AS ENUM ('open', 'locked', 'resolved', 'void');

-- =============================================================================
-- Staging roles and immutable audit trail
-- =============================================================================

CREATE TABLE public.staging_user_roles (
  -- User IDs come from the shared production Auth project. They intentionally
  -- cannot reference this isolated staging project's auth.users table.
  user_id uuid PRIMARY KEY,
  role public.staging_user_role NOT NULL DEFAULT 'user',
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.staging_pending_role_assignments (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  email text NOT NULL,
  role public.staging_user_role NOT NULL,
  status public.staging_assignment_status NOT NULL DEFAULT 'pending',
  requested_by uuid,
  requested_at timestamptz NOT NULL DEFAULT now(),
  claimed_by uuid,
  claimed_at timestamptz,
  revoked_by uuid,
  revoked_at timestamptz,
  CONSTRAINT staging_pending_email_normalized_check CHECK (
    email = lower(btrim(email)) AND email ~ '^[^@[:space:]]+@[^@[:space:]]+$'
  ),
  CONSTRAINT staging_pending_role_check CHECK (role = 'game_designer'),
  CONSTRAINT staging_pending_state_check CHECK (
    (status = 'pending' AND claimed_by IS NULL AND claimed_at IS NULL AND revoked_by IS NULL AND revoked_at IS NULL)
    OR (status = 'claimed' AND claimed_by IS NOT NULL AND claimed_at IS NOT NULL AND revoked_by IS NULL AND revoked_at IS NULL)
    OR (status = 'revoked' AND revoked_by IS NOT NULL AND revoked_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX staging_pending_role_assignment_active_email_idx
  ON public.staging_pending_role_assignments(email)
  WHERE status = 'pending';

CREATE TABLE public.staging_role_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id uuid,
  actor_email text,
  action text NOT NULL,
  target_user_id uuid,
  target_email text,
  previous_role public.staging_user_role,
  new_role public.staging_user_role,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staging_role_audit_action_check CHECK (
    action IN (
      'role_granted', 'role_revoked', 'assignment_created',
      'assignment_claimed', 'assignment_revoked', 'access_denied'
    )
  ),
  CONSTRAINT staging_role_audit_metadata_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX staging_role_audit_created_idx
  ON public.staging_role_audit_log(created_at DESC);

CREATE INDEX staging_role_audit_target_idx
  ON public.staging_role_audit_log(target_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION private.reject_staging_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'staging audit and event rows are append-only'
    USING ERRCODE = '42501';
END;
$$;

-- Compatibility shim for the bootstrap migration. Universal authentication is
-- synchronized by the application against the isolated staging tables, so the
-- auth.users trigger is intentionally absent from the desired schema.
CREATE OR REPLACE FUNCTION private.sync_staging_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION private.sync_staging_user_role() IS
  'Deprecated compatibility shim; staging roles are synchronized from universal Auth by the web application.';

CREATE TRIGGER staging_role_audit_append_only
  BEFORE UPDATE OR DELETE ON public.staging_role_audit_log
  FOR EACH ROW EXECUTE FUNCTION private.reject_staging_append_only_mutation();

CREATE TRIGGER staging_user_roles_set_updated_at
  BEFORE UPDATE ON public.staging_user_roles
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- =============================================================================
-- Simulation aggregate and clock
-- =============================================================================

CREATE TABLE public.simulations (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  preset_key text,
  status public.simulation_status NOT NULL DEFAULT 'draft',
  simulation_time timestamptz NOT NULL,
  started_at timestamptz,
  archived_at timestamptz,
  random_seed bigint NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT simulations_name_check CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  CONSTRAINT simulations_description_check CHECK (char_length(description) <= 1000),
  CONSTRAINT simulations_config_check CHECK (jsonb_typeof(config) = 'object'),
  CONSTRAINT simulations_status_dates_check CHECK (
    (status <> 'archived' OR archived_at IS NOT NULL)
  )
);

CREATE INDEX simulations_status_updated_idx ON public.simulations(status, updated_at DESC);

CREATE TRIGGER simulations_set_updated_at
  BEFORE UPDATE ON public.simulations
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TABLE public.simulation_games (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  simulation_id uuid NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
  steam_app_id bigint,
  name text NOT NULL,
  release_at timestamptz,
  hero_url text,
  tags text[] NOT NULL DEFAULT '{}',
  scenario_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT simulation_games_name_check CHECK (char_length(btrim(name)) BETWEEN 1 AND 160),
  CONSTRAINT simulation_games_tags_check CHECK (cardinality(tags) <= 10),
  CONSTRAINT simulation_games_values_check CHECK (jsonb_typeof(scenario_values) = 'object'),
  CONSTRAINT simulation_games_unique_name UNIQUE (simulation_id, name)
);

CREATE INDEX simulation_games_simulation_idx ON public.simulation_games(simulation_id, release_at);

CREATE TABLE public.simulation_markets (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  simulation_id uuid NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.simulation_games(id) ON DELETE CASCADE,
  metric_type text NOT NULL,
  status public.simulation_market_status NOT NULL DEFAULT 'open',
  lock_at timestamptz,
  resolve_after timestamptz,
  percentile_model_version integer NOT NULL DEFAULT 1,
  void_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT simulation_markets_metric_check CHECK (
    metric_type IN ('first_weekend_ccu', 'first_month_reviews', 'full_price_us')
  ),
  CONSTRAINT simulation_markets_void_check CHECK (
    (status = 'void' AND nullif(btrim(void_reason), '') IS NOT NULL) OR status <> 'void'
  ),
  CONSTRAINT simulation_markets_unique_metric UNIQUE (simulation_id, game_id, metric_type)
);

CREATE INDEX simulation_markets_simulation_status_idx
  ON public.simulation_markets(simulation_id, status, lock_at);

CREATE TRIGGER simulation_markets_set_updated_at
  BEFORE UPDATE ON public.simulation_markets
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TABLE public.simulation_players (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  simulation_id uuid NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
  username text NOT NULL,
  display_name text NOT NULL,
  behavior text NOT NULL DEFAULT 'random',
  skill numeric NOT NULL DEFAULT 0.5,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT simulation_players_username_check CHECK (
    username = lower(username) AND username ~ '^[a-z0-9_]{3,32}$'
  ),
  CONSTRAINT simulation_players_behavior_check CHECK (
    behavior IN ('follower', 'contrarian', 'expert', 'late', 'random', 'outlier')
  ),
  CONSTRAINT simulation_players_skill_check CHECK (skill BETWEEN 0 AND 1),
  CONSTRAINT simulation_players_metadata_check CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT simulation_players_unique_username UNIQUE (simulation_id, username)
);

CREATE INDEX simulation_players_simulation_idx ON public.simulation_players(simulation_id);

CREATE TABLE public.simulation_forecast_versions (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  simulation_id uuid NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
  market_id uuid NOT NULL REFERENCES public.simulation_markets(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.simulation_players(id) ON DELETE CASCADE,
  raw_value numeric NOT NULL,
  percentile_value numeric NOT NULL,
  valid_from timestamptz NOT NULL,
  valid_to timestamptz,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT simulation_forecasts_raw_check CHECK (raw_value >= 0),
  CONSTRAINT simulation_forecasts_percentile_check CHECK (percentile_value BETWEEN 0 AND 100),
  CONSTRAINT simulation_forecasts_validity_check CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE UNIQUE INDEX simulation_forecast_versions_active_idx
  ON public.simulation_forecast_versions(simulation_id, market_id, player_id)
  WHERE valid_to IS NULL;

CREATE INDEX simulation_forecast_versions_history_idx
  ON public.simulation_forecast_versions(simulation_id, market_id, player_id, valid_from DESC);

CREATE TABLE public.simulation_scheduled_forecasts (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  simulation_id uuid NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
  market_id uuid NOT NULL REFERENCES public.simulation_markets(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.simulation_players(id) ON DELETE CASCADE,
  raw_value numeric NOT NULL,
  percentile_value numeric NOT NULL,
  scheduled_at timestamptz NOT NULL,
  processed_at timestamptz,
  source text NOT NULL DEFAULT 'bot',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT simulation_scheduled_raw_check CHECK (raw_value >= 0),
  CONSTRAINT simulation_scheduled_percentile_check CHECK (percentile_value BETWEEN 0 AND 100),
  CONSTRAINT simulation_scheduled_unique_event UNIQUE (simulation_id, market_id, player_id, scheduled_at)
);

CREATE INDEX simulation_scheduled_due_idx
  ON public.simulation_scheduled_forecasts(simulation_id, scheduled_at)
  WHERE processed_at IS NULL;

CREATE TABLE public.simulation_snapshots (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  simulation_id uuid NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
  market_id uuid NOT NULL REFERENCES public.simulation_markets(id) ON DELETE CASCADE,
  snapshot_at timestamptz NOT NULL,
  eligible_prediction_count integer NOT NULL DEFAULT 0,
  crowd_percentile numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT simulation_snapshots_count_check CHECK (eligible_prediction_count >= 0),
  CONSTRAINT simulation_snapshots_percentile_check CHECK (
    crowd_percentile IS NULL OR crowd_percentile BETWEEN 0 AND 100
  ),
  CONSTRAINT simulation_snapshots_unique_time UNIQUE (simulation_id, market_id, snapshot_at)
);

CREATE INDEX simulation_snapshots_simulation_idx
  ON public.simulation_snapshots(simulation_id, snapshot_at DESC);

CREATE TABLE public.simulation_snapshot_predictions (
  simulation_id uuid NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
  snapshot_id uuid NOT NULL REFERENCES public.simulation_snapshots(id) ON DELETE CASCADE,
  forecast_version_id uuid NOT NULL REFERENCES public.simulation_forecast_versions(id) ON DELETE RESTRICT,
  player_id uuid NOT NULL REFERENCES public.simulation_players(id) ON DELETE CASCADE,
  raw_value numeric NOT NULL,
  percentile_value numeric NOT NULL,
  PRIMARY KEY (snapshot_id, player_id),
  CONSTRAINT simulation_snapshot_prediction_percentile_check CHECK (
    percentile_value BETWEEN 0 AND 100
  )
);

CREATE TABLE public.simulation_results (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  simulation_id uuid NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
  market_id uuid NOT NULL REFERENCES public.simulation_markets(id) ON DELETE CASCADE,
  result_version integer NOT NULL,
  actual_raw_value numeric NOT NULL,
  actual_percentile_value numeric NOT NULL,
  source_reference text NOT NULL,
  resolved_at timestamptz NOT NULL,
  correction_note text,
  is_current boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT simulation_results_raw_check CHECK (actual_raw_value >= 0),
  CONSTRAINT simulation_results_percentile_check CHECK (actual_percentile_value BETWEEN 0 AND 100),
  CONSTRAINT simulation_results_unique_version UNIQUE (simulation_id, market_id, result_version)
);

CREATE UNIQUE INDEX simulation_results_current_idx
  ON public.simulation_results(simulation_id, market_id)
  WHERE is_current = true;

CREATE TABLE public.simulation_score_runs (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  simulation_id uuid NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
  market_id uuid NOT NULL REFERENCES public.simulation_markets(id) ON DELETE CASCADE,
  result_id uuid NOT NULL REFERENCES public.simulation_results(id) ON DELETE RESTRICT,
  run_version integer NOT NULL,
  reason text NOT NULL,
  formula_key text NOT NULL DEFAULT 'canonical',
  is_current boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT simulation_score_runs_unique_version UNIQUE (
    simulation_id, market_id, formula_key, run_version
  )
);

CREATE UNIQUE INDEX simulation_score_runs_current_idx
  ON public.simulation_score_runs(simulation_id, market_id, formula_key)
  WHERE is_current = true;

CREATE TABLE public.simulation_score_entries (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  simulation_id uuid NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
  score_run_id uuid NOT NULL REFERENCES public.simulation_score_runs(id) ON DELETE CASCADE,
  market_id uuid NOT NULL REFERENCES public.simulation_markets(id) ON DELETE CASCADE,
  snapshot_id uuid NOT NULL REFERENCES public.simulation_snapshots(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.simulation_players(id) ON DELETE CASCADE,
  user_percentile numeric NOT NULL,
  crowd_without_user_percentile numeric NOT NULL,
  actual_percentile numeric NOT NULL,
  user_error numeric NOT NULL,
  crowd_error numeric NOT NULL,
  points numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT simulation_score_entries_percentiles_check CHECK (
    (user_percentile >= 0::numeric AND user_percentile <= 100::numeric)
    AND (crowd_without_user_percentile >= 0::numeric AND crowd_without_user_percentile <= 100::numeric)
    AND (actual_percentile >= 0::numeric AND actual_percentile <= 100::numeric)
  ),
  CONSTRAINT simulation_score_entries_unique_score UNIQUE (score_run_id, snapshot_id, player_id)
);

CREATE INDEX simulation_score_entries_player_idx
  ON public.simulation_score_entries(simulation_id, player_id, market_id);

CREATE TABLE public.simulation_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  simulation_id uuid NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_at timestamptz NOT NULL,
  actor_user_id uuid,
  player_id uuid,
  market_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT simulation_events_payload_check CHECK (jsonb_typeof(payload) = 'object')
);

CREATE INDEX simulation_events_timeline_idx
  ON public.simulation_events(simulation_id, event_at DESC, id DESC);

CREATE TRIGGER simulation_events_append_only
  BEFORE UPDATE OR DELETE ON public.simulation_events
  FOR EACH ROW EXECUTE FUNCTION private.reject_staging_append_only_mutation();

CREATE TABLE public.simulation_checkpoints (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  simulation_id uuid NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
  name text NOT NULL,
  simulation_time timestamptz NOT NULL,
  state jsonb NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT simulation_checkpoints_name_check CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  CONSTRAINT simulation_checkpoints_state_check CHECK (jsonb_typeof(state) = 'object')
);

CREATE INDEX simulation_checkpoints_simulation_idx
  ON public.simulation_checkpoints(simulation_id, created_at DESC);

-- The canonical points formula used by production scoring: improvement over
-- the leave-one-out crowd benchmark. Keeping this function in one place makes
-- score-inspector results independently testable.
CREATE OR REPLACE FUNCTION private.staging_canonical_points(
  p_user_percentile numeric,
  p_crowd_without_user_percentile numeric,
  p_actual_percentile numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT abs(p_actual_percentile - p_crowd_without_user_percentile)
       - abs(p_actual_percentile - p_user_percentile);
$$;

-- =============================================================================
-- Data API hardening. No simulation or role table is directly client-visible;
-- all access goes through authenticated, environment-guarded server routes.
-- =============================================================================

ALTER TABLE public.staging_user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staging_pending_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staging_role_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_forecast_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_scheduled_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_snapshot_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_score_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_score_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_checkpoints ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.staging_user_roles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.staging_pending_role_assignments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.staging_role_audit_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.simulations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.simulation_games FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.simulation_markets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.simulation_players FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.simulation_forecast_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.simulation_scheduled_forecasts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.simulation_snapshots FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.simulation_snapshot_predictions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.simulation_results FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.simulation_score_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.simulation_score_entries FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.simulation_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.simulation_checkpoints FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.staging_user_roles TO service_role;
GRANT ALL ON TABLE public.staging_pending_role_assignments TO service_role;
GRANT SELECT, INSERT ON TABLE public.staging_role_audit_log TO service_role;
GRANT ALL ON TABLE public.simulations TO service_role;
GRANT ALL ON TABLE public.simulation_games TO service_role;
GRANT ALL ON TABLE public.simulation_markets TO service_role;
GRANT ALL ON TABLE public.simulation_players TO service_role;
GRANT ALL ON TABLE public.simulation_forecast_versions TO service_role;
GRANT ALL ON TABLE public.simulation_scheduled_forecasts TO service_role;
GRANT ALL ON TABLE public.simulation_snapshots TO service_role;
GRANT ALL ON TABLE public.simulation_snapshot_predictions TO service_role;
GRANT ALL ON TABLE public.simulation_results TO service_role;
GRANT ALL ON TABLE public.simulation_score_runs TO service_role;
GRANT ALL ON TABLE public.simulation_score_entries TO service_role;
GRANT SELECT, INSERT ON TABLE public.simulation_events TO service_role;
GRANT ALL ON TABLE public.simulation_checkpoints TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

REVOKE ALL ON FUNCTION private.reject_staging_append_only_mutation() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.staging_canonical_points(numeric, numeric, numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.staging_canonical_points(numeric, numeric, numeric) TO service_role;
