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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_invites: {
        Row: {
          city: string
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          id: string
          region: string
          region_code: string
          used_at: string | null
        }
        Insert: {
          city?: string
          created_at?: string
          created_by?: string | null
          email: string
          expires_at?: string
          id?: string
          region?: string
          region_code?: string
          used_at?: string | null
        }
        Update: {
          city?: string
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          id?: string
          region?: string
          region_code?: string
          used_at?: string | null
        }
        Relationships: []
      }
      app_users: {
        Row: {
          city: string
          created_at: string
          credits: number
          email: string
          full_name: string
          id: string
          kind: string
          phone: string
          region: string
          region_code: string
          roles: string[]
          total_credits: number
          updated_at: string
        }
        Insert: {
          city?: string
          created_at?: string
          credits?: number
          email?: string
          full_name?: string
          id: string
          kind?: string
          phone?: string
          region?: string
          region_code?: string
          roles?: string[]
          total_credits?: number
          updated_at?: string
        }
        Update: {
          city?: string
          created_at?: string
          credits?: number
          email?: string
          full_name?: string
          id?: string
          kind?: string
          phone?: string
          region?: string
          region_code?: string
          roles?: string[]
          total_credits?: number
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_id: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender_id: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          created_by: string
          id: string
          last_message_at: string
          report_id: string | null
          status: string
          subject: string
          worker_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          last_message_at?: string
          report_id?: string | null
          status?: string
          subject?: string
          worker_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          last_message_at?: string
          report_id?: string | null
          status?: string
          subject?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_threads_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_requests: {
        Row: {
          amount: number
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          requested_by: string
          status: string
          team_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          requested_by: string
          status?: string
          team_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          requested_by?: string
          status?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          kind: string
          note: string
          report_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          note?: string
          report_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          note?: string
          report_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      depots: {
        Row: {
          active: boolean
          city: string
          code: string
          created_at: string
          id: string
          lat: number
          lng: number
          name: string
          region: string
          region_code: string
        }
        Insert: {
          active?: boolean
          city?: string
          code: string
          created_at?: string
          id?: string
          lat: number
          lng: number
          name: string
          region?: string
          region_code?: string
        }
        Update: {
          active?: boolean
          city?: string
          code?: string
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          name?: string
          region?: string
          region_code?: string
        }
        Relationships: []
      }
      donations: {
        Row: {
          amount_kzt: number
          created_at: string
          credits: number
          full_name: string
          id: string
          status: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          amount_kzt: number
          created_at?: string
          credits: number
          full_name?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
          username?: string
        }
        Update: {
          amount_kzt?: number
          created_at?: string
          credits?: number
          full_name?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      email_delivery_log: {
        Row: {
          created_at: string
          email_masked: string
          error: string
          event: string
          http_status: number | null
          id: string
          provider: string
          purpose: string
          status: string
        }
        Insert: {
          created_at?: string
          email_masked: string
          error?: string
          event: string
          http_status?: number | null
          id?: string
          provider?: string
          purpose?: string
          status?: string
        }
        Update: {
          created_at?: string
          email_masked?: string
          error?: string
          event?: string
          http_status?: number | null
          id?: string
          provider?: string
          purpose?: string
          status?: string
        }
        Relationships: []
      }
      email_otps: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          purpose: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          purpose?: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          purpose?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payout_requests: {
        Row: {
          amount_kzt: number
          created_at: string
          credits: number
          decided_at: string | null
          full_name: string
          id: string
          note: string | null
          phone: string
          status: string
          user_id: string
        }
        Insert: {
          amount_kzt: number
          created_at?: string
          credits: number
          decided_at?: string | null
          full_name: string
          id?: string
          note?: string | null
          phone: string
          status?: string
          user_id: string
        }
        Update: {
          amount_kzt?: number
          created_at?: string
          credits?: number
          decided_at?: string | null
          full_name?: string
          id?: string
          note?: string | null
          phone?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      point_checkins: {
        Row: {
          created_at: string
          depot_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          depot_id: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          depot_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_checkins_depot_id_fkey"
            columns: ["depot_id"]
            isOneToOne: false
            referencedRelation: "depots"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          admin_activated_at: string | null
          admin_city: string
          admin_region: string
          admin_region_code: string
          approved_count: number
          avatar_url: string | null
          birth_date: string | null
          city: string
          consent_data_at: string | null
          consent_privacy_at: string | null
          consent_terms_at: string | null
          created_at: string
          credits: number
          email_verified_at: string | null
          first_name: string
          full_name: string
          id: string
          last_name: string
          lat: number | null
          lng: number | null
          patronymic: string
          phone: string
          region: string
          region_code: string
          rejected_count: number
          settlement_id: number | null
          total_credits: number
          updated_at: string
          username: string | null
        }
        Insert: {
          admin_activated_at?: string | null
          admin_city?: string
          admin_region?: string
          admin_region_code?: string
          approved_count?: number
          avatar_url?: string | null
          birth_date?: string | null
          city?: string
          consent_data_at?: string | null
          consent_privacy_at?: string | null
          consent_terms_at?: string | null
          created_at?: string
          credits?: number
          email_verified_at?: string | null
          first_name?: string
          full_name?: string
          id: string
          last_name?: string
          lat?: number | null
          lng?: number | null
          patronymic?: string
          phone?: string
          region?: string
          region_code?: string
          rejected_count?: number
          settlement_id?: number | null
          total_credits?: number
          updated_at?: string
          username?: string | null
        }
        Update: {
          admin_activated_at?: string | null
          admin_city?: string
          admin_region?: string
          admin_region_code?: string
          approved_count?: number
          avatar_url?: string | null
          birth_date?: string | null
          city?: string
          consent_data_at?: string | null
          consent_privacy_at?: string | null
          consent_terms_at?: string | null
          created_at?: string
          credits?: number
          email_verified_at?: string | null
          first_name?: string
          full_name?: string
          id?: string
          last_name?: string
          lat?: number | null
          lng?: number | null
          patronymic?: string
          phone?: string
          region?: string
          region_code?: string
          rejected_count?: number
          settlement_id?: number | null
          total_credits?: number
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          address: string
          ai_reason: string
          approved: boolean
          assigned_at: string | null
          assigned_worker_id: string | null
          cleaned_at: string | null
          cleaned_photo_url: string | null
          comment: string
          created_at: string
          credits_awarded: number
          depot_id: string | null
          id: string
          lat: number
          lng: number
          photo_url: string
          region: string
          region_code: string
          severity: string
          status: string
          team_id: string | null
          updated_at: string
          user_id: string
          verified_at: string | null
          water_body: string
          worker_reward: number
        }
        Insert: {
          address?: string
          ai_reason?: string
          approved?: boolean
          assigned_at?: string | null
          assigned_worker_id?: string | null
          cleaned_at?: string | null
          cleaned_photo_url?: string | null
          comment?: string
          created_at?: string
          credits_awarded?: number
          depot_id?: string | null
          id?: string
          lat: number
          lng: number
          photo_url: string
          region?: string
          region_code?: string
          severity?: string
          status?: string
          team_id?: string | null
          updated_at?: string
          user_id: string
          verified_at?: string | null
          water_body?: string
          worker_reward?: number
        }
        Update: {
          address?: string
          ai_reason?: string
          approved?: boolean
          assigned_at?: string | null
          assigned_worker_id?: string | null
          cleaned_at?: string | null
          cleaned_photo_url?: string | null
          comment?: string
          created_at?: string
          credits_awarded?: number
          depot_id?: string | null
          id?: string
          lat?: number
          lng?: number
          photo_url?: string
          region?: string
          region_code?: string
          severity?: string
          status?: string
          team_id?: string | null
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          water_body?: string
          worker_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "reports_depot_id_fkey"
            columns: ["depot_id"]
            isOneToOne: false
            referencedRelation: "depots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          is_captain: boolean
          joined_at: string
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          is_captain?: boolean
          joined_at?: string
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          is_captain?: boolean
          joined_at?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_positions: {
        Row: {
          lat: number
          lng: number
          status: string
          target_report_id: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          lat: number
          lng: number
          status?: string
          target_report_id?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          lat?: number
          lng?: number
          status?: string
          target_report_id?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_positions_target_report_id_fkey"
            columns: ["target_report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_positions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          admin_topups_today: number
          captain_id: string | null
          created_at: string
          credits_balance: number
          daily_limit: number
          depot_id: string
          id: string
          refill_date: string
          region_code: string
          team_code: string
        }
        Insert: {
          admin_topups_today?: number
          captain_id?: string | null
          created_at?: string
          credits_balance?: number
          daily_limit?: number
          depot_id: string
          id?: string
          refill_date?: string
          region_code?: string
          team_code: string
        }
        Update: {
          admin_topups_today?: number
          captain_id?: string | null
          created_at?: string
          credits_balance?: number
          daily_limit?: number
          depot_id?: string
          id?: string
          refill_date?: string
          region_code?: string
          team_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_depot_id_fkey"
            columns: ["depot_id"]
            isOneToOne: false
            referencedRelation: "depots"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_admin_chats: {
        Row: {
          chat_id: number
          created_at: string
          title: string | null
        }
        Insert: {
          chat_id: number
          created_at?: string
          title?: string | null
        }
        Update: {
          chat_id?: number
          created_at?: string
          title?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      worker_applications: {
        Row: {
          about: string
          applicant_age: number | null
          birth_date: string | null
          city: string
          created_at: string
          doc_back_url: string | null
          doc_front_url: string | null
          doc_number: string
          doc_type: string
          experience: string
          father_name: string
          full_name: string
          has_transport: boolean
          id: string
          iin: string
          mother_name: string
          parent_consent: boolean
          parent_contact: string
          parent_doc_url: string | null
          parent_full_name: string
          phone: string
          region: string
          region_code: string
          review_note: string
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_url: string | null
          status: string
          telegram_notified_at: string | null
          user_id: string
        }
        Insert: {
          about?: string
          applicant_age?: number | null
          birth_date?: string | null
          city?: string
          created_at?: string
          doc_back_url?: string | null
          doc_front_url?: string | null
          doc_number?: string
          doc_type?: string
          experience?: string
          father_name?: string
          full_name: string
          has_transport?: boolean
          id?: string
          iin?: string
          mother_name?: string
          parent_consent?: boolean
          parent_contact?: string
          parent_doc_url?: string | null
          parent_full_name?: string
          phone: string
          region?: string
          region_code?: string
          review_note?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: string
          telegram_notified_at?: string | null
          user_id: string
        }
        Update: {
          about?: string
          applicant_age?: number | null
          birth_date?: string | null
          city?: string
          created_at?: string
          doc_back_url?: string | null
          doc_front_url?: string | null
          doc_number?: string
          doc_type?: string
          experience?: string
          father_name?: string
          full_name?: string
          has_transport?: boolean
          id?: string
          iin?: string
          mother_name?: string
          parent_consent?: boolean
          parent_contact?: string
          parent_doc_url?: string | null
          parent_full_name?: string
          phone?: string
          region?: string
          region_code?: string
          review_note?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: string
          telegram_notified_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      sync_app_user: { Args: { _user_id: string }; Returns: undefined }
    }
    Enums: {
      app_role:
        | "user"
        | "volunteer"
        | "worker"
        | "captain"
        | "moderator"
        | "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "user",
        "volunteer",
        "worker",
        "captain",
        "moderator",
        "admin",
      ],
    },
  },
} as const
