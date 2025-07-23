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
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          insight_id: string
          org_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          insight_id: string
          org_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          insight_id?: string
          org_id?: string
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
          {
            foreignKeyName: "comments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      insight_tags: {
        Row: {
          insight_id: string
          tag: string
        }
        Insert: {
          insight_id: string
          tag: string
        }
        Update: {
          insight_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "insight_tags_insight_id_fkey"
            columns: ["insight_id"]
            isOneToOne: false
            referencedRelation: "insights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insight_tags_tag_fkey"
            columns: ["tag"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["tag"]
          },
        ]
      }
      insights: {
        Row: {
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
          org_id: string
          pain: string | null
          related_tags: string[] | null
          updated_at: string
        }
        Insert: {
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
          org_id: string
          pain?: string | null
          related_tags?: string[] | null
          updated_at?: string
        }
        Update: {
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
          org_id?: string
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
          {
            foreignKeyName: "insights_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      interviewee: {
        Row: {
          contact_info: Json | null
          created_at: string
          id: string
          interview_id: string | null
          name: string | null
          org_id: string
          participant_description: string | null
          persona: string | null
          segment: string | null
          updated_at: string
        }
        Insert: {
          contact_info?: Json | null
          created_at?: string
          id?: string
          interview_id?: string | null
          name?: string | null
          org_id: string
          participant_description?: string | null
          persona?: string | null
          segment?: string | null
          updated_at?: string
        }
        Update: {
          contact_info?: Json | null
          created_at?: string
          id?: string
          interview_id?: string | null
          name?: string | null
          org_id?: string
          participant_description?: string | null
          persona?: string | null
          segment?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interviewee_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviewee_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          created_at: string
          duration_min: number | null
          high_impact_themes: string[] | null
          id: string
          interview_date: string | null
          interviewer_id: string | null
          observations_and_notes: string | null
          open_questions_and_next_steps: string | null
          org_id: string
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
          created_at?: string
          duration_min?: number | null
          high_impact_themes?: string[] | null
          id?: string
          interview_date?: string | null
          interviewer_id?: string | null
          observations_and_notes?: string | null
          open_questions_and_next_steps?: string | null
          org_id: string
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
          created_at?: string
          duration_min?: number | null
          high_impact_themes?: string[] | null
          id?: string
          interview_date?: string | null
          interviewer_id?: string | null
          observations_and_notes?: string | null
          open_questions_and_next_steps?: string | null
          org_id?: string
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
            foreignKeyName: "interviews_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      media_files: {
        Row: {
          file_name: string
          id: string
          interview_id: string | null
          mime_type: string
          org_id: string
          r2_path: string
          size_bytes: number | null
          uploaded_at: string
          uploaded_by: string | null
          url: string | null
        }
        Insert: {
          file_name: string
          id?: string
          interview_id?: string | null
          mime_type: string
          org_id: string
          r2_path: string
          size_bytes?: number | null
          uploaded_at?: string
          uploaded_by?: string | null
          url?: string | null
        }
        Update: {
          file_name?: string
          id?: string
          interview_id?: string | null
          mime_type?: string
          org_id?: string
          r2_path?: string
          size_bytes?: number | null
          uploaded_at?: string
          uploaded_by?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_files_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_files_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          created_at: string
          id: string
          kanban_status: string | null
          org_id: string
          owner_id: string | null
          related_insight_ids: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kanban_status?: string | null
          org_id: string
          owner_id?: string | null
          related_insight_ids?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kanban_status?: string | null
          org_id?: string
          owner_id?: string | null
          related_insight_ids?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      personas: {
        Row: {
          color_hex: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          org_id: string
          percentage: number | null
          updated_at: string
        }
        Insert: {
          color_hex?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          org_id: string
          percentage?: number | null
          updated_at?: string
        }
        Update: {
          color_hex?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          org_id?: string
          percentage?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "personas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          created_at: string
          id: string
          insight_id: string
          org_id: string
          quote: string
          timestamp_sec: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          insight_id: string
          org_id: string
          quote: string
          timestamp_sec?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          insight_id?: string
          org_id?: string
          quote?: string
          timestamp_sec?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_insight_id_fkey"
            columns: ["insight_id"]
            isOneToOne: false
            referencedRelation: "insights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      research_projects: {
        Row: {
          code: string | null
          created_at: string
          description: string | null
          id: string
          org_id: string
          title: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          org_id: string
          title: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          org_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          description: string | null
          tag: string
        }
        Insert: {
          description?: string | null
          tag: string
        }
        Update: {
          description?: string | null
          tag?: string
        }
        Relationships: []
      }
      themes: {
        Row: {
          category: string | null
          color_hex: string | null
          created_at: string
          embedding: string | null
          id: string
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          color_hex?: string | null
          created_at?: string
          embedding?: string | null
          id?: string
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          color_hex?: string | null
          created_at?: string
          embedding?: string | null
          id?: string
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "themes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_org_memberships: {
        Row: {
          joined_at: string
          org_id: string
          role: Database["public"]["Enums"]["membership_role"]
          user_id: string
        }
        Insert: {
          joined_at?: string
          org_id: string
          role?: Database["public"]["Enums"]["membership_role"]
          user_id: string
        }
        Update: {
          joined_at?: string
          org_id?: string
          role?: Database["public"]["Enums"]["membership_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_org_memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      theme_counts_mv: {
        Row: {
          insight_count: number | null
          name: string | null
          theme_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
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
        Returns: unknown
      }
      process_embedding_queue: {
        Args: Record<PropertyKey, never>
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
      membership_role: "owner" | "member"
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
      membership_role: ["owner", "member"],
    },
  },
} as const
