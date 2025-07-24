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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      account_settings: {
        Row: {
          account_id: string | null
          app_activity: Json
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          onboarding_completed: boolean
          role: string | null
          title: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id?: string | null
          app_activity?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          onboarding_completed?: boolean
          role?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string | null
          app_activity?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          onboarding_completed?: boolean
          role?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          account_id: string
          content: string
          created_at: string
          id: string
          insight_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          content: string
          created_at?: string
          id?: string
          insight_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          content?: string
          created_at?: string
          id?: string
          insight_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_insight_id_fkey"
            columns: ["insight_id"]
            isOneToOne: false
            referencedRelation: "insights"
            referencedColumns: ["id"]
          },
        ]
      }
      insights: {
        Row: {
          account_id: string
          category: string
          confidence: string | null
          contradictions: string | null
          created_at: string
          desired_outcome: string | null
          details: string | null
          embedding: string | null
          emotional_response: string | null
          evidence: string | null
          id: string
          impact: number | null
          interview_id: string | null
          journey_stage: string | null
          jtbd: string | null
          motivation: string | null
          name: string
          novelty: number | null
          opportunity_ideas: string[] | null
          pain: string | null
          related_tags: string[] | null
          updated_at: string
        }
        Insert: {
          account_id: string
          category: string
          confidence?: string | null
          contradictions?: string | null
          created_at?: string
          desired_outcome?: string | null
          details?: string | null
          embedding?: string | null
          emotional_response?: string | null
          evidence?: string | null
          id?: string
          impact?: number | null
          interview_id?: string | null
          journey_stage?: string | null
          jtbd?: string | null
          motivation?: string | null
          name: string
          novelty?: number | null
          opportunity_ideas?: string[] | null
          pain?: string | null
          related_tags?: string[] | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          category?: string
          confidence?: string | null
          contradictions?: string | null
          created_at?: string
          desired_outcome?: string | null
          details?: string | null
          embedding?: string | null
          emotional_response?: string | null
          evidence?: string | null
          id?: string
          impact?: number | null
          interview_id?: string | null
          journey_stage?: string | null
          jtbd?: string | null
          motivation?: string | null
          name?: string
          novelty?: number | null
          opportunity_ideas?: string[] | null
          pain?: string | null
          related_tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insights_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          account_id: string
          created_at: string
          duration_min: number | null
          high_impact_themes: string[] | null
          id: string
          interview_date: string | null
          interviewer_id: string | null
          media_url: string | null
          observations_and_notes: string | null
          open_questions_and_next_steps: string | null
          participant_pseudonym: string | null
          project_id: string
          segment: string | null
          status: Database["public"]["Enums"]["interview_status"]
          title: string | null
          transcript: string | null
          transcript_formatted: Json | null
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          duration_min?: number | null
          high_impact_themes?: string[] | null
          id?: string
          interview_date?: string | null
          interviewer_id?: string | null
          media_url?: string | null
          observations_and_notes?: string | null
          open_questions_and_next_steps?: string | null
          participant_pseudonym?: string | null
          project_id: string
          segment?: string | null
          status?: Database["public"]["Enums"]["interview_status"]
          title?: string | null
          transcript?: string | null
          transcript_formatted?: Json | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          duration_min?: number | null
          high_impact_themes?: string[] | null
          id?: string
          interview_date?: string | null
          interviewer_id?: string | null
          media_url?: string | null
          observations_and_notes?: string | null
          open_questions_and_next_steps?: string | null
          participant_pseudonym?: string | null
          project_id?: string
          segment?: string | null
          status?: Database["public"]["Enums"]["interview_status"]
          title?: string | null
          transcript?: string | null
          transcript_formatted?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          account_id: string
          created_at: string
          id: string
          kanban_status: string | null
          owner_id: string | null
          project_id: string
          related_insight_ids: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          kanban_status?: string | null
          owner_id?: string | null
          project_id: string
          related_insight_ids?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          kanban_status?: string | null
          owner_id?: string | null
          project_id?: string
          related_insight_ids?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          account_id: string | null
          age: number | null
          contact_info: Json | null
          created_at: string
          description: string | null
          education: string | null
          gender: string | null
          id: string
          income: number | null
          location: string | null
          name: string | null
          occupation: string | null
          persona: string | null
          preferences: string | null
          segment: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          age?: number | null
          contact_info?: Json | null
          created_at?: string
          description?: string | null
          education?: string | null
          gender?: string | null
          id?: string
          income?: number | null
          location?: string | null
          name?: string | null
          occupation?: string | null
          persona?: string | null
          preferences?: string | null
          segment?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          age?: number | null
          contact_info?: Json | null
          created_at?: string
          description?: string | null
          education?: string | null
          gender?: string | null
          id?: string
          income?: number | null
          location?: string | null
          name?: string | null
          occupation?: string | null
          persona?: string | null
          preferences?: string | null
          segment?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      personas: {
        Row: {
          account_id: string
          color_hex: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          percentage: number | null
          updated_at: string
        }
        Insert: {
          account_id: string
          color_hex?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          percentage?: number | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          color_hex?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          percentage?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          account_id: string
          created_at: string
          description: string | null
          id: string
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          description?: string | null
          id?: string
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          description?: string | null
          id?: string
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          account_id: string
          created_at: string
          definition: string | null
          embedding: string | null
          set_name: string | null
          tag: string
          term: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          definition?: string | null
          embedding?: string | null
          set_name?: string | null
          tag: string
          term?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          definition?: string | null
          embedding?: string | null
          set_name?: string | null
          tag?: string
          term?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: {
        Args: { lookup_invitation_token: string }
        Returns: Json
      }
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      create_account: {
        Args: { slug?: string; name?: string }
        Returns: Json
      }
      create_invitation: {
        Args: {
          account_id: string
          account_role: "owner" | "member"
          invitation_type: "one_time" | "24_hour"
        }
        Returns: Json
      }
      current_user_account_role: {
        Args: { account_id: string }
        Returns: Json
      }
      delete_invitation: {
        Args: { invitation_id: string }
        Returns: undefined
      }
      get_account: {
        Args: { account_id: string }
        Returns: Json
      }
      get_account_billing_status: {
        Args: { account_id: string }
        Returns: Json
      }
      get_account_by_slug: {
        Args: { slug: string }
        Returns: Json
      }
      get_account_id: {
        Args: { slug: string }
        Returns: string
      }
      get_account_invitations: {
        Args: {
          account_id: string
          results_limit?: number
          results_offset?: number
        }
        Returns: Json
      }
      get_account_members: {
        Args: {
          account_id: string
          results_limit?: number
          results_offset?: number
        }
        Returns: Json
      }
      get_accounts: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_personal_account: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_user_accounts: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      invoke_edge_function: {
        Args: { func_name: string; payload: Json }
        Returns: undefined
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      lookup_invitation: {
        Args: { lookup_invitation_token: string }
        Returns: Json
      }
      process_embedding_queue: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      process_transcribe_queue: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      remove_account_member: {
        Args: { account_id: string; user_id: string }
        Returns: undefined
      }
      service_role_upsert_customer_subscription: {
        Args: { account_id: string; customer?: Json; subscription?: Json }
        Returns: undefined
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      update_account: {
        Args: {
          account_id: string
          slug?: string
          name?: string
          public_metadata?: Json
          replace_metadata?: boolean
        }
        Returns: Json
      }
      update_account_user_role: {
        Args: {
          account_id: string
          user_id: string
          new_account_role: "owner" | "member"
          make_primary_owner?: boolean
        }
        Returns: undefined
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      interview_status:
        | "draft"
        | "scheduled"
        | "uploaded"
        | "transcribed"
        | "processing"
        | "ready"
        | "tagged"
        | "archived"
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
      interview_status: [
        "draft",
        "scheduled",
        "uploaded",
        "transcribed",
        "processing",
        "ready",
        "tagged",
        "archived",
      ],
    },
  },
} as const
