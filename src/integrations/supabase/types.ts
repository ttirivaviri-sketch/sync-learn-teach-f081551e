export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          created_at: string
          duration_minutes: number
          id: string
          learner_id: string
          price: number
          scheduled_at: string
          status: Database["public"]["Enums"]["booking_status"]
          tutor_id: string
          tutor_subject_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_minutes: number
          id?: string
          learner_id: string
          price: number
          scheduled_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          tutor_id: string
          tutor_subject_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          id?: string
          learner_id?: string
          price?: number
          scheduled_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          tutor_id?: string
          tutor_subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_tutor_subject_id_fkey"
            columns: ["tutor_subject_id"]
            isOneToOne: false
            referencedRelation: "tutor_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          learner_id: string
          tutor_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          learner_id: string
          tutor_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          learner_id?: string
          tutor_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      location_codes: {
        Row: {
          active: boolean
          city: string | null
          code: string
          created_at: string
          latitude: number | null
          longitude: number | null
          name: string
          region: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          city?: string | null
          code: string
          created_at?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          region?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          city?: string | null
          code?: string
          created_at?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          region?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      message_logs: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["message_channel"]
          created_at: string
          direction: Database["public"]["Enums"]["message_direction"]
          error: string | null
          from_msisdn: string | null
          id: string
          provider_message_id: string | null
          related_request_id: string | null
          to_msisdn: string | null
        }
        Insert: {
          body: string
          channel: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          direction: Database["public"]["Enums"]["message_direction"]
          error?: string | null
          from_msisdn?: string | null
          id?: string
          provider_message_id?: string | null
          related_request_id?: string | null
          to_msisdn?: string | null
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          direction?: Database["public"]["Enums"]["message_direction"]
          error?: string | null
          from_msisdn?: string | null
          id?: string
          provider_message_id?: string | null
          related_request_id?: string | null
          to_msisdn?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_logs_related_request_id_fkey"
            columns: ["related_request_id"]
            isOneToOne: false
            referencedRelation: "offline_booking_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          message_type: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          message_type?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          message_type?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      offline_booking_requests: {
        Row: {
          cell_tower_id: string | null
          channel: Database["public"]["Enums"]["message_channel"]
          created_at: string
          created_by_profile_id: string | null
          id: string
          learner_msisdn: string
          learner_profile_id: string | null
          location_code: string | null
          location_pin: string | null
          raw_payload: Json | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["offline_request_status"]
          subject_code: string | null
          subject_name: string | null
          tutor_msisdn: string | null
          tutor_profile_id: string | null
          updated_at: string
        }
        Insert: {
          cell_tower_id?: string | null
          channel: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          created_by_profile_id?: string | null
          id?: string
          learner_msisdn: string
          learner_profile_id?: string | null
          location_code?: string | null
          location_pin?: string | null
          raw_payload?: Json | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["offline_request_status"]
          subject_code?: string | null
          subject_name?: string | null
          tutor_msisdn?: string | null
          tutor_profile_id?: string | null
          updated_at?: string
        }
        Update: {
          cell_tower_id?: string | null
          channel?: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          created_by_profile_id?: string | null
          id?: string
          learner_msisdn?: string
          learner_profile_id?: string | null
          location_code?: string | null
          location_pin?: string | null
          raw_payload?: Json | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["offline_request_status"]
          subject_code?: string | null
          subject_name?: string | null
          tutor_msisdn?: string | null
          tutor_profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offline_booking_requests_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offline_booking_requests_learner_profile_id_fkey"
            columns: ["learner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offline_booking_requests_location_code_fkey"
            columns: ["location_code"]
            isOneToOne: false
            referencedRelation: "location_codes"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "offline_booking_requests_tutor_profile_id_fkey"
            columns: ["tutor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          currency: string
          id: string
          payer_id: string
          provider: string | null
          provider_ref: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          currency?: string
          id?: string
          payer_id: string
          provider?: string | null
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          currency?: string
          id?: string
          payer_id?: string
          provider?: string | null
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          study_level: Database["public"]["Enums"]["study_level"] | null
          updated_at: string
          user_type: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          study_level?: Database["public"]["Enums"]["study_level"] | null
          updated_at?: string
          user_type: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          study_level?: Database["public"]["Enums"]["study_level"] | null
          updated_at?: string
          user_type?: string
        }
        Relationships: []
      }
      qualifications: {
        Row: {
          created_at: string
          document_url: string | null
          id: string
          institution: string
          qualification_type: string
          user_id: string
          year_obtained: number | null
        }
        Insert: {
          created_at?: string
          document_url?: string | null
          id?: string
          institution: string
          qualification_type: string
          user_id: string
          year_obtained?: number | null
        }
        Update: {
          created_at?: string
          document_url?: string | null
          id?: string
          institution?: string
          qualification_type?: string
          user_id?: string
          year_obtained?: number | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          booking_id: string | null
          comment: string | null
          created_at: string
          id: string
          rating: number
          reviewed_id: string
          reviewer_id: string
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          reviewed_id: string
          reviewer_id: string
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          reviewed_id?: string
          reviewer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assignee_id: string | null
          created_at: string
          creator_id: string
          id: string
          message: string
          priority: Database["public"]["Enums"]["priority_level"]
          status: Database["public"]["Enums"]["support_status"]
          subject: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          creator_id: string
          id?: string
          message: string
          priority?: Database["public"]["Enums"]["priority_level"]
          status?: Database["public"]["Enums"]["support_status"]
          subject: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          creator_id?: string
          id?: string
          message?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          status?: Database["public"]["Enums"]["support_status"]
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_subjects: {
        Row: {
          created_at: string
          hourly_rate: number | null
          id: string
          level: string
          subject: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hourly_rate?: number | null
          id?: string
          level: string
          subject: string
          user_id: string
        }
        Update: {
          created_at?: string
          hourly_rate?: number | null
          id?: string
          level?: string
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      tutor_verifications: {
        Row: {
          created_at: string
          id: string
          id_document_url: string | null
          id_number: string | null
          police_clearance_url: string | null
          profile_photo_url: string | null
          updated_at: string
          user_id: string
          verification_status: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          id_document_url?: string | null
          id_number?: string | null
          police_clearance_url?: string | null
          profile_photo_url?: string | null
          updated_at?: string
          user_id: string
          verification_status?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          id_document_url?: string | null
          id_number?: string | null
          police_clearance_url?: string | null
          profile_photo_url?: string | null
          updated_at?: string
          user_id?: string
          verification_status?: string | null
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
      ussd_sessions: {
        Row: {
          created_at: string
          current_step: string | null
          data: Json | null
          id: string
          is_active: boolean
          msisdn: string
          provider_session_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_step?: string | null
          data?: Json | null
          id?: string
          is_active?: boolean
          msisdn: string
          provider_session_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_step?: string | null
          data?: Json | null
          id?: string
          is_active?: boolean
          msisdn?: string
          provider_session_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      verification_reviews: {
        Row: {
          created_at: string
          decision: Database["public"]["Enums"]["verification_decision"]
          id: string
          notes: string | null
          reviewer_id: string
          verification_id: string
        }
        Insert: {
          created_at?: string
          decision: Database["public"]["Enums"]["verification_decision"]
          id?: string
          notes?: string | null
          reviewer_id: string
          verification_id: string
        }
        Update: {
          created_at?: string
          decision?: Database["public"]["Enums"]["verification_decision"]
          id?: string
          notes?: string | null
          reviewer_id?: string
          verification_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_reviews_verification_id_fkey"
            columns: ["verification_id"]
            isOneToOne: false
            referencedRelation: "tutor_verifications"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _user_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin"
      booking_status: "requested" | "confirmed" | "completed" | "canceled"
      message_channel: "sms" | "ussd" | "whatsapp"
      message_direction: "inbound" | "outbound"
      offline_request_status:
        | "received"
        | "parsed"
        | "notified_tutor"
        | "tutor_confirmed"
        | "tutor_declined"
        | "synced"
        | "failed"
      payment_status: "pending" | "succeeded" | "failed" | "refunded"
      priority_level: "low" | "medium" | "high" | "urgent"
      study_level:
        | "junior_primary"
        | "senior_primary"
        | "junior_high"
        | "senior_high"
        | "tertiary"
      support_status: "open" | "in_progress" | "resolved" | "closed"
      verification_decision: "approved" | "rejected" | "needs_more_info"
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
      app_role: ["admin"],
      booking_status: ["requested", "confirmed", "completed", "canceled"],
      message_channel: ["sms", "ussd", "whatsapp"],
      message_direction: ["inbound", "outbound"],
      offline_request_status: [
        "received",
        "parsed",
        "notified_tutor",
        "tutor_confirmed",
        "tutor_declined",
        "synced",
        "failed",
      ],
      payment_status: ["pending", "succeeded", "failed", "refunded"],
      priority_level: ["low", "medium", "high", "urgent"],
      study_level: [
        "junior_primary",
        "senior_primary",
        "junior_high",
        "senior_high",
        "tertiary",
      ],
      support_status: ["open", "in_progress", "resolved", "closed"],
      verification_decision: ["approved", "rejected", "needs_more_info"],
    },
  },
} as const
