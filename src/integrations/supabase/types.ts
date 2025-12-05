export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      championships: {
        Row: {
          admin_id: string
          bronze_players_count: number | null
          created_at: string
          enable_set_bonus: boolean
          first_place_points: number
          gold_players_count: number | null
          id: string
          is_public: boolean
          min_matches_for_points: number
          min_matches_required: number
          name: string
          silver_players_count: number | null
          updated_at: string
        }
        Insert: {
          admin_id: string
          bronze_players_count?: number | null
          created_at?: string
          enable_set_bonus?: boolean
          first_place_points?: number
          gold_players_count?: number | null
          id?: string
          is_public?: boolean
          min_matches_for_points?: number
          min_matches_required?: number
          name: string
          silver_players_count?: number | null
          updated_at?: string
        }
        Update: {
          admin_id?: string
          bronze_players_count?: number | null
          created_at?: string
          enable_set_bonus?: boolean
          first_place_points?: number
          gold_players_count?: number | null
          id?: string
          is_public?: boolean
          min_matches_for_points?: number
          min_matches_required?: number
          name?: string
          silver_players_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      email_errors: {
        Row: {
          challenge_type: string
          created_at: string
          error_message: string
          id: string
          match_id: string | null
          recipient_email: string
          recipient_name: string
          sender_name: string
        }
        Insert: {
          challenge_type: string
          created_at?: string
          error_message: string
          id?: string
          match_id?: string | null
          recipient_email: string
          recipient_name: string
          sender_name: string
        }
        Update: {
          challenge_type?: string
          created_at?: string
          error_message?: string
          id?: string
          match_id?: string | null
          recipient_email?: string
          recipient_name?: string
          sender_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_errors_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          challenge_launcher_id: string | null
          challenge_status: string | null
          championship_id: string
          created_at: string
          id: string
          is_draw: boolean | null
          is_scheduled: boolean | null
          loser_id: string | null
          loser_points_lost: number | null
          played_at: string
          score: string
          updated_at: string
          winner_id: string | null
          winner_points_gained: number | null
        }
        Insert: {
          challenge_launcher_id?: string | null
          challenge_status?: string | null
          championship_id: string
          created_at?: string
          id?: string
          is_draw?: boolean | null
          is_scheduled?: boolean | null
          loser_id?: string | null
          loser_points_lost?: number | null
          played_at?: string
          score: string
          updated_at?: string
          winner_id?: string | null
          winner_points_gained?: number | null
        }
        Update: {
          challenge_launcher_id?: string | null
          challenge_status?: string | null
          championship_id?: string
          created_at?: string
          id?: string
          is_draw?: boolean | null
          is_scheduled?: boolean | null
          loser_id?: string | null
          loser_points_lost?: number | null
          played_at?: string
          score?: string
          updated_at?: string
          winner_id?: string | null
          winner_points_gained?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_championship_id_fkey"
            columns: ["championship_id"]
            isOneToOne: false
            referencedRelation: "championships"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          admin_contested_result: string | null
          admin_new_registration: string | null
          challenge_accepted: string | null
          challenge_cancelled: string | null
          challenge_received: string | null
          challenge_rejected: string | null
          challenge_reminder_24h: string | null
          challenge_reminder_2h: string | null
          championship_announcement: string | null
          championship_new_season: string | null
          created_at: string | null
          dnd_enabled: boolean | null
          dnd_end_time: string | null
          dnd_start_time: string | null
          id: string
          in_app_enabled: boolean | null
          match_deleted: string | null
          match_scheduled: string | null
          match_time_changed: string | null
          push_enabled: boolean | null
          ranking_category_change: string | null
          ranking_first_place: string | null
          ranking_position_change: string | null
          result_confirmed: string | null
          result_contested: string | null
          result_expiring: string | null
          result_pending: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_contested_result?: string | null
          admin_new_registration?: string | null
          challenge_accepted?: string | null
          challenge_cancelled?: string | null
          challenge_received?: string | null
          challenge_rejected?: string | null
          challenge_reminder_24h?: string | null
          challenge_reminder_2h?: string | null
          championship_announcement?: string | null
          championship_new_season?: string | null
          created_at?: string | null
          dnd_enabled?: boolean | null
          dnd_end_time?: string | null
          dnd_start_time?: string | null
          id?: string
          in_app_enabled?: boolean | null
          match_deleted?: string | null
          match_scheduled?: string | null
          match_time_changed?: string | null
          push_enabled?: boolean | null
          ranking_category_change?: string | null
          ranking_first_place?: string | null
          ranking_position_change?: string | null
          result_confirmed?: string | null
          result_contested?: string | null
          result_expiring?: string | null
          result_pending?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_contested_result?: string | null
          admin_new_registration?: string | null
          challenge_accepted?: string | null
          challenge_cancelled?: string | null
          challenge_received?: string | null
          challenge_rejected?: string | null
          challenge_reminder_24h?: string | null
          challenge_reminder_2h?: string | null
          championship_announcement?: string | null
          championship_new_season?: string | null
          created_at?: string | null
          dnd_enabled?: boolean | null
          dnd_end_time?: string | null
          dnd_start_time?: string | null
          id?: string
          in_app_enabled?: boolean | null
          match_deleted?: string | null
          match_scheduled?: string | null
          match_time_changed?: string | null
          push_enabled?: boolean | null
          ranking_category_change?: string | null
          ranking_first_place?: string | null
          ranking_position_change?: string | null
          result_confirmed?: string | null
          result_contested?: string | null
          result_expiring?: string | null
          result_pending?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          icon: string | null
          id: string
          is_read: boolean | null
          message: string
          read_at: string | null
          related_id: string | null
          related_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          icon?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          read_at?: string | null
          related_id?: string | null
          related_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          icon?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          read_at?: string | null
          related_id?: string | null
          related_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      player_suspensions: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_active: boolean
          reason: string
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean
          reason: string
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean
          reason?: string
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      players: {
        Row: {
          availability_status: Database["public"]["Enums"]["availability_status_enum"]
          avatar_url: string | null
          best_category: string | null
          best_live_rank_category_position: number | null
          best_pro_master_rank: number | null
          championship_id: string
          created_at: string
          display_name: string
          id: string
          is_admin: boolean | null
          last_match_date: string | null
          live_rank_category: string | null
          live_rank_position: number | null
          matches_this_month: number | null
          phone: string | null
          previous_live_rank_position: number | null
          pro_master_points: number | null
          pro_master_rank_position: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          availability_status?: Database["public"]["Enums"]["availability_status_enum"]
          avatar_url?: string | null
          best_category?: string | null
          best_live_rank_category_position?: number | null
          best_pro_master_rank?: number | null
          championship_id: string
          created_at?: string
          display_name: string
          id?: string
          is_admin?: boolean | null
          last_match_date?: string | null
          live_rank_category?: string | null
          live_rank_position?: number | null
          matches_this_month?: number | null
          phone?: string | null
          previous_live_rank_position?: number | null
          pro_master_points?: number | null
          pro_master_rank_position?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          availability_status?: Database["public"]["Enums"]["availability_status_enum"]
          avatar_url?: string | null
          best_category?: string | null
          best_live_rank_category_position?: number | null
          best_pro_master_rank?: number | null
          championship_id?: string
          created_at?: string
          display_name?: string
          id?: string
          is_admin?: boolean | null
          last_match_date?: string | null
          live_rank_category?: string | null
          live_rank_position?: number | null
          matches_this_month?: number | null
          phone?: string | null
          previous_live_rank_position?: number | null
          pro_master_points?: number | null
          pro_master_rank_position?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      registration_requests: {
        Row: {
          championship_id: string
          created_at: string
          display_name: string
          id: string
          phone: string | null
          processed_at: string | null
          processed_by: string | null
          rejected_reason: string | null
          requested_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          championship_id: string
          created_at?: string
          display_name: string
          id?: string
          phone?: string | null
          processed_at?: string | null
          processed_by?: string | null
          rejected_reason?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          championship_id?: string
          created_at?: string
          display_name?: string
          id?: string
          phone?: string | null
          processed_at?: string | null
          processed_by?: string | null
          rejected_reason?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_requests_championship_id_fkey"
            columns: ["championship_id"]
            isOneToOne: false
            referencedRelation: "championships"
            referencedColumns: ["id"]
          },
        ]
      }
      trophies: {
        Row: {
          awarded_date: string
          championship_id: string
          created_at: string
          id: string
          player_id: string
          position: number
          tournament_title: string | null
          trophy_type: string
        }
        Insert: {
          awarded_date?: string
          championship_id: string
          created_at?: string
          id?: string
          player_id: string
          position: number
          tournament_title?: string | null
          trophy_type: string
        }
        Update: {
          awarded_date?: string
          championship_id?: string
          created_at?: string
          id?: string
          player_id?: string
          position?: number
          tournament_title?: string | null
          trophy_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "trophies_championship_id_fkey"
            columns: ["championship_id"]
            isOneToOne: false
            referencedRelation: "championships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trophies_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_challenge: {
        Args: { p_challenge_id: string; p_user_id: string }
        Returns: Json
      }
      admin_adjust_player_rank: {
        Args: { player1_id: string; player2_id: string }
        Returns: Json
      }
      admin_create_match: {
        Args: {
          p_championship_id: string
          p_is_scheduled?: boolean
          p_loser_id: string
          p_played_at?: string
          p_score: string
          p_winner_id: string
        }
        Returns: Json
      }
      admin_delete_match: { Args: { match_id_param: string }; Returns: Json }
      admin_move_player: {
        Args: {
          new_championship_id: string
          new_position?: number
          target_player_id: string
        }
        Returns: Json
      }
      admin_update_match_score: {
        Args: {
          match_id_param: string
          new_loser_id?: string
          new_score: string
          new_winner_id?: string
        }
        Returns: Json
      }
      approve_registration_request: {
        Args: { request_id: string; target_category: string }
        Returns: Json
      }
      calculate_games_from_score: {
        Args: { score_str: string }
        Returns: {
          loser_games: number
          winner_games: number
        }[]
      }
      calculate_inactivity_demotion: {
        Args: {
          min_matches_required?: number
          target_championship_id: string
          target_month?: string
        }
        Returns: Json
      }
      calculate_pro_master_points: {
        Args: {
          first_place_points?: number
          min_matches_for_points?: number
          target_championship_id: string
          target_month?: string
        }
        Returns: Json
      }
      calculate_sets_from_score: {
        Args: { score_str: string }
        Returns: {
          loser_sets: number
          winner_sets: number
        }[]
      }
      can_delete_challenge: {
        Args: { p_challenge_id: string; p_user_id: string }
        Returns: boolean
      }
      can_user_create_challenge: {
        Args: { p_championship_id: string; p_user_id: string }
        Returns: boolean
      }
      check_expired_suspensions: {
        Args: never
        Returns: {
          player_email: string
          player_name: string
          user_id: string
        }[]
      }
      create_notification: {
        Args: {
          p_icon?: string
          p_message: string
          p_related_id?: string
          p_related_type?: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      create_player_profile: {
        Args: {
          p_avatar_url?: string
          p_championship_id: string
          p_display_name: string
          p_phone?: string
          p_user_id: string
        }
        Returns: Json
      }
      create_player_suspension: {
        Args: {
          p_end_date: string
          p_reason: string
          p_start_date: string
          p_user_id: string
        }
        Returns: string
      }
      get_active_suspension: {
        Args: { p_user_id: string }
        Returns: {
          end_date: string
          id: string
          is_expired: boolean
          reason: string
          start_date: string
        }[]
      }
      get_category_by_position: {
        Args: { rank_position: number }
        Returns: string
      }
      get_category_position: {
        Args: {
          p_championship_id: string
          p_live_rank_category: string
          p_live_rank_position: number
        }
        Returns: number
      }
      get_default_championship_id: { Args: never; Returns: string }
      get_filtered_player_stats: {
        Args: {
          filter_month?: number
          filter_type: string
          filter_year?: number
          player_uuid: string
        }
        Returns: {
          draws: number
          games_lost: number
          games_win_percentage: number
          games_won: number
          losses: number
          matches_played: number
          sets_lost: number
          sets_win_percentage: number
          sets_won: number
          win_percentage: number
          wins: number
        }[]
      }
      get_player_monthly_stats: {
        Args: { days_back?: number; player_uuid: string }
        Returns: {
          losses: number
          match_date: string
          wins: number
        }[]
      }
      get_player_stats_by_range: {
        Args: { end_date: string; player_uuid: string; start_date: string }
        Returns: {
          losses: number
          match_date: string
          wins: number
        }[]
      }
      get_pro_master_points_by_position: {
        Args: { rank_position: number }
        Returns: number
      }
      get_user_email: { Args: { p_user_id: string }; Returns: string }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      is_player_challengeable: {
        Args: { p_championship_id: string; p_user_id: string }
        Returns: boolean
      }
      launch_challenge: {
        Args: {
          p_challenged_id: string
          p_challenger_id: string
          p_championship_id: string
        }
        Returns: Json
      }
      process_category_swaps: {
        Args: { target_championship_id: string }
        Returns: Json
      }
      recompact_positions: {
        Args: { target_championship_id: string }
        Returns: Json
      }
      reject_challenge: {
        Args: { p_challenge_id: string; p_user_id: string }
        Returns: Json
      }
      reject_registration_request: {
        Args: { rejection_reason?: string; request_id: string }
        Returns: Json
      }
      remove_player_suspension: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      reset_monthly_matches: {
        Args: { target_championship_id: string }
        Returns: Json
      }
      set_challenge_datetime: {
        Args: { p_challenge_id: string; p_datetime: string; p_user_id: string }
        Returns: Json
      }
      test_match_counts: {
        Args: { target_championship_id: string; target_month?: string }
        Returns: {
          matches_counter: number
          matches_from_db: number
          player_name: string
          player_position: number
          pro_master_points: number
        }[]
      }
      update_pro_master_rankings: {
        Args: { target_championship_id: string }
        Returns: Json
      }
    }
    Enums: {
      availability_status_enum: "available" | "unavailable" | "suspended"
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
      availability_status_enum: ["available", "unavailable", "suspended"],
    },
  },
} as const
