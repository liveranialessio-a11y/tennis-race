export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          message: string
          related_id: string | null
          related_type: string | null
          icon: string | null
          is_read: boolean
          created_at: string
          read_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          message: string
          related_id?: string | null
          related_type?: string | null
          icon?: string | null
          is_read?: boolean
          created_at?: string
          read_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          message?: string
          related_id?: string | null
          related_type?: string | null
          icon?: string | null
          is_read?: boolean
          created_at?: string
          read_at?: string | null
        }
      }
      notification_preferences: {
        Row: {
          id: string
          user_id: string
          in_app_enabled: boolean
          push_enabled: boolean
          challenge_received: string
          challenge_accepted: string
          challenge_rejected: string
          challenge_cancelled: string
          challenge_reminder_24h: string
          challenge_reminder_2h: string
          result_pending: string
          result_confirmed: string
          result_contested: string
          result_expiring: string
          ranking_position_change: string
          ranking_category_change: string
          ranking_first_place: string
          championship_new_season: string
          championship_announcement: string
          admin_new_registration: string
          admin_contested_result: string
          dnd_enabled: boolean
          dnd_start_time: string
          dnd_end_time: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          in_app_enabled?: boolean
          push_enabled?: boolean
          challenge_received?: string
          challenge_accepted?: string
          challenge_rejected?: string
          challenge_cancelled?: string
          challenge_reminder_24h?: string
          challenge_reminder_2h?: string
          result_pending?: string
          result_confirmed?: string
          result_contested?: string
          result_expiring?: string
          ranking_position_change?: string
          ranking_category_change?: string
          ranking_first_place?: string
          championship_new_season?: string
          championship_announcement?: string
          admin_new_registration?: string
          admin_contested_result?: string
          dnd_enabled?: boolean
          dnd_start_time?: string
          dnd_end_time?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          in_app_enabled?: boolean
          push_enabled?: boolean
          challenge_received?: string
          challenge_accepted?: string
          challenge_rejected?: string
          challenge_cancelled?: string
          challenge_reminder_24h?: string
          challenge_reminder_2h?: string
          result_pending?: string
          result_confirmed?: string
          result_contested?: string
          result_expiring?: string
          ranking_position_change?: string
          ranking_category_change?: string
          ranking_first_place?: string
          championship_new_season?: string
          championship_announcement?: string
          admin_new_registration?: string
          admin_contested_result?: string
          dnd_enabled?: boolean
          dnd_start_time?: string
          dnd_end_time?: string
          created_at?: string
          updated_at?: string
        }
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          user_agent: string | null
          created_at: string
          last_used_at: string
        }
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          user_agent?: string | null
          created_at?: string
          last_used_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          endpoint?: string
          p256dh?: string
          auth?: string
          user_agent?: string | null
          created_at?: string
          last_used_at?: string
        }
      }
    }
  }
}
