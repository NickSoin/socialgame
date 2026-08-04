export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      coin_ledger: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          id: string
          market_id: string | null
          prediction_id: string | null
          reason: Database["public"]["Enums"]["coin_ledger_reason"]
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          id?: string
          market_id?: string | null
          prediction_id?: string | null
          reason: Database["public"]["Enums"]["coin_ledger_reason"]
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          market_id?: string | null
          prediction_id?: string | null
          reason?: Database["public"]["Enums"]["coin_ledger_reason"]
          user_id?: string
        }
        Relationships: []
      }
      forecast_targets: {
        Row: {
          closes_at: string
          created_at: string
          display_order: number
          id: string
          key: string
          label: string
          market_id: string
          max_value: number | null
          min_value: number
          resolved_at: string | null
          resolved_value: number | null
          status: Database["public"]["Enums"]["market_status"]
          step: number
          unit: string
          updated_at: string
        }
        Insert: {
          closes_at: string
          created_at?: string
          display_order?: number
          id?: string
          key: string
          label: string
          market_id: string
          max_value?: number | null
          min_value?: number
          resolved_at?: string | null
          resolved_value?: number | null
          status?: Database["public"]["Enums"]["market_status"]
          step?: number
          unit: string
          updated_at?: string
        }
        Update: {
          closes_at?: string
          created_at?: string
          display_order?: number
          id?: string
          key?: string
          label?: string
          market_id?: string
          max_value?: number | null
          min_value?: number
          resolved_at?: string | null
          resolved_value?: number | null
          status?: Database["public"]["Enums"]["market_status"]
          step?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forecast_targets_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      markets: {
        Row: {
          category: string
          closes_at: string
          created_at: string
          description: string
          header_image_url: string
          id: string
          question: string
          resolved_at: string | null
          resolved_outcome:
            | Database["public"]["Enums"]["prediction_outcome"]
            | null
          slug: string
          status: Database["public"]["Enums"]["market_status"]
          steam_app_id: number
          steam_title: string
          total_volume: number
          yes_price_bps: number
        }
        Insert: {
          category: string
          closes_at: string
          created_at?: string
          description: string
          header_image_url: string
          id?: string
          question: string
          resolved_at?: string | null
          resolved_outcome?:
            | Database["public"]["Enums"]["prediction_outcome"]
            | null
          slug: string
          status?: Database["public"]["Enums"]["market_status"]
          steam_app_id: number
          steam_title: string
          total_volume?: number
          yes_price_bps: number
        }
        Update: {
          category?: string
          closes_at?: string
          created_at?: string
          description?: string
          header_image_url?: string
          id?: string
          question?: string
          resolved_at?: string | null
          resolved_outcome?:
            | Database["public"]["Enums"]["prediction_outcome"]
            | null
          slug?: string
          status?: Database["public"]["Enums"]["market_status"]
          steam_app_id?: number
          steam_title?: string
          total_volume?: number
          yes_price_bps?: number
        }
        Relationships: []
      }
      numeric_predictions: {
        Row: {
          created_at: string
          id: string
          target_id: string
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          target_id: string
          updated_at?: string
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          target_id?: string
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "numeric_predictions_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "forecast_targets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "numeric_predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "numeric_predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          created_at: string
          id: string
          is_correct: boolean | null
          market_id: string
          outcome: Database["public"]["Enums"]["prediction_outcome"]
          payout: number
          price_bps: number
          resolved_at: string | null
          shares: number
          stake: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_correct?: boolean | null
          market_id: string
          outcome: Database["public"]["Enums"]["prediction_outcome"]
          payout?: number
          price_bps: number
          resolved_at?: string | null
          shares: number
          stake: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_correct?: boolean | null
          market_id?: string
          outcome?: Database["public"]["Enums"]["prediction_outcome"]
          payout?: number
          price_bps?: number
          resolved_at?: string | null
          shares?: number
          stake?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_id: Database["public"]["Enums"]["avatar_id"]
          bio: string
          coin_balance: number
          coins_wagered: number
          coins_won: number
          correct_predictions: number
          created_at: string
          display_name: string
          id: string
          links: Json
          predictions_made: number
          predictions_resolved: number
          updated_at: string
          username: string
        }
        Insert: {
          avatar_id?: Database["public"]["Enums"]["avatar_id"]
          bio?: string
          coin_balance?: number
          coins_wagered?: number
          coins_won?: number
          correct_predictions?: number
          created_at?: string
          display_name: string
          id: string
          links?: Json
          predictions_made?: number
          predictions_resolved?: number
          updated_at?: string
          username: string
        }
        Update: {
          avatar_id?: Database["public"]["Enums"]["avatar_id"]
          bio?: string
          coin_balance?: number
          coins_wagered?: number
          coins_won?: number
          correct_predictions?: number
          created_at?: string
          display_name?: string
          id?: string
          links?: Json
          predictions_made?: number
          predictions_resolved?: number
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      simulation_checkpoints: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          simulation_id: string
          simulation_time: string
          state: Json
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          simulation_id: string
          simulation_time: string
          state: Json
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          simulation_id?: string
          simulation_time?: string
          state?: Json
        }
        Relationships: [
          {
            foreignKeyName: "simulation_checkpoints_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_at: string
          event_type: string
          id: number
          market_id: string | null
          payload: Json
          player_id: string | null
          simulation_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_at: string
          event_type: string
          id?: never
          market_id?: string | null
          payload?: Json
          player_id?: string | null
          simulation_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_at?: string
          event_type?: string
          id?: never
          market_id?: string | null
          payload?: Json
          player_id?: string | null
          simulation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_events_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_forecast_versions: {
        Row: {
          created_at: string
          id: string
          market_id: string
          percentile_value: number
          player_id: string
          raw_value: number
          simulation_id: string
          source: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          market_id: string
          percentile_value: number
          player_id: string
          raw_value: number
          simulation_id: string
          source?: string
          valid_from: string
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          market_id?: string
          percentile_value?: number
          player_id?: string
          raw_value?: number
          simulation_id?: string
          source?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "simulation_forecast_versions_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "simulation_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_forecast_versions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "simulation_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_forecast_versions_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_games: {
        Row: {
          created_at: string
          hero_url: string | null
          id: string
          name: string
          release_at: string | null
          scenario_values: Json
          simulation_id: string
          steam_app_id: number | null
          tags: string[]
        }
        Insert: {
          created_at?: string
          hero_url?: string | null
          id?: string
          name: string
          release_at?: string | null
          scenario_values?: Json
          simulation_id: string
          steam_app_id?: number | null
          tags?: string[]
        }
        Update: {
          created_at?: string
          hero_url?: string | null
          id?: string
          name?: string
          release_at?: string | null
          scenario_values?: Json
          simulation_id?: string
          steam_app_id?: number | null
          tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "simulation_games_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_markets: {
        Row: {
          created_at: string
          game_id: string
          id: string
          lock_at: string | null
          metric_type: string
          percentile_model_version: number
          resolve_after: string | null
          simulation_id: string
          status: Database["public"]["Enums"]["simulation_market_status"]
          updated_at: string
          void_reason: string | null
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          lock_at?: string | null
          metric_type: string
          percentile_model_version?: number
          resolve_after?: string | null
          simulation_id: string
          status?: Database["public"]["Enums"]["simulation_market_status"]
          updated_at?: string
          void_reason?: string | null
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          lock_at?: string | null
          metric_type?: string
          percentile_model_version?: number
          resolve_after?: string | null
          simulation_id?: string
          status?: Database["public"]["Enums"]["simulation_market_status"]
          updated_at?: string
          void_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "simulation_markets_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "simulation_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_markets_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_players: {
        Row: {
          behavior: string
          created_at: string
          display_name: string
          id: string
          metadata: Json
          simulation_id: string
          skill: number
          username: string
        }
        Insert: {
          behavior?: string
          created_at?: string
          display_name: string
          id?: string
          metadata?: Json
          simulation_id: string
          skill?: number
          username: string
        }
        Update: {
          behavior?: string
          created_at?: string
          display_name?: string
          id?: string
          metadata?: Json
          simulation_id?: string
          skill?: number
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_players_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_results: {
        Row: {
          actual_percentile_value: number
          actual_raw_value: number
          correction_note: string | null
          created_at: string
          created_by: string
          id: string
          is_current: boolean
          market_id: string
          resolved_at: string
          result_version: number
          simulation_id: string
          source_reference: string
        }
        Insert: {
          actual_percentile_value: number
          actual_raw_value: number
          correction_note?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_current?: boolean
          market_id: string
          resolved_at: string
          result_version: number
          simulation_id: string
          source_reference: string
        }
        Update: {
          actual_percentile_value?: number
          actual_raw_value?: number
          correction_note?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_current?: boolean
          market_id?: string
          resolved_at?: string
          result_version?: number
          simulation_id?: string
          source_reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_results_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "simulation_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_results_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_scheduled_forecasts: {
        Row: {
          created_at: string
          id: string
          market_id: string
          percentile_value: number
          player_id: string
          processed_at: string | null
          raw_value: number
          scheduled_at: string
          simulation_id: string
          source: string
        }
        Insert: {
          created_at?: string
          id?: string
          market_id: string
          percentile_value: number
          player_id: string
          processed_at?: string | null
          raw_value: number
          scheduled_at: string
          simulation_id: string
          source?: string
        }
        Update: {
          created_at?: string
          id?: string
          market_id?: string
          percentile_value?: number
          player_id?: string
          processed_at?: string | null
          raw_value?: number
          scheduled_at?: string
          simulation_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_scheduled_forecasts_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "simulation_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_scheduled_forecasts_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "simulation_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_scheduled_forecasts_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_score_entries: {
        Row: {
          actual_percentile: number
          created_at: string
          crowd_error: number
          crowd_without_user_percentile: number
          id: string
          market_id: string
          player_id: string
          points: number
          score_run_id: string
          simulation_id: string
          snapshot_id: string
          user_error: number
          user_percentile: number
        }
        Insert: {
          actual_percentile: number
          created_at?: string
          crowd_error: number
          crowd_without_user_percentile: number
          id?: string
          market_id: string
          player_id: string
          points: number
          score_run_id: string
          simulation_id: string
          snapshot_id: string
          user_error: number
          user_percentile: number
        }
        Update: {
          actual_percentile?: number
          created_at?: string
          crowd_error?: number
          crowd_without_user_percentile?: number
          id?: string
          market_id?: string
          player_id?: string
          points?: number
          score_run_id?: string
          simulation_id?: string
          snapshot_id?: string
          user_error?: number
          user_percentile?: number
        }
        Relationships: [
          {
            foreignKeyName: "simulation_score_entries_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "simulation_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_score_entries_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "simulation_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_score_entries_score_run_id_fkey"
            columns: ["score_run_id"]
            isOneToOne: false
            referencedRelation: "simulation_score_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_score_entries_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_score_entries_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "simulation_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_score_runs: {
        Row: {
          created_at: string
          created_by: string
          formula_key: string
          id: string
          is_current: boolean
          market_id: string
          reason: string
          result_id: string
          run_version: number
          simulation_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          formula_key?: string
          id?: string
          is_current?: boolean
          market_id: string
          reason: string
          result_id: string
          run_version: number
          simulation_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          formula_key?: string
          id?: string
          is_current?: boolean
          market_id?: string
          reason?: string
          result_id?: string
          run_version?: number
          simulation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_score_runs_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "simulation_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_score_runs_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "simulation_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_score_runs_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_snapshot_predictions: {
        Row: {
          forecast_version_id: string
          percentile_value: number
          player_id: string
          raw_value: number
          simulation_id: string
          snapshot_id: string
        }
        Insert: {
          forecast_version_id: string
          percentile_value: number
          player_id: string
          raw_value: number
          simulation_id: string
          snapshot_id: string
        }
        Update: {
          forecast_version_id?: string
          percentile_value?: number
          player_id?: string
          raw_value?: number
          simulation_id?: string
          snapshot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_snapshot_predictions_forecast_version_id_fkey"
            columns: ["forecast_version_id"]
            isOneToOne: false
            referencedRelation: "simulation_forecast_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_snapshot_predictions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "simulation_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_snapshot_predictions_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_snapshot_predictions_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "simulation_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_snapshots: {
        Row: {
          created_at: string
          crowd_percentile: number | null
          eligible_prediction_count: number
          id: string
          market_id: string
          simulation_id: string
          snapshot_at: string
        }
        Insert: {
          created_at?: string
          crowd_percentile?: number | null
          eligible_prediction_count?: number
          id?: string
          market_id: string
          simulation_id: string
          snapshot_at: string
        }
        Update: {
          created_at?: string
          crowd_percentile?: number | null
          eligible_prediction_count?: number
          id?: string
          market_id?: string
          simulation_id?: string
          snapshot_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_snapshots_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "simulation_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_snapshots_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      simulations: {
        Row: {
          archived_at: string | null
          config: Json
          created_at: string
          created_by: string
          description: string
          id: string
          name: string
          preset_key: string | null
          random_seed: number
          simulation_time: string
          started_at: string | null
          status: Database["public"]["Enums"]["simulation_status"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          config?: Json
          created_at?: string
          created_by: string
          description?: string
          id?: string
          name: string
          preset_key?: string | null
          random_seed: number
          simulation_time: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["simulation_status"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          config?: Json
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          name?: string
          preset_key?: string | null
          random_seed?: number
          simulation_time?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["simulation_status"]
          updated_at?: string
        }
        Relationships: []
      }
      staging_pending_role_assignments: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          email: string
          id: string
          requested_at: string
          requested_by: string | null
          revoked_at: string | null
          revoked_by: string | null
          role: Database["public"]["Enums"]["staging_user_role"]
          status: Database["public"]["Enums"]["staging_assignment_status"]
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          email: string
          id?: string
          requested_at?: string
          requested_by?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role: Database["public"]["Enums"]["staging_user_role"]
          status?: Database["public"]["Enums"]["staging_assignment_status"]
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          email?: string
          id?: string
          requested_at?: string
          requested_by?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role?: Database["public"]["Enums"]["staging_user_role"]
          status?: Database["public"]["Enums"]["staging_assignment_status"]
        }
        Relationships: []
      }
      staging_role_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string | null
          created_at: string
          id: number
          metadata: Json
          new_role: Database["public"]["Enums"]["staging_user_role"] | null
          previous_role: Database["public"]["Enums"]["staging_user_role"] | null
          target_email: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: never
          metadata?: Json
          new_role?: Database["public"]["Enums"]["staging_user_role"] | null
          previous_role?:
            | Database["public"]["Enums"]["staging_user_role"]
            | null
          target_email?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: never
          metadata?: Json
          new_role?: Database["public"]["Enums"]["staging_user_role"] | null
          previous_role?:
            | Database["public"]["Enums"]["staging_user_role"]
            | null
          target_email?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      staging_user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          role: Database["public"]["Enums"]["staging_user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          role?: Database["public"]["Enums"]["staging_user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          role?: Database["public"]["Enums"]["staging_user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      steam_bets: {
        Row: {
          created_at: string
          game_name: string | null
          id: string
          image_url: string | null
          percentile_model_version: number | null
          percentile_value: number | null
          release_date: string | null
          release_label: string | null
          steam_app_id: number
          target_key: string
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          game_name?: string | null
          id?: string
          image_url?: string | null
          percentile_model_version?: number | null
          percentile_value?: number | null
          release_date?: string | null
          release_label?: string | null
          steam_app_id: number
          target_key: string
          updated_at?: string
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          game_name?: string | null
          id?: string
          image_url?: string | null
          percentile_model_version?: number | null
          percentile_value?: number | null
          release_date?: string | null
          release_label?: string | null
          steam_app_id?: number
          target_key?: string
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "steam_bets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "steam_bets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      steam_catalog_exclusions: {
        Row: {
          excluded_at: string
          last_seen_at: string
          name: string
          reason: string
          release_date: string | null
          source: string
          steam_app_id: number
          steam_app_type: string | null
        }
        Insert: {
          excluded_at?: string
          last_seen_at?: string
          name: string
          reason: string
          release_date?: string | null
          source?: string
          steam_app_id: number
          steam_app_type?: string | null
        }
        Update: {
          excluded_at?: string
          last_seen_at?: string
          name?: string
          reason?: string
          release_date?: string | null
          source?: string
          steam_app_id?: number
          steam_app_type?: string | null
        }
        Relationships: []
      }
      steam_catalog_sync_runs: {
        Row: {
          current_count: number
          error_message: string | null
          finished_at: string | null
          id: string
          released_count: number
          source_updated_at: string
          started_at: string
          status: string
        }
        Insert: {
          current_count?: number
          error_message?: string | null
          finished_at?: string | null
          id?: string
          released_count?: number
          source_updated_at: string
          started_at?: string
          status?: string
        }
        Update: {
          current_count?: number
          error_message?: string | null
          finished_at?: string | null
          id?: string
          released_count?: number
          source_updated_at?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      steam_enrichment_runs: {
        Row: {
          excluded_count: number
          error_message: string | null
          failed_count: number
          finished_at: string | null
          id: string
          partial_count: number
          released_count: number
          selected_count: number
          skipped_unchanged_count: number
          started_at: string
          status: string
          still_pending_count: number
          succeeded_count: number
          unavailable_count: number
          uploaded_count: number
          worker_id: string
        }
        Insert: {
          excluded_count?: number
          error_message?: string | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          partial_count?: number
          released_count?: number
          selected_count?: number
          skipped_unchanged_count?: number
          started_at?: string
          status?: string
          still_pending_count?: number
          succeeded_count?: number
          unavailable_count?: number
          uploaded_count?: number
          worker_id: string
        }
        Update: {
          excluded_count?: number
          error_message?: string | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          partial_count?: number
          released_count?: number
          selected_count?: number
          skipped_unchanged_count?: number
          started_at?: string
          status?: string
          still_pending_count?: number
          succeeded_count?: number
          unavailable_count?: number
          uploaded_count?: number
          worker_id?: string
        }
        Relationships: []
      }
      steam_forecast_markets: {
        Row: {
          created_at: string
          id: string
          lock_at: string | null
          metric_type: string
          percentile_model_id: string
          percentile_model_version: number
          resolve_after: string | null
          scoring_start_at: string
          source_release_date: string | null
          status: string
          steam_app_id: number
          updated_at: string
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          lock_at?: string | null
          metric_type: string
          percentile_model_id: string
          percentile_model_version: number
          resolve_after?: string | null
          scoring_start_at: string
          source_release_date?: string | null
          status?: string
          steam_app_id: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          lock_at?: string | null
          metric_type?: string
          percentile_model_id?: string
          percentile_model_version?: number
          resolve_after?: string | null
          scoring_start_at?: string
          source_release_date?: string | null
          status?: string
          steam_app_id?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "steam_forecast_markets_percentile_model_id_fkey"
            columns: ["percentile_model_id"]
            isOneToOne: false
            referencedRelation: "steam_percentile_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "steam_forecast_markets_steam_app_id_fkey"
            columns: ["steam_app_id"]
            isOneToOne: false
            referencedRelation: "steam_games"
            referencedColumns: ["steam_app_id"]
          },
        ]
      }
      steam_game_enrichment_state: {
        Row: {
          component: string
          consecutive_failures: number
          error_code: string | null
          error_message: string | null
          last_attempt_at: string | null
          last_success_at: string | null
          lease_expires_at: string | null
          lease_owner: string | null
          retry_after: string | null
          source_fingerprint: string | null
          source_payload: Json
          status: string
          steam_app_id: number
          updated_at: string
        }
        Insert: {
          component: string
          consecutive_failures?: number
          error_code?: string | null
          error_message?: string | null
          last_attempt_at?: string | null
          last_success_at?: string | null
          lease_expires_at?: string | null
          lease_owner?: string | null
          retry_after?: string | null
          source_fingerprint?: string | null
          source_payload?: Json
          status?: string
          steam_app_id: number
          updated_at?: string
        }
        Update: {
          component?: string
          consecutive_failures?: number
          error_code?: string | null
          error_message?: string | null
          last_attempt_at?: string | null
          last_success_at?: string | null
          lease_expires_at?: string | null
          lease_owner?: string | null
          retry_after?: string | null
          source_fingerprint?: string | null
          source_payload?: Json
          status?: string
          steam_app_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "steam_game_enrichment_state_steam_app_id_fkey"
            columns: ["steam_app_id"]
            isOneToOne: false
            referencedRelation: "steam_games"
            referencedColumns: ["steam_app_id"]
          },
        ]
      }
      steam_game_media: {
        Row: {
          active: boolean
          byte_size: number
          checksum_sha256: string
          created_at: string
          encoder_quality: number
          height: number
          id: string
          kind: string
          mime_type: string
          original_source_url: string
          position: number
          processed_at: string
          source_updated_at: string | null
          steam_app_id: number
          storage_bucket: string
          storage_path: string
          width: number
        }
        Insert: {
          active?: boolean
          byte_size: number
          checksum_sha256: string
          created_at?: string
          encoder_quality: number
          height: number
          id?: string
          kind: string
          mime_type: string
          original_source_url: string
          position: number
          processed_at?: string
          source_updated_at?: string | null
          steam_app_id: number
          storage_bucket: string
          storage_path: string
          width: number
        }
        Update: {
          active?: boolean
          byte_size?: number
          checksum_sha256?: string
          created_at?: string
          encoder_quality?: number
          height?: number
          id?: string
          kind?: string
          mime_type?: string
          original_source_url?: string
          position?: number
          processed_at?: string
          source_updated_at?: string | null
          steam_app_id?: number
          storage_bucket?: string
          storage_path?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "steam_game_media_steam_app_id_fkey"
            columns: ["steam_app_id"]
            isOneToOne: false
            referencedRelation: "steam_games"
            referencedColumns: ["steam_app_id"]
          },
        ]
      }
      steam_game_release_transitions: {
        Row: {
          id: string
          next_coming_soon: boolean | null
          next_precision: string
          next_release_date: string | null
          next_release_text: string | null
          observed_at: string
          previous_coming_soon: boolean | null
          previous_precision: string
          previous_release_date: string | null
          previous_release_text: string | null
          steam_app_id: number
        }
        Insert: {
          id?: string
          next_coming_soon?: boolean | null
          next_precision: string
          next_release_date?: string | null
          next_release_text?: string | null
          observed_at?: string
          previous_coming_soon?: boolean | null
          previous_precision: string
          previous_release_date?: string | null
          previous_release_text?: string | null
          steam_app_id: number
        }
        Update: {
          id?: string
          next_coming_soon?: boolean | null
          next_precision?: string
          next_release_date?: string | null
          next_release_text?: string | null
          observed_at?: string
          previous_coming_soon?: boolean | null
          previous_precision?: string
          previous_release_date?: string | null
          previous_release_text?: string | null
          steam_app_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "steam_game_release_transitions_steam_app_id_fkey"
            columns: ["steam_app_id"]
            isOneToOne: false
            referencedRelation: "steam_games"
            referencedColumns: ["steam_app_id"]
          },
        ]
      }
      steam_games: {
        Row: {
          average_forecast_history: Json
          classification_updated_at: string | null
          first_seen_at: string
          follower_count: number | null
          followers_updated_at: string | null
          image_url: string
          is_popular_upcoming: boolean
          is_wishlisted: boolean
          last_seen_at: string
          lifecycle_status: string
          media_updated_at: string | null
          name: string
          popular_upcoming_position: number | null
          pre_release_rank: number | null
          release_date: string | null
          release_label: string
          release_metadata_updated_at: string | null
          release_precision: string
          release_text: string | null
          released_at: string | null
          source: string
          source_updated_at: string
          steam_app_id: number
          steam_app_type: string | null
          steam_coming_soon: boolean | null
          steam_data_attempted_at: string | null
          steam_data_updated_at: string | null
          tag_source: string
          tags: string[]
          tags_updated_at: string | null
          updated_at: string
          wishlist_estimate: string | null
          wishlist_rank: number | null
        }
        Insert: {
          average_forecast_history?: Json
          classification_updated_at?: string | null
          first_seen_at?: string
          follower_count?: number | null
          followers_updated_at?: string | null
          image_url: string
          is_popular_upcoming?: boolean
          is_wishlisted?: boolean
          last_seen_at?: string
          lifecycle_status?: string
          media_updated_at?: string | null
          name: string
          popular_upcoming_position?: number | null
          pre_release_rank?: number | null
          release_date?: string | null
          release_label?: string
          release_metadata_updated_at?: string | null
          release_precision?: string
          release_text?: string | null
          released_at?: string | null
          source?: string
          source_updated_at: string
          steam_app_id: number
          steam_app_type?: string | null
          steam_coming_soon?: boolean | null
          steam_data_attempted_at?: string | null
          steam_data_updated_at?: string | null
          tag_source?: string
          tags?: string[]
          tags_updated_at?: string | null
          updated_at?: string
          wishlist_estimate?: string | null
          wishlist_rank?: number | null
        }
        Update: {
          average_forecast_history?: Json
          classification_updated_at?: string | null
          first_seen_at?: string
          follower_count?: number | null
          followers_updated_at?: string | null
          image_url?: string
          is_popular_upcoming?: boolean
          is_wishlisted?: boolean
          last_seen_at?: string
          lifecycle_status?: string
          media_updated_at?: string | null
          name?: string
          popular_upcoming_position?: number | null
          pre_release_rank?: number | null
          release_date?: string | null
          release_label?: string
          release_metadata_updated_at?: string | null
          release_precision?: string
          release_text?: string | null
          released_at?: string | null
          source?: string
          source_updated_at?: string
          steam_app_id?: number
          steam_app_type?: string | null
          steam_coming_soon?: boolean | null
          steam_data_attempted_at?: string | null
          steam_data_updated_at?: string | null
          tag_source?: string
          tags?: string[]
          tags_updated_at?: string | null
          updated_at?: string
          wishlist_estimate?: string | null
          wishlist_rank?: number | null
        }
        Relationships: []
      }
      steam_market_daily_snapshots: {
        Row: {
          created_at: string
          crowd_percentile: number | null
          eligible_prediction_count: number
          id: string
          market_id: string
          snapshot_at: string
          snapshot_date: string
        }
        Insert: {
          created_at?: string
          crowd_percentile?: number | null
          eligible_prediction_count?: number
          id?: string
          market_id: string
          snapshot_at: string
          snapshot_date: string
        }
        Update: {
          created_at?: string
          crowd_percentile?: number | null
          eligible_prediction_count?: number
          id?: string
          market_id?: string
          snapshot_at?: string
          snapshot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "steam_market_daily_snapshots_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "steam_forecast_markets"
            referencedColumns: ["id"]
          },
        ]
      }
      steam_market_results: {
        Row: {
          actual_percentile_value: number
          actual_raw_value: number
          correction_note: string | null
          created_at: string
          created_by: string | null
          id: string
          is_current: boolean
          market_id: string
          resolved_at: string
          result_version: number
          source_reference: string
        }
        Insert: {
          actual_percentile_value: number
          actual_raw_value: number
          correction_note?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          market_id: string
          resolved_at: string
          result_version: number
          source_reference: string
        }
        Update: {
          actual_percentile_value?: number
          actual_raw_value?: number
          correction_note?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          market_id?: string
          resolved_at?: string
          result_version?: number
          source_reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "steam_market_results_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "steam_market_results_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "steam_market_results_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "steam_forecast_markets"
            referencedColumns: ["id"]
          },
        ]
      }
      steam_market_snapshot_predictions: {
        Row: {
          percentile_value: number
          prediction_version_id: string
          raw_value: number
          snapshot_id: string
          user_id: string
        }
        Insert: {
          percentile_value: number
          prediction_version_id: string
          raw_value: number
          snapshot_id: string
          user_id: string
        }
        Update: {
          percentile_value?: number
          prediction_version_id?: string
          raw_value?: number
          snapshot_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "steam_market_snapshot_predictions_prediction_version_id_fkey"
            columns: ["prediction_version_id"]
            isOneToOne: false
            referencedRelation: "steam_prediction_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "steam_market_snapshot_predictions_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "steam_market_daily_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "steam_market_snapshot_predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "steam_market_snapshot_predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      steam_percentile_models: {
        Row: {
          created_at: string
          dataset_reference: string
          id: string
          is_active: boolean
          metric_type: string
          model_version: number
          reference_values: number[]
          sample_size: number
        }
        Insert: {
          created_at?: string
          dataset_reference: string
          id?: string
          is_active?: boolean
          metric_type: string
          model_version: number
          reference_values: number[]
          sample_size: number
        }
        Update: {
          created_at?: string
          dataset_reference?: string
          id?: string
          is_active?: boolean
          metric_type?: string
          model_version?: number
          reference_values?: number[]
          sample_size?: number
        }
        Relationships: []
      }
      steam_prediction_score_entries: {
        Row: {
          actual_percentile: number
          created_at: string
          crowd_without_user_percentile: number
          id: string
          market_id: string
          points: number
          score_run_id: string
          snapshot_id: string
          user_id: string
          user_percentile: number
        }
        Insert: {
          actual_percentile: number
          created_at?: string
          crowd_without_user_percentile: number
          id?: string
          market_id: string
          points: number
          score_run_id: string
          snapshot_id: string
          user_id: string
          user_percentile: number
        }
        Update: {
          actual_percentile?: number
          created_at?: string
          crowd_without_user_percentile?: number
          id?: string
          market_id?: string
          points?: number
          score_run_id?: string
          snapshot_id?: string
          user_id?: string
          user_percentile?: number
        }
        Relationships: [
          {
            foreignKeyName: "steam_prediction_score_entries_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "steam_forecast_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "steam_prediction_score_entries_score_run_id_fkey"
            columns: ["score_run_id"]
            isOneToOne: false
            referencedRelation: "steam_score_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "steam_prediction_score_entries_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "steam_market_daily_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "steam_prediction_score_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "steam_prediction_score_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      steam_prediction_versions: {
        Row: {
          created_at: string
          id: string
          market_id: string
          percentile_model_version: number
          percentile_value: number
          raw_value: number
          user_id: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          market_id: string
          percentile_model_version: number
          percentile_value: number
          raw_value: number
          user_id: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          market_id?: string
          percentile_model_version?: number
          percentile_value?: number
          raw_value?: number
          user_id?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "steam_prediction_versions_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "steam_forecast_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "steam_prediction_versions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "steam_prediction_versions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      steam_score_runs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_current: boolean
          market_id: string
          reason: string
          result_id: string
          run_version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          market_id: string
          reason: string
          result_id: string
          run_version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          market_id?: string
          reason?: string
          result_id?: string
          run_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "steam_score_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "steam_score_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "steam_score_runs_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "steam_forecast_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "steam_score_runs_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "steam_market_results"
            referencedColumns: ["id"]
          },
        ]
      }
      steam_scoring_config: {
        Row: {
          created_at: string
          scoring_start_at: string
          singleton: boolean
        }
        Insert: {
          created_at?: string
          scoring_start_at: string
          singleton?: boolean
        }
        Update: {
          created_at?: string
          scoring_start_at?: string
          singleton?: boolean
        }
        Relationships: []
      }
      steam_user_leaderboard_stats: {
        Row: {
          metric_type: string
          points: number
          rank_position: number
          resolved_markets: number
          scored_days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          metric_type: string
          points?: number
          rank_position: number
          resolved_markets?: number
          scored_days?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          metric_type?: string
          points?: number
          rank_position?: number
          resolved_markets?: number
          scored_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "steam_user_leaderboard_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "steam_user_leaderboard_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      leaderboard: {
        Row: {
          accuracy_bps: number | null
          accuracy_rank: number | null
          avatar_id: Database["public"]["Enums"]["avatar_id"] | null
          coin_balance: number | null
          coin_rank: number | null
          coins_wagered: number | null
          coins_won: number | null
          correct_predictions: number | null
          display_name: string | null
          id: string | null
          predictions_made: number | null
          predictions_resolved: number | null
          username: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      claim_steam_media_jobs: {
        Args: {
          p_app_id?: number
          p_lease_seconds?: number
          p_limit: number
          p_worker_id: string
        }
        Returns: {
          consecutive_failures: number
          source_fingerprint: string
          source_payload: Json
          steam_app_id: number
        }[]
      }
      create_steam_market_snapshots: {
        Args: { p_snapshot_at?: string }
        Returns: number
      }
      ensure_steam_points_system: { Args: never; Returns: undefined }
      get_forecast_leaderboard: {
        Args: { p_period?: string }
        Returns: {
          accuracy: number
          avatar_id: Database["public"]["Enums"]["avatar_id"]
          display_name: string
          prediction_count: number
          profile_id: string
          rank: number
          username: string
        }[]
      }
      get_forecast_summaries: {
        Args: { p_market_ids?: string[] }
        Returns: {
          prediction_count: number
          raw_average: number
          target_id: string
          weighted_average: number
        }[]
      }
      get_steam_bet_summaries: {
        Args: never
        Returns: {
          average_value: number
          prediction_count: number
          steam_app_id: number
          target_key: string
        }[]
      }
      get_steam_bet_trends: {
        Args: never
        Returns: {
          bet_count: number
          game_name: string
          image_url: string
          release_date: string
          release_label: string
          steam_app_id: number
        }[]
      }
      get_steam_game_data_quality_report: {
        Args: never
        Returns: {
          exact_release_count: number
          fallback_tags_count: number
          five_tags_count: number
          media_failed_count: number
          media_pending_count: number
          media_unavailable_count: number
          missing_tags_count: number
          most_recent_successful_run_at: string
          oldest_pending_at: string
          one_screenshot_count: number
          one_to_four_tags_count: number
          partial_release_count: number
          stale_media_count: number
          stale_release_count: number
          stale_tag_count: number
          tba_release_count: number
          total_games: number
          two_screenshots_count: number
        }[]
      }
      get_steam_points_leaderboard: {
        Args: { p_limit?: number; p_metric_type?: string; p_offset?: number }
        Returns: {
          avatar_id: Database["public"]["Enums"]["avatar_id"]
          display_name: string
          is_current_user: boolean
          is_page_member: boolean
          points: number
          rank_position: number
          resolved_markets: number
          scored_days: number
          total_rows: number
          user_id: string
          username: string
        }[]
      }
      get_steam_prediction_states: {
        Args: { p_steam_app_ids?: number[] }
        Returns: {
          actual_percentile_value: number
          actual_raw_value: number
          lock_at: string
          market_status: string
          metric_type: string
          points: number
          resolve_after: string
          scored_days: number
          steam_app_id: number
          user_percentile_value: number
          user_raw_value: number
        }[]
      }
      get_steam_resolution_queue: {
        Args: never
        Returns: {
          game_name: string
          market_id: string
          metric_type: string
          resolve_after: string
          status: string
          steam_app_id: number
        }[]
      }
      get_steam_released_game_feed: {
        Args: {
          p_lifecycle: string
          p_limit?: number
          p_offset?: number
          p_query?: string
        }
        Returns: {
          steam_app_id: number
          total_rows: number
        }[]
      }
      is_current_user_admin: { Args: never; Returns: boolean }
      lock_due_steam_forecast_markets: { Args: never; Returns: number }
      place_prediction: {
        Args: { p_market_id: string; p_outcome: string; p_stake: number }
        Returns: {
          created_at: string
          id: string
          is_correct: boolean | null
          market_id: string
          outcome: Database["public"]["Enums"]["prediction_outcome"]
          payout: number
          price_bps: number
          resolved_at: string | null
          shares: number
          stake: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "predictions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      process_steam_market_cycle: { Args: never; Returns: Json }
      publish_steam_game_media: {
        Args: {
          p_byte_size: number
          p_checksum_sha256: string
          p_encoder_quality: number
          p_height: number
          p_original_source_url: string
          p_position: number
          p_source_updated_at?: string
          p_steam_app_id: number
          p_storage_bucket: string
          p_storage_path: string
          p_width: number
        }
        Returns: {
          previous_storage_bucket: string
          previous_storage_path: string
        }[]
      }
      rebuild_steam_leaderboard_stats: { Args: never; Returns: number }
      recalculate_steam_forecast_market: {
        Args: { p_market_id: string; p_reason?: string }
        Returns: number
      }
      resolve_market: {
        Args: { p_market_id: string; p_outcome: string }
        Returns: {
          category: string
          closes_at: string
          created_at: string
          description: string
          header_image_url: string
          id: string
          question: string
          resolved_at: string | null
          resolved_outcome:
            | Database["public"]["Enums"]["prediction_outcome"]
            | null
          slug: string
          status: Database["public"]["Enums"]["market_status"]
          steam_app_id: number
          steam_title: string
          total_volume: number
          yes_price_bps: number
        }
        SetofOptions: {
          from: "*"
          to: "markets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_steam_forecast_market: {
        Args: {
          p_actual_raw_value: number
          p_correction_note?: string
          p_market_id: string
          p_resolved_at?: string
          p_source_reference: string
        }
        Returns: {
          actual_percentile_value: number
          actual_raw_value: number
          correction_note: string | null
          created_at: string
          created_by: string | null
          id: string
          is_current: boolean
          market_id: string
          resolved_at: string
          result_version: number
          source_reference: string
        }
        SetofOptions: {
          from: "*"
          to: "steam_market_results"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      steam_percentile_value: {
        Args: {
          p_metric_type: string
          p_model_version: number
          p_raw_value: number
        }
        Returns: number
      }
      submit_steam_prediction: {
        Args: {
          p_metric_type: string
          p_raw_value: number
          p_steam_app_id: number
        }
        Returns: {
          lock_at: string
          market_status: string
          metric_type: string
          percentile_value: number
          raw_value: number
          steam_app_id: number
          updated_at: string
        }[]
      }
      sync_steam_forecast_markets: { Args: never; Returns: number }
      update_own_profile: {
        Args: {
          p_avatar_id: string
          p_bio: string
          p_display_name: string
          p_links: Json
          p_username: string
        }
        Returns: {
          avatar_id: Database["public"]["Enums"]["avatar_id"]
          bio: string
          coin_balance: number
          coins_wagered: number
          coins_won: number
          correct_predictions: number
          created_at: string
          display_name: string
          id: string
          links: Json
          predictions_made: number
          predictions_resolved: number
          updated_at: string
          username: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_numeric_prediction: {
        Args: { p_target_id: string; p_value: number }
        Returns: {
          created_at: string
          id: string
          target_id: string
          updated_at: string
          user_id: string
          value: number
        }
        SetofOptions: {
          from: "*"
          to: "numeric_predictions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      void_steam_forecast_market: {
        Args: { p_market_id: string; p_reason: string }
        Returns: undefined
      }
    }
    Enums: {
      avatar_id:
        | "steam_blue"
        | "neon_purple"
        | "pixel_green"
        | "ember_red"
        | "golden_controller"
        | "cyber_cat"
      coin_ledger_reason:
        | "signup_bonus"
        | "prediction_stake"
        | "prediction_payout"
      market_status: "open" | "resolved"
      prediction_outcome: "yes" | "no"
      simulation_market_status: "open" | "locked" | "resolved" | "void"
      simulation_status: "draft" | "running" | "paused" | "archived"
      staging_assignment_status: "pending" | "claimed" | "revoked"
      staging_user_role: "user" | "game_designer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      avatar_id: [
        "steam_blue",
        "neon_purple",
        "pixel_green",
        "ember_red",
        "golden_controller",
        "cyber_cat",
      ],
      coin_ledger_reason: [
        "signup_bonus",
        "prediction_stake",
        "prediction_payout",
      ],
      market_status: ["open", "resolved"],
      prediction_outcome: ["yes", "no"],
      simulation_market_status: ["open", "locked", "resolved", "void"],
      simulation_status: ["draft", "running", "paused", "archived"],
      staging_assignment_status: ["pending", "claimed", "revoked"],
      staging_user_role: ["user", "game_designer"],
    },
  },
} as const
