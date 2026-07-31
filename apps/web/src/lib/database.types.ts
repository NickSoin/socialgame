export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
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
      steam_games: {
        Row: {
          first_seen_at: string
          image_url: string
          is_popular_upcoming: boolean
          is_wishlisted: boolean
          last_seen_at: string
          lifecycle_status: string
          name: string
          popular_upcoming_position: number | null
          pre_release_rank: number | null
          release_date: string | null
          release_label: string
          released_at: string | null
          source: string
          source_updated_at: string
          steam_app_id: number
          steam_data_attempted_at: string | null
          steam_data_updated_at: string | null
          tags: string[]
          updated_at: string
          wishlist_estimate: string | null
          wishlist_rank: number | null
        }
        Insert: {
          first_seen_at?: string
          image_url: string
          is_popular_upcoming?: boolean
          is_wishlisted?: boolean
          last_seen_at?: string
          lifecycle_status?: string
          name: string
          popular_upcoming_position?: number | null
          pre_release_rank?: number | null
          release_date?: string | null
          release_label?: string
          released_at?: string | null
          source?: string
          source_updated_at: string
          steam_app_id: number
          steam_data_attempted_at?: string | null
          steam_data_updated_at?: string | null
          tags?: string[]
          updated_at?: string
          wishlist_estimate?: string | null
          wishlist_rank?: number | null
        }
        Update: {
          first_seen_at?: string
          image_url?: string
          is_popular_upcoming?: boolean
          is_wishlisted?: boolean
          last_seen_at?: string
          lifecycle_status?: string
          name?: string
          popular_upcoming_position?: number | null
          pre_release_rank?: number | null
          release_date?: string | null
          release_label?: string
          released_at?: string | null
          source?: string
          source_updated_at?: string
          steam_app_id?: number
          steam_data_attempted_at?: string | null
          steam_data_updated_at?: string | null
          tags?: string[]
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
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      iceberg_namespaces: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_namespaces_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      iceberg_tables: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          location: string
          name: string
          namespace_id: string
          remote_table_id: string | null
          shard_id: string | null
          shard_key: string | null
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          location: string
          name: string
          namespace_id: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          namespace_id?: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_tables_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iceberg_tables_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "iceberg_namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
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
  graphql_public: {
    Enums: {},
  },
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
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const

