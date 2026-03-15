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
          room_name: string | null
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
          room_name?: string | null
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
          room_name?: string | null
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
      daily_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          is_completed: boolean
          is_locked: boolean
          subject_id: string | null
          task_date: string
          task_type: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_completed?: boolean
          is_locked?: boolean
          subject_id?: string | null
          task_date?: string
          task_type: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_completed?: boolean
          is_locked?: boolean
          subject_id?: string | null
          task_date?: string
          task_type?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_tasks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          file_path: string
          file_size: number | null
          id: string
          is_processed: boolean
          name: string
          parsed_content: Json | null
          subject: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_path: string
          file_size?: number | null
          id?: string
          is_processed?: boolean
          name: string
          parsed_content?: Json | null
          subject: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_path?: string
          file_size?: number | null
          id?: string
          is_processed?: boolean
          name?: string
          parsed_content?: Json | null
          subject?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      exam_patterns: {
        Row: {
          avg_marks: number | null
          created_at: string
          difficulty_level: string | null
          document_id: string | null
          frequency_score: number
          id: string
          question_types: Json | null
          subject_id: string
          topic_name: string
          user_id: string
          year: string | null
        }
        Insert: {
          avg_marks?: number | null
          created_at?: string
          difficulty_level?: string | null
          document_id?: string | null
          frequency_score?: number
          id?: string
          question_types?: Json | null
          subject_id: string
          topic_name: string
          user_id: string
          year?: string | null
        }
        Update: {
          avg_marks?: number | null
          created_at?: string
          difficulty_level?: string | null
          document_id?: string | null
          frequency_score?: number
          id?: string
          question_types?: Json | null
          subject_id?: string
          topic_name?: string
          user_id?: string
          year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_patterns_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_patterns_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_subjects: {
        Row: {
          created_at: string
          id: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_subjects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          related_booking_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          related_booking_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          related_booking_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_booking_id_fkey"
            columns: ["related_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
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
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          last_seen: string | null
          location_lat: number | null
          location_lng: number | null
          online_status: boolean | null
          phone: string | null
          study_level: Database["public"]["Enums"]["study_level"] | null
          updated_at: string
          user_type: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          last_seen?: string | null
          location_lat?: number | null
          location_lng?: number | null
          online_status?: boolean | null
          phone?: string | null
          study_level?: Database["public"]["Enums"]["study_level"] | null
          updated_at?: string
          user_type: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          last_seen?: string | null
          location_lat?: number | null
          location_lng?: number | null
          online_status?: boolean | null
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
      refund_requests: {
        Row: {
          admin_notes: string | null
          booking_id: string
          created_at: string
          id: string
          payment_id: string
          reason: string
          requester_id: string
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          booking_id: string
          created_at?: string
          id?: string
          payment_id: string
          reason: string
          requester_id: string
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          booking_id?: string
          created_at?: string
          id?: string
          payment_id?: string
          reason?: string
          requester_id?: string
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_requests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_requests_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
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
      security_audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: unknown
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      subjects: {
        Row: {
          created_at: string
          exam_patterns: Json | null
          id: string
          name: string
          syllabus_code: string | null
          topics: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exam_patterns?: Json | null
          id?: string
          name: string
          syllabus_code?: string | null
          topics?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          exam_patterns?: Json | null
          id?: string
          name?: string
          syllabus_code?: string | null
          topics?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      topic_mastery: {
        Row: {
          correct_attempts: number
          created_at: string
          id: string
          is_locked: boolean
          last_reviewed_at: string | null
          mastery_percentage: number
          next_review_at: string | null
          subject_id: string
          topic_name: string
          total_attempts: number
          updated_at: string
          user_id: string
        }
        Insert: {
          correct_attempts?: number
          created_at?: string
          id?: string
          is_locked?: boolean
          last_reviewed_at?: string | null
          mastery_percentage?: number
          next_review_at?: string | null
          subject_id: string
          topic_name: string
          total_attempts?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          correct_attempts?: number
          created_at?: string
          id?: string
          is_locked?: boolean
          last_reviewed_at?: string | null
          mastery_percentage?: number
          next_review_at?: string | null
          subject_id?: string
          topic_name?: string
          total_attempts?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_mastery_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_availability: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_available: boolean
          start_time: string
          tutor_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_available?: boolean
          start_time: string
          tutor_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_available?: boolean
          start_time?: string
          tutor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_availability_tutor_id_fkey"
            columns: ["tutor_id"]
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
      academic_profiles: {
        Row: {
          id: string
          user_id: string
          curriculum: string
          study_level: string
          subjects: string[]
          exam_board: string | null
          school_name: string | null
          target_grade: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          curriculum: string
          study_level: string
          subjects?: string[]
          exam_board?: string | null
          school_name?: string | null
          target_grade?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          curriculum?: string
          study_level?: string
          subjects?: string[]
          exam_board?: string | null
          school_name?: string | null
          target_grade?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          id: string
          user_id: string
          subject_id: string | null
          topic_name: string
          question: string
          model_answer: string | null
          user_answer: string | null
          was_correct: boolean
          marks_awarded: number | null
          marks_possible: number | null
          difficulty_rating: number | null
          command_word: string | null
          concepts_tested: string[] | null
          next_review_date: string | null
          review_count: number
          ease_factor: number
          interval_days: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          subject_id?: string | null
          topic_name: string
          question: string
          model_answer?: string | null
          user_answer?: string | null
          was_correct?: boolean
          marks_awarded?: number | null
          marks_possible?: number | null
          difficulty_rating?: number | null
          command_word?: string | null
          concepts_tested?: string[] | null
          next_review_date?: string | null
          review_count?: number
          ease_factor?: number
          interval_days?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          subject_id?: string | null
          topic_name?: string
          question?: string
          model_answer?: string | null
          user_answer?: string | null
          was_correct?: boolean
          marks_awarded?: number | null
          marks_possible?: number | null
          difficulty_rating?: number | null
          command_word?: string | null
          concepts_tested?: string[] | null
          next_review_date?: string | null
          review_count?: number
          ease_factor?: number
          interval_days?: number
          created_at?: string
        }
        Relationships: []
      }
      user_progress: {
        Row: {
          id: string
          user_id: string
          xp: number
          streak: number
          badges: Json
          last_study_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          xp?: number
          streak?: number
          badges?: Json
          last_study_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          xp?: number
          streak?: number
          badges?: Json
          last_study_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      study_schedule: {
        Row: {
          id: string
          user_id: string
          subject_id: string | null
          topic_name: string | null
          scheduled_date: string
          duration_minutes: number
          task_type: string
          is_completed: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          subject_id?: string | null
          topic_name?: string | null
          scheduled_date: string
          duration_minutes?: number
          task_type?: string
          is_completed?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          subject_id?: string | null
          topic_name?: string | null
          scheduled_date?: string
          duration_minutes?: number
          task_type?: string
          is_completed?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      subject_exams: {
        Row: {
          id: string
          user_id: string
          subject_id: string | null
          subject_name: string
          exam_name: string
          exam_date: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          subject_id?: string | null
          subject_name: string
          exam_name: string
          exam_date: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          subject_id?: string | null
          subject_name?: string
          exam_name?: string
          exam_date?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      exam_settings: {
        Row: {
          id: string
          user_id: string
          exam_name: string
          exam_date: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          exam_name: string
          exam_date: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          exam_name?: string
          exam_date?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      tutor_tutorials: {
        Row: {
          id: string
          tutor_id: string
          title: string
          description: string | null
          subject: string
          topic: string | null
          subtopic: string | null
          grade: string | null
          curriculum: string | null
          video_url: string | null
          thumbnail_url: string | null
          duration_label: string | null
          status: string
          rating: number | null
          review_count: number | null
          watch_count: number | null
          completion_rate: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tutor_id: string
          title: string
          description?: string | null
          subject: string
          topic?: string | null
          subtopic?: string | null
          grade?: string | null
          curriculum?: string | null
          video_url?: string | null
          thumbnail_url?: string | null
          duration_label?: string | null
          status?: string
          rating?: number | null
          review_count?: number | null
          watch_count?: number | null
          completion_rate?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tutor_id?: string
          title?: string
          description?: string | null
          subject?: string
          topic?: string | null
          subtopic?: string | null
          grade?: string | null
          curriculum?: string | null
          video_url?: string | null
          thumbnail_url?: string | null
          duration_label?: string | null
          status?: string
          rating?: number | null
          review_count?: number | null
          watch_count?: number | null
          completion_rate?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_security_event: {
        Args: {
          _action: string
          _details?: Json
          _ip_address?: unknown
          _user_agent?: string
          _user_id: string
        }
        Returns: string
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
