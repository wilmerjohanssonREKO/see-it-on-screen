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
          compensation: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_time: string
          id: string
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
          compensation?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time: string
          id?: string
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
          compensation?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string
          id?: string
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
          id: string
          substitute_id: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          distance_km?: number | null
          id?: string
          substitute_id: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          distance_km?: number | null
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
          background_file_path: string | null
          background_status: Database["public"]["Enums"]["background_status"]
          city: string | null
          consent_at: string | null
          created_at: string
          cv_consent_at: string | null
          cv_file_path: string | null
          email: string
          full_name: string
          graduation_year: number | null
          id: string
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
          background_file_path?: string | null
          background_status?: Database["public"]["Enums"]["background_status"]
          city?: string | null
          consent_at?: string | null
          created_at?: string
          cv_consent_at?: string | null
          cv_file_path?: string | null
          email?: string
          full_name?: string
          graduation_year?: number | null
          id: string
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
          background_file_path?: string | null
          background_status?: Database["public"]["Enums"]["background_status"]
          city?: string | null
          consent_at?: string | null
          created_at?: string
          cv_consent_at?: string | null
          cv_file_path?: string | null
          email?: string
          full_name?: string
          graduation_year?: number | null
          id?: string
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
          avg_notified_distance_km: number | null
          created_at: string | null
          filled_distance_km: number | null
          minutes_to_filled: number | null
          minutes_to_first_response: number | null
          notified_count: number | null
          outcome: string | null
          published_at: string | null
          rating: number | null
          school_id: string | null
          school_name: string | null
          short_notice: boolean | null
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
      admin_assignment_metrics: {
        Args: never
        Returns: {
          accepted_count: number | null
          assignment_id: string | null
          avg_notified_distance_km: number | null
          created_at: string | null
          filled_distance_km: number | null
          minutes_to_filled: number | null
          minutes_to_first_response: number | null
          notified_count: number | null
          outcome: string | null
          published_at: string | null
          rating: number | null
          school_id: string | null
          school_name: string | null
          short_notice: boolean | null
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
      can_manage_school: { Args: { p_school: string }; Returns: boolean }
      claim_assignment: { Args: { p_assignment_id: string }; Returns: string }
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
      decline_substitute: {
        Args: { p_assignment_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
      my_school_id: { Args: never; Returns: string }
      notify_matching: { Args: { p_assignment_id: string }; Returns: number }
      publish_assignment: { Args: { p_assignment_id: string }; Returns: number }
      purge_old_event_log: { Args: never; Returns: number }
      school_assignments: {
        Args: never
        Returns: {
          assignment_date: string
          compensation: string
          created_at: string
          description: string
          end_time: string
          id: string
          start_time: string
          status: Database["public"]["Enums"]["assignment_status"]
          subject: string
          substitute_distance_km: number
          substitute_name: string
          substitute_phone: string
        }[]
      }
      set_profile_consent: { Args: never; Returns: undefined }
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
