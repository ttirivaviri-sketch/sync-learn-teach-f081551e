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
      academic_profiles: {
        Row: {
          created_at: string | null
          curriculum: string | null
          exam_board: string | null
          exam_dates: Json | null
          exam_year: number | null
          goals: string | null
          grade: string | null
          guardian_email: string | null
          id: string
          learning_style: string | null
          school_name: string | null
          student_email: string | null
          study_level: string | null
          subjects: string[] | null
          target_grade: string | null
          updated_at: string | null
          user_id: string | null
          weekly_report_dow: number
        }
        Insert: {
          created_at?: string | null
          curriculum?: string | null
          exam_board?: string | null
          exam_dates?: Json | null
          exam_year?: number | null
          goals?: string | null
          grade?: string | null
          guardian_email?: string | null
          id?: string
          learning_style?: string | null
          school_name?: string | null
          student_email?: string | null
          study_level?: string | null
          subjects?: string[] | null
          target_grade?: string | null
          updated_at?: string | null
          user_id?: string | null
          weekly_report_dow?: number
        }
        Update: {
          created_at?: string | null
          curriculum?: string | null
          exam_board?: string | null
          exam_dates?: Json | null
          exam_year?: number | null
          goals?: string | null
          grade?: string | null
          guardian_email?: string | null
          id?: string
          learning_style?: string | null
          school_name?: string | null
          student_email?: string | null
          study_level?: string | null
          subjects?: string[] | null
          target_grade?: string | null
          updated_at?: string | null
          user_id?: string | null
          weekly_report_dow?: number
        }
        Relationships: []
      }
      ai_rate_limit_counters: {
        Row: {
          count: number
          fn: string
          updated_at: string
          user_id: string
          window_start: string
        }
        Insert: {
          count?: number
          fn: string
          updated_at?: string
          user_id: string
          window_start: string
        }
        Update: {
          count?: number
          fn?: string
          updated_at?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      ai_response_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          fn_name: string
          hits: number
          response: Json
          school_id: string | null
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at?: string
          fn_name: string
          hits?: number
          response: Json
          school_id?: string | null
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          fn_name?: string
          hits?: number
          response?: Json
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_response_cache_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_daily: {
        Row: {
          bucket: string
          requests: number
          tokens_in: number
          tokens_out: number
          updated_at: string
          usage_date: string
          user_id: string
        }
        Insert: {
          bucket: string
          requests?: number
          tokens_in?: number
          tokens_out?: number
          updated_at?: string
          usage_date?: string
          user_id: string
        }
        Update: {
          bucket?: string
          requests?: number
          tokens_in?: number
          tokens_out?: number
          updated_at?: string
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      analytics_reports: {
        Row: {
          created_at: string
          email_sent: boolean
          email_sent_at: string | null
          id: string
          report_type: string
          summary_json: Json
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          email_sent?: boolean
          email_sent_at?: string | null
          id?: string
          report_type?: string
          summary_json?: Json
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          email_sent?: boolean
          email_sent_at?: string | null
          id?: string
          report_type?: string
          summary_json?: Json
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          audience: Database["public"]["Enums"]["announcement_audience"]
          author_id: string
          body: string
          class_id: string | null
          created_at: string
          deleted_at: string | null
          grade_id: string | null
          id: string
          pinned: boolean
          school_id: string
          title: string
          updated_at: string
        }
        Insert: {
          audience?: Database["public"]["Enums"]["announcement_audience"]
          author_id: string
          body: string
          class_id?: string | null
          created_at?: string
          deleted_at?: string | null
          grade_id?: string | null
          id?: string
          pinned?: boolean
          school_id: string
          title: string
          updated_at?: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["announcement_audience"]
          author_id?: string
          body?: string
          class_id?: string | null
          created_at?: string
          deleted_at?: string | null
          grade_id?: string | null
          id?: string
          pinned?: boolean
          school_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          allow_late: boolean
          attachment_resource_ids: string[] | null
          class_id: string
          created_at: string
          deleted_at: string | null
          due_at: string | null
          id: string
          instructions: string | null
          max_score: number
          school_id: string
          status: Database["public"]["Enums"]["content_status"]
          subject_id: string | null
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          allow_late?: boolean
          attachment_resource_ids?: string[] | null
          class_id: string
          created_at?: string
          deleted_at?: string | null
          due_at?: string | null
          id?: string
          instructions?: string | null
          max_score?: number
          school_id: string
          status?: Database["public"]["Enums"]["content_status"]
          subject_id?: string | null
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          allow_late?: boolean
          attachment_resource_ids?: string[] | null
          class_id?: string
          created_at?: string
          deleted_at?: string | null
          due_at?: string | null
          id?: string
          instructions?: string | null
          max_score?: number
          school_id?: string
          status?: Database["public"]["Enums"]["content_status"]
          subject_id?: string | null
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "school_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          allocation_id: string | null
          created_at: string
          duration_minutes: number
          id: string
          learner_id: string
          price: number
          room_name: string | null
          scheduled_at: string
          source: string
          status: Database["public"]["Enums"]["booking_status"]
          tutor_id: string
          tutor_subject_id: string
          updated_at: string
        }
        Insert: {
          allocation_id?: string | null
          created_at?: string
          duration_minutes: number
          id?: string
          learner_id: string
          price: number
          room_name?: string | null
          scheduled_at: string
          source?: string
          status?: Database["public"]["Enums"]["booking_status"]
          tutor_id: string
          tutor_subject_id: string
          updated_at?: string
        }
        Update: {
          allocation_id?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          learner_id?: string
          price?: number
          room_name?: string | null
          scheduled_at?: string
          source?: string
          status?: Database["public"]["Enums"]["booking_status"]
          tutor_id?: string
          tutor_subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "tutor_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "tutors_public"
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
            foreignKeyName: "bookings_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors_public"
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
      class_subjects: {
        Row: {
          class_id: string
          created_at: string
          id: string
          school_id: string
          subject_id: string
          teacher_id: string | null
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          school_id: string
          subject_id: string
          teacher_id?: string | null
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          school_id?: string
          subject_id?: string
          teacher_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "school_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          code: string | null
          created_at: string
          curriculum: string | null
          deleted_at: string | null
          grade_id: string | null
          homeroom_teacher_id: string | null
          id: string
          name: string
          school_id: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          curriculum?: string | null
          deleted_at?: string | null
          grade_id?: string | null
          homeroom_teacher_id?: string | null
          id?: string
          name: string
          school_id: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          curriculum?: string | null
          deleted_at?: string | null
          grade_id?: string | null
          homeroom_teacher_id?: string | null
          id?: string
          name?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      companion_interactions: {
        Row: {
          created_at: string
          event: string
          id: string
          metadata: Json
          resource_id: string | null
          subject: string | null
          suggestion_id: string
          suggestion_kind: string
          topic: string | null
          tutor_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          metadata?: Json
          resource_id?: string | null
          subject?: string | null
          suggestion_id: string
          suggestion_kind: string
          topic?: string | null
          tutor_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          metadata?: Json
          resource_id?: string | null
          subject?: string | null
          suggestion_id?: string
          suggestion_kind?: string
          topic?: string | null
          tutor_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      concept_attempts: {
        Row: {
          concept_id: string | null
          concept_label: string
          created_at: string
          id: string
          marks_awarded: number
          marks_possible: number
          source_id: string | null
          source_table: string | null
          subject_name: string
          surface: string
          topic: string | null
          user_id: string
          was_correct: boolean
        }
        Insert: {
          concept_id?: string | null
          concept_label: string
          created_at?: string
          id?: string
          marks_awarded?: number
          marks_possible?: number
          source_id?: string | null
          source_table?: string | null
          subject_name: string
          surface: string
          topic?: string | null
          user_id: string
          was_correct?: boolean
        }
        Update: {
          concept_id?: string | null
          concept_label?: string
          created_at?: string
          id?: string
          marks_awarded?: number
          marks_possible?: number
          source_id?: string | null
          source_table?: string | null
          subject_name?: string
          surface?: string
          topic?: string | null
          user_id?: string
          was_correct?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "concept_attempts_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      concepts: {
        Row: {
          created_at: string
          curriculum: string
          description: string | null
          grade: string | null
          id: string
          label: string
          slug: string
          subject_id: string | null
          subject_name: string
          subtopic: string | null
          syllabus_ref: string | null
          topic: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          curriculum: string
          description?: string | null
          grade?: string | null
          id?: string
          label: string
          slug: string
          subject_id?: string | null
          subject_name: string
          subtopic?: string | null
          syllabus_ref?: string | null
          topic: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          curriculum?: string
          description?: string | null
          grade?: string | null
          id?: string
          label?: string
          slug?: string
          subject_id?: string | null
          subject_name?: string
          subtopic?: string | null
          syllabus_ref?: string | null
          topic?: string
          updated_at?: string
        }
        Relationships: []
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
      curriculum_topic_templates: {
        Row: {
          created_at: string
          curriculum: string
          grade: string
          source: string
          subject: string
          topics: Json
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          curriculum: string
          grade: string
          source?: string
          subject: string
          topics?: Json
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          curriculum?: string
          grade?: string
          source?: string
          subject?: string
          topics?: Json
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      daily_task_attempts: {
        Row: {
          block: string
          concept: string | null
          created_at: string
          daily_task_id: string | null
          difficulty: string | null
          id: string
          marks_awarded: number
          marks_possible: number
          model_answer: string | null
          question: string
          subject_id: string | null
          subject_name: string
          time_spent_seconds: number | null
          topic: string
          user_answer: string | null
          user_id: string
          was_correct: boolean
        }
        Insert: {
          block: string
          concept?: string | null
          created_at?: string
          daily_task_id?: string | null
          difficulty?: string | null
          id?: string
          marks_awarded?: number
          marks_possible?: number
          model_answer?: string | null
          question: string
          subject_id?: string | null
          subject_name: string
          time_spent_seconds?: number | null
          topic: string
          user_answer?: string | null
          user_id: string
          was_correct?: boolean
        }
        Update: {
          block?: string
          concept?: string | null
          created_at?: string
          daily_task_id?: string | null
          difficulty?: string | null
          id?: string
          marks_awarded?: number
          marks_possible?: number
          model_answer?: string | null
          question?: string
          subject_id?: string | null
          subject_name?: string
          time_spent_seconds?: number | null
          topic?: string
          user_answer?: string | null
          user_id?: string
          was_correct?: boolean
        }
        Relationships: []
      }
      daily_task_concepts: {
        Row: {
          concept: string
          concept_id: string | null
          coverage_count: number
          created_at: string
          id: string
          last_covered_at: string
          subject_id: string | null
          subject_name: string
          subtopic: string | null
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          concept: string
          concept_id?: string | null
          coverage_count?: number
          created_at?: string
          id?: string
          last_covered_at?: string
          subject_id?: string | null
          subject_name: string
          subtopic?: string | null
          topic: string
          updated_at?: string
          user_id: string
        }
        Update: {
          concept?: string
          concept_id?: string | null
          coverage_count?: number
          created_at?: string
          id?: string
          last_covered_at?: string
          subject_id?: string | null
          subject_name?: string
          subtopic?: string | null
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_task_concepts_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_tasks: {
        Row: {
          completed_at: string | null
          concepts_covered: string[] | null
          created_at: string
          description: string | null
          generation_meta: Json | null
          id: string
          is_completed: boolean
          is_locked: boolean
          selection_reason: string | null
          subject_id: string | null
          task_date: string
          task_payload: Json | null
          task_type: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          concepts_covered?: string[] | null
          created_at?: string
          description?: string | null
          generation_meta?: Json | null
          id?: string
          is_completed?: boolean
          is_locked?: boolean
          selection_reason?: string | null
          subject_id?: string | null
          task_date?: string
          task_payload?: Json | null
          task_type: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          concepts_covered?: string[] | null
          created_at?: string
          description?: string | null
          generation_meta?: Json | null
          id?: string
          is_completed?: boolean
          is_locked?: boolean
          selection_reason?: string | null
          subject_id?: string | null
          task_date?: string
          task_payload?: Json | null
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
      device_push_tokens: {
        Row: {
          created_at: string
          device_label: string | null
          id: string
          last_seen_at: string
          platform: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_label?: string | null
          id?: string
          last_seen_at?: string
          platform: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_label?: string | null
          id?: string
          last_seen_at?: string
          platform?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          document_type: string | null
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
          document_type?: string | null
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
          document_type?: string | null
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
      enrollments: {
        Row: {
          class_id: string
          created_at: string
          enrolled_at: string
          id: string
          school_id: string
          status: Database["public"]["Enums"]["enrollment_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          enrolled_at?: string
          id?: string
          school_id: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          enrolled_at?: string
          id?: string
          school_id?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
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
      exam_settings: {
        Row: {
          created_at: string | null
          exam_date: string | null
          exam_name: string | null
          id: string
          reminders_enabled: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          exam_date?: string | null
          exam_name?: string | null
          id?: string
          reminders_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          exam_date?: string | null
          exam_name?: string | null
          id?: string
          reminders_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      feedback_events: {
        Row: {
          comment: string | null
          context: Json
          created_at: string
          id: string
          kind: string
          rating: number | null
          reason: string | null
          sentiment: string | null
          subject_name: string | null
          surface: string
          topic_name: string | null
          user_id: string
        }
        Insert: {
          comment?: string | null
          context?: Json
          created_at?: string
          id?: string
          kind: string
          rating?: number | null
          reason?: string | null
          sentiment?: string | null
          subject_name?: string | null
          surface: string
          topic_name?: string | null
          user_id: string
        }
        Update: {
          comment?: string | null
          context?: Json
          created_at?: string
          id?: string
          kind?: string
          rating?: number | null
          reason?: string | null
          sentiment?: string | null
          subject_name?: string | null
          surface?: string
          topic_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      flashcards: {
        Row: {
          back: string
          class_id: string | null
          created_at: string | null
          difficulty: string | null
          ease_factor: number | null
          front: string
          generation_meta: Json | null
          hint: string | null
          id: string
          interval_days: number | null
          last_reviewed_at: string | null
          next_review_date: string | null
          repetitions: number | null
          school_id: string | null
          scope: string
          shared_template_id: string | null
          source_document_id: string | null
          subject: string
          subject_id: string | null
          tags: Json | null
          topic: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          back: string
          class_id?: string | null
          created_at?: string | null
          difficulty?: string | null
          ease_factor?: number | null
          front: string
          generation_meta?: Json | null
          hint?: string | null
          id?: string
          interval_days?: number | null
          last_reviewed_at?: string | null
          next_review_date?: string | null
          repetitions?: number | null
          school_id?: string | null
          scope?: string
          shared_template_id?: string | null
          source_document_id?: string | null
          subject: string
          subject_id?: string | null
          tags?: Json | null
          topic: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          back?: string
          class_id?: string | null
          created_at?: string | null
          difficulty?: string | null
          ease_factor?: number | null
          front?: string
          generation_meta?: Json | null
          hint?: string | null
          id?: string
          interval_days?: number | null
          last_reviewed_at?: string | null
          next_review_date?: string | null
          repetitions?: number | null
          school_id?: string | null
          scope?: string
          shared_template_id?: string | null
          source_document_id?: string | null
          subject?: string
          subject_id?: string | null
          tags?: Json | null
          topic?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_rates: {
        Row: {
          base: string
          fetched_at: string
          quote: string
          rate: number
        }
        Insert: {
          base: string
          fetched_at?: string
          quote: string
          rate: number
        }
        Update: {
          base?: string
          fetched_at?: string
          quote?: string
          rate?: number
        }
        Relationships: []
      }
      grades: {
        Row: {
          created_at: string
          id: string
          name: string
          school_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          school_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          school_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grades_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      guardian_links: {
        Row: {
          accepted_at: string | null
          created_at: string
          guardian_label: string | null
          guardian_user_id: string | null
          id: string
          invite_code: string
          learner_user_id: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          guardian_label?: string | null
          guardian_user_id?: string | null
          id?: string
          invite_code?: string
          learner_user_id: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          guardian_label?: string | null
          guardian_user_id?: string | null
          id?: string
          invite_code?: string
          learner_user_id?: string
          status?: string
        }
        Relationships: []
      }
      homework_reminder_sent: {
        Row: {
          homework_id: string
          id: string
          kind: string
          sent_at: string
          student_id: string
        }
        Insert: {
          homework_id: string
          id?: string
          kind: string
          sent_at?: string
          student_id: string
        }
        Update: {
          homework_id?: string
          id?: string
          kind?: string
          sent_at?: string
          student_id?: string
        }
        Relationships: []
      }
      ip_rate_limit_counters: {
        Row: {
          count: number
          fn: string
          ip: string
          updated_at: string
          window_start: string
        }
        Insert: {
          count?: number
          fn: string
          ip: string
          updated_at?: string
          window_start: string
        }
        Update: {
          count?: number
          fn?: string
          ip?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      kernel_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          assigned_homework_id: string | null
          avg_score: number | null
          created_at: string
          delta_students: number
          detected_at: string
          id: string
          resolved_at: string | null
          school_id: string
          severity: string
          status: string
          students_affected: number
          subject_id: string | null
          topic: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          assigned_homework_id?: string | null
          avg_score?: number | null
          created_at?: string
          delta_students?: number
          detected_at?: string
          id?: string
          resolved_at?: string | null
          school_id: string
          severity?: string
          status?: string
          students_affected?: number
          subject_id?: string | null
          topic: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          assigned_homework_id?: string | null
          avg_score?: number | null
          created_at?: string
          delta_students?: number
          detected_at?: string
          id?: string
          resolved_at?: string | null
          school_id?: string
          severity?: string
          status?: string
          students_affected?: number
          subject_id?: string | null
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kernel_alerts_assigned_homework_id_fkey"
            columns: ["assigned_homework_id"]
            isOneToOne: false
            referencedRelation: "school_homework"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kernel_alerts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_events: {
        Row: {
          created_at: string
          event: string
          id: string
          metadata: Json
          path: string | null
          referrer: string | null
          session_id: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          metadata?: Json
          path?: string | null
          referrer?: string | null
          session_id: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          metadata?: Json
          path?: string | null
          referrer?: string | null
          session_id?: string
        }
        Relationships: []
      }
      learner_state: {
        Row: {
          attempts: number
          avg_score_pct: number | null
          created_at: string
          ewma_score_pct: number | null
          id: string
          last_event_at: string | null
          last_score_pct: number | null
          mastery_pct: number
          risk_level: string
          sources: Json
          subject_id: string | null
          topic_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          avg_score_pct?: number | null
          created_at?: string
          ewma_score_pct?: number | null
          id?: string
          last_event_at?: string | null
          last_score_pct?: number | null
          mastery_pct?: number
          risk_level?: string
          sources?: Json
          subject_id?: string | null
          topic_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          avg_score_pct?: number | null
          created_at?: string
          ewma_score_pct?: number | null
          id?: string
          last_event_at?: string | null
          last_score_pct?: number | null
          mastery_pct?: number
          risk_level?: string
          sources?: Json
          subject_id?: string | null
          topic_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "learner_subjects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tutors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_concept_catalog: {
        Row: {
          command_words: string[]
          concept_name: string
          confidence: number | null
          created_at: string
          curriculum: string
          id: string
          ingested_at: string | null
          metadata: Json
          objective_type: string
          prerequisites: string[]
          source_document_id: string | null
          source_kind: string | null
          subject_id: string | null
          subject_name: string
          subtopic_name: string | null
          topic_name: string
          updated_at: string
        }
        Insert: {
          command_words?: string[]
          concept_name: string
          confidence?: number | null
          created_at?: string
          curriculum: string
          id?: string
          ingested_at?: string | null
          metadata?: Json
          objective_type?: string
          prerequisites?: string[]
          source_document_id?: string | null
          source_kind?: string | null
          subject_id?: string | null
          subject_name: string
          subtopic_name?: string | null
          topic_name: string
          updated_at?: string
        }
        Update: {
          command_words?: string[]
          concept_name?: string
          confidence?: number | null
          created_at?: string
          curriculum?: string
          id?: string
          ingested_at?: string | null
          metadata?: Json
          objective_type?: string
          prerequisites?: string[]
          source_document_id?: string | null
          source_kind?: string | null
          subject_id?: string | null
          subject_name?: string
          subtopic_name?: string | null
          topic_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      learning_concept_ingestion_staging: {
        Row: {
          command_words: string[]
          concept_name: string
          confidence: number
          created_at: string
          curriculum: string
          id: string
          metadata: Json
          objective_type: string
          prerequisites: string[]
          promoted_catalog_id: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          source_document_id: string | null
          source_kind: string
          status: string
          subject_id: string | null
          subject_name: string
          submitted_by_user_id: string | null
          subtopic_name: string | null
          topic_name: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          command_words?: string[]
          concept_name: string
          confidence?: number
          created_at?: string
          curriculum: string
          id?: string
          metadata?: Json
          objective_type?: string
          prerequisites?: string[]
          promoted_catalog_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          source_document_id?: string | null
          source_kind: string
          status?: string
          subject_id?: string | null
          subject_name: string
          submitted_by_user_id?: string | null
          subtopic_name?: string | null
          topic_name: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          command_words?: string[]
          concept_name?: string
          confidence?: number
          created_at?: string
          curriculum?: string
          id?: string
          metadata?: Json
          objective_type?: string
          prerequisites?: string[]
          promoted_catalog_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          source_document_id?: string | null
          source_kind?: string
          status?: string
          subject_id?: string | null
          subject_name?: string
          submitted_by_user_id?: string | null
          subtopic_name?: string | null
          topic_name?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_concept_ingestion_staging_promoted_catalog_id_fkey"
            columns: ["promoted_catalog_id"]
            isOneToOne: false
            referencedRelation: "learning_concept_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_concept_ingestion_staging_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "learning_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_concept_mastery_ledger: {
        Row: {
          concept_id: string | null
          concept_name: string
          confidence: number
          created_at: string
          evidence_source: string | null
          evidence_type: string
          id: string
          metadata: Json
          recorded_at: string
          score_delta: number
          subject_id: string | null
          subject_name: string
          topic_name: string
          user_id: string
        }
        Insert: {
          concept_id?: string | null
          concept_name: string
          confidence?: number
          created_at?: string
          evidence_source?: string | null
          evidence_type: string
          id?: string
          metadata?: Json
          recorded_at?: string
          score_delta?: number
          subject_id?: string | null
          subject_name: string
          topic_name: string
          user_id: string
        }
        Update: {
          concept_id?: string | null
          concept_name?: string
          confidence?: number
          created_at?: string
          evidence_source?: string | null
          evidence_type?: string
          id?: string
          metadata?: Json
          recorded_at?: string
          score_delta?: number
          subject_id?: string | null
          subject_name?: string
          topic_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_concept_mastery_ledger_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "learning_concept_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_concept_prerequisite_edges: {
        Row: {
          concept_id: string
          created_at: string
          id: string
          metadata: Json
          prerequisite_concept_id: string
          source_kind: string | null
          updated_at: string
          weight: number
        }
        Insert: {
          concept_id: string
          created_at?: string
          id?: string
          metadata?: Json
          prerequisite_concept_id: string
          source_kind?: string | null
          updated_at?: string
          weight?: number
        }
        Update: {
          concept_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          prerequisite_concept_id?: string
          source_kind?: string | null
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "learning_concept_prerequisite_edge_prerequisite_concept_id_fkey"
            columns: ["prerequisite_concept_id"]
            isOneToOne: false
            referencedRelation: "learning_concept_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_concept_prerequisite_edges_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "learning_concept_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_events: {
        Row: {
          created_at: string
          id: string
          mastery_delta: number | null
          occurred_at: string
          payload: Json
          school_id: string | null
          score_pct: number | null
          source: string
          subject_id: string | null
          topic_name: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mastery_delta?: number | null
          occurred_at?: string
          payload?: Json
          school_id?: string | null
          score_pct?: number | null
          source: string
          subject_id?: string | null
          topic_name?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mastery_delta?: number | null
          occurred_at?: string
          payload?: Json
          school_id?: string | null
          score_pct?: number | null
          source?: string
          subject_id?: string | null
          topic_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_intervention_events: {
        Row: {
          action_type: string
          actor_user_id: string
          created_at: string
          id: string
          intervention_id: string
          metadata: Json
          note: string | null
        }
        Insert: {
          action_type: string
          actor_user_id: string
          created_at?: string
          id?: string
          intervention_id: string
          metadata?: Json
          note?: string | null
        }
        Update: {
          action_type?: string
          actor_user_id?: string
          created_at?: string
          id?: string
          intervention_id?: string
          metadata?: Json
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_intervention_events_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "learning_intervention_outcomes"
            referencedColumns: ["intervention_id"]
          },
          {
            foreignKeyName: "learning_intervention_events_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "learning_intervention_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_intervention_queue: {
        Row: {
          acknowledged_at: string | null
          action_note: string | null
          assigned_role: string | null
          assigned_to_user_id: string | null
          created_at: string
          due_at: string | null
          id: string
          intervention_type: string
          last_action_at: string | null
          metadata: Json
          priority: string
          reason: string
          recommended_action: string
          resolved_at: string | null
          resolved_by_user_id: string | null
          status: string
          subject_id: string | null
          supporting_evidence: Json
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          action_note?: string | null
          assigned_role?: string | null
          assigned_to_user_id?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          intervention_type: string
          last_action_at?: string | null
          metadata?: Json
          priority?: string
          reason: string
          recommended_action: string
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          status?: string
          subject_id?: string | null
          supporting_evidence?: Json
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          action_note?: string | null
          assigned_role?: string | null
          assigned_to_user_id?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          intervention_type?: string
          last_action_at?: string | null
          metadata?: Json
          priority?: string
          reason?: string
          recommended_action?: string
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          status?: string
          subject_id?: string | null
          supporting_evidence?: Json
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_intervention_queue_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "learning_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_ops_automation_runs: {
        Row: {
          details: Json
          error_message: string | null
          finished_at: string | null
          id: string
          job_name: string
          rows_processed: number
          started_at: string
          status: string
          workspace_id: string | null
        }
        Insert: {
          details?: Json
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_name: string
          rows_processed?: number
          started_at?: string
          status?: string
          workspace_id?: string | null
        }
        Update: {
          details?: Json
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_name?: string
          rows_processed?: number
          started_at?: string
          status?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_ops_automation_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "learning_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_ops_automation_schedule: {
        Row: {
          cadence: string
          created_at: string
          enabled: boolean
          id: string
          job_name: string
          last_error: string | null
          last_run_at: string | null
          last_status: string | null
          metadata: Json
          next_run_at: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          cadence?: string
          created_at?: string
          enabled?: boolean
          id?: string
          job_name: string
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string | null
          metadata?: Json
          next_run_at?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          cadence?: string
          created_at?: string
          enabled?: boolean
          id?: string
          job_name?: string
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string | null
          metadata?: Json
          next_run_at?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_ops_automation_schedule_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "learning_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_ops_plan_proposals: {
        Row: {
          applied_schedule_id: string | null
          created_at: string
          duration_minutes: number
          id: string
          metadata: Json
          projected_risk: number | null
          proposed_for: string
          reason: string
          status: string
          subject_id: string | null
          subject_name: string
          topic_name: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          applied_schedule_id?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          metadata?: Json
          projected_risk?: number | null
          proposed_for: string
          reason?: string
          status?: string
          subject_id?: string | null
          subject_name: string
          topic_name: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          applied_schedule_id?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          metadata?: Json
          projected_risk?: number | null
          proposed_for?: string
          reason?: string
          status?: string
          subject_id?: string | null
          subject_name?: string
          topic_name?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_ops_plan_proposals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "learning_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_workspace_cohorts: {
        Row: {
          created_at: string
          curriculum: string | null
          grade_level: string | null
          id: string
          is_active: boolean
          lead_user_id: string | null
          metadata: Json
          name: string
          subject_names: string[]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          curriculum?: string | null
          grade_level?: string | null
          id?: string
          is_active?: boolean
          lead_user_id?: string | null
          metadata?: Json
          name: string
          subject_names?: string[]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          curriculum?: string | null
          grade_level?: string | null
          id?: string
          is_active?: boolean
          lead_user_id?: string | null
          metadata?: Json
          name?: string
          subject_names?: string[]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_workspace_cohorts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "learning_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_workspace_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by_user_id: string | null
          cohort_ids: string[]
          created_at: string
          email: string
          expires_at: string | null
          id: string
          invite_note: string | null
          invited_by_user_id: string
          metadata: Json
          role: string
          status: string
          token: string | null
          token_hash: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          cohort_ids?: string[]
          created_at?: string
          email: string
          expires_at?: string | null
          id?: string
          invite_note?: string | null
          invited_by_user_id: string
          metadata?: Json
          role?: string
          status?: string
          token?: string | null
          token_hash?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          cohort_ids?: string[]
          created_at?: string
          email?: string
          expires_at?: string | null
          id?: string
          invite_note?: string | null
          invited_by_user_id?: string
          metadata?: Json
          role?: string
          status?: string
          token?: string | null
          token_hash?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_workspace_invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "learning_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_workspace_member_cohorts: {
        Row: {
          cohort_id: string
          created_at: string
          id: string
          membership_id: string
          metadata: Json
          status: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          cohort_id: string
          created_at?: string
          id?: string
          membership_id: string
          metadata?: Json
          status?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          cohort_id?: string
          created_at?: string
          id?: string
          membership_id?: string
          metadata?: Json
          status?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_workspace_member_cohorts_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "learning_workspace_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_workspace_member_cohorts_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "learning_workspace_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_workspace_member_cohorts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "learning_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_workspace_memberships: {
        Row: {
          campus: string | null
          cohort_name: string | null
          created_at: string
          grade_level: string | null
          id: string
          metadata: Json
          role: string
          status: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          campus?: string | null
          cohort_name?: string | null
          created_at?: string
          grade_level?: string | null
          id?: string
          metadata?: Json
          role?: string
          status?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          campus?: string | null
          cohort_name?: string | null
          created_at?: string
          grade_level?: string | null
          id?: string
          metadata?: Json
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_workspace_memberships_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "learning_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_workspaces: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          name: string
          owner_user_id: string
          school_name: string | null
          slug: string
          updated_at: string
          workspace_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          owner_user_id: string
          school_name?: string | null
          slug: string
          updated_at?: string
          workspace_type?: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          owner_user_id?: string
          school_name?: string | null
          slug?: string
          updated_at?: string
          workspace_type?: string
        }
        Relationships: []
      }
      lesson_consents: {
        Row: {
          booking_id: string
          consented_at: string | null
          created_at: string
          id: string
          notes_consent: boolean
          recording_consent: boolean
          revoked_at: string | null
          transcription_consent: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_id: string
          consented_at?: string | null
          created_at?: string
          id?: string
          notes_consent?: boolean
          recording_consent?: boolean
          revoked_at?: string | null
          transcription_consent?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_id?: string
          consented_at?: string | null
          created_at?: string
          id?: string
          notes_consent?: boolean
          recording_consent?: boolean
          revoked_at?: string | null
          transcription_consent?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_consents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_notes: {
        Row: {
          action_items: Json
          audience: string
          booking_id: string
          created_at: string
          id: string
          key_points: Json
          owner_id: string
          summary: string | null
          updated_at: string
          vocabulary: Json
        }
        Insert: {
          action_items?: Json
          audience: string
          booking_id: string
          created_at?: string
          id?: string
          key_points?: Json
          owner_id: string
          summary?: string | null
          updated_at?: string
          vocabulary?: Json
        }
        Update: {
          action_items?: Json
          audience?: string
          booking_id?: string
          created_at?: string
          id?: string
          key_points?: Json
          owner_id?: string
          summary?: string | null
          updated_at?: string
          vocabulary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "lesson_notes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_recordings: {
        Row: {
          booking_id: string
          created_at: string
          duration_seconds: number | null
          error_message: string | null
          id: string
          learner_id: string
          status: string
          storage_path: string
          tutor_id: string
          updated_at: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          learner_id: string
          status?: string
          storage_path: string
          tutor_id: string
          updated_at?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          learner_id?: string
          status?: string
          storage_path?: string
          tutor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_recordings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_reinforcement_sets: {
        Row: {
          booking_id: string
          completed_at: string | null
          concepts: string[]
          created_at: string
          flashcards: Json
          id: string
          learner_id: string
          mastery_after: Json | null
          mastery_baseline: Json
          quiz: Json
          recording_id: string | null
          updated_at: string
        }
        Insert: {
          booking_id: string
          completed_at?: string | null
          concepts?: string[]
          created_at?: string
          flashcards?: Json
          id?: string
          learner_id: string
          mastery_after?: Json | null
          mastery_baseline?: Json
          quiz?: Json
          recording_id?: string | null
          updated_at?: string
        }
        Update: {
          booking_id?: string
          completed_at?: string | null
          concepts?: string[]
          created_at?: string
          flashcards?: Json
          id?: string
          learner_id?: string
          mastery_after?: Json | null
          mastery_baseline?: Json
          quiz?: Json
          recording_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_reinforcement_sets_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_reinforcement_sets_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "lesson_recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_retention_settings: {
        Row: {
          auto_delete_after_days: number
          created_at: string
          keep_notes_only: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_delete_after_days?: number
          created_at?: string
          keep_notes_only?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_delete_after_days?: number
          created_at?: string
          keep_notes_only?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lesson_topic_mapping: {
        Row: {
          booking_id: string
          concepts: string[]
          confidence: number | null
          coverage_score: number
          created_at: string
          evidence: Json | null
          id: string
          learner_id: string
          recommendation: string | null
          subject_id: string | null
          subject_name: string | null
          topic: string
          weak_concepts: string[]
        }
        Insert: {
          booking_id: string
          concepts?: string[]
          confidence?: number | null
          coverage_score?: number
          created_at?: string
          evidence?: Json | null
          id?: string
          learner_id: string
          recommendation?: string | null
          subject_id?: string | null
          subject_name?: string | null
          topic: string
          weak_concepts?: string[]
        }
        Update: {
          booking_id?: string
          concepts?: string[]
          confidence?: number | null
          coverage_score?: number
          created_at?: string
          evidence?: Json | null
          id?: string
          learner_id?: string
          recommendation?: string | null
          subject_id?: string | null
          subject_name?: string | null
          topic?: string
          weak_concepts?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "lesson_topic_mapping_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_transcripts: {
        Row: {
          booking_id: string
          created_at: string
          full_text: string
          id: string
          language: string | null
          recording_id: string
          segments: Json
        }
        Insert: {
          booking_id: string
          created_at?: string
          full_text: string
          id?: string
          language?: string | null
          recording_id: string
          segments?: Json
        }
        Update: {
          booking_id?: string
          created_at?: string
          full_text?: string
          id?: string
          language?: string | null
          recording_id?: string
          segments?: Json
        }
        Relationships: [
          {
            foreignKeyName: "lesson_transcripts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_transcripts_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: true
            referencedRelation: "lesson_recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      library_access_log: {
        Row: {
          created_at: string
          id: string
          resource_id: string
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          resource_id: string
          source: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          resource_id?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      library_saved_items: {
        Row: {
          id: string
          resource_id: string
          resource_type: string
          saved_at: string
          title: string
          user_id: string
        }
        Insert: {
          id?: string
          resource_id: string
          resource_type: string
          saved_at?: string
          title: string
          user_id: string
        }
        Update: {
          id?: string
          resource_id?: string
          resource_type?: string
          saved_at?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_saved_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_saved_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tutors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      library_system_resources: {
        Row: {
          created_at: string
          curriculum: string
          description: string | null
          grade_levels: string[]
          id: string
          kind: string
          marking_scheme_url: string | null
          pages: number | null
          paper_number: string | null
          paper_session: string | null
          paper_year: number | null
          pdf_url: string | null
          rights_note: string | null
          subject: string
          thumbnail_url: string | null
          title: string
          topic: string | null
          updated_at: string
          video_url: string | null
          view_count: number
        }
        Insert: {
          created_at?: string
          curriculum: string
          description?: string | null
          grade_levels?: string[]
          id?: string
          kind: string
          marking_scheme_url?: string | null
          pages?: number | null
          paper_number?: string | null
          paper_session?: string | null
          paper_year?: number | null
          pdf_url?: string | null
          rights_note?: string | null
          subject: string
          thumbnail_url?: string | null
          title: string
          topic?: string | null
          updated_at?: string
          video_url?: string | null
          view_count?: number
        }
        Update: {
          created_at?: string
          curriculum?: string
          description?: string | null
          grade_levels?: string[]
          id?: string
          kind?: string
          marking_scheme_url?: string | null
          pages?: number | null
          paper_number?: string | null
          paper_session?: string | null
          paper_year?: number | null
          pdf_url?: string | null
          rights_note?: string | null
          subject?: string
          thumbnail_url?: string | null
          title?: string
          topic?: string | null
          updated_at?: string
          video_url?: string | null
          view_count?: number
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
      manual_payment_requests: {
        Row: {
          access_days: number
          amount: number
          created_at: string
          currency: string
          id: string
          method: string
          proof_path: string | null
          reference: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_days?: number
          amount: number
          created_at?: string
          currency?: string
          id?: string
          method: string
          proof_path?: string | null
          reference: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_days?: number
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          method?: string
          proof_path?: string | null
          reference?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
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
      mock_exam_attempts: {
        Row: {
          answers_json: Json
          created_at: string
          duration_minutes: number | null
          generation_meta: Json | null
          grade_band: string | null
          grading_json: Json
          id: string
          marks_awarded: number
          paper_code: string
          paper_json: Json
          percent: number
          started_at: string
          status: string
          subject_id: string
          subject_name: string
          submitted_at: string | null
          time_taken_seconds: number | null
          total_marks: number
          updated_at: string
          user_id: string
        }
        Insert: {
          answers_json?: Json
          created_at?: string
          duration_minutes?: number | null
          generation_meta?: Json | null
          grade_band?: string | null
          grading_json?: Json
          id?: string
          marks_awarded?: number
          paper_code: string
          paper_json?: Json
          percent?: number
          started_at?: string
          status?: string
          subject_id: string
          subject_name: string
          submitted_at?: string | null
          time_taken_seconds?: number | null
          total_marks?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          answers_json?: Json
          created_at?: string
          duration_minutes?: number | null
          generation_meta?: Json | null
          grade_band?: string | null
          grading_json?: Json
          id?: string
          marks_awarded?: number
          paper_code?: string
          paper_json?: Json
          percent?: number
          started_at?: string
          status?: string
          subject_id?: string
          subject_name?: string
          submitted_at?: string | null
          time_taken_seconds?: number | null
          total_marks?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          due_soon_alerts: boolean
          homework_release_alerts: boolean
          push_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          due_soon_alerts?: boolean
          homework_release_alerts?: boolean
          push_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          due_soon_alerts?: boolean
          homework_release_alerts?: boolean
          push_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
            foreignKeyName: "offline_booking_requests_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "tutors_public"
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
            foreignKeyName: "offline_booking_requests_learner_profile_id_fkey"
            columns: ["learner_profile_id"]
            isOneToOne: false
            referencedRelation: "tutors_public"
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
          {
            foreignKeyName: "offline_booking_requests_tutor_profile_id_fkey"
            columns: ["tutor_profile_id"]
            isOneToOne: false
            referencedRelation: "tutors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      paper_blueprints: {
        Row: {
          command_word_frequency: Json
          created_at: string
          difficulty_distribution: Json
          duration_minutes: number | null
          id: string
          paper_code: string
          question_type_distribution: Json
          subject_id: string
          subject_name: string
          topic_coverage: Json
          total_marks: number | null
          updated_at: string
          user_id: string
          years_analysed: string[]
        }
        Insert: {
          command_word_frequency?: Json
          created_at?: string
          difficulty_distribution?: Json
          duration_minutes?: number | null
          id?: string
          paper_code: string
          question_type_distribution?: Json
          subject_id: string
          subject_name: string
          topic_coverage?: Json
          total_marks?: number | null
          updated_at?: string
          user_id: string
          years_analysed?: string[]
        }
        Update: {
          command_word_frequency?: Json
          created_at?: string
          difficulty_distribution?: Json
          duration_minutes?: number | null
          id?: string
          paper_code?: string
          question_type_distribution?: Json
          subject_id?: string
          subject_name?: string
          topic_coverage?: Json
          total_marks?: number | null
          updated_at?: string
          user_id?: string
          years_analysed?: string[]
        }
        Relationships: []
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
          {
            foreignKeyName: "payments_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "tutors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_requests: {
        Row: {
          admin_note: string | null
          amount: number
          bank_account_holder: string
          bank_account_number: string
          bank_branch_code: string | null
          bank_name: string
          created_at: string
          currency: string
          id: string
          method: string
          processed_at: string | null
          processed_by: string | null
          status: string
          tutor_id: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          bank_account_holder: string
          bank_account_number: string
          bank_branch_code?: string | null
          bank_name: string
          created_at?: string
          currency?: string
          id?: string
          method?: string
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          tutor_id: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          bank_account_holder?: string
          bank_account_number?: string
          bank_branch_code?: string | null
          bank_name?: string
          created_at?: string
          currency?: string
          id?: string
          method?: string
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          tutor_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      photo_solve_attempts: {
        Row: {
          confidence: number | null
          created_at: string
          curriculum: string | null
          final_answer: string | null
          final_answer_correct: boolean | null
          id: string
          marks_awarded: number | null
          marks_possible: number | null
          missed_steps: Json
          model_solution: string | null
          next_hint: string | null
          practice_questions: Json | null
          practice_score_pct: number | null
          practiced_at: string | null
          question_detected: string | null
          steps: Json
          subject_name: string | null
          topic_name: string | null
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          curriculum?: string | null
          final_answer?: string | null
          final_answer_correct?: boolean | null
          id?: string
          marks_awarded?: number | null
          marks_possible?: number | null
          missed_steps?: Json
          model_solution?: string | null
          next_hint?: string | null
          practice_questions?: Json | null
          practice_score_pct?: number | null
          practiced_at?: string | null
          question_detected?: string | null
          steps?: Json
          subject_name?: string | null
          topic_name?: string | null
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          curriculum?: string | null
          final_answer?: string | null
          final_answer_correct?: boolean | null
          id?: string
          marks_awarded?: number | null
          marks_possible?: number | null
          missed_steps?: Json
          model_solution?: string | null
          next_hint?: string | null
          practice_questions?: Json | null
          practice_score_pct?: number | null
          practiced_at?: string | null
          question_detected?: string | null
          steps?: Json
          subject_name?: string | null
          topic_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          country: string | null
          created_at: string
          currency: string | null
          email: string
          full_name: string | null
          id: string
          is_official: boolean
          is_suspended: boolean
          last_seen: string | null
          location_lat: number | null
          location_lng: number | null
          onboarding_completed_at: string | null
          online_status: boolean | null
          phone: string | null
          study_level: Database["public"]["Enums"]["study_level"] | null
          suspended_at: string | null
          suspended_reason: string | null
          terms_accepted_at: string | null
          terms_version: string | null
          updated_at: string
          user_type: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          email: string
          full_name?: string | null
          id: string
          is_official?: boolean
          is_suspended?: boolean
          last_seen?: string | null
          location_lat?: number | null
          location_lng?: number | null
          onboarding_completed_at?: string | null
          online_status?: boolean | null
          phone?: string | null
          study_level?: Database["public"]["Enums"]["study_level"] | null
          suspended_at?: string | null
          suspended_reason?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
          user_type: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_official?: boolean
          is_suspended?: boolean
          last_seen?: string | null
          location_lat?: number | null
          location_lng?: number | null
          onboarding_completed_at?: string | null
          online_status?: boolean | null
          phone?: string | null
          study_level?: Database["public"]["Enums"]["study_level"] | null
          suspended_at?: string | null
          suspended_reason?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
          user_type?: string
        }
        Relationships: []
      }
      progress_reports: {
        Row: {
          ai_plan_json: Json
          audience: string
          created_at: string
          expires_at: string
          generated_at: string
          id: string
          learner_id: string
          summary_json: Json
          tutor_id: string | null
        }
        Insert: {
          ai_plan_json?: Json
          audience?: string
          created_at?: string
          expires_at?: string
          generated_at?: string
          id?: string
          learner_id: string
          summary_json?: Json
          tutor_id?: string | null
        }
        Update: {
          ai_plan_json?: Json
          audience?: string
          created_at?: string
          expires_at?: string
          generated_at?: string
          id?: string
          learner_id?: string
          summary_json?: Json
          tutor_id?: string | null
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
      question_fingerprints: {
        Row: {
          embedding: string | null
          fingerprint: string
          id: string
          seen_at: string
          stem_preview: string | null
          subject_id: string | null
          subject_name: string | null
          surface: string
          user_id: string
        }
        Insert: {
          embedding?: string | null
          fingerprint: string
          id?: string
          seen_at?: string
          stem_preview?: string | null
          subject_id?: string | null
          subject_name?: string | null
          surface: string
          user_id: string
        }
        Update: {
          embedding?: string | null
          fingerprint?: string
          id?: string
          seen_at?: string
          stem_preview?: string | null
          subject_id?: string | null
          subject_name?: string | null
          surface?: string
          user_id?: string
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          command_word: string | null
          concepts_tested: string[] | null
          created_at: string | null
          difficulty_rating: number | null
          ease_factor: number | null
          generation_meta: Json | null
          id: string
          interval_days: number | null
          marks_awarded: number | null
          marks_possible: number | null
          model_answer: string | null
          next_review_date: string | null
          question: string | null
          review_count: number | null
          subject_id: string | null
          topic_name: string | null
          user_answer: string | null
          user_id: string | null
          was_correct: boolean | null
        }
        Insert: {
          command_word?: string | null
          concepts_tested?: string[] | null
          created_at?: string | null
          difficulty_rating?: number | null
          ease_factor?: number | null
          generation_meta?: Json | null
          id?: string
          interval_days?: number | null
          marks_awarded?: number | null
          marks_possible?: number | null
          model_answer?: string | null
          next_review_date?: string | null
          question?: string | null
          review_count?: number | null
          subject_id?: string | null
          topic_name?: string | null
          user_answer?: string | null
          user_id?: string | null
          was_correct?: boolean | null
        }
        Update: {
          command_word?: string | null
          concepts_tested?: string[] | null
          created_at?: string | null
          difficulty_rating?: number | null
          ease_factor?: number | null
          generation_meta?: Json | null
          id?: string
          interval_days?: number | null
          marks_awarded?: number | null
          marks_possible?: number | null
          model_answer?: string | null
          next_review_date?: string | null
          question?: string | null
          review_count?: number | null
          subject_id?: string | null
          topic_name?: string | null
          user_answer?: string | null
          user_id?: string | null
          was_correct?: boolean | null
        }
        Relationships: []
      }
      quiz_questions: {
        Row: {
          answer: Json | null
          created_at: string
          id: string
          marks: number
          options: Json | null
          ord: number
          prompt: string
          quiz_id: string
          school_id: string
          type: Database["public"]["Enums"]["quiz_question_type"]
          updated_at: string
        }
        Insert: {
          answer?: Json | null
          created_at?: string
          id?: string
          marks?: number
          options?: Json | null
          ord?: number
          prompt: string
          quiz_id: string
          school_id: string
          type: Database["public"]["Enums"]["quiz_question_type"]
          updated_at?: string
        }
        Update: {
          answer?: Json | null
          created_at?: string
          id?: string
          marks?: number
          options?: Json | null
          ord?: number
          prompt?: string
          quiz_id?: string
          school_id?: string
          type?: Database["public"]["Enums"]["quiz_question_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_questions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          ai_generated: boolean
          attempts_allowed: number
          class_id: string
          created_at: string
          deleted_at: string | null
          due_at: string | null
          id: string
          instructions: string | null
          school_id: string
          source_resource_id: string | null
          status: Database["public"]["Enums"]["content_status"]
          subject_id: string | null
          teacher_id: string
          time_limit_min: number | null
          title: string
          updated_at: string
        }
        Insert: {
          ai_generated?: boolean
          attempts_allowed?: number
          class_id: string
          created_at?: string
          deleted_at?: string | null
          due_at?: string | null
          id?: string
          instructions?: string | null
          school_id: string
          source_resource_id?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          subject_id?: string | null
          teacher_id: string
          time_limit_min?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          ai_generated?: boolean
          attempts_allowed?: number
          class_id?: string
          created_at?: string
          deleted_at?: string | null
          due_at?: string | null
          id?: string
          instructions?: string | null
          school_id?: string
          source_resource_id?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          subject_id?: string | null
          teacher_id?: string
          time_limit_min?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_source_resource_id_fkey"
            columns: ["source_resource_id"]
            isOneToOne: false
            referencedRelation: "school_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "school_subjects"
            referencedColumns: ["id"]
          },
        ]
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
      remediation_baselines: {
        Row: {
          baseline_ewma: number | null
          baseline_risk: string | null
          captured_at: string
          homework_id: string
          id: string
          school_id: string
          student_id: string
          topic: string
        }
        Insert: {
          baseline_ewma?: number | null
          baseline_risk?: string | null
          captured_at?: string
          homework_id: string
          id?: string
          school_id: string
          student_id: string
          topic: string
        }
        Update: {
          baseline_ewma?: number | null
          baseline_risk?: string | null
          captured_at?: string
          homework_id?: string
          id?: string
          school_id?: string
          student_id?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "remediation_baselines_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "school_homework"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remediation_baselines_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
      sail_agent_logs: {
        Row: {
          action: string
          agent: Database["public"]["Enums"]["sail_agent_type"]
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          input: Json | null
          output: Json | null
          success: boolean
          task_id: string
        }
        Insert: {
          action: string
          agent: Database["public"]["Enums"]["sail_agent_type"]
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input?: Json | null
          output?: Json | null
          success?: boolean
          task_id: string
        }
        Update: {
          action?: string
          agent?: Database["public"]["Enums"]["sail_agent_type"]
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input?: Json | null
          output?: Json | null
          success?: boolean
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sail_agent_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "sail_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      sail_detection_signals: {
        Row: {
          auto_create_task: boolean | null
          created_at: string | null
          data: Json | null
          description: string | null
          id: string
          severity: string
          source: string
          suggested_agent: string | null
          suggested_priority: string | null
          suggested_task_type: string | null
          title: string
        }
        Insert: {
          auto_create_task?: boolean | null
          created_at?: string | null
          data?: Json | null
          description?: string | null
          id?: string
          severity?: string
          source: string
          suggested_agent?: string | null
          suggested_priority?: string | null
          suggested_task_type?: string | null
          title: string
        }
        Update: {
          auto_create_task?: boolean | null
          created_at?: string | null
          data?: Json | null
          description?: string | null
          id?: string
          severity?: string
          source?: string
          suggested_agent?: string | null
          suggested_priority?: string | null
          suggested_task_type?: string | null
          title?: string
        }
        Relationships: []
      }
      sail_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          processed: boolean
          severity: Database["public"]["Enums"]["sail_risk_level"]
          source: string
          task_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          processed?: boolean
          severity?: Database["public"]["Enums"]["sail_risk_level"]
          source: string
          task_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean
          severity?: Database["public"]["Enums"]["sail_risk_level"]
          source?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sail_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "sail_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      sail_pipelines: {
        Row: {
          agent: string
          approved_at: string | null
          approved_by: string | null
          branch_name: string
          created_at: string | null
          diff_summary: string | null
          id: string
          preview_url: string | null
          rejection_reason: string | null
          risk_level: string
          stage: string
          task_id: string | null
          test_results: Json | null
          updated_at: string | null
        }
        Insert: {
          agent: string
          approved_at?: string | null
          approved_by?: string | null
          branch_name: string
          created_at?: string | null
          diff_summary?: string | null
          id?: string
          preview_url?: string | null
          rejection_reason?: string | null
          risk_level?: string
          stage?: string
          task_id?: string | null
          test_results?: Json | null
          updated_at?: string | null
        }
        Update: {
          agent?: string
          approved_at?: string | null
          approved_by?: string | null
          branch_name?: string
          created_at?: string | null
          diff_summary?: string | null
          id?: string
          preview_url?: string | null
          rejection_reason?: string | null
          risk_level?: string
          stage?: string
          task_id?: string | null
          test_results?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sail_pipelines_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "sail_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      sail_tasks: {
        Row: {
          agent: Database["public"]["Enums"]["sail_agent_type"]
          approval_required: boolean
          approved_at: string | null
          approved_by: string | null
          code_patch: string | null
          context: Json
          created_at: string
          description: string
          id: string
          priority: Database["public"]["Enums"]["priority_level"]
          rejection_reason: string | null
          risk_level: Database["public"]["Enums"]["sail_risk_level"]
          status: Database["public"]["Enums"]["sail_task_status"]
          title: string
          type: Database["public"]["Enums"]["sail_task_type"]
          updated_at: string
        }
        Insert: {
          agent: Database["public"]["Enums"]["sail_agent_type"]
          approval_required?: boolean
          approved_at?: string | null
          approved_by?: string | null
          code_patch?: string | null
          context?: Json
          created_at?: string
          description?: string
          id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          rejection_reason?: string | null
          risk_level?: Database["public"]["Enums"]["sail_risk_level"]
          status?: Database["public"]["Enums"]["sail_task_status"]
          title: string
          type: Database["public"]["Enums"]["sail_task_type"]
          updated_at?: string
        }
        Update: {
          agent?: Database["public"]["Enums"]["sail_agent_type"]
          approval_required?: boolean
          approved_at?: string | null
          approved_by?: string | null
          code_patch?: string | null
          context?: Json
          created_at?: string
          description?: string
          id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          rejection_reason?: string | null
          risk_level?: Database["public"]["Enums"]["sail_risk_level"]
          status?: Database["public"]["Enums"]["sail_task_status"]
          title?: string
          type?: Database["public"]["Enums"]["sail_task_type"]
          updated_at?: string
        }
        Relationships: []
      }
      saved_payment_methods: {
        Row: {
          card_bank: string | null
          card_brand: string | null
          card_exp_month: string | null
          card_exp_year: string | null
          card_last4: string | null
          created_at: string | null
          id: string
          is_default: boolean | null
          paystack_authorization_code: string | null
          paystack_signature: string | null
          provider: string
          token: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          card_bank?: string | null
          card_brand?: string | null
          card_exp_month?: string | null
          card_exp_year?: string | null
          card_last4?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          paystack_authorization_code?: string | null
          paystack_signature?: string | null
          provider?: string
          token: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          card_bank?: string | null
          card_brand?: string | null
          card_exp_month?: string | null
          card_exp_year?: string | null
          card_last4?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          paystack_authorization_code?: string | null
          paystack_signature?: string | null
          provider?: string
          token?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      scheduled_insight_runs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          sent_to_guardian: boolean
          sent_to_tutors: string[]
          status: string
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          sent_to_guardian?: boolean
          sent_to_tutors?: string[]
          status?: string
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          sent_to_guardian?: boolean
          sent_to_tutors?: string[]
          status?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      school_ai_chunks: {
        Row: {
          class_id: string | null
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          metadata: Json
          ord: number
          school_id: string
          subject_id: string | null
        }
        Insert: {
          class_id?: string | null
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          metadata?: Json
          ord?: number
          school_id: string
          subject_id?: string | null
        }
        Update: {
          class_id?: string | null
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          ord?: number
          school_id?: string
          subject_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_ai_chunks_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_ai_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "school_ai_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_ai_chunks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_ai_chunks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "school_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      school_ai_documents: {
        Row: {
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          page_count: number | null
          resource_id: string | null
          school_id: string
          status: string
          title: string | null
          total_tokens: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          page_count?: number | null
          resource_id?: string | null
          school_id: string
          status?: string
          title?: string | null
          total_tokens?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          page_count?: number | null
          resource_id?: string | null
          school_id?: string
          status?: string
          title?: string | null
          total_tokens?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_ai_documents_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "school_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_ai_documents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_ai_usage_daily: {
        Row: {
          bucket: string
          requests: number
          school_id: string
          tokens_in: number
          tokens_out: number
          updated_at: string
          usage_date: string
        }
        Insert: {
          bucket?: string
          requests?: number
          school_id: string
          tokens_in?: number
          tokens_out?: number
          updated_at?: string
          usage_date?: string
        }
        Update: {
          bucket?: string
          requests?: number
          school_id?: string
          tokens_in?: number
          tokens_out?: number
          updated_at?: string
          usage_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_ai_usage_daily_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_analytics_daily: {
        Row: {
          active_users: number
          ai_requests: number
          assignments_created: number
          day: string
          graded_submissions: number
          lessons: number
          quiz_attempts: number
          school_id: string
          storage_mb: number
          submissions: number
          updated_at: string
        }
        Insert: {
          active_users?: number
          ai_requests?: number
          assignments_created?: number
          day?: string
          graded_submissions?: number
          lessons?: number
          quiz_attempts?: number
          school_id: string
          storage_mb?: number
          submissions?: number
          updated_at?: string
        }
        Update: {
          active_users?: number
          ai_requests?: number
          assignments_created?: number
          day?: string
          graded_submissions?: number
          lessons?: number
          quiz_attempts?: number
          school_id?: string
          storage_mb?: number
          submissions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_analytics_daily_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          diff: Json | null
          id: string
          ip: string | null
          school_id: string
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          id?: string
          ip?: string | null
          school_id: string
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          id?: string
          ip?: string | null
          school_id?: string
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_audit_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_homework: {
        Row: {
          auto_release_feedback: boolean
          auto_release_grades: boolean
          class_id: string
          created_at: string
          difficulty: string
          due_at: string | null
          id: string
          instructions: string | null
          is_remediation: boolean
          remediation_topic: string | null
          school_id: string
          source_document_id: string | null
          status: string
          subject_id: string | null
          teacher_id: string
          title: string
          topic: string | null
          total_marks: number
          updated_at: string
        }
        Insert: {
          auto_release_feedback?: boolean
          auto_release_grades?: boolean
          class_id: string
          created_at?: string
          difficulty?: string
          due_at?: string | null
          id?: string
          instructions?: string | null
          is_remediation?: boolean
          remediation_topic?: string | null
          school_id: string
          source_document_id?: string | null
          status?: string
          subject_id?: string | null
          teacher_id: string
          title: string
          topic?: string | null
          total_marks?: number
          updated_at?: string
        }
        Update: {
          auto_release_feedback?: boolean
          auto_release_grades?: boolean
          class_id?: string
          created_at?: string
          difficulty?: string
          due_at?: string | null
          id?: string
          instructions?: string | null
          is_remediation?: boolean
          remediation_topic?: string | null
          school_id?: string
          source_document_id?: string | null
          status?: string
          subject_id?: string | null
          teacher_id?: string
          title?: string
          topic?: string | null
          total_marks?: number
          updated_at?: string
        }
        Relationships: []
      }
      school_homework_questions: {
        Row: {
          common_mistakes: string | null
          concepts: string[] | null
          created_at: string
          examiner_notes: string | null
          expected_answer: string | null
          homework_id: string
          id: string
          marks: number
          options: Json | null
          ord: number
          prompt: string
          question_type: string
          school_id: string
          visual: Json | null
        }
        Insert: {
          common_mistakes?: string | null
          concepts?: string[] | null
          created_at?: string
          examiner_notes?: string | null
          expected_answer?: string | null
          homework_id: string
          id?: string
          marks?: number
          options?: Json | null
          ord: number
          prompt: string
          question_type?: string
          school_id: string
          visual?: Json | null
        }
        Update: {
          common_mistakes?: string | null
          concepts?: string[] | null
          created_at?: string
          examiner_notes?: string | null
          expected_answer?: string | null
          homework_id?: string
          id?: string
          marks?: number
          options?: Json | null
          ord?: number
          prompt?: string
          question_type?: string
          school_id?: string
          visual?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "school_homework_questions_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "school_homework"
            referencedColumns: ["id"]
          },
        ]
      }
      school_homework_responses: {
        Row: {
          ai_feedback: Json | null
          ai_score: number | null
          created_at: string
          homework_id: string
          id: string
          marked_at: string | null
          question_id: string
          released_at: string | null
          school_id: string
          status: string
          student_answer: string | null
          student_id: string
          submitted_at: string | null
          teacher_comment: string | null
          teacher_score: number | null
          updated_at: string
        }
        Insert: {
          ai_feedback?: Json | null
          ai_score?: number | null
          created_at?: string
          homework_id: string
          id?: string
          marked_at?: string | null
          question_id: string
          released_at?: string | null
          school_id: string
          status?: string
          student_answer?: string | null
          student_id: string
          submitted_at?: string | null
          teacher_comment?: string | null
          teacher_score?: number | null
          updated_at?: string
        }
        Update: {
          ai_feedback?: Json | null
          ai_score?: number | null
          created_at?: string
          homework_id?: string
          id?: string
          marked_at?: string | null
          question_id?: string
          released_at?: string | null
          school_id?: string
          status?: string
          student_answer?: string | null
          student_id?: string
          submitted_at?: string | null
          teacher_comment?: string | null
          teacher_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_homework_responses_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "school_homework"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_homework_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "school_homework_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      school_invitations: {
        Row: {
          accepted_at: string | null
          accepted_user_id: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          message: string | null
          role: Database["public"]["Enums"]["app_role"]
          school_id: string
          status: Database["public"]["Enums"]["school_invitation_status"]
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          message?: string | null
          role: Database["public"]["Enums"]["app_role"]
          school_id: string
          status?: Database["public"]["Enums"]["school_invitation_status"]
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          message?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          school_id?: string
          status?: Database["public"]["Enums"]["school_invitation_status"]
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_invitations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_kernel_snapshots: {
        Row: {
          avg_score: number | null
          captured_at: string
          id: string
          school_id: string
          students_affected: number
          subject_id: string | null
          topic: string
        }
        Insert: {
          avg_score?: number | null
          captured_at?: string
          id?: string
          school_id: string
          students_affected?: number
          subject_id?: string | null
          topic: string
        }
        Update: {
          avg_score?: number | null
          captured_at?: string
          id?: string
          school_id?: string
          students_affected?: number
          subject_id?: string | null
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_kernel_snapshots_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_memberships: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          invited_email: string | null
          joined_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          school_id: string
          status: Database["public"]["Enums"]["school_membership_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          invited_email?: string | null
          joined_at?: string | null
          role: Database["public"]["Enums"]["app_role"]
          school_id: string
          status?: Database["public"]["Enums"]["school_membership_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          invited_email?: string | null
          joined_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          school_id?: string
          status?: Database["public"]["Enums"]["school_membership_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_memberships_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_quiz_attempts: {
        Row: {
          created_at: string
          id: string
          max_score: number | null
          per_question: Json | null
          quiz_id: string
          school_id: string
          score: number | null
          started_at: string
          status: Database["public"]["Enums"]["quiz_attempt_status"]
          student_id: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_score?: number | null
          per_question?: Json | null
          quiz_id: string
          school_id: string
          score?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["quiz_attempt_status"]
          student_id: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          max_score?: number | null
          per_question?: Json | null
          quiz_id?: string
          school_id?: string
          score?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["quiz_attempt_status"]
          student_id?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_quiz_attempts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_resources: {
        Row: {
          class_id: string | null
          created_at: string
          custom_audience: string[] | null
          deleted_at: string | null
          description: string | null
          external_url: string | null
          grade_id: string | null
          id: string
          kind: Database["public"]["Enums"]["resource_kind"]
          mime: string | null
          school_id: string
          size_bytes: number | null
          status: Database["public"]["Enums"]["content_status"]
          storage_path: string | null
          subject_id: string | null
          teacher_id: string
          title: string
          updated_at: string
          version: number
          visibility: Database["public"]["Enums"]["content_visibility"]
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          custom_audience?: string[] | null
          deleted_at?: string | null
          description?: string | null
          external_url?: string | null
          grade_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["resource_kind"]
          mime?: string | null
          school_id: string
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          storage_path?: string | null
          subject_id?: string | null
          teacher_id: string
          title: string
          updated_at?: string
          version?: number
          visibility?: Database["public"]["Enums"]["content_visibility"]
        }
        Update: {
          class_id?: string | null
          created_at?: string
          custom_audience?: string[] | null
          deleted_at?: string | null
          description?: string | null
          external_url?: string | null
          grade_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["resource_kind"]
          mime?: string | null
          school_id?: string
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          storage_path?: string | null
          subject_id?: string | null
          teacher_id?: string
          title?: string
          updated_at?: string
          version?: number
          visibility?: Database["public"]["Enums"]["content_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "school_resources_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_resources_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_resources_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_resources_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "school_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      school_subjects: {
        Row: {
          code: string | null
          color: string | null
          created_at: string
          id: string
          name: string
          school_id: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          color?: string | null
          created_at?: string
          id?: string
          name: string
          school_id: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_videos: {
        Row: {
          also_public: boolean
          class_id: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          duration_seconds: number | null
          id: string
          school_id: string
          status: Database["public"]["Enums"]["content_status"]
          storage_path: string
          subject_id: string | null
          teacher_id: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["content_visibility"]
        }
        Insert: {
          also_public?: boolean
          class_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          school_id: string
          status?: Database["public"]["Enums"]["content_status"]
          storage_path: string
          subject_id?: string | null
          teacher_id: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["content_visibility"]
        }
        Update: {
          also_public?: boolean
          class_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          school_id?: string
          status?: Database["public"]["Enums"]["content_status"]
          storage_path?: string
          subject_id?: string | null
          teacher_id?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["content_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "school_videos_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_videos_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_videos_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "school_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string | null
          ai_quota_daily: number
          brand_color: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          contract_end: string | null
          contract_start: string | null
          country: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          logo_url: string | null
          metadata: Json
          name: string
          plan: Database["public"]["Enums"]["school_plan"]
          school_type: string | null
          seats_students: number
          seats_teachers: number
          slug: string
          status: Database["public"]["Enums"]["school_status"]
          storage_quota_mb: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          ai_quota_daily?: number
          brand_color?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          contract_end?: string | null
          contract_start?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          metadata?: Json
          name: string
          plan?: Database["public"]["Enums"]["school_plan"]
          school_type?: string | null
          seats_students?: number
          seats_teachers?: number
          slug: string
          status?: Database["public"]["Enums"]["school_status"]
          storage_quota_mb?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          ai_quota_daily?: number
          brand_color?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          contract_end?: string | null
          contract_start?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          metadata?: Json
          name?: string
          plan?: Database["public"]["Enums"]["school_plan"]
          school_type?: string | null
          seats_students?: number
          seats_teachers?: number
          slug?: string
          status?: Database["public"]["Enums"]["school_status"]
          storage_quota_mb?: number
          updated_at?: string
        }
        Relationships: []
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
      seeding_jobs: {
        Row: {
          created_at: string
          details: Json
          error: string | null
          failed: number
          finished_at: string | null
          id: string
          kind: string
          skipped: number
          started_at: string
          status: string
          succeeded: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: Json
          error?: string | null
          failed?: number
          finished_at?: string | null
          id?: string
          kind: string
          skipped?: number
          started_at?: string
          status?: string
          succeeded?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: Json
          error?: string | null
          failed?: number
          finished_at?: string | null
          id?: string
          kind?: string
          skipped?: number
          started_at?: string
          status?: string
          succeeded?: number
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      session_integrity_reports: {
        Row: {
          created_at: string
          events: Json
          focus_score: number | null
          id: string
          is_flagged: boolean
          paste_events: number
          question_copies: number
          questions_flagged: number
          questions_total: number
          session_kind: string
          session_ref: string | null
          subject_name: string | null
          tab_switches: number
          topic_name: string | null
          total_away_ms: number
          user_id: string
        }
        Insert: {
          created_at?: string
          events?: Json
          focus_score?: number | null
          id?: string
          is_flagged?: boolean
          paste_events?: number
          question_copies?: number
          questions_flagged?: number
          questions_total?: number
          session_kind: string
          session_ref?: string | null
          subject_name?: string | null
          tab_switches?: number
          topic_name?: string | null
          total_away_ms?: number
          user_id: string
        }
        Update: {
          created_at?: string
          events?: Json
          focus_score?: number | null
          id?: string
          is_flagged?: boolean
          paste_events?: number
          question_copies?: number
          questions_flagged?: number
          questions_total?: number
          session_kind?: string
          session_ref?: string | null
          subject_name?: string | null
          tab_switches?: number
          topic_name?: string | null
          total_away_ms?: number
          user_id?: string
        }
        Relationships: []
      }
      student_analytics_daily: {
        Row: {
          created_at: string
          day: string
          flashcard_mastery_avg: number
          flashcards_reviewed: number
          homework_completed: number
          id: string
          minutes_studied: number
          quiz_count: number
          quiz_score_max_sum: number
          quiz_score_sum: number
          resources_opened: number
          school_id: string | null
          tasks_completed: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day?: string
          flashcard_mastery_avg?: number
          flashcards_reviewed?: number
          homework_completed?: number
          id?: string
          minutes_studied?: number
          quiz_count?: number
          quiz_score_max_sum?: number
          quiz_score_sum?: number
          resources_opened?: number
          school_id?: string | null
          tasks_completed?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          flashcard_mastery_avg?: number
          flashcards_reviewed?: number
          homework_completed?: number
          id?: string
          minutes_studied?: number
          quiz_count?: number
          quiz_score_max_sum?: number
          quiz_score_sum?: number
          resources_opened?: number
          school_id?: string | null
          tasks_completed?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      student_context_snapshots: {
        Row: {
          class_ids: string[]
          context: Json
          created_at: string
          curriculum: string | null
          grade_id: string | null
          refreshed_at: string
          school_id: string | null
          subject_ids: string[]
          teacher_ids: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          class_ids?: string[]
          context?: Json
          created_at?: string
          curriculum?: string | null
          grade_id?: string | null
          refreshed_at?: string
          school_id?: string | null
          subject_ids?: string[]
          teacher_ids?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          class_ids?: string[]
          context?: Json
          created_at?: string
          curriculum?: string | null
          grade_id?: string | null
          refreshed_at?: string
          school_id?: string | null
          subject_ids?: string[]
          teacher_ids?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_activity: {
        Row: {
          activity_type: string
          created_at: string
          date: string
          duration_minutes: number | null
          id: string
          metadata: Json | null
          score: number | null
          subject: string
          task_completed: boolean
          topic: string | null
          user_id: string
        }
        Insert: {
          activity_type?: string
          created_at?: string
          date?: string
          duration_minutes?: number | null
          id?: string
          metadata?: Json | null
          score?: number | null
          subject: string
          task_completed?: boolean
          topic?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          date?: string
          duration_minutes?: number | null
          id?: string
          metadata?: Json | null
          score?: number | null
          subject?: string
          task_completed?: boolean
          topic?: string | null
          user_id?: string
        }
        Relationships: []
      }
      study_memory_daily: {
        Row: {
          avg_score_pct: number | null
          exam_count: number
          flashcard_count: number
          id: string
          quiz_correct: number
          quiz_count: number
          study_date: string
          subject_name: string
          subtopics_studied: string[]
          topics_studied: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_score_pct?: number | null
          exam_count?: number
          flashcard_count?: number
          id?: string
          quiz_correct?: number
          quiz_count?: number
          study_date: string
          subject_name: string
          subtopics_studied?: string[]
          topics_studied?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_score_pct?: number | null
          exam_count?: number
          flashcard_count?: number
          id?: string
          quiz_correct?: number
          quiz_count?: number
          study_date?: string
          subject_name?: string
          subtopics_studied?: string[]
          topics_studied?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_memory_events: {
        Row: {
          command_word: string | null
          concepts_tested: string[] | null
          created_at: string
          curriculum: string | null
          difficulty: string | null
          ease_factor: number | null
          event_type: string
          id: string
          metadata: Json
          question_text: string | null
          score_max: number | null
          score_raw: number | null
          subject_id: string | null
          subject_name: string
          subtopic_name: string | null
          topic_name: string
          user_id: string
          was_correct: boolean | null
        }
        Insert: {
          command_word?: string | null
          concepts_tested?: string[] | null
          created_at?: string
          curriculum?: string | null
          difficulty?: string | null
          ease_factor?: number | null
          event_type: string
          id?: string
          metadata?: Json
          question_text?: string | null
          score_max?: number | null
          score_raw?: number | null
          subject_id?: string | null
          subject_name: string
          subtopic_name?: string | null
          topic_name: string
          user_id: string
          was_correct?: boolean | null
        }
        Update: {
          command_word?: string | null
          concepts_tested?: string[] | null
          created_at?: string
          curriculum?: string | null
          difficulty?: string | null
          ease_factor?: number | null
          event_type?: string
          id?: string
          metadata?: Json
          question_text?: string | null
          score_max?: number | null
          score_raw?: number | null
          subject_id?: string | null
          subject_name?: string
          subtopic_name?: string | null
          topic_name?: string
          user_id?: string
          was_correct?: boolean | null
        }
        Relationships: []
      }
      study_memory_summary: {
        Row: {
          avg_score_pct: number | null
          best_score_pct: number | null
          command_words_used: string[]
          concepts_covered: string[]
          concepts_mastered: string[]
          concepts_weak: string[]
          id: string
          last_activity_at: string
          last_score_pct: number | null
          needs_reinforcement: boolean
          questions_seen: string[]
          quiz_attempts: number
          quiz_correct: number
          subject_name: string
          subtopics_covered: string[]
          topic_complete: boolean
          topic_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_score_pct?: number | null
          best_score_pct?: number | null
          command_words_used?: string[]
          concepts_covered?: string[]
          concepts_mastered?: string[]
          concepts_weak?: string[]
          id?: string
          last_activity_at?: string
          last_score_pct?: number | null
          needs_reinforcement?: boolean
          questions_seen?: string[]
          quiz_attempts?: number
          quiz_correct?: number
          subject_name: string
          subtopics_covered?: string[]
          topic_complete?: boolean
          topic_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_score_pct?: number | null
          best_score_pct?: number | null
          command_words_used?: string[]
          concepts_covered?: string[]
          concepts_mastered?: string[]
          concepts_weak?: string[]
          id?: string
          last_activity_at?: string
          last_score_pct?: number | null
          needs_reinforcement?: boolean
          questions_seen?: string[]
          quiz_attempts?: number
          quiz_correct?: number
          subject_name?: string
          subtopics_covered?: string[]
          topic_complete?: boolean
          topic_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_schedule: {
        Row: {
          completed: boolean | null
          created_at: string | null
          due_date: string | null
          duration_minutes: number | null
          id: string
          is_completed: boolean | null
          notes: string | null
          scheduled_date: string | null
          subject: string | null
          subject_id: string | null
          task: string | null
          task_type: string | null
          topic_name: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          due_date?: string | null
          duration_minutes?: number | null
          id?: string
          is_completed?: boolean | null
          notes?: string | null
          scheduled_date?: string | null
          subject?: string | null
          subject_id?: string | null
          task?: string | null
          task_type?: string | null
          topic_name?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          due_date?: string | null
          duration_minutes?: number | null
          id?: string
          is_completed?: boolean | null
          notes?: string | null
          scheduled_date?: string | null
          subject?: string | null
          subject_id?: string | null
          task?: string | null
          task_type?: string | null
          topic_name?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "study_schedule_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_coverage_audit: {
        Row: {
          covered_topics: number
          last_audit_at: string
          mastered_topics: number
          subject_id: string
          total_topics: number
          user_id: string
        }
        Insert: {
          covered_topics?: number
          last_audit_at?: string
          mastered_topics?: number
          subject_id: string
          total_topics?: number
          user_id: string
        }
        Update: {
          covered_topics?: number
          last_audit_at?: string
          mastered_topics?: number
          subject_id?: string
          total_topics?: number
          user_id?: string
        }
        Relationships: []
      }
      subject_exams: {
        Row: {
          created_at: string | null
          exam_date: string | null
          exam_name: string | null
          id: string
          notes: string | null
          paper_number: string | null
          subject: string | null
          subject_id: string | null
          subject_name: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          exam_date?: string | null
          exam_name?: string | null
          id?: string
          notes?: string | null
          paper_number?: string | null
          subject?: string | null
          subject_id?: string | null
          subject_name?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          exam_date?: string | null
          exam_name?: string | null
          id?: string
          notes?: string | null
          paper_number?: string | null
          subject?: string | null
          subject_id?: string | null
          subject_name?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subject_exams_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_xp: {
        Row: {
          created_at: string
          curriculum: string
          id: string
          last_activity_date: string | null
          streak: number
          subject: string
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          created_at?: string
          curriculum?: string
          id?: string
          last_activity_date?: string | null
          streak?: number
          subject: string
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          created_at?: string
          curriculum?: string
          id?: string
          last_activity_date?: string | null
          streak?: number
          subject?: string
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      subjects: {
        Row: {
          created_at: string
          exam_board_meta: Json
          exam_patterns: Json | null
          icon_emoji: string | null
          icon_gradient: string | null
          id: string
          name: string
          syllabus_code: string | null
          topics: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exam_board_meta?: Json
          exam_patterns?: Json | null
          icon_emoji?: string | null
          icon_gradient?: string | null
          id?: string
          name: string
          syllabus_code?: string | null
          topics?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          exam_board_meta?: Json
          exam_patterns?: Json | null
          icon_emoji?: string | null
          icon_gradient?: string | null
          id?: string
          name?: string
          syllabus_code?: string | null
          topics?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          assignment_id: string
          attachment_paths: string[] | null
          created_at: string
          feedback: string | null
          graded_at: string | null
          graded_by: string | null
          id: string
          school_id: string
          score: number | null
          status: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at: string | null
          text_response: string | null
          updated_at: string
          version: number
        }
        Insert: {
          assignment_id: string
          attachment_paths?: string[] | null
          created_at?: string
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          school_id: string
          score?: number | null
          status?: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at?: string | null
          text_response?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          assignment_id?: string
          attachment_paths?: string[] | null
          created_at?: string
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          school_id?: string
          score?: number | null
          status?: Database["public"]["Enums"]["submission_status"]
          student_id?: string
          submitted_at?: string | null
          text_response?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          access_until: string | null
          amount: number | null
          created_at: string
          currency: string | null
          id: string
          payment_provider: string | null
          payment_ref: string | null
          plan: string
          status: string
          trial_end: string | null
          trial_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_until?: string | null
          amount?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          payment_provider?: string | null
          payment_ref?: string | null
          plan?: string
          status?: string
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_until?: string | null
          amount?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          payment_provider?: string | null
          payment_ref?: string | null
          plan?: string
          status?: string
          trial_end?: string | null
          trial_start?: string | null
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
            foreignKeyName: "support_tickets_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "tutors_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "tutors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_ai_settings: {
        Row: {
          auto_release_feedback: boolean
          auto_release_grades: boolean
          created_at: string
          feedback_style: string
          homework_difficulty_default: string
          school_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          auto_release_feedback?: boolean
          auto_release_grades?: boolean
          created_at?: string
          feedback_style?: string
          homework_difficulty_default?: string
          school_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          auto_release_feedback?: boolean
          auto_release_grades?: boolean
          created_at?: string
          feedback_style?: string
          homework_difficulty_default?: string
          school_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      timetable_slots: {
        Row: {
          created_at: string
          end_min: number
          id: string
          location: string | null
          school_id: string
          start_min: number
          subject_id: string | null
          teacher_id: string | null
          timetable_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_min: number
          id?: string
          location?: string | null
          school_id: string
          start_min: number
          subject_id?: string | null
          teacher_id?: string | null
          timetable_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_min?: number
          id?: string
          location?: string | null
          school_id?: string
          start_min?: number
          subject_id?: string | null
          teacher_id?: string | null
          timetable_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "timetable_slots_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_slots_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "school_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_slots_timetable_id_fkey"
            columns: ["timetable_id"]
            isOneToOne: false
            referencedRelation: "timetables"
            referencedColumns: ["id"]
          },
        ]
      }
      timetables: {
        Row: {
          class_id: string | null
          created_at: string
          id: string
          name: string
          school_id: string
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          id?: string
          name: string
          school_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          id?: string
          name?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timetables_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetables_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_mastery: {
        Row: {
          attempts: number
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
          attempts?: number
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
          attempts?: number
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
      topic_session_questions: {
        Row: {
          accuracy: boolean | null
          concept_map: Json
          coverage_score: number | null
          created_at: string
          expected_answer: string | null
          expression_score: number | null
          generation_meta: Json | null
          id: string
          improvement_needed: boolean | null
          level: string | null
          missing_points: Json | null
          question_text: string
          session_id: string
          student_answer: string | null
          user_id: string
          xp_delta: number
        }
        Insert: {
          accuracy?: boolean | null
          concept_map?: Json
          coverage_score?: number | null
          created_at?: string
          expected_answer?: string | null
          expression_score?: number | null
          generation_meta?: Json | null
          id?: string
          improvement_needed?: boolean | null
          level?: string | null
          missing_points?: Json | null
          question_text: string
          session_id: string
          student_answer?: string | null
          user_id: string
          xp_delta?: number
        }
        Update: {
          accuracy?: boolean | null
          concept_map?: Json
          coverage_score?: number | null
          created_at?: string
          expected_answer?: string | null
          expression_score?: number | null
          generation_meta?: Json | null
          id?: string
          improvement_needed?: boolean | null
          level?: string | null
          missing_points?: Json | null
          question_text?: string
          session_id?: string
          student_answer?: string | null
          user_id?: string
          xp_delta?: number
        }
        Relationships: [
          {
            foreignKeyName: "topic_session_questions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "topic_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_sessions: {
        Row: {
          completed_at: string | null
          concept_review_count: number
          created_at: string
          curriculum: string
          id: string
          last_activity_at: string
          mastery_score: number
          mode: string
          questions_attempted: number
          questions_correct: number
          session_xp: number
          status: string
          subject_id: string | null
          subject_name: string
          subtopic: string | null
          topic_id: string | null
          topic_name: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          concept_review_count?: number
          created_at?: string
          curriculum?: string
          id?: string
          last_activity_at?: string
          mastery_score?: number
          mode?: string
          questions_attempted?: number
          questions_correct?: number
          session_xp?: number
          status?: string
          subject_id?: string | null
          subject_name: string
          subtopic?: string | null
          topic_id?: string | null
          topic_name: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          concept_review_count?: number
          created_at?: string
          curriculum?: string
          id?: string
          last_activity_at?: string
          mastery_score?: number
          mode?: string
          questions_attempted?: number
          questions_correct?: number
          session_xp?: number
          status?: string
          subject_id?: string | null
          subject_name?: string
          subtopic?: string | null
          topic_id?: string | null
          topic_name?: string
          user_id?: string
        }
        Relationships: []
      }
      topic_tutor_rankings: {
        Row: {
          completion_rate: number | null
          id: string
          rank_position: number | null
          subject: string
          success_rate: number | null
          topic: string
          topic_rating: number | null
          total_reviews: number
          tutor_id: string
          updated_at: string
        }
        Insert: {
          completion_rate?: number | null
          id?: string
          rank_position?: number | null
          subject: string
          success_rate?: number | null
          topic: string
          topic_rating?: number | null
          total_reviews?: number
          tutor_id: string
          updated_at?: string
        }
        Update: {
          completion_rate?: number | null
          id?: string
          rank_position?: number | null
          subject?: string
          success_rate?: number | null
          topic?: string
          topic_rating?: number | null
          total_reviews?: number
          tutor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_tutor_rankings_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_tutor_rankings_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_allocations: {
        Row: {
          created_at: string
          created_by: string
          duration_minutes: number
          end_date: string
          external_payment_reference: string | null
          id: string
          learner_id: string
          notes: string | null
          price_per_session: number
          start_date: string
          status: string
          tutor_id: string
          tutor_subject_id: string
          updated_at: string
          weekly_schedule: Json
        }
        Insert: {
          created_at?: string
          created_by: string
          duration_minutes?: number
          end_date: string
          external_payment_reference?: string | null
          id?: string
          learner_id: string
          notes?: string | null
          price_per_session?: number
          start_date: string
          status?: string
          tutor_id: string
          tutor_subject_id: string
          updated_at?: string
          weekly_schedule?: Json
        }
        Update: {
          created_at?: string
          created_by?: string
          duration_minutes?: number
          end_date?: string
          external_payment_reference?: string | null
          id?: string
          learner_id?: string
          notes?: string | null
          price_per_session?: number
          start_date?: string
          status?: string
          tutor_id?: string
          tutor_subject_id?: string
          updated_at?: string
          weekly_schedule?: Json
        }
        Relationships: []
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
          {
            foreignKeyName: "tutor_availability_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_booking_insights: {
        Row: {
          booking_id: string
          expires_at: string
          generated_at: string
          id: string
          insights_json: Json
          student_id: string
          subject: string
          tutor_id: string
        }
        Insert: {
          booking_id: string
          expires_at?: string
          generated_at?: string
          id?: string
          insights_json?: Json
          student_id: string
          subject: string
          tutor_id: string
        }
        Update: {
          booking_id?: string
          expires_at?: string
          generated_at?: string
          id?: string
          insights_json?: Json
          student_id?: string
          subject?: string
          tutor_id?: string
        }
        Relationships: []
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
      tutor_teaching_profile: {
        Row: {
          bio: string | null
          created_at: string
          curriculums: string[]
          grades: string[]
          onboarding_completed_at: string | null
          teaching_style: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          curriculums?: string[]
          grades?: string[]
          onboarding_completed_at?: string | null
          teaching_style?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          curriculums?: string[]
          grades?: string[]
          onboarding_completed_at?: string | null
          teaching_style?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tutor_tutorials: {
        Row: {
          completion_rate: number | null
          content_type: string
          created_at: string | null
          curriculum: string | null
          description: string | null
          duration_label: string | null
          duration_seconds: number | null
          grade: string | null
          id: string
          pdf_url: string | null
          price: number | null
          rating: number | null
          resource_category: string | null
          review_count: number | null
          status: string | null
          subject: string | null
          subtopic: string | null
          thumbnail_url: string | null
          title: string | null
          topic: string | null
          tutor_id: string | null
          updated_at: string | null
          video_url: string | null
          watch_count: number | null
        }
        Insert: {
          completion_rate?: number | null
          content_type?: string
          created_at?: string | null
          curriculum?: string | null
          description?: string | null
          duration_label?: string | null
          duration_seconds?: number | null
          grade?: string | null
          id?: string
          pdf_url?: string | null
          price?: number | null
          rating?: number | null
          resource_category?: string | null
          review_count?: number | null
          status?: string | null
          subject?: string | null
          subtopic?: string | null
          thumbnail_url?: string | null
          title?: string | null
          topic?: string | null
          tutor_id?: string | null
          updated_at?: string | null
          video_url?: string | null
          watch_count?: number | null
        }
        Update: {
          completion_rate?: number | null
          content_type?: string
          created_at?: string | null
          curriculum?: string | null
          description?: string | null
          duration_label?: string | null
          duration_seconds?: number | null
          grade?: string | null
          id?: string
          pdf_url?: string | null
          price?: number | null
          rating?: number | null
          resource_category?: string | null
          review_count?: number | null
          status?: string | null
          subject?: string | null
          subtopic?: string | null
          thumbnail_url?: string | null
          title?: string | null
          topic?: string | null
          tutor_id?: string | null
          updated_at?: string | null
          video_url?: string | null
          watch_count?: number | null
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
          qualification_url: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          student_status: string | null
          submitted_at: string | null
          transcript_url: string | null
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
          qualification_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          student_status?: string | null
          submitted_at?: string | null
          transcript_url?: string | null
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
          qualification_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          student_status?: string | null
          submitted_at?: string | null
          transcript_url?: string | null
          updated_at?: string
          user_id?: string
          verification_status?: string | null
        }
        Relationships: []
      }
      tutorial_watch_events: {
        Row: {
          booked_tutor: boolean
          completed: boolean
          created_at: string
          id: string
          learner_id: string
          tutorial_id: string
          watch_seconds: number
        }
        Insert: {
          booked_tutor?: boolean
          completed?: boolean
          created_at?: string
          id?: string
          learner_id: string
          tutorial_id: string
          watch_seconds?: number
        }
        Update: {
          booked_tutor?: boolean
          completed?: boolean
          created_at?: string
          id?: string
          learner_id?: string
          tutorial_id?: string
          watch_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "tutorial_watch_events_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutorial_watch_events_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "tutors_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutorial_watch_events_tutorial_id_fkey"
            columns: ["tutorial_id"]
            isOneToOne: false
            referencedRelation: "tutor_tutorials"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          haptics_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          haptics_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          haptics_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_progress: {
        Row: {
          badges: Json | null
          created_at: string | null
          id: string
          last_activity: string | null
          last_study_date: string | null
          progress: number | null
          streak: number | null
          subject: string | null
          updated_at: string | null
          user_id: string | null
          xp: number | null
        }
        Insert: {
          badges?: Json | null
          created_at?: string | null
          id?: string
          last_activity?: string | null
          last_study_date?: string | null
          progress?: number | null
          streak?: number | null
          subject?: string | null
          updated_at?: string | null
          user_id?: string | null
          xp?: number | null
        }
        Update: {
          badges?: Json | null
          created_at?: string | null
          id?: string
          last_activity?: string | null
          last_study_date?: string | null
          progress?: number | null
          streak?: number | null
          subject?: string | null
          updated_at?: string | null
          user_id?: string | null
          xp?: number | null
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
            foreignKeyName: "verification_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "tutors_public"
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
      weak_concepts: {
        Row: {
          concept: string
          concept_id: string | null
          created_at: string
          curriculum: string
          id: string
          last_seen_at: string
          subject: string
          topic: string | null
          user_id: string
          weakness_score: number
        }
        Insert: {
          concept: string
          concept_id?: string | null
          created_at?: string
          curriculum?: string
          id?: string
          last_seen_at?: string
          subject: string
          topic?: string | null
          user_id: string
          weakness_score?: number
        }
        Update: {
          concept?: string
          concept_id?: string | null
          created_at?: string
          curriculum?: string
          id?: string
          last_seen_at?: string
          subject?: string
          topic?: string | null
          user_id?: string
          weakness_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "weak_concepts_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      companion_suggestion_effectiveness: {
        Row: {
          booked_count: number | null
          clicked_count: number | null
          dismissed_count: number | null
          engagement_rate: number | null
          last_interaction_at: string | null
          shown_count: number | null
          suggestion_kind: string | null
          user_id: string | null
        }
        Relationships: []
      }
      concept_mastery_v: {
        Row: {
          attempts: number | null
          concept_id: string | null
          concept_label: string | null
          last_seen_at: string | null
          mastery_score: number | null
          subject_name: string | null
          topic: string | null
          user_id: string | null
          weakness_score: number | null
        }
        Relationships: [
          {
            foreignKeyName: "concept_attempts_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_projected_risk: {
        Row: {
          avg_confidence: number | null
          projected_risk: number | null
          recent_avg_delta: number | null
          slope_per_day: number | null
          subject_id: string | null
          subject_name: string | null
          total_evidence: number | null
          user_id: string | null
        }
        Relationships: []
      }
      learning_class_at_risk: {
        Row: {
          cohort_id: string | null
          cohort_name: string | null
          high_count: number | null
          last_alert_at: string | null
          open_count: number | null
          projected_risk: number | null
          user_id: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_workspace_member_cohorts_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "learning_workspace_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_workspace_member_cohorts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "learning_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_concept_trends: {
        Row: {
          avg_confidence: number | null
          concept_name: string | null
          day: string | null
          evidence_count: number | null
          subject_id: string | null
          subject_name: string | null
          topic_name: string | null
          total_score_delta: number | null
          user_id: string | null
        }
        Relationships: []
      }
      learning_intervention_outcomes: {
        Row: {
          acknowledged_at: string | null
          created_at: string | null
          hours_open: number | null
          intervention_id: string | null
          intervention_type: string | null
          post_evidence_count: number | null
          post_score_delta: number | null
          priority: string | null
          resolved_at: string | null
          status: string | null
          subject_id: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_intervention_queue_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "learning_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      school_member_directory: {
        Row: {
          brand_color: string | null
          country: string | null
          created_at: string | null
          id: string | null
          logo_url: string | null
          name: string | null
          plan: Database["public"]["Enums"]["school_plan"] | null
          school_type: string | null
          slug: string | null
          status: Database["public"]["Enums"]["school_status"] | null
        }
        Relationships: []
      }
      tutors_public: {
        Row: {
          avatar_url: string | null
          bio: string | null
          full_name: string | null
          id: string | null
          is_official: boolean | null
          last_seen: string | null
          location_lat: number | null
          location_lng: number | null
          online_status: boolean | null
          user_type: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          full_name?: string | null
          id?: string | null
          is_official?: boolean | null
          last_seen?: string | null
          location_lat?: number | null
          location_lng?: number | null
          online_status?: boolean | null
          user_type?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          full_name?: string | null
          id?: string | null
          is_official?: boolean | null
          last_seen?: string | null
          location_lat?: number | null
          location_lng?: number | null
          online_status?: boolean | null
          user_type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _sad_upsert: { Args: { _day: string; _user_id: string }; Returns: string }
      _student_primary_school: { Args: { _user_id: string }; Returns: string }
      accept_guardian_invite: { Args: { p_code: string }; Returns: Json }
      accept_school_invitation: { Args: { _token: string }; Returns: Json }
      accept_workspace_invitation: {
        Args: { p_token: string }
        Returns: string
      }
      admin_study_completion_rate: {
        Args: { p_days?: number }
        Returns: {
          completed: number
          completion_rate: number
          subject_id: string
          subject_name: string
          total: number
        }[]
      }
      admin_study_mastery_progression: {
        Args: never
        Returns: {
          avg_mastery: number
          avg_mastery_7d_ago: number
          delta: number
          learners: number
          subject_id: string
          subject_name: string
        }[]
      }
      admin_study_regen_usage: {
        Args: { p_days?: number }
        Returns: {
          avg_regens: number
          max_regens: number
          subject_id: string
          subject_name: string
          tasks_with_regen: number
          total_regens: number
        }[]
      }
      auto_resolve_kernel_alerts: { Args: never; Returns: number }
      check_ai_rate_limit: {
        Args: {
          _fn: string
          _limit: number
          _user_id: string
          _window_seconds?: number
        }
        Returns: Json
      }
      check_and_increment_ai_usage: {
        Args: {
          _amount?: number
          _bucket: string
          _limit: number
          _user_id: string
        }
        Returns: Json
      }
      check_ip_rate_limit: {
        Args: {
          _fn: string
          _ip: string
          _limit: number
          _window_seconds?: number
        }
        Returns: Json
      }
      check_mock_exam_unlock: {
        Args: { p_paper_code: string; p_subject_id: string }
        Returns: Json
      }
      check_school_ai_quota: {
        Args: { _school_id: string }
        Returns: {
          allowed: boolean
          limit: number
          used: number
        }[]
      }
      class_topic_affected_students: {
        Args: { _class_id: string; _topic: string }
        Returns: {
          attempts: number
          email: string
          ewma_score_pct: number
          full_name: string
          last_event_at: string
          mastery_pct: number
          risk_level: string
          student_id: string
        }[]
      }
      current_school_ids: { Args: never; Returns: string[] }
      detect_kernel_alerts: { Args: { _school_id: string }; Returns: number }
      detect_kernel_alerts_all: { Args: never; Returns: number }
      ensure_learning_workspace_for_school: {
        Args: { _school_id: string }
        Returns: string
      }
      ensure_studysync_team_conversation: {
        Args: { _learner_id: string }
        Returns: string
      }
      expire_stale_topic_sessions: { Args: never; Returns: number }
      generate_allocation_bookings: {
        Args: { p_allocation_id: string }
        Returns: number
      }
      generate_workspace_invite_token: {
        Args: { p_invitation_id: string }
        Returns: string
      }
      get_ai_usage_today: { Args: never; Returns: Json }
      get_class_misconception_digest: {
        Args: { p_class_id: string }
        Returns: Json
      }
      get_exam_readiness: {
        Args: { p_paper_code: string; p_subject_id: string }
        Returns: Json
      }
      get_guardian_learner_overview: {
        Args: { p_learner: string }
        Returns: Json
      }
      get_homework_questions_for_student: {
        Args: { _homework_id: string }
        Returns: {
          id: string
          marks: number
          options: Json
          ord: number
          prompt: string
          question_type: string
          visual: Json
        }[]
      }
      get_invitation_summary: { Args: { _token: string }; Returns: Json }
      get_overall_leaderboard: {
        Args: { p_curriculum: string; p_limit?: number }
        Returns: Json
      }
      get_published_tutorials: {
        Args: { p_curriculum?: string; p_subject?: string }
        Returns: {
          completion_rate: number
          created_at: string
          curriculum: string
          description: string
          duration_label: string
          grade: string
          id: string
          rating: number
          review_count: number
          subject: string
          subtopic: string
          thumbnail_url: string
          title: string
          topic: string
          tutor_avatar_url: string
          tutor_full_name: string
          tutor_id: string
          video_url: string
          watch_count: number
        }[]
      }
      get_quiz_questions_for_student: {
        Args: { p_quiz_id: string }
        Returns: {
          id: string
          marks: number
          options: Json
          ord: number
          prompt: string
          quiz_id: string
          school_id: string
          type: Database["public"]["Enums"]["quiz_question_type"]
        }[]
      }
      get_student_analytics: {
        Args: { _from?: string; _to?: string; _user_id?: string }
        Returns: Json
      }
      get_study_memory_context: {
        Args: {
          p_days_back?: number
          p_subject: string
          p_topic?: string
          p_user_id: string
        }
        Returns: string
      }
      get_subject_context: {
        Args: { p_subject_id: string; p_topic_name: string }
        Returns: Json
      }
      get_subject_leaderboard: {
        Args: { p_curriculum: string; p_limit?: number; p_subject: string }
        Returns: Json
      }
      get_tutor_directory: {
        Args: never
        Returns: {
          avatar_url: string
          bio: string
          country: string
          created_at: string
          full_name: string
          id: string
          is_official: boolean
          last_seen: string
          location_lat: number
          location_lng: number
          online_status: boolean
          user_type: string
        }[]
      }
      get_upstream_prerequisites: {
        Args: { p_concept_id: string; p_max_depth?: number }
        Returns: {
          concept_id: string
          concept_name: string
          depth: number
          subject_name: string
          topic_name: string
          weight: number
        }[]
      }
      has_conversation_access: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_shared_relationship: { Args: { _other: string }; Returns: boolean }
      increment_school_ai_usage: {
        Args: {
          _bucket: string
          _school_id: string
          _tokens_in?: number
          _tokens_out?: number
        }
        Returns: undefined
      }
      is_any_los_staff: { Args: { _user_id: string }; Returns: boolean }
      is_class_teacher: { Args: { _class_id: string }; Returns: boolean }
      is_enrolled_in_class: { Args: { _class_id: string }; Returns: boolean }
      is_los_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_los_workspace_staff: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_school_member: {
        Args: {
          _role?: Database["public"]["Enums"]["app_role"]
          _school_id: string
        }
        Returns: boolean
      }
      learner_weekly_digest: {
        Args: { _user_id: string }
        Returns: {
          avg_score_7d: number
          events_7d: number
          top_strength: string
          top_struggle: string
          topics_at_risk: number
          topics_mastered: number
        }[]
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
      los_map_school_role: { Args: { _role: string }; Returns: string }
      los_map_school_status: { Args: { _status: string }; Returns: string }
      map_template_topics_to_subject_shape: {
        Args: { p_topics: Json }
        Returns: Json
      }
      mark_learner_onboarding_complete: { Args: never; Returns: undefined }
      match_school_chunks: {
        Args: {
          _class_id?: string
          _match_count?: number
          _query_embedding: string
          _school_id: string
        }
        Returns: {
          class_id: string
          content: string
          document_id: string
          id: string
          metadata: Json
          similarity: number
          subject_id: string
        }[]
      }
      materialize_concept_prerequisite_edges: {
        Args: { p_subject_name?: string }
        Returns: number
      }
      notify_allocation_event: {
        Args: { p_allocation_id: string; p_event: string; p_extra?: string }
        Returns: undefined
      }
      notify_homework_due_soon: { Args: never; Returns: undefined }
      promote_concept_ingestion: {
        Args: { p_staging_id: string }
        Returns: string
      }
      prune_ai_rate_limit_counters: { Args: never; Returns: number }
      rebuild_school_analytics_today: {
        Args: { _school_id: string }
        Returns: undefined
      }
      rebuild_student_analytics_today: {
        Args: { _user_id?: string }
        Returns: {
          created_at: string
          day: string
          flashcard_mastery_avg: number
          flashcards_reviewed: number
          homework_completed: number
          id: string
          minutes_studied: number
          quiz_count: number
          quiz_score_max_sum: number
          quiz_score_sum: number
          resources_opened: number
          school_id: string | null
          tasks_completed: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "student_analytics_daily"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_ai_token_usage: {
        Args: {
          _bucket: string
          _school_id?: string
          _tokens_in?: number
          _tokens_out?: number
          _user_id: string
        }
        Returns: undefined
      }
      refresh_student_context_snapshot: {
        Args: { _user_id: string }
        Returns: {
          class_ids: string[]
          context: Json
          created_at: string
          curriculum: string | null
          grade_id: string | null
          refreshed_at: string
          school_id: string | null
          subject_ids: string[]
          teacher_ids: string[]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "student_context_snapshots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      remediation_effectiveness: {
        Args: { _school_id: string }
        Returns: {
          avg_delta: number
          avg_ewma_after: number
          avg_ewma_before: number
          class_id: string
          created_at: string
          homework_id: string
          students_improved: number
          students_total: number
          students_worsened: number
          title: string
          topic: string
        }[]
      }
      request_tutor_withdrawal: {
        Args: {
          _amount: number
          _bank_account_holder: string
          _bank_account_number: string
          _bank_branch_code?: string
          _bank_name: string
        }
        Returns: string
      }
      resolve_payout_request: {
        Args: { _admin_note?: string; _new_status: string; _request_id: string }
        Returns: {
          admin_note: string | null
          amount: number
          bank_account_holder: string
          bank_account_number: string
          bank_branch_code: string | null
          bank_name: string
          created_at: string
          currency: string
          id: string
          method: string
          processed_at: string | null
          processed_by: string | null
          status: string
          tutor_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payout_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      route_interventions_to_teachers: {
        Args: { p_workspace_id: string }
        Returns: number
      }
      run_nightly_intervention_sweep: {
        Args: { p_workspace_id: string }
        Returns: Json
      }
      run_study_plan_optimizer: {
        Args: { p_workspace_id: string }
        Returns: Json
      }
      run_weekly_cohort_rollup: {
        Args: { p_workspace_id: string }
        Returns: Json
      }
      school_member_directory_rows: {
        Args: never
        Returns: {
          brand_color: string
          country: string
          created_at: string
          id: string
          logo_url: string
          name: string
          plan: Database["public"]["Enums"]["school_plan"]
          school_type: string
          slug: string
          status: Database["public"]["Enums"]["school_status"]
        }[]
      }
      school_storage_used_mb: { Args: { _school_id: string }; Returns: number }
      school_topic_affected_students: {
        Args: { _school_id: string; _topic: string }
        Returns: {
          class_names: string
          email: string
          ewma_score_pct: number
          full_name: string
          mastery_pct: number
          risk_level: string
          student_id: string
        }[]
      }
      seed_learning_ops_default_schedules: {
        Args: { _workspace_id: string }
        Returns: undefined
      }
      send_studysync_team_message: {
        Args: { _content: string; _learner_id: string }
        Returns: string
      }
      set_subscription_plan: {
        Args: { p_plan: string }
        Returns: {
          access_until: string | null
          amount: number | null
          created_at: string
          currency: string | null
          id: string
          payment_provider: string | null
          payment_ref: string | null
          plan: string
          status: string
          trial_end: string | null
          trial_start: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      start_topic_session: {
        Args: {
          p_curriculum?: string
          p_subject_id?: string
          p_subject_name: string
          p_subtopic?: string
          p_topic_id?: string
          p_topic_name: string
        }
        Returns: string
      }
      subject_canonical_name: { Args: { p_name: string }; Returns: string }
      submit_school_quiz_attempt: {
        Args: { p_answers: Json; p_attempt_id: string }
        Returns: {
          created_at: string
          id: string
          max_score: number | null
          per_question: Json | null
          quiz_id: string
          school_id: string
          score: number | null
          started_at: string
          status: Database["public"]["Enums"]["quiz_attempt_status"]
          student_id: string
          submitted_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "school_quiz_attempts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_academic_profile:
        | {
            Args: {
              p_curriculum: string
              p_exam_year?: number
              p_grade: string
              p_subjects: string[]
            }
            Returns: {
              created_at: string | null
              curriculum: string | null
              exam_board: string | null
              exam_dates: Json | null
              exam_year: number | null
              goals: string | null
              grade: string | null
              guardian_email: string | null
              id: string
              learning_style: string | null
              school_name: string | null
              student_email: string | null
              study_level: string | null
              subjects: string[] | null
              target_grade: string | null
              updated_at: string | null
              user_id: string | null
              weekly_report_dow: number
            }
            SetofOptions: {
              from: "*"
              to: "academic_profiles"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_curriculum: string
              p_exam_dates?: Json
              p_exam_year?: number
              p_grade: string
              p_guardian_email?: string
              p_student_email?: string
              p_subjects: string[]
            }
            Returns: {
              created_at: string | null
              curriculum: string | null
              exam_board: string | null
              exam_dates: Json | null
              exam_year: number | null
              goals: string | null
              grade: string | null
              guardian_email: string | null
              id: string
              learning_style: string | null
              school_name: string | null
              student_email: string | null
              study_level: string | null
              subjects: string[] | null
              target_grade: string | null
              updated_at: string | null
              user_id: string | null
              weekly_report_dow: number
            }
            SetofOptions: {
              from: "*"
              to: "academic_profiles"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      verify_cron_token: { Args: { _token: string }; Returns: boolean }
      welcome_message_body: { Args: never; Returns: string }
    }
    Enums: {
      announcement_audience: "school" | "grade" | "class"
      app_role: "admin" | "school_admin" | "school_teacher" | "school_student"
      booking_status: "requested" | "confirmed" | "completed" | "canceled"
      content_status: "draft" | "published" | "archived"
      content_visibility: "school" | "grade" | "class" | "subject" | "custom"
      enrollment_status: "active" | "withdrawn" | "suspended"
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
      quiz_attempt_status: "in_progress" | "submitted" | "graded"
      quiz_question_type: "mcq" | "short" | "tf" | "long"
      resource_kind:
        | "pdf"
        | "doc"
        | "ppt"
        | "image"
        | "note"
        | "video"
        | "past_paper"
        | "link"
      sail_agent_type:
        | "debug"
        | "frontend"
        | "backend"
        | "learning"
        | "monetization"
        | "reviewer"
      sail_risk_level: "low" | "medium" | "high"
      sail_task_status:
        | "pending"
        | "in_progress"
        | "review"
        | "approved"
        | "rejected"
        | "deployed"
      sail_task_type: "bug" | "ux" | "backend" | "learning" | "monetization"
      school_invitation_status: "pending" | "accepted" | "revoked" | "expired"
      school_membership_status: "invited" | "active" | "suspended" | "removed"
      school_plan: "trial" | "starter" | "standard" | "premium" | "enterprise"
      school_status: "active" | "suspended" | "archived" | "trial"
      study_level:
        | "junior_primary"
        | "senior_primary"
        | "junior_high"
        | "senior_high"
        | "tertiary"
      submission_status:
        | "not_started"
        | "draft"
        | "submitted"
        | "late"
        | "graded"
        | "returned"
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
      announcement_audience: ["school", "grade", "class"],
      app_role: ["admin", "school_admin", "school_teacher", "school_student"],
      booking_status: ["requested", "confirmed", "completed", "canceled"],
      content_status: ["draft", "published", "archived"],
      content_visibility: ["school", "grade", "class", "subject", "custom"],
      enrollment_status: ["active", "withdrawn", "suspended"],
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
      quiz_attempt_status: ["in_progress", "submitted", "graded"],
      quiz_question_type: ["mcq", "short", "tf", "long"],
      resource_kind: [
        "pdf",
        "doc",
        "ppt",
        "image",
        "note",
        "video",
        "past_paper",
        "link",
      ],
      sail_agent_type: [
        "debug",
        "frontend",
        "backend",
        "learning",
        "monetization",
        "reviewer",
      ],
      sail_risk_level: ["low", "medium", "high"],
      sail_task_status: [
        "pending",
        "in_progress",
        "review",
        "approved",
        "rejected",
        "deployed",
      ],
      sail_task_type: ["bug", "ux", "backend", "learning", "monetization"],
      school_invitation_status: ["pending", "accepted", "revoked", "expired"],
      school_membership_status: ["invited", "active", "suspended", "removed"],
      school_plan: ["trial", "starter", "standard", "premium", "enterprise"],
      school_status: ["active", "suspended", "archived", "trial"],
      study_level: [
        "junior_primary",
        "senior_primary",
        "junior_high",
        "senior_high",
        "tertiary",
      ],
      submission_status: [
        "not_started",
        "draft",
        "submitted",
        "late",
        "graded",
        "returned",
      ],
      support_status: ["open", "in_progress", "resolved", "closed"],
      verification_decision: ["approved", "rejected", "needs_more_info"],
    },
  },
} as const
