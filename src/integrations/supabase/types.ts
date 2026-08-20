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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
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
      profiles: {
        Row: {
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
          id: string
          lat: number
          lng: number
          photo_url: string
          region: string
          severity: string
          status: string
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
          id?: string
          lat: number
          lng: number
          photo_url: string
          region?: string
          severity?: string
          status?: string
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
          id?: string
          lat?: number
          lng?: number
          photo_url?: string
          region?: string
          severity?: string
          status?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          water_body?: string
          worker_reward?: number
        }
        Relationships: []
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
      can_access_thread: {
        Args: { _thread_id: string; _user_id: string }
        Returns: boolean
      }
      get_leaderboard: {
        Args: { _limit?: number }
        Returns: {
          approved_count: number
          city: string
          full_name: string
          id: string
          total_credits: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
