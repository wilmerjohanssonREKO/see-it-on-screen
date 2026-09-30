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
      assignments: {
        Row: {
          assigned_at: string | null
          assigned_substitute_id: string | null
          assignment_date: string
          compensation: string | null
          created_at: string
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
      notifications: {
        Row: {
          assignment_id: string
          created_at: string
          id: string
          substitute_id: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          id?: string
          substitute_id: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          id?: string
          substitute_id?: string
        }
        Relationships: [
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
          created_at: string
          email: string
          full_name: string
          graduation_year: number | null
          id: string
          phone: string | null
          school_name: string | null
          subjects: string[]
        }
        Insert: {
          approved?: boolean
          availability?: string | null
          background_file_path?: string | null
          background_status?: Database["public"]["Enums"]["background_status"]
          created_at?: string
          email?: string
          full_name?: string
          graduation_year?: number | null
          id: string
          phone?: string | null
          school_name?: string | null
          subjects?: string[]
        }
        Update: {
          approved?: boolean
          availability?: string | null
          background_file_path?: string | null
          background_status?: Database["public"]["Enums"]["background_status"]
          created_at?: string
          email?: string
          full_name?: string
          graduation_year?: number | null
          id?: string
          phone?: string | null
          school_name?: string | null
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
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
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
      [_ in never]: never
    }
    Functions: {
      claim_assignment: { Args: { p_assignment_id: string }; Returns: string }
      claim_first_admin: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      publish_assignment: { Args: { p_assignment_id: string }; Returns: number }
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
