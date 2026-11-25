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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      account_deletion_jobs: {
        Row: {
          created_at: string
          last_error: string | null
          requested_by: string | null
          stage: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          last_error?: string | null
          requested_by?: string | null
          stage?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          last_error?: string | null
          requested_by?: string | null
          stage?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      assignment_applications: {
        Row: {
          assignment_id: string
          created_at: string
          status: string
          substitute_id: string
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          status?: string
          substitute_id: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          status?: string
          substitute_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_applications_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignment_metrics"
            referencedColumns: ["assignment_id"]
          },
          {
            foreignKeyName: "assignment_applications_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_applications_substitute_id_fkey"
            columns: ["substitute_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_declines: {
        Row: {
          assignment_id: string
          created_at: string
          substitute_id: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          substitute_id: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          substitute_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_declines_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignment_metrics"
            referencedColumns: ["assignment_id"]
          },
          {
            foreignKeyName: "assignment_declines_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          assigned_at: string | null
          assigned_substitute_id: string | null
          assignment_date: string
          cancelled_at: string | null
          compensation: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_time: string
          history_completed: boolean
          id: string
          notification_version: number
          published_at: string | null
          school_id: string
          start_time: string
          status: Database["public"]["Enums"]["assignment_status"]
          subject: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_substitute_id?: string | null
          assignment_date: string
          cancelled_at?: string | null
          compensation?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time: string
          history_completed?: boolean
          id?: string
          notification_version?: number
          published_at?: string | null
          school_id: string
          start_time: string
          status?: Database["public"]["Enums"]["assignment_status"]
          subject: string
        }
        Update: {
          assigned_at?: string | null
          assigned_substitute_id?: string | null
          assignment_date?: string
          cancelled_at?: string | null
          compensation?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string
          history_completed?: boolean
          id?: string
          notification_version?: number
          published_at?: string | null
          school_id?: string
          start_time?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_assigned_substitute_id_fkey"
            columns: ["assigned_substitute_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      cancellation_requests: {
        Row: {
          affected_substitute_id: string | null
          assignment_id: string
          created_at: string
          id: string
          reason: string
          requester_id: string
          requester_kind: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          affected_substitute_id?: string | null
          assignment_id: string
          created_at?: string
          id?: string
          reason: string
          requester_id: string
          requester_kind: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          affected_substitute_id?: string | null
          assignment_id?: string
          created_at?: string
          id?: string
          reason?: string
          requester_id?: string
          requester_kind?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cancellation_requests_affected_substitute_id_fkey"
            columns: ["affected_substitute_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancellation_requests_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignment_metrics"
            referencedColumns: ["assignment_id"]
          },
          {
            foreignKeyName: "cancellation_requests_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      email_outbox: {
        Row: {
          assignment_id: string | null
          attempts: number
          available_at: string
          created_at: string
          delivered_at: string | null
          id: string
          idempotency_key: string
          last_error: string | null
          lock_token: string | null
          locked_at: string | null
          payload: Json
          recipient: string
          recipient_kind: string
          school_id: string
          status: string
          substitute_id: string | null
          template: string
          test_snapshot: boolean
          version: number
        }
        Insert: {
          assignment_id?: string | null
          attempts?: number
          available_at?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          idempotency_key: string
          last_error?: string | null
          lock_token?: string | null
          locked_at?: string | null
          payload: Json
          recipient: string
          recipient_kind: string
          school_id: string
          status?: string
          substitute_id?: string | null
          template: string
          test_snapshot: boolean
          version: number
        }
        Update: {
          assignment_id?: string | null
          attempts?: number
          available_at?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          idempotency_key?: string
          last_error?: string | null
          lock_token?: string | null
          locked_at?: string | null
          payload?: Json
          recipient?: string
          recipient_kind?: string
          school_id?: string
          status?: string
          substitute_id?: string | null
          template?: string
          test_snapshot?: boolean
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "email_outbox_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignment_metrics"
            referencedColumns: ["assignment_id"]
          },
          {
            foreignKeyName: "email_outbox_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      event_log: {
        Row: {
          assignment_id: string | null
          event_type: string
          id: string
          metadata: Json
          occurred_at: string
          school_id: string | null
          substitute_ref: string | null
        }
        Insert: {
          assignment_id?: string | null
          event_type: string
          id?: string
          metadata?: Json
          occurred_at?: string
          school_id?: string | null
          substitute_ref?: string | null
        }
        Update: {
          assignment_id?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          school_id?: string | null
          substitute_ref?: string | null
        }
        Relationships: []
      }
      feedback: {
        Row: {
          category: string
          created_at: string
          id: string
          message: string
          role: string
          score: number | null
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          message: string
          role?: string
          score?: number | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          message?: string
          role?: string
          score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      log_config: {
        Row: {
          id: boolean
          secret: string
        }
        Insert: {
          id?: boolean
          secret: string
        }
        Update: {
          id?: boolean
          secret?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          assignment_id: string
          created_at: string
          distance_km: number | null
          first_viewed_at: string | null
          id: string
          substitute_id: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          distance_km?: number | null
          first_viewed_at?: string | null
          id?: string
          substitute_id: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          distance_km?: number | null
          first_viewed_at?: string | null
          id?: string
          substitute_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignment_metrics"
            referencedColumns: ["assignment_id"]
          },
          {
            foreignKeyName: "notifications_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_substitute_id_fkey"
            columns: ["substitute_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approved: boolean
          availability: string | null
          avatar_consent_at: string | null
          avatar_path: string | null
          background_file_path: string | null
          background_status: Database["public"]["Enums"]["background_status"]
          city: string | null
          consent_at: string | null
          created_at: string
          cv_consent_at: string | null
          cv_file_path: string | null
          deactivated_at: string | null
          email: string
          full_name: string
          graduation_year: number | null
          id: string
          is_test: boolean
          lat: number | null
          lng: number | null
          phone: string | null
          postal_code: string | null
          school_name: string | null
          street_address: string | null
          subjects: string[]
        }
        Insert: {
          approved?: boolean
          availability?: string | null
          avatar_consent_at?: string | null
          avatar_path?: string | null
          background_file_path?: string | null
          background_status?: Database["public"]["Enums"]["background_status"]
          city?: string | null
          consent_at?: string | null
          created_at?: string
          cv_consent_at?: string | null
          cv_file_path?: string | null
          deactivated_at?: string | null
          email?: string
          full_name?: string
          graduation_year?: number | null
          id: string
          is_test?: boolean
          lat?: number | null
          lng?: number | null
          phone?: string | null
          postal_code?: string | null
          school_name?: string | null
          street_address?: string | null
          subjects?: string[]
        }
        Update: {
          approved?: boolean
          availability?: string | null
          avatar_consent_at?: string | null
          avatar_path?: string | null
          background_file_path?: string | null
          background_status?: Database["public"]["Enums"]["background_status"]
          city?: string | null
          consent_at?: string | null
          created_at?: string
          cv_consent_at?: string | null
          cv_file_path?: string | null
          deactivated_at?: string | null
          email?: string
          full_name?: string
          graduation_year?: number | null
          id?: string
          is_test?: boolean
          lat?: number | null
          lng?: number | null
          phone?: string | null
          postal_code?: string | null
          school_name?: string | null
          street_address?: string | null
          subjects?: string[]
        }
        Relationships: []
      }
      ratings: {
        Row: {
          assignment_id: string | null
          comment: string | null
          created_at: string
          id: string
          score: number
          substitute_id: string
        }
        Insert: {
          assignment_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          score: number
          substitute_id: string
        }
        Update: {
          assignment_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          score?: number
          substitute_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignment_metrics"
            referencedColumns: ["assignment_id"]
          },
          {
            foreignKeyName: "ratings_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_substitute_id_fkey"
            columns: ["substitute_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sandbox_emails: {
        Row: {
          assignment_id: string | null
          created_at: string
          data: Json
          id: string
          outbox_id: string | null
          recipient: string
          template: string
        }
        Insert: {
          assignment_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          outbox_id?: string | null
          recipient: string
          template: string
        }
        Update: {
          assignment_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          outbox_id?: string | null
          recipient?: string
          template?: string
        }
        Relationships: [
          {
            foreignKeyName: "sandbox_emails_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: true
            referencedRelation: "email_outbox"
            referencedColumns: ["id"]
          },
        ]
      }
      school_codes: {
        Row: {
          code_hash: string
          salt: string
          school_id: string
          updated_at: string
        }
        Insert: {
          code_hash: string
          salt: string
          school_id: string
          updated_at?: string
        }
        Update: {
          code_hash?: string
          salt?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_codes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          id: string
          member_type: string
          revoked_at: string | null
          school_id: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          expires_at?: string
          id?: string
          member_type: string
          revoked_at?: string | null
          school_id: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          id?: string
          member_type?: string
          revoked_at?: string | null
          school_id?: string
          token_hash?: string
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
      school_members: {
        Row: {
          created_at: string
          member_type: string
          school_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          member_type?: string
          school_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          member_type?: string
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_members_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_ratings: {
        Row: {
          assignment_id: string
          comment: string | null
          created_at: string
          id: string
          school_id: string
          score: number
          substitute_id: string
        }
        Insert: {
          assignment_id: string
          comment?: string | null
          created_at?: string
          id?: string
          school_id: string
          score: number
          substitute_id: string
        }
        Update: {
          assignment_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          school_id?: string
          score?: number
          substitute_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_ratings_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "assignment_metrics"
            referencedColumns: ["assignment_id"]
          },
          {
            foreignKeyName: "school_ratings_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_ratings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_requests: {
        Row: {
          contact_email: string | null
          contact_person: string
          contact_phone: string | null
          created_at: string
          description: string
          handled: boolean
          id: string
          school_name: string
        }
        Insert: {
          contact_email?: string | null
          contact_person: string
          contact_phone?: string | null
          created_at?: string
          description: string
          handled?: boolean
          id?: string
          school_name: string
        }
        Update: {
          contact_email?: string | null
          contact_person?: string
          contact_phone?: string | null
          created_at?: string
          description?: string
          handled?: boolean
          id?: string
          school_name?: string
        }
        Relationships: []
      }
      schools: {
        Row: {
          city: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          is_test: boolean
          lat: number | null
          lng: number | null
          name: string
          phone: string | null
          postal_code: string | null
          street_address: string | null
        }
        Insert: {
          city?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_test?: boolean
          lat?: number | null
          lng?: number | null
          name: string
          phone?: string | null
          postal_code?: string | null
          street_address?: string | null
        }
        Update: {
          city?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_test?: boolean
          lat?: number | null
          lng?: number | null
          name?: string
          phone?: string | null
          postal_code?: string | null
          street_address?: string | null
        }
        Relationships: []
      }
      teacher_code_attempts: {
        Row: {
          created_at: string
          email: string
          id: string
          ip: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      assignment_metrics: {
        Row: {
          accepted_count: number | null
          assignment_id: string | null
          created_at: string | null
          minutes_to_filled: number | null
          minutes_to_first_response: number | null
          notified_count: number | null
          outcome: string | null
          published_at: string | null
          rating: number | null
          school_id: string | null
          school_name: string | null
          starts_at: string | null
          subject: string | null
          viewed_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_school_invitation: {
        Args: { p_full_name: string; p_phone: string; p_token: string }
        Returns: string
      }
      admin_assignment_metrics: {
        Args: never
        Returns: {
          accepted_count: number | null
          assignment_id: string | null
          created_at: string | null
          minutes_to_filled: number | null
          minutes_to_first_response: number | null
          notified_count: number | null
          outcome: string | null
          published_at: string | null
          rating: number | null
          school_id: string | null
          school_name: string | null
          starts_at: string | null
          subject: string | null
          viewed_count: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "assignment_metrics"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_assignment_metrics_export_page: {
        Args: {
          p_before: string
          p_cursor_at?: string
          p_cursor_id?: string
          p_limit?: number
        }
        Returns: {
          accepted_count: number | null
          assignment_id: string | null
          created_at: string | null
          minutes_to_filled: number | null
          minutes_to_first_response: number | null
          notified_count: number | null
          outcome: string | null
          published_at: string | null
          rating: number | null
          school_id: string | null
          school_name: string | null
          starts_at: string | null
          subject: string | null
          viewed_count: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "assignment_metrics"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_assignment_metrics_page: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          accepted_count: number | null
          assignment_id: string | null
          created_at: string | null
          minutes_to_filled: number | null
          minutes_to_first_response: number | null
          notified_count: number | null
          outcome: string | null
          published_at: string | null
          rating: number | null
          school_id: string | null
          school_name: string | null
          starts_at: string | null
          subject: string | null
          viewed_count: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "assignment_metrics"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_assignments_page: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          assigned_substitute_id: string
          assignment_date: string
          compensation: string
          description: string
          end_time: string
          id: string
          notified_count: number
          school_contact_person: string
          school_email: string
          school_id: string
          school_name: string
          school_phone: string
          start_time: string
          status: Database["public"]["Enums"]["assignment_status"]
          subject: string
          substitute_email: string
          substitute_name: string
          substitute_phone: string
        }[]
      }
      admin_cancellation_requests: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          assignment_date: string
          assignment_id: string
          created_at: string
          id: string
          reason: string
          requester_kind: string
          requester_name: string
          school_name: string
          status: string
          subject: string
        }[]
      }
      admin_create_and_publish_assignment: {
        Args: {
          p_compensation: string
          p_date: string
          p_description: string
          p_end: string
          p_school_id: string
          p_start: string
          p_subject: string
        }
        Returns: number
      }
      admin_email_outbox: {
        Args: { p_offset?: number }
        Returns: {
          assignment_id: string
          attempts: number
          available_at: string
          created_at: string
          id: string
          last_error: string
          recipient_kind: string
          status: string
          template: string
          test_snapshot: boolean
        }[]
      }
      admin_event_log: {
        Args: never
        Returns: {
          assignment_id: string
          event_type: string
          id: string
          metadata: Json
          occurred_at: string
          school_id: string
          substitute_ref: string
        }[]
      }
      admin_event_log_export_page: {
        Args: {
          p_before: string
          p_cursor_at?: string
          p_cursor_id?: string
          p_limit?: number
        }
        Returns: {
          assignment_id: string
          event_type: string
          id: string
          metadata: Json
          occurred_at: string
          school_id: string
          substitute_ref: string
        }[]
      }
      admin_event_log_page: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          assignment_id: string
          event_type: string
          id: string
          metadata: Json
          occurred_at: string
          school_id: string
          substitute_ref: string
        }[]
      }
      admin_expire_assignment: {
        Args: { p_assignment_id: string }
        Returns: boolean
      }
      admin_prepare_user_deletion: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      admin_reopen_assignment: {
        Args: { p_assignment_id: string }
        Returns: boolean
      }
      admin_resolve_cancellation: {
        Args: { p_approve: boolean; p_request_id: string }
        Returns: boolean
      }
      admin_retry_email: { Args: { p_id: string }; Returns: undefined }
      admin_school_rating_summaries: {
        Args: never
        Returns: {
          rating_avg: number
          rating_count: number
          school_id: string
        }[]
      }
      admin_set_test: {
        Args: { p_id: string; p_kind: string; p_value: boolean }
        Returns: undefined
      }
      admin_substitutes_page: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          approved: boolean
          availability: string
          background_status: Database["public"]["Enums"]["background_status"]
          email: string
          full_name: string
          graduation_year: number
          has_cv: boolean
          id: string
          is_test: boolean
          phone: string
          rating_avg: number
          rating_count: number
          school_name: string
          subjects: string[]
        }[]
      }
      apply_assignment: { Args: { p_assignment_id: string }; Returns: string }
      assignment_completed: {
        Args: { p_assignment_id: string }
        Returns: boolean
      }
      assignment_visible_to_substitute: {
        Args: { p_assignment: string; p_substitute: string }
        Returns: boolean
      }
      can_manage_school: { Args: { p_school: string }; Returns: boolean }
      can_view_substitute: { Args: { p_substitute: string }; Returns: boolean }
      capture_email_outbox: {
        Args: { p_id: string; p_lock: string }
        Returns: boolean
      }
      claim_assignment: { Args: { p_assignment_id: string }; Returns: string }
      claim_email_outbox: {
        Args: { p_limit?: number }
        Returns: {
          assignment_id: string | null
          attempts: number
          available_at: string
          created_at: string
          delivered_at: string | null
          id: string
          idempotency_key: string
          last_error: string | null
          lock_token: string | null
          locked_at: string | null
          payload: Json
          recipient: string
          recipient_kind: string
          school_id: string
          status: string
          substitute_id: string | null
          template: string
          test_snapshot: boolean
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "email_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_first_admin: { Args: never; Returns: boolean }
      create_and_publish_assignment: {
        Args: {
          p_compensation: string
          p_date: string
          p_description: string
          p_end: string
          p_start: string
          p_subject: string
        }
        Returns: number
      }
      create_school_invitation: {
        Args: {
          p_email: string
          p_member_type: string
          p_school_id: string
          p_token_hash: string
        }
        Returns: string
      }
      decline_substitute: {
        Args: { p_assignment_id: string }
        Returns: boolean
      }
      finalize_user_deletion_data: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      finish_email_outbox: {
        Args: {
          p_error?: string
          p_id: string
          p_lock: string
          p_status: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      inspect_school_invitation: {
        Args: { p_token: string }
        Returns: {
          has_password: boolean
          member_type: string
          school_name: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      log_assignment_view: {
        Args: { p_assignment_id: string }
        Returns: undefined
      }
      log_event: {
        Args: {
          p_assignment_id?: string
          p_event_type: string
          p_metadata?: Json
          p_school_id?: string
          p_substitute_id?: string
        }
        Returns: undefined
      }
      my_cancellation_requests: {
        Args: never
        Returns: {
          assignment_date: string
          assignment_id: string
          created_at: string
          id: string
          reason: string
          requester_kind: string
          school_name: string
          status: string
          subject: string
        }[]
      }
      my_rating_summary: {
        Args: never
        Returns: {
          avg_score: number
          rating_count: number
        }[]
      }
      my_school_id: { Args: never; Returns: string }
      notify_matching: { Args: { p_assignment_id: string }; Returns: number }
      profile_active: { Args: { p_user: string }; Returns: boolean }
      publish_assignment: { Args: { p_assignment_id: string }; Returns: number }
      purge_old_event_log: { Args: never; Returns: number }
      purge_sandbox_data: { Args: never; Returns: number }
      rate_school: {
        Args: { p_assignment_id: string; p_comment: string; p_score: number }
        Returns: undefined
      }
      rate_substitute: {
        Args: { p_assignment_id: string; p_comment: string; p_score: number }
        Returns: undefined
      }
      reject_applicant: {
        Args: { p_assignment_id: string; p_substitute_id: string }
        Returns: boolean
      }
      request_assignment_cancellation: {
        Args: { p_assignment_id: string; p_reason: string }
        Returns: string
      }
      revoke_school_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      same_sandbox: {
        Args: { p_school: string; p_substitute: string }
        Returns: boolean
      }
      school_applicants: {
        Args: { p_assignment_id: string }
        Returns: {
          created_at: string
          full_name: string
          has_cv: boolean
          phone: string
          rating_avg: number
          rating_count: number
          status: string
          subjects: string[]
          substitute_id: string
        }[]
      }
      school_assignments: {
        Args: never
        Returns: {
          assignment_date: string
          compensation: string
          completed: boolean
          created_at: string
          description: string
          end_time: string
          id: string
          rated: boolean
          start_time: string
          status: Database["public"]["Enums"]["assignment_status"]
          subject: string
          substitute_id: string
          substitute_name: string
          substitute_phone: string
          substitute_rating_avg: number
          substitute_rating_count: number
        }[]
      }
      school_assignments_page: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          applicant_count: number
          assignment_date: string
          cancellation_status: string
          compensation: string
          completed: boolean
          created_at: string
          description: string
          end_time: string
          has_cv: boolean
          id: string
          rated: boolean
          start_time: string
          status: Database["public"]["Enums"]["assignment_status"]
          subject: string
          substitute_id: string
          substitute_name: string
          substitute_phone: string
          substitute_rating_avg: number
          substitute_rating_count: number
        }[]
      }
      select_applicant: {
        Args: { p_assignment_id: string; p_substitute_id: string }
        Returns: string
      }
      set_profile_consent: { Args: never; Returns: undefined }
      substitute_assignments: {
        Args: never
        Returns: {
          assigned_to_me: boolean
          assignment_date: string
          compensation: string
          completed: boolean
          description: string
          end_time: string
          id: string
          rated: boolean
          school_contact_person: string
          school_email: string
          school_name: string
          school_phone: string
          school_rating_avg: number
          school_rating_count: number
          start_time: string
          status: Database["public"]["Enums"]["assignment_status"]
          subject: string
        }[]
      }
      substitute_assignments_page: {
        Args: {
          p_date?: string
          p_limit?: number
          p_offset?: number
          p_subject?: string
        }
        Returns: {
          application_status: string
          assigned_to_me: boolean
          assignment_date: string
          cancellation_status: string
          compensation: string
          completed: boolean
          description: string
          end_time: string
          id: string
          rated: boolean
          school_contact_person: string
          school_email: string
          school_name: string
          school_phone: string
          school_rating_avg: number
          school_rating_count: number
          start_time: string
          status: Database["public"]["Enums"]["assignment_status"]
          subject: string
        }[]
      }
      withdraw_application: {
        Args: { p_assignment_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "substitute"
      assignment_status: "open" | "filled" | "expired"
      background_status: "pending" | "approved" | "needs_renewal"
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
      app_role: ["admin", "substitute"],
      assignment_status: ["open", "filled", "expired"],
      background_status: ["pending", "approved", "needs_renewal"],
    },
  },
} as const
