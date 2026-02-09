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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  accounts: {
    Tables: {
      account_user: {
        Row: {
          account_id: string
          account_role: Database["accounts"]["Enums"]["account_role"]
          user_id: string
        }
        Insert: {
          account_id: string
          account_role: Database["accounts"]["Enums"]["account_role"]
          user_id: string
        }
        Update: {
          account_id?: string
          account_role?: Database["accounts"]["Enums"]["account_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_user_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          company_description: string | null
          competitors: string[] | null
          created_at: string | null
          created_by: string | null
          customer_problem: string | null
          id: string
          industry: string | null
          name: string | null
          offerings: string[] | null
          personal_account: boolean
          plan_id: string
          primary_owner_user_id: string
          private_metadata: Json | null
          public_metadata: Json | null
          slug: string | null
          target_company_sizes: string[] | null
          target_orgs: string[] | null
          target_roles: string[] | null
          updated_at: string | null
          updated_by: string | null
          website_url: string | null
        }
        Insert: {
          company_description?: string | null
          competitors?: string[] | null
          created_at?: string | null
          created_by?: string | null
          customer_problem?: string | null
          id?: string
          industry?: string | null
          name?: string | null
          offerings?: string[] | null
          personal_account?: boolean
          plan_id?: string
          primary_owner_user_id?: string
          private_metadata?: Json | null
          public_metadata?: Json | null
          slug?: string | null
          target_company_sizes?: string[] | null
          target_orgs?: string[] | null
          target_roles?: string[] | null
          updated_at?: string | null
          updated_by?: string | null
          website_url?: string | null
        }
        Update: {
          company_description?: string | null
          competitors?: string[] | null
          created_at?: string | null
          created_by?: string | null
          customer_problem?: string | null
          id?: string
          industry?: string | null
          name?: string | null
          offerings?: string[] | null
          personal_account?: boolean
          plan_id?: string
          primary_owner_user_id?: string
          private_metadata?: Json | null
          public_metadata?: Json | null
          slug?: string | null
          target_company_sizes?: string[] | null
          target_orgs?: string[] | null
          target_roles?: string[] | null
          updated_at?: string | null
          updated_by?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      billing_customers: {
        Row: {
          account_id: string
          active: boolean | null
          email: string | null
          id: string
          provider: string | null
        }
        Insert: {
          account_id: string
          active?: boolean | null
          email?: string | null
          id: string
          provider?: string | null
        }
        Update: {
          account_id?: string
          active?: boolean | null
          email?: string | null
          id?: string
          provider?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_customers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_subscriptions: {
        Row: {
          account_id: string
          billing_customer_id: string
          cancel_at: string | null
          cancel_at_period_end: boolean | null
          canceled_at: string | null
          created_at: string
          current_period_end: string
          current_period_start: string
          ended_at: string | null
          id: string
          metadata: Json | null
          plan_name: string | null
          price_id: string | null
          provider: string | null
          quantity: number | null
          status: Database["accounts"]["Enums"]["subscription_status"] | null
          trial_end: string | null
          trial_start: string | null
        }
        Insert: {
          account_id: string
          billing_customer_id: string
          cancel_at?: string | null
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          ended_at?: string | null
          id: string
          metadata?: Json | null
          plan_name?: string | null
          price_id?: string | null
          provider?: string | null
          quantity?: number | null
          status?: Database["accounts"]["Enums"]["subscription_status"] | null
          trial_end?: string | null
          trial_start?: string | null
        }
        Update: {
          account_id?: string
          billing_customer_id?: string
          cancel_at?: string | null
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          ended_at?: string | null
          id?: string
          metadata?: Json | null
          plan_name?: string | null
          price_id?: string | null
          provider?: string | null
          quantity?: number | null
          status?: Database["accounts"]["Enums"]["subscription_status"] | null
          trial_end?: string | null
          trial_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_subscriptions_billing_customer_id_fkey"
            columns: ["billing_customer_id"]
            isOneToOne: false
            referencedRelation: "billing_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      config: {
        Row: {
          billing_provider: string | null
          enable_personal_account_billing: boolean | null
          enable_team_account_billing: boolean | null
          enable_team_accounts: boolean | null
        }
        Insert: {
          billing_provider?: string | null
          enable_personal_account_billing?: boolean | null
          enable_team_account_billing?: boolean | null
          enable_team_accounts?: boolean | null
        }
        Update: {
          billing_provider?: string | null
          enable_personal_account_billing?: boolean | null
          enable_team_account_billing?: boolean | null
          enable_team_accounts?: boolean | null
        }
        Relationships: []
      }
      invitation_audit: {
        Row: {
          account_id: string
          account_role: Database["accounts"]["Enums"]["account_role"] | null
          action: string
          actor_user_id: string | null
          created_at: string
          details: Json | null
          id: string
          invitation_id: string | null
          invitee_email: string | null
        }
        Insert: {
          account_id: string
          account_role?: Database["accounts"]["Enums"]["account_role"] | null
          action: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          invitation_id?: string | null
          invitee_email?: string | null
        }
        Update: {
          account_id?: string
          account_role?: Database["accounts"]["Enums"]["account_role"] | null
          action?: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          invitation_id?: string | null
          invitee_email?: string | null
        }
        Relationships: []
      }
      invitations: {
        Row: {
          account_id: string
          account_name: string | null
          account_role: Database["accounts"]["Enums"]["account_role"]
          created_at: string | null
          id: string
          invitation_type: Database["accounts"]["Enums"]["invitation_type"]
          invited_by_user_id: string
          invitee_email: string | null
          token: string
          updated_at: string | null
        }
        Insert: {
          account_id: string
          account_name?: string | null
          account_role: Database["accounts"]["Enums"]["account_role"]
          created_at?: string | null
          id?: string
          invitation_type: Database["accounts"]["Enums"]["invitation_type"]
          invited_by_user_id: string
          invitee_email?: string | null
          token?: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          account_name?: string | null
          account_role?: Database["accounts"]["Enums"]["account_role"]
          created_at?: string | null
          id?: string
          invitation_type?: Database["accounts"]["Enums"]["invitation_type"]
          invited_by_user_id?: string
          invitee_email?: string | null
          token?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_token: { Args: { length: number }; Returns: string }
      get_accounts_with_role: {
        Args: { passed_in_role?: Database["accounts"]["Enums"]["account_role"] }
        Returns: string[]
      }
      get_config: { Args: never; Returns: Json }
      has_role_on_account: {
        Args: {
          account_id: string
          account_role?: Database["accounts"]["Enums"]["account_role"]
        }
        Returns: boolean
      }
      is_set: { Args: { field_name: string }; Returns: boolean }
    }
    Enums: {
      account_role: "owner" | "member" | "viewer"
      invitation_type: "one_time" | "24_hour"
      subscription_status:
        | "trialing"
        | "active"
        | "canceled"
        | "incomplete"
        | "incomplete_expired"
        | "past_due"
        | "unpaid"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  billing: {
    Tables: {
      credit_ledger: {
        Row: {
          account_id: string
          amount: number
          billing_period_end: string | null
          billing_period_start: string | null
          created_at: string
          created_by: string | null
          event_type: Database["billing"]["Enums"]["credit_event_type"]
          expires_at: string | null
          feature_source: string | null
          id: string
          idempotency_key: string | null
          metadata: Json | null
          source: Database["billing"]["Enums"]["credit_source"] | null
          usage_event_id: string | null
        }
        Insert: {
          account_id: string
          amount: number
          billing_period_end?: string | null
          billing_period_start?: string | null
          created_at?: string
          created_by?: string | null
          event_type: Database["billing"]["Enums"]["credit_event_type"]
          expires_at?: string | null
          feature_source?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          source?: Database["billing"]["Enums"]["credit_source"] | null
          usage_event_id?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          billing_period_end?: string | null
          billing_period_start?: string | null
          created_at?: string
          created_by?: string | null
          event_type?: Database["billing"]["Enums"]["credit_event_type"]
          expires_at?: string | null
          feature_source?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          source?: Database["billing"]["Enums"]["credit_source"] | null
          usage_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_usage_event_id_fkey"
            columns: ["usage_event_id"]
            isOneToOne: false
            referencedRelation: "usage_events"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_entitlements: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          enabled: boolean
          feature_key: string
          id: string
          metadata: Json | null
          quantity_limit: number | null
          quantity_used: number | null
          source: Database["billing"]["Enums"]["entitlement_source"]
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          feature_key: string
          id?: string
          metadata?: Json | null
          quantity_limit?: number | null
          quantity_used?: number | null
          source: Database["billing"]["Enums"]["entitlement_source"]
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          feature_key?: string
          id?: string
          metadata?: Json | null
          quantity_limit?: number | null
          quantity_used?: number | null
          source?: Database["billing"]["Enums"]["entitlement_source"]
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      usage_events: {
        Row: {
          account_id: string
          created_at: string
          credits_charged: number
          estimated_cost_usd: number
          feature_source: string
          id: string
          idempotency_key: string | null
          input_tokens: number
          model: string
          output_tokens: number
          project_id: string | null
          provider: string
          resource_id: string | null
          resource_type: string | null
          total_tokens: number | null
          user_id: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          credits_charged: number
          estimated_cost_usd: number
          feature_source: string
          id?: string
          idempotency_key?: string | null
          input_tokens?: number
          model: string
          output_tokens?: number
          project_id?: string | null
          provider: string
          resource_id?: string | null
          resource_type?: string | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          credits_charged?: number
          estimated_cost_usd?: number
          feature_source?: string
          id?: string
          idempotency_key?: string | null
          input_tokens?: number
          model?: string
          output_tokens?: number
          project_id?: string | null
          provider?: string
          resource_id?: string | null
          resource_type?: string | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_active_entitlement: {
        Args: { p_account_id: string; p_feature_key: string }
        Returns: {
          enabled: boolean
          id: string
          quantity_limit: number
          quantity_remaining: number
          quantity_used: number
          source: Database["billing"]["Enums"]["entitlement_source"]
          valid_until: string
        }[]
      }
      get_admin_daily_usage: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          event_count: number
          total_cost_usd: number
          total_credits: number
          total_tokens: number
          unique_accounts: number
          usage_date: string
        }[]
      }
      get_admin_usage_by_account: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          account_id: string
          account_name: string
          event_count: number
          total_cost_usd: number
          total_credits: number
          total_tokens: number
        }[]
      }
      get_admin_usage_by_feature: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          event_count: number
          feature_source: string
          total_cost_usd: number
          total_credits: number
          total_tokens: number
        }[]
      }
      get_credit_balance: {
        Args: { p_account_id: string }
        Returns: {
          balance: number
          expires_in_7_days: number
          grants_total: number
          spends_total: number
        }[]
      }
      get_monthly_usage_summary: {
        Args: { p_account_id: string; p_month_start?: string }
        Returns: {
          event_count: number
          feature_source: string
          total_cost_usd: number
          total_credits: number
          total_tokens: number
        }[]
      }
      grant_credits: {
        Args: {
          p_account_id: string
          p_amount: number
          p_billing_period_end?: string
          p_billing_period_start?: string
          p_created_by?: string
          p_expires_at?: string
          p_idempotency_key: string
          p_metadata?: Json
          p_source: Database["billing"]["Enums"]["credit_source"]
        }
        Returns: {
          is_duplicate: boolean
          ledger_id: string
          success: boolean
        }[]
      }
      increment_voice_minutes: {
        Args: { p_account_id: string; p_minutes: number }
        Returns: {
          new_quantity_used: number
          quantity_remaining: number
          success: boolean
        }[]
      }
      spend_credits_atomic: {
        Args: {
          p_account_id: string
          p_amount: number
          p_feature_source?: string
          p_hard_limit: number
          p_idempotency_key: string
          p_metadata?: Json
          p_soft_limit: number
          p_usage_event_id?: string
        }
        Returns: {
          limit_status: string
          new_balance: number
          success: boolean
        }[]
      }
    }
    Enums: {
      credit_event_type: "grant" | "purchase" | "spend" | "expire" | "refund"
      credit_source: "plan" | "purchase" | "promo" | "manual"
      entitlement_source: "plan" | "addon" | "promo" | "override"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      account_settings: {
        Row: {
          account_id: string | null
          app_activity: Json
          created_at: string
          created_by: string | null
          current_account_id: string | null
          current_project_id: string | null
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
          current_account_id?: string | null
          current_project_id?: string | null
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
          current_account_id?: string | null
          current_project_id?: string | null
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
      actions: {
        Row: {
          account_id: string
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          evidence_ids: string[] | null
          id: string
          impact_score: number | null
          insight_id: string | null
          lens_type: string | null
          metadata: Json | null
          owner_user_id: string | null
          priority: string | null
          project_id: string
          status: string
          theme_id: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          account_id: string
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          evidence_ids?: string[] | null
          id?: string
          impact_score?: number | null
          insight_id?: string | null
          lens_type?: string | null
          metadata?: Json | null
          owner_user_id?: string | null
          priority?: string | null
          project_id: string
          status?: string
          theme_id?: string | null
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          evidence_ids?: string[] | null
          id?: string
          impact_score?: number | null
          insight_id?: string | null
          lens_type?: string | null
          metadata?: Json | null
          owner_user_id?: string | null
          priority?: string | null
          project_id?: string
          status?: string
          theme_id?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "actions_insight_id_fkey"
            columns: ["insight_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actions_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_task_runs: {
        Row: {
          agent_type: string
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          logs: Json | null
          output: string | null
          started_at: string | null
          status: string
          task_id: string
          triggered_by: string | null
        }
        Insert: {
          agent_type: string
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          logs?: Json | null
          output?: string | null
          started_at?: string | null
          status?: string
          task_id: string
          triggered_by?: string | null
        }
        Update: {
          agent_type?: string
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          logs?: Json | null
          output?: string | null
          started_at?: string | null
          status?: string
          task_id?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_task_runs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      annotations: {
        Row: {
          account_id: string
          ai_model: string | null
          annotation_type: string
          content: string | null
          content_jsonb: Json | null
          created_at: string | null
          created_by_ai: boolean | null
          created_by_user_id: string | null
          due_date: string | null
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          parent_annotation_id: string | null
          project_id: string
          reaction_type: string | null
          resolved_at: string | null
          resolved_by_user_id: string | null
          status: string | null
          task_id: string | null
          thread_root_id: string | null
          updated_at: string | null
          updated_by_user_id: string | null
          visibility: string | null
        }
        Insert: {
          account_id: string
          ai_model?: string | null
          annotation_type: string
          content?: string | null
          content_jsonb?: Json | null
          created_at?: string | null
          created_by_ai?: boolean | null
          created_by_user_id?: string | null
          due_date?: string | null
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          parent_annotation_id?: string | null
          project_id: string
          reaction_type?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          status?: string | null
          task_id?: string | null
          thread_root_id?: string | null
          updated_at?: string | null
          updated_by_user_id?: string | null
          visibility?: string | null
        }
        Update: {
          account_id?: string
          ai_model?: string | null
          annotation_type?: string
          content?: string | null
          content_jsonb?: Json | null
          created_at?: string | null
          created_by_ai?: boolean | null
          created_by_user_id?: string | null
          due_date?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          parent_annotation_id?: string | null
          project_id?: string
          reaction_type?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          status?: string | null
          task_id?: string | null
          thread_root_id?: string | null
          updated_at?: string | null
          updated_by_user_id?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "annotations_parent_annotation_id_fkey"
            columns: ["parent_annotation_id"]
            isOneToOne: false
            referencedRelation: "annotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotations_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotations_thread_root_id_fkey"
            columns: ["thread_root_id"]
            isOneToOne: false
            referencedRelation: "annotations"
            referencedColumns: ["id"]
          },
        ]
      }
      artifacts: {
        Row: {
          a2ui_doc: Json
          account_id: string
          artifact_type: string
          capabilities_snapshot: Json
          created_at: string
          created_by: string
          data_model: Json
          etag: string
          id: string
          parent_id: string | null
          status: string
          thread_id: string
          trace_id: string | null
          version: number
        }
        Insert: {
          a2ui_doc: Json
          account_id: string
          artifact_type: string
          capabilities_snapshot: Json
          created_at?: string
          created_by: string
          data_model: Json
          etag: string
          id?: string
          parent_id?: string | null
          status?: string
          thread_id: string
          trace_id?: string | null
          version?: number
        }
        Update: {
          a2ui_doc?: Json
          account_id?: string
          artifact_type?: string
          capabilities_snapshot?: Json
          created_at?: string
          created_by?: string
          data_model?: Json
          etag?: string
          id?: string
          parent_id?: string | null
          status?: string
          thread_id?: string
          trace_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "artifacts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artifacts_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_evidence: {
        Row: {
          account_id: string
          asset_id: string
          column_name: string | null
          created_at: string
          created_by: string | null
          evidence_id: string
          extraction_type: string | null
          id: string
          project_id: string | null
          row_index: number | null
        }
        Insert: {
          account_id: string
          asset_id: string
          column_name?: string | null
          created_at?: string
          created_by?: string | null
          evidence_id: string
          extraction_type?: string | null
          id?: string
          project_id?: string | null
          row_index?: number | null
        }
        Update: {
          account_id?: string
          asset_id?: string
          column_name?: string | null
          created_at?: string
          created_by?: string | null
          evidence_id?: string
          extraction_type?: string | null
          id?: string
          project_id?: string | null
          row_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_evidence_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "project_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_evidence_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_opportunities: {
        Row: {
          account_id: string
          asset_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          opportunity_id: string
          project_id: string
          relationship_type: string | null
        }
        Insert: {
          account_id: string
          asset_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          opportunity_id: string
          project_id: string
          relationship_type?: string | null
        }
        Update: {
          account_id?: string
          asset_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          opportunity_id?: string
          project_id?: string
          relationship_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_opportunities_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "project_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_opportunities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_opportunities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_organizations: {
        Row: {
          account_id: string
          asset_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          organization_id: string
          project_id: string
          relationship_type: string | null
        }
        Insert: {
          account_id: string
          asset_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          project_id: string
          relationship_type?: string | null
        }
        Update: {
          account_id?: string
          asset_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          project_id?: string
          relationship_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_organizations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "project_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_organizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_organizations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_people: {
        Row: {
          account_id: string
          asset_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          person_id: string
          project_id: string
          relationship_type: string | null
        }
        Insert: {
          account_id: string
          asset_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          person_id: string
          project_id: string
          relationship_type?: string | null
        }
        Update: {
          account_id?: string
          asset_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          person_id?: string
          project_id?: string
          relationship_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_people_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "project_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_people_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_people_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_connections: {
        Row: {
          access_token: string | null
          account_id: string
          calendar_id: string | null
          created_at: string
          id: string
          last_synced_at: string | null
          pica_connection_id: string | null
          pica_connection_key: string | null
          provider: string
          provider_account_id: string | null
          provider_email: string | null
          refresh_token: string | null
          sync_enabled: boolean
          sync_error: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          account_id: string
          calendar_id?: string | null
          created_at?: string
          id?: string
          last_synced_at?: string | null
          pica_connection_id?: string | null
          pica_connection_key?: string | null
          provider?: string
          provider_account_id?: string | null
          provider_email?: string | null
          refresh_token?: string | null
          sync_enabled?: boolean
          sync_error?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          account_id?: string
          calendar_id?: string | null
          created_at?: string
          id?: string
          last_synced_at?: string | null
          pica_connection_id?: string | null
          pica_connection_key?: string | null
          provider?: string
          provider_account_id?: string | null
          provider_email?: string | null
          refresh_token?: string | null
          sync_enabled?: boolean
          sync_error?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          account_id: string
          attendee_emails: string[] | null
          brief_generated_at: string | null
          brief_id: string | null
          connection_id: string
          created_at: string
          description: string | null
          end_time: string
          external_id: string
          id: string
          interview_id: string | null
          is_customer_meeting: boolean | null
          location: string | null
          matched_org_id: string | null
          matched_person_ids: string[] | null
          meeting_type: string | null
          meeting_url: string | null
          organizer_email: string | null
          raw_event: Json | null
          start_time: string
          synced_at: string
          timezone: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          attendee_emails?: string[] | null
          brief_generated_at?: string | null
          brief_id?: string | null
          connection_id: string
          created_at?: string
          description?: string | null
          end_time: string
          external_id: string
          id?: string
          interview_id?: string | null
          is_customer_meeting?: boolean | null
          location?: string | null
          matched_org_id?: string | null
          matched_person_ids?: string[] | null
          meeting_type?: string | null
          meeting_url?: string | null
          organizer_email?: string | null
          raw_event?: Json | null
          start_time: string
          synced_at?: string
          timezone?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          attendee_emails?: string[] | null
          brief_generated_at?: string | null
          brief_id?: string | null
          connection_id?: string
          created_at?: string
          description?: string | null
          end_time?: string
          external_id?: string
          id?: string
          interview_id?: string | null
          is_customer_meeting?: boolean | null
          location?: string | null
          matched_org_id?: string | null
          matched_person_ids?: string[] | null
          meeting_type?: string | null
          meeting_url?: string | null
          organizer_email?: string | null
          raw_event?: Json | null
          start_time?: string
          synced_at?: string
          timezone?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "calendar_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_matched_org_id_fkey"
            columns: ["matched_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      conversation_lens_analyses: {
        Row: {
          account_id: string
          analysis_data: Json
          auto_detected: boolean | null
          confidence_score: number | null
          created_at: string
          custom_instructions: string | null
          error_message: string | null
          icp_context: Json | null
          id: string
          interview_id: string
          processed_at: string | null
          processed_by: string | null
          project_id: string | null
          status: string | null
          template_key: string
          trigger_run_id: string | null
          updated_at: string
          user_goals: string[] | null
        }
        Insert: {
          account_id: string
          analysis_data?: Json
          auto_detected?: boolean | null
          confidence_score?: number | null
          created_at?: string
          custom_instructions?: string | null
          error_message?: string | null
          icp_context?: Json | null
          id?: string
          interview_id: string
          processed_at?: string | null
          processed_by?: string | null
          project_id?: string | null
          status?: string | null
          template_key: string
          trigger_run_id?: string | null
          updated_at?: string
          user_goals?: string[] | null
        }
        Update: {
          account_id?: string
          analysis_data?: Json
          auto_detected?: boolean | null
          confidence_score?: number | null
          created_at?: string
          custom_instructions?: string | null
          error_message?: string | null
          icp_context?: Json | null
          id?: string
          interview_id?: string
          processed_at?: string | null
          processed_by?: string | null
          project_id?: string | null
          status?: string | null
          template_key?: string
          trigger_run_id?: string | null
          updated_at?: string
          user_goals?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_lens_analyses_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_lens_analyses_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_lens_analyses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_lens_analyses_template_key_fkey"
            columns: ["template_key"]
            isOneToOne: false
            referencedRelation: "conversation_lens_templates"
            referencedColumns: ["template_key"]
          },
        ]
      }
      conversation_lens_summaries: {
        Row: {
          account_id: string
          conflicts_to_review: Json | null
          created_at: string
          custom_instructions: string | null
          error_message: string | null
          executive_summary: string | null
          id: string
          interview_count: number
          key_takeaways: Json | null
          overall_confidence: number | null
          processed_at: string | null
          processed_by: string | null
          project_id: string
          recommendations: Json | null
          status: string | null
          synthesis_data: Json
          template_key: string
          trigger_run_id: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          conflicts_to_review?: Json | null
          created_at?: string
          custom_instructions?: string | null
          error_message?: string | null
          executive_summary?: string | null
          id?: string
          interview_count?: number
          key_takeaways?: Json | null
          overall_confidence?: number | null
          processed_at?: string | null
          processed_by?: string | null
          project_id: string
          recommendations?: Json | null
          status?: string | null
          synthesis_data?: Json
          template_key: string
          trigger_run_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          conflicts_to_review?: Json | null
          created_at?: string
          custom_instructions?: string | null
          error_message?: string | null
          executive_summary?: string | null
          id?: string
          interview_count?: number
          key_takeaways?: Json | null
          overall_confidence?: number | null
          processed_at?: string | null
          processed_by?: string | null
          project_id?: string
          recommendations?: Json | null
          status?: string | null
          synthesis_data?: Json
          template_key?: string
          trigger_run_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_lens_summaries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_lens_templates: {
        Row: {
          account_id: string | null
          category: string | null
          created_at: string
          created_by: string | null
          display_order: number | null
          is_active: boolean | null
          is_public: boolean
          is_system: boolean
          nlp_source: string | null
          primary_objective: string | null
          summary: string | null
          template_definition: Json
          template_key: string
          template_name: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          display_order?: number | null
          is_active?: boolean | null
          is_public?: boolean
          is_system?: boolean
          nlp_source?: string | null
          primary_objective?: string | null
          summary?: string | null
          template_definition: Json
          template_key: string
          template_name: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          display_order?: number | null
          is_active?: boolean | null
          is_public?: boolean
          is_system?: boolean
          nlp_source?: string | null
          primary_objective?: string | null
          summary?: string | null
          template_definition?: Json
          template_key?: string
          template_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      decision_question_metrics: {
        Row: {
          decision_question_id: string
          id: string
          metric: string
          project_id: string
        }
        Insert: {
          decision_question_id: string
          id?: string
          metric: string
          project_id: string
        }
        Update: {
          decision_question_id?: string
          id?: string
          metric?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_question_metrics_decision_question_id_fkey"
            columns: ["decision_question_id"]
            isOneToOne: false
            referencedRelation: "decision_question_summary"
            referencedColumns: ["decision_question_id"]
          },
          {
            foreignKeyName: "decision_question_metrics_decision_question_id_fkey"
            columns: ["decision_question_id"]
            isOneToOne: false
            referencedRelation: "decision_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_question_metrics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_question_risks: {
        Row: {
          decision_question_id: string
          id: string
          project_id: string
          risk: string
        }
        Insert: {
          decision_question_id: string
          id?: string
          project_id: string
          risk: string
        }
        Update: {
          decision_question_id?: string
          id?: string
          project_id?: string
          risk?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_question_risks_decision_question_id_fkey"
            columns: ["decision_question_id"]
            isOneToOne: false
            referencedRelation: "decision_question_summary"
            referencedColumns: ["decision_question_id"]
          },
          {
            foreignKeyName: "decision_question_risks_decision_question_id_fkey"
            columns: ["decision_question_id"]
            isOneToOne: false
            referencedRelation: "decision_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_question_risks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_questions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          plan_id: string | null
          project_id: string
          rationale: string | null
          text: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          plan_id?: string | null
          project_id: string
          rationale?: string | null
          text: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          plan_id?: string | null
          project_id?: string
          rationale?: string | null
          text?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decision_questions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "project_research_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_questions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_flags: {
        Row: {
          account_id: string
          created_at: string | null
          entity_id: string
          entity_type: string
          flag_type: string
          flag_value: boolean | null
          id: string
          metadata: Json | null
          project_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string | null
          entity_id: string
          entity_type: string
          flag_type: string
          flag_value?: boolean | null
          id?: string
          metadata?: Json | null
          project_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          flag_type?: string
          flag_value?: boolean | null
          id?: string
          metadata?: Json | null
          project_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_flags_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence: {
        Row: {
          account_id: string
          anchors: Json
          chunk: string | null
          citation: string | null
          confidence: string | null
          context_summary: string | null
          created_at: string
          created_by: string | null
          does: string[] | null
          embedding: string | null
          embedding_generated_at: string | null
          embedding_model: string | null
          feels: string[] | null
          gains: string[] | null
          gist: string | null
          id: string
          independence_key: string | null
          interview_id: string | null
          is_question: boolean | null
          journey_stage: string | null
          method: string | null
          modality: string
          pains: string[] | null
          personas: string[] | null
          project_answer_id: string | null
          project_id: string | null
          research_link_response_id: string | null
          says: string[] | null
          segments: string[] | null
          source_type: string | null
          support: string | null
          thinks: string[] | null
          topic: string | null
          updated_at: string
          updated_by: string | null
          verbatim: string
          weight_quality: number | null
          weight_relevance: number | null
        }
        Insert: {
          account_id: string
          anchors?: Json
          chunk?: string | null
          citation?: string | null
          confidence?: string | null
          context_summary?: string | null
          created_at?: string
          created_by?: string | null
          does?: string[] | null
          embedding?: string | null
          embedding_generated_at?: string | null
          embedding_model?: string | null
          feels?: string[] | null
          gains?: string[] | null
          gist?: string | null
          id?: string
          independence_key?: string | null
          interview_id?: string | null
          is_question?: boolean | null
          journey_stage?: string | null
          method?: string | null
          modality?: string
          pains?: string[] | null
          personas?: string[] | null
          project_answer_id?: string | null
          project_id?: string | null
          research_link_response_id?: string | null
          says?: string[] | null
          segments?: string[] | null
          source_type?: string | null
          support?: string | null
          thinks?: string[] | null
          topic?: string | null
          updated_at?: string
          updated_by?: string | null
          verbatim: string
          weight_quality?: number | null
          weight_relevance?: number | null
        }
        Update: {
          account_id?: string
          anchors?: Json
          chunk?: string | null
          citation?: string | null
          confidence?: string | null
          context_summary?: string | null
          created_at?: string
          created_by?: string | null
          does?: string[] | null
          embedding?: string | null
          embedding_generated_at?: string | null
          embedding_model?: string | null
          feels?: string[] | null
          gains?: string[] | null
          gist?: string | null
          id?: string
          independence_key?: string | null
          interview_id?: string | null
          is_question?: boolean | null
          journey_stage?: string | null
          method?: string | null
          modality?: string
          pains?: string[] | null
          personas?: string[] | null
          project_answer_id?: string | null
          project_id?: string | null
          research_link_response_id?: string | null
          says?: string[] | null
          segments?: string[] | null
          source_type?: string | null
          support?: string | null
          thinks?: string[] | null
          topic?: string | null
          updated_at?: string
          updated_by?: string | null
          verbatim?: string
          weight_quality?: number | null
          weight_relevance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_project_answer_id_fkey"
            columns: ["project_answer_id"]
            isOneToOne: false
            referencedRelation: "project_answer_metrics"
            referencedColumns: ["project_answer_id"]
          },
          {
            foreignKeyName: "evidence_project_answer_id_fkey"
            columns: ["project_answer_id"]
            isOneToOne: false
            referencedRelation: "project_answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_research_link_response_id_fkey"
            columns: ["research_link_response_id"]
            isOneToOne: false
            referencedRelation: "research_link_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_facet: {
        Row: {
          account_id: string
          confidence: number | null
          created_at: string
          created_by: string | null
          embedding: string | null
          embedding_generated_at: string | null
          embedding_model: string | null
          evidence_id: string
          facet_account_id: number
          id: string
          kind_slug: string
          label: string
          notes: string | null
          person_id: string | null
          project_id: string | null
          quote: string | null
          source: string
          updated_at: string
        }
        Insert: {
          account_id: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          embedding?: string | null
          embedding_generated_at?: string | null
          embedding_model?: string | null
          evidence_id: string
          facet_account_id: number
          id?: string
          kind_slug: string
          label: string
          notes?: string | null
          person_id?: string | null
          project_id?: string | null
          quote?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          embedding?: string | null
          embedding_generated_at?: string | null
          embedding_model?: string | null
          evidence_id?: string
          facet_account_id?: number
          id?: string
          kind_slug?: string
          label?: string
          notes?: string | null
          person_id?: string | null
          project_id?: string | null
          quote?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_facet_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_facet_facet_account_id_fkey"
            columns: ["facet_account_id"]
            isOneToOne: false
            referencedRelation: "facet_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_facet_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_facet_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_people: {
        Row: {
          account_id: string
          confidence: number | null
          created_at: string | null
          created_by: string | null
          evidence_id: string
          id: string
          person_id: string
          project_id: string | null
          role: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          account_id: string
          confidence?: number | null
          created_at?: string | null
          created_by?: string | null
          evidence_id: string
          id?: string
          person_id: string
          project_id?: string | null
          role?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          account_id?: string
          confidence?: number | null
          created_at?: string | null
          created_by?: string | null
          evidence_id?: string
          id?: string
          person_id?: string
          project_id?: string | null
          role?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_people_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_people_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_people_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_tag: {
        Row: {
          account_id: string
          confidence: number | null
          created_at: string | null
          created_by: string | null
          evidence_id: string
          id: string
          project_id: string | null
          tag_id: string
        }
        Insert: {
          account_id: string
          confidence?: number | null
          created_at?: string | null
          created_by?: string | null
          evidence_id: string
          id?: string
          project_id?: string | null
          tag_id: string
        }
        Update: {
          account_id?: string
          confidence?: number | null
          created_at?: string | null
          created_by?: string | null
          evidence_id?: string
          id?: string
          project_id?: string | null
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_tag_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_tag_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_tag_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_account: {
        Row: {
          account_id: string
          created_at: string
          description: string | null
          global_facet_id: number | null
          id: number
          is_active: boolean
          kind_id: number
          label: string
          slug: string
          synonyms: string[] | null
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          description?: string | null
          global_facet_id?: number | null
          id?: number
          is_active?: boolean
          kind_id: number
          label: string
          slug: string
          synonyms?: string[] | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          description?: string | null
          global_facet_id?: number | null
          id?: number
          is_active?: boolean
          kind_id?: number
          label?: string
          slug?: string
          synonyms?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facet_account_global_facet_id_fkey"
            columns: ["global_facet_id"]
            isOneToOne: false
            referencedRelation: "facet_global"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facet_account_kind_id_fkey"
            columns: ["kind_id"]
            isOneToOne: false
            referencedRelation: "facet_kind_global"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_global: {
        Row: {
          created_at: string
          description: string | null
          id: number
          kind_id: number
          label: string
          slug: string
          synonyms: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: number
          kind_id: number
          label: string
          slug: string
          synonyms?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: number
          kind_id?: number
          label?: string
          slug?: string
          synonyms?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facet_global_kind_id_fkey"
            columns: ["kind_id"]
            isOneToOne: false
            referencedRelation: "facet_kind_global"
            referencedColumns: ["id"]
          },
        ]
      }
      facet_kind_global: {
        Row: {
          created_at: string
          description: string | null
          id: number
          label: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: number
          label: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: number
          label?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      icp_recommendations: {
        Row: {
          created_at: string
          generated_at: string
          generated_by_user_id: string | null
          id: string
          project_id: string
          recommendations: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          generated_at?: string
          generated_by_user_id?: string | null
          id?: string
          project_id: string
          recommendations?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          generated_at?: string
          generated_by_user_id?: string | null
          id?: string
          project_id?: string
          recommendations?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "icp_recommendations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      insight_tags: {
        Row: {
          account_id: string
          created_at: string | null
          created_by: string | null
          id: string
          insight_id: string
          project_id: string | null
          tag_id: string
        }
        Insert: {
          account_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          insight_id: string
          project_id?: string | null
          tag_id: string
        }
        Update: {
          account_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          insight_id?: string
          project_id?: string | null
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insight_tags_insight_id_fkey"
            columns: ["insight_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insight_tags_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insight_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
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
          created_by: string | null
          desired_outcome: string | null
          details: string | null
          embedding: string | null
          embedding_generated_at: string | null
          embedding_model: string | null
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
          project_id: string | null
          related_tags: string[] | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id: string
          category: string
          confidence?: string | null
          contradictions?: string | null
          created_at?: string
          created_by?: string | null
          desired_outcome?: string | null
          details?: string | null
          embedding?: string | null
          embedding_generated_at?: string | null
          embedding_model?: string | null
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
          project_id?: string | null
          related_tags?: string[] | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string
          category?: string
          confidence?: string | null
          contradictions?: string | null
          created_at?: string
          created_by?: string | null
          desired_outcome?: string | null
          details?: string | null
          embedding?: string | null
          embedding_generated_at?: string | null
          embedding_model?: string | null
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
          project_id?: string | null
          related_tags?: string[] | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insights_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insights_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insights_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_opportunities: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          id: string
          interview_id: string
          notes: string | null
          opportunity_id: string
          project_id: string
          relationship_type: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          interview_id: string
          notes?: string | null
          opportunity_id: string
          project_id: string
          relationship_type?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          interview_id?: string
          notes?: string | null
          opportunity_id?: string
          project_id?: string
          relationship_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_opportunities_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_opportunities_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_opportunities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_opportunities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_organizations: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          id: string
          interview_id: string
          notes: string | null
          organization_id: string
          project_id: string
          relationship_type: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          interview_id: string
          notes?: string | null
          organization_id: string
          project_id: string
          relationship_type?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          interview_id?: string
          notes?: string | null
          organization_id?: string
          project_id?: string
          relationship_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_organizations_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_organizations_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_organizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_organizations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_people: {
        Row: {
          created_at: string
          created_by: string | null
          display_name: string | null
          id: number
          interview_id: string
          person_id: string
          project_id: string | null
          role: string | null
          transcript_key: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          id?: number
          interview_id: string
          person_id: string
          project_id?: string | null
          role?: string | null
          transcript_key?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          id?: number
          interview_id?: string
          person_id?: string
          project_id?: string | null
          role?: string | null
          transcript_key?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_people_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_people_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_people_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_people_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_prompt_bias_checks: {
        Row: {
          id: string
          project_id: string
          prompt_id: string
          text: string
        }
        Insert: {
          id?: string
          project_id: string
          prompt_id: string
          text: string
        }
        Update: {
          id?: string
          project_id?: string
          prompt_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_prompt_bias_checks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_prompt_bias_checks_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "interview_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_prompt_followups: {
        Row: {
          id: string
          project_id: string
          prompt_id: string
          text: string
        }
        Insert: {
          id?: string
          project_id: string
          prompt_id: string
          text: string
        }
        Update: {
          id?: string
          project_id?: string
          prompt_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_prompt_followups_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_prompt_followups_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "interview_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_prompt_research_questions: {
        Row: {
          id: string
          project_id: string
          prompt_id: string
          research_question_id: string
        }
        Insert: {
          id?: string
          project_id: string
          prompt_id: string
          research_question_id: string
        }
        Update: {
          id?: string
          project_id?: string
          prompt_id?: string
          research_question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_prompt_research_questions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_prompt_research_questions_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "interview_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_prompt_research_questions_research_question_id_fkey"
            columns: ["research_question_id"]
            isOneToOne: false
            referencedRelation: "research_question_summary"
            referencedColumns: ["research_question_id"]
          },
          {
            foreignKeyName: "interview_prompt_research_questions_research_question_id_fkey"
            columns: ["research_question_id"]
            isOneToOne: false
            referencedRelation: "research_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_prompts: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          estimated_time_minutes: number | null
          id: string
          is_must_have: boolean | null
          is_selected: boolean | null
          order_index: number | null
          plan_id: string | null
          project_id: string
          rationale: string | null
          scores: Json | null
          selected_order: number | null
          source: string | null
          status: string | null
          text: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          estimated_time_minutes?: number | null
          id?: string
          is_must_have?: boolean | null
          is_selected?: boolean | null
          order_index?: number | null
          plan_id?: string | null
          project_id: string
          rationale?: string | null
          scores?: Json | null
          selected_order?: number | null
          source?: string | null
          status?: string | null
          text: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          estimated_time_minutes?: number | null
          id?: string
          is_must_have?: boolean | null
          is_selected?: boolean | null
          order_index?: number | null
          plan_id?: string | null
          project_id?: string
          rationale?: string | null
          scores?: Json | null
          selected_order?: number | null
          source?: string | null
          status?: string | null
          text?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_prompts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "project_research_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_prompts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_tags: {
        Row: {
          account_id: string
          created_at: string | null
          created_by: string | null
          id: string
          interview_id: string
          project_id: string | null
          tag_id: string
        }
        Insert: {
          account_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          interview_id: string
          project_id?: string | null
          tag_id: string
        }
        Update: {
          account_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          interview_id?: string
          project_id?: string | null
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_tags_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_tags_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_tags_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          account_id: string
          context_confidence: number | null
          context_reasoning: string | null
          conversation_analysis: Json | null
          created_at: string
          created_by: string | null
          duration_sec: number | null
          file_extension: string | null
          high_impact_themes: string[] | null
          id: string
          interaction_context:
            | Database["public"]["Enums"]["interaction_context"]
            | null
          interview_date: string | null
          interview_type: string | null
          interviewer_id: string | null
          key_takeaways: string | null
          lens_visibility: string | null
          media_type: string | null
          media_url: string | null
          meeting_platform: string | null
          observations_and_notes: string | null
          open_questions_and_next_steps: string | null
          original_filename: string | null
          participant_pseudonym: string | null
          person_id: string | null
          processing_metadata: Json | null
          project_id: string
          recall_recording_id: string | null
          relevant_answers: string[] | null
          research_link_id: string | null
          segment: string | null
          share_created_at: string | null
          share_enabled: boolean | null
          share_expires_at: string | null
          share_token: string | null
          source_type: string | null
          status: Database["public"]["Enums"]["interview_status"]
          thumbnail_url: string | null
          title: string | null
          transcript: string | null
          transcript_formatted: Json | null
          transcript_url: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id: string
          context_confidence?: number | null
          context_reasoning?: string | null
          conversation_analysis?: Json | null
          created_at?: string
          created_by?: string | null
          duration_sec?: number | null
          file_extension?: string | null
          high_impact_themes?: string[] | null
          id?: string
          interaction_context?:
            | Database["public"]["Enums"]["interaction_context"]
            | null
          interview_date?: string | null
          interview_type?: string | null
          interviewer_id?: string | null
          key_takeaways?: string | null
          lens_visibility?: string | null
          media_type?: string | null
          media_url?: string | null
          meeting_platform?: string | null
          observations_and_notes?: string | null
          open_questions_and_next_steps?: string | null
          original_filename?: string | null
          participant_pseudonym?: string | null
          person_id?: string | null
          processing_metadata?: Json | null
          project_id: string
          recall_recording_id?: string | null
          relevant_answers?: string[] | null
          research_link_id?: string | null
          segment?: string | null
          share_created_at?: string | null
          share_enabled?: boolean | null
          share_expires_at?: string | null
          share_token?: string | null
          source_type?: string | null
          status?: Database["public"]["Enums"]["interview_status"]
          thumbnail_url?: string | null
          title?: string | null
          transcript?: string | null
          transcript_formatted?: Json | null
          transcript_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string
          context_confidence?: number | null
          context_reasoning?: string | null
          conversation_analysis?: Json | null
          created_at?: string
          created_by?: string | null
          duration_sec?: number | null
          file_extension?: string | null
          high_impact_themes?: string[] | null
          id?: string
          interaction_context?:
            | Database["public"]["Enums"]["interaction_context"]
            | null
          interview_date?: string | null
          interview_type?: string | null
          interviewer_id?: string | null
          key_takeaways?: string | null
          lens_visibility?: string | null
          media_type?: string | null
          media_url?: string | null
          meeting_platform?: string | null
          observations_and_notes?: string | null
          open_questions_and_next_steps?: string | null
          original_filename?: string | null
          participant_pseudonym?: string | null
          person_id?: string | null
          processing_metadata?: Json | null
          project_id?: string
          recall_recording_id?: string | null
          relevant_answers?: string[] | null
          research_link_id?: string | null
          segment?: string | null
          share_created_at?: string | null
          share_enabled?: boolean | null
          share_expires_at?: string | null
          share_token?: string | null
          source_type?: string | null
          status?: Database["public"]["Enums"]["interview_status"]
          thumbnail_url?: string | null
          title?: string | null
          transcript?: string | null
          transcript_formatted?: Json | null
          transcript_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interviews_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_research_link_id_fkey"
            columns: ["research_link_id"]
            isOneToOne: false
            referencedRelation: "research_links"
            referencedColumns: ["id"]
          },
        ]
      }
      mastra_agents: {
        Row: {
          agents: Json | null
          createdAt: string
          createdAtZ: string | null
          defaultOptions: Json | null
          description: string | null
          id: string
          inputProcessors: Json | null
          instructions: string
          memory: Json | null
          metadata: Json | null
          model: Json
          name: string
          outputProcessors: Json | null
          scorers: Json | null
          tools: Json | null
          updatedAt: string
          updatedAtZ: string | null
          workflows: Json | null
        }
        Insert: {
          agents?: Json | null
          createdAt: string
          createdAtZ?: string | null
          defaultOptions?: Json | null
          description?: string | null
          id: string
          inputProcessors?: Json | null
          instructions: string
          memory?: Json | null
          metadata?: Json | null
          model: Json
          name: string
          outputProcessors?: Json | null
          scorers?: Json | null
          tools?: Json | null
          updatedAt: string
          updatedAtZ?: string | null
          workflows?: Json | null
        }
        Update: {
          agents?: Json | null
          createdAt?: string
          createdAtZ?: string | null
          defaultOptions?: Json | null
          description?: string | null
          id?: string
          inputProcessors?: Json | null
          instructions?: string
          memory?: Json | null
          metadata?: Json | null
          model?: Json
          name?: string
          outputProcessors?: Json | null
          scorers?: Json | null
          tools?: Json | null
          updatedAt?: string
          updatedAtZ?: string | null
          workflows?: Json | null
        }
        Relationships: []
      }
      mastra_ai_spans: {
        Row: {
          attributes: Json | null
          createdAt: string
          createdAtZ: string | null
          endedAt: string | null
          endedAtZ: string | null
          entityId: string | null
          entityName: string | null
          entityType: string | null
          environment: string | null
          error: Json | null
          input: Json | null
          isEvent: boolean
          links: Json | null
          metadata: Json | null
          name: string
          organizationId: string | null
          output: Json | null
          parentSpanId: string | null
          requestId: string | null
          resourceId: string | null
          runId: string | null
          scope: Json | null
          serviceName: string | null
          sessionId: string | null
          source: string | null
          spanId: string
          spanType: string
          startedAt: string
          startedAtZ: string | null
          tags: Json | null
          threadId: string | null
          traceId: string
          updatedAt: string | null
          updatedAtZ: string | null
          userId: string | null
        }
        Insert: {
          attributes?: Json | null
          createdAt: string
          createdAtZ?: string | null
          endedAt?: string | null
          endedAtZ?: string | null
          entityId?: string | null
          entityName?: string | null
          entityType?: string | null
          environment?: string | null
          error?: Json | null
          input?: Json | null
          isEvent: boolean
          links?: Json | null
          metadata?: Json | null
          name: string
          organizationId?: string | null
          output?: Json | null
          parentSpanId?: string | null
          requestId?: string | null
          resourceId?: string | null
          runId?: string | null
          scope?: Json | null
          serviceName?: string | null
          sessionId?: string | null
          source?: string | null
          spanId: string
          spanType: string
          startedAt: string
          startedAtZ?: string | null
          tags?: Json | null
          threadId?: string | null
          traceId: string
          updatedAt?: string | null
          updatedAtZ?: string | null
          userId?: string | null
        }
        Update: {
          attributes?: Json | null
          createdAt?: string
          createdAtZ?: string | null
          endedAt?: string | null
          endedAtZ?: string | null
          entityId?: string | null
          entityName?: string | null
          entityType?: string | null
          environment?: string | null
          error?: Json | null
          input?: Json | null
          isEvent?: boolean
          links?: Json | null
          metadata?: Json | null
          name?: string
          organizationId?: string | null
          output?: Json | null
          parentSpanId?: string | null
          requestId?: string | null
          resourceId?: string | null
          runId?: string | null
          scope?: Json | null
          serviceName?: string | null
          sessionId?: string | null
          source?: string | null
          spanId?: string
          spanType?: string
          startedAt?: string
          startedAtZ?: string | null
          tags?: Json | null
          threadId?: string | null
          traceId?: string
          updatedAt?: string | null
          updatedAtZ?: string | null
          userId?: string | null
        }
        Relationships: []
      }
      mastra_evals: {
        Row: {
          agent_name: string
          created_at: string
          created_atZ: string | null
          createdAt: string | null
          createdAtZ: string | null
          global_run_id: string
          input: string
          instructions: string
          metric_name: string
          output: string
          result: Json
          run_id: string
          test_info: Json | null
        }
        Insert: {
          agent_name: string
          created_at: string
          created_atZ?: string | null
          createdAt?: string | null
          createdAtZ?: string | null
          global_run_id: string
          input: string
          instructions: string
          metric_name: string
          output: string
          result: Json
          run_id: string
          test_info?: Json | null
        }
        Update: {
          agent_name?: string
          created_at?: string
          created_atZ?: string | null
          createdAt?: string | null
          createdAtZ?: string | null
          global_run_id?: string
          input?: string
          instructions?: string
          metric_name?: string
          output?: string
          result?: Json
          run_id?: string
          test_info?: Json | null
        }
        Relationships: []
      }
      mastra_messages: {
        Row: {
          content: string
          createdAt: string
          createdAtZ: string | null
          id: string
          resourceId: string | null
          role: string
          thread_id: string
          type: string
        }
        Insert: {
          content: string
          createdAt: string
          createdAtZ?: string | null
          id: string
          resourceId?: string | null
          role: string
          thread_id: string
          type: string
        }
        Update: {
          content?: string
          createdAt?: string
          createdAtZ?: string | null
          id?: string
          resourceId?: string | null
          role?: string
          thread_id?: string
          type?: string
        }
        Relationships: []
      }
      mastra_resources: {
        Row: {
          createdAt: string
          createdAtZ: string | null
          id: string
          metadata: Json | null
          updatedAt: string
          updatedAtZ: string | null
          workingMemory: string | null
        }
        Insert: {
          createdAt: string
          createdAtZ?: string | null
          id: string
          metadata?: Json | null
          updatedAt: string
          updatedAtZ?: string | null
          workingMemory?: string | null
        }
        Update: {
          createdAt?: string
          createdAtZ?: string | null
          id?: string
          metadata?: Json | null
          updatedAt?: string
          updatedAtZ?: string | null
          workingMemory?: string | null
        }
        Relationships: []
      }
      mastra_scorers: {
        Row: {
          additionalContext: Json | null
          analyzePrompt: string | null
          analyzeStepResult: Json | null
          createdAt: string
          createdAtZ: string | null
          entity: Json | null
          entityId: string | null
          entityType: string | null
          extractPrompt: string | null
          extractStepResult: Json | null
          generateReasonPrompt: string | null
          generateScorePrompt: string | null
          id: string
          input: Json
          metadata: Json | null
          output: Json
          preprocessPrompt: string | null
          preprocessStepResult: Json | null
          reason: string | null
          reasonPrompt: string | null
          requestContext: Json | null
          resourceId: string | null
          runId: string
          runtimeContext: Json | null
          score: number
          scorer: Json
          scorerId: string
          source: string
          spanId: string | null
          threadId: string | null
          traceId: string | null
          updatedAt: string
          updatedAtZ: string | null
        }
        Insert: {
          additionalContext?: Json | null
          analyzePrompt?: string | null
          analyzeStepResult?: Json | null
          createdAt: string
          createdAtZ?: string | null
          entity?: Json | null
          entityId?: string | null
          entityType?: string | null
          extractPrompt?: string | null
          extractStepResult?: Json | null
          generateReasonPrompt?: string | null
          generateScorePrompt?: string | null
          id: string
          input: Json
          metadata?: Json | null
          output: Json
          preprocessPrompt?: string | null
          preprocessStepResult?: Json | null
          reason?: string | null
          reasonPrompt?: string | null
          requestContext?: Json | null
          resourceId?: string | null
          runId: string
          runtimeContext?: Json | null
          score: number
          scorer: Json
          scorerId: string
          source: string
          spanId?: string | null
          threadId?: string | null
          traceId?: string | null
          updatedAt: string
          updatedAtZ?: string | null
        }
        Update: {
          additionalContext?: Json | null
          analyzePrompt?: string | null
          analyzeStepResult?: Json | null
          createdAt?: string
          createdAtZ?: string | null
          entity?: Json | null
          entityId?: string | null
          entityType?: string | null
          extractPrompt?: string | null
          extractStepResult?: Json | null
          generateReasonPrompt?: string | null
          generateScorePrompt?: string | null
          id?: string
          input?: Json
          metadata?: Json | null
          output?: Json
          preprocessPrompt?: string | null
          preprocessStepResult?: Json | null
          reason?: string | null
          reasonPrompt?: string | null
          requestContext?: Json | null
          resourceId?: string | null
          runId?: string
          runtimeContext?: Json | null
          score?: number
          scorer?: Json
          scorerId?: string
          source?: string
          spanId?: string | null
          threadId?: string | null
          traceId?: string | null
          updatedAt?: string
          updatedAtZ?: string | null
        }
        Relationships: []
      }
      mastra_threads: {
        Row: {
          createdAt: string
          createdAtZ: string | null
          id: string
          metadata: string | null
          resourceId: string
          title: string
          updatedAt: string
          updatedAtZ: string | null
        }
        Insert: {
          createdAt: string
          createdAtZ?: string | null
          id: string
          metadata?: string | null
          resourceId: string
          title: string
          updatedAt: string
          updatedAtZ?: string | null
        }
        Update: {
          createdAt?: string
          createdAtZ?: string | null
          id?: string
          metadata?: string | null
          resourceId?: string
          title?: string
          updatedAt?: string
          updatedAtZ?: string | null
        }
        Relationships: []
      }
      mastra_traces: {
        Row: {
          attributes: Json | null
          createdAt: string
          createdAtZ: string | null
          endTime: number
          events: Json | null
          id: string
          kind: number
          links: Json | null
          name: string
          other: string | null
          parentSpanId: string | null
          scope: string
          startTime: number
          status: Json | null
          traceId: string
        }
        Insert: {
          attributes?: Json | null
          createdAt: string
          createdAtZ?: string | null
          endTime: number
          events?: Json | null
          id: string
          kind: number
          links?: Json | null
          name: string
          other?: string | null
          parentSpanId?: string | null
          scope: string
          startTime: number
          status?: Json | null
          traceId: string
        }
        Update: {
          attributes?: Json | null
          createdAt?: string
          createdAtZ?: string | null
          endTime?: number
          events?: Json | null
          id?: string
          kind?: number
          links?: Json | null
          name?: string
          other?: string | null
          parentSpanId?: string | null
          scope?: string
          startTime?: number
          status?: Json | null
          traceId?: string
        }
        Relationships: []
      }
      mastra_workflow_snapshot: {
        Row: {
          createdAt: string
          createdAtZ: string | null
          resourceId: string | null
          run_id: string
          snapshot: string
          updatedAt: string
          updatedAtZ: string | null
          workflow_name: string
        }
        Insert: {
          createdAt: string
          createdAtZ?: string | null
          resourceId?: string | null
          run_id: string
          snapshot: string
          updatedAt: string
          updatedAtZ?: string | null
          workflow_name: string
        }
        Update: {
          createdAt?: string
          createdAtZ?: string | null
          resourceId?: string | null
          run_id?: string
          snapshot?: string
          updatedAt?: string
          updatedAtZ?: string | null
          workflow_name?: string
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          account_id: string
          amount: number | null
          close_date: string | null
          confidence: number | null
          created_at: string
          crm_external_id: string | null
          currency: string | null
          description: string | null
          forecast_category: string | null
          id: string
          kanban_status: string | null
          metadata: Json
          next_step: string | null
          next_step_due: string | null
          organization_id: string | null
          owner_id: string | null
          primary_contact_id: string | null
          project_id: string
          related_insight_ids: string[] | null
          source: string | null
          stage: string | null
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          amount?: number | null
          close_date?: string | null
          confidence?: number | null
          created_at?: string
          crm_external_id?: string | null
          currency?: string | null
          description?: string | null
          forecast_category?: string | null
          id?: string
          kanban_status?: string | null
          metadata?: Json
          next_step?: string | null
          next_step_due?: string | null
          organization_id?: string | null
          owner_id?: string | null
          primary_contact_id?: string | null
          project_id: string
          related_insight_ids?: string[] | null
          source?: string | null
          stage?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number | null
          close_date?: string | null
          confidence?: number | null
          created_at?: string
          crm_external_id?: string | null
          currency?: string | null
          description?: string | null
          forecast_category?: string | null
          id?: string
          kanban_status?: string | null
          metadata?: Json
          next_step?: string | null
          next_step_due?: string | null
          organization_id?: string | null
          owner_id?: string | null
          primary_contact_id?: string | null
          project_id?: string
          related_insight_ids?: string[] | null
          source?: string | null
          stage?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_insights: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          insight_id: string
          opportunity_id: string
          project_id: string | null
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          insight_id: string
          opportunity_id: string
          project_id?: string | null
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          insight_id?: string
          opportunity_id?: string
          project_id?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_insights_insight_id_fkey"
            columns: ["insight_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_insights_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_insights_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          account_id: string | null
          annual_revenue: number | null
          billing_address: Json | null
          company_type: string | null
          created_at: string
          crm_external_id: string | null
          description: string | null
          domain: string | null
          email: string | null
          employee_count: number | null
          funding_stage: string | null
          headquarters_location: string | null
          id: string
          industry: string | null
          legal_name: string | null
          lifecycle_stage: string | null
          linkedin_url: string | null
          market_cap: number | null
          name: string
          notes: string | null
          parent_organization_id: string | null
          phone: string | null
          primary_contact_id: string | null
          project_id: string | null
          shipping_address: Json | null
          size_range: string | null
          sub_industry: string | null
          tags: string[] | null
          timezone: string | null
          total_funding: number | null
          twitter_url: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          account_id?: string | null
          annual_revenue?: number | null
          billing_address?: Json | null
          company_type?: string | null
          created_at?: string
          crm_external_id?: string | null
          description?: string | null
          domain?: string | null
          email?: string | null
          employee_count?: number | null
          funding_stage?: string | null
          headquarters_location?: string | null
          id?: string
          industry?: string | null
          legal_name?: string | null
          lifecycle_stage?: string | null
          linkedin_url?: string | null
          market_cap?: number | null
          name: string
          notes?: string | null
          parent_organization_id?: string | null
          phone?: string | null
          primary_contact_id?: string | null
          project_id?: string | null
          shipping_address?: Json | null
          size_range?: string | null
          sub_industry?: string | null
          tags?: string[] | null
          timezone?: string | null
          total_funding?: number | null
          twitter_url?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          account_id?: string | null
          annual_revenue?: number | null
          billing_address?: Json | null
          company_type?: string | null
          created_at?: string
          crm_external_id?: string | null
          description?: string | null
          domain?: string | null
          email?: string | null
          employee_count?: number | null
          funding_stage?: string | null
          headquarters_location?: string | null
          id?: string
          industry?: string | null
          legal_name?: string | null
          lifecycle_stage?: string | null
          linkedin_url?: string | null
          market_cap?: number | null
          name?: string
          notes?: string | null
          parent_organization_id?: string | null
          phone?: string | null
          primary_contact_id?: string | null
          project_id?: string | null
          shipping_address?: Json | null
          size_range?: string | null
          sub_industry?: string | null
          tags?: string[] | null
          timezone?: string | null
          total_funding?: number | null
          twitter_url?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_parent_organization_id_fkey"
            columns: ["parent_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      pain_matrix_cache: {
        Row: {
          account_id: string
          computation_time_ms: number | null
          created_at: string
          evidence_count: number
          id: string
          insights: string | null
          matrix_data: Json
          pain_count: number
          project_id: string
          updated_at: string
          user_group_count: number
        }
        Insert: {
          account_id: string
          computation_time_ms?: number | null
          created_at?: string
          evidence_count: number
          id?: string
          insights?: string | null
          matrix_data: Json
          pain_count: number
          project_id: string
          updated_at?: string
          user_group_count: number
        }
        Update: {
          account_id?: string
          computation_time_ms?: number | null
          created_at?: string
          evidence_count?: number
          id?: string
          insights?: string | null
          matrix_data?: Json
          pain_count?: number
          project_id?: string
          updated_at?: string
          user_group_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "pain_matrix_cache_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          account_id: string | null
          age: number | null
          age_range: string | null
          company: string
          contact_info: Json | null
          created_at: string
          default_organization_id: string | null
          description: string | null
          education: string | null
          firstname: string | null
          gender: string | null
          id: string
          image_url: string | null
          income: number | null
          industry: string | null
          job_function: string | null
          languages: string[] | null
          lastname: string | null
          life_stage: string | null
          lifecycle_stage: string | null
          linkedin_url: string | null
          location: string | null
          name: string | null
          name_hash: string | null
          occupation: string | null
          person_type: string | null
          preferences: string | null
          primary_email: string | null
          primary_phone: string | null
          project_id: string | null
          pronouns: string | null
          role: string | null
          segment: string | null
          seniority_level: string | null
          timezone: string | null
          title: string | null
          updated_at: string
          user_id: string | null
          website_url: string | null
        }
        Insert: {
          account_id?: string | null
          age?: number | null
          age_range?: string | null
          company?: string
          contact_info?: Json | null
          created_at?: string
          default_organization_id?: string | null
          description?: string | null
          education?: string | null
          firstname?: string | null
          gender?: string | null
          id?: string
          image_url?: string | null
          income?: number | null
          industry?: string | null
          job_function?: string | null
          languages?: string[] | null
          lastname?: string | null
          life_stage?: string | null
          lifecycle_stage?: string | null
          linkedin_url?: string | null
          location?: string | null
          name?: string | null
          name_hash?: string | null
          occupation?: string | null
          person_type?: string | null
          preferences?: string | null
          primary_email?: string | null
          primary_phone?: string | null
          project_id?: string | null
          pronouns?: string | null
          role?: string | null
          segment?: string | null
          seniority_level?: string | null
          timezone?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
          website_url?: string | null
        }
        Update: {
          account_id?: string | null
          age?: number | null
          age_range?: string | null
          company?: string
          contact_info?: Json | null
          created_at?: string
          default_organization_id?: string | null
          description?: string | null
          education?: string | null
          firstname?: string | null
          gender?: string | null
          id?: string
          image_url?: string | null
          income?: number | null
          industry?: string | null
          job_function?: string | null
          languages?: string[] | null
          lastname?: string | null
          life_stage?: string | null
          lifecycle_stage?: string | null
          linkedin_url?: string | null
          location?: string | null
          name?: string | null
          name_hash?: string | null
          occupation?: string | null
          person_type?: string | null
          preferences?: string | null
          primary_email?: string | null
          primary_phone?: string | null
          project_id?: string | null
          pronouns?: string | null
          role?: string | null
          segment?: string | null
          seniority_level?: string | null
          timezone?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_default_organization_id_fkey"
            columns: ["default_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      people_organizations: {
        Row: {
          account_id: string | null
          created_at: string
          id: string
          is_primary: boolean | null
          job_title: string | null
          notes: string | null
          organization_id: string
          person_id: string
          project_id: string | null
          relationship_status: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean | null
          job_title?: string | null
          notes?: string | null
          organization_id: string
          person_id: string
          project_id?: string | null
          relationship_status?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean | null
          job_title?: string | null
          notes?: string | null
          organization_id?: string
          person_id?: string
          project_id?: string | null
          relationship_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_organizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_organizations_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_organizations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      people_personas: {
        Row: {
          assigned_at: string | null
          confidence_score: number | null
          created_at: string | null
          created_by: string | null
          interview_id: string | null
          person_id: string
          persona_id: string
          project_id: string | null
          source: string | null
        }
        Insert: {
          assigned_at?: string | null
          confidence_score?: number | null
          created_at?: string | null
          created_by?: string | null
          interview_id?: string | null
          person_id: string
          persona_id: string
          project_id?: string | null
          source?: string | null
        }
        Update: {
          assigned_at?: string | null
          confidence_score?: number | null
          created_at?: string | null
          created_by?: string | null
          interview_id?: string | null
          person_id?: string
          persona_id?: string
          project_id?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_personas_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_personas_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_personas_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_personas_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "persona_distribution"
            referencedColumns: ["persona_id"]
          },
          {
            foreignKeyName: "people_personas_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_personas_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      person_facet: {
        Row: {
          account_id: string
          confidence: number | null
          created_at: string
          embedding: string | null
          embedding_generated_at: string | null
          embedding_model: string | null
          evidence_id: string | null
          facet_account_id: number
          noted_at: string | null
          person_id: string
          project_id: string
          source: string
          updated_at: string
        }
        Insert: {
          account_id: string
          confidence?: number | null
          created_at?: string
          embedding?: string | null
          embedding_generated_at?: string | null
          embedding_model?: string | null
          evidence_id?: string | null
          facet_account_id: number
          noted_at?: string | null
          person_id: string
          project_id: string
          source: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          confidence?: number | null
          created_at?: string
          embedding?: string | null
          embedding_generated_at?: string | null
          embedding_model?: string | null
          evidence_id?: string | null
          facet_account_id?: number
          noted_at?: string | null
          person_id?: string
          project_id?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_facet_facet_account_id_fkey"
            columns: ["facet_account_id"]
            isOneToOne: false
            referencedRelation: "facet_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_facet_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_facet_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      person_facet_summaries: {
        Row: {
          account_id: string
          created_at: string
          generated_at: string
          id: string
          input_hash: string | null
          kind_slug: string
          model_version: string | null
          person_id: string
          project_id: string
          summary: string
          supporting_evidence: Json | null
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          generated_at?: string
          id?: string
          input_hash?: string | null
          kind_slug: string
          model_version?: string | null
          person_id: string
          project_id: string
          summary: string
          supporting_evidence?: Json | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          generated_at?: string
          id?: string
          input_hash?: string | null
          kind_slug?: string
          model_version?: string | null
          person_id?: string
          project_id?: string
          summary?: string
          supporting_evidence?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_facet_summaries_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_facet_summaries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      person_scale: {
        Row: {
          account_id: string
          band: string | null
          confidence: number | null
          created_at: string
          evidence_id: string | null
          kind_slug: string
          noted_at: string | null
          person_id: string
          project_id: string
          score: number
          source: string
          updated_at: string
        }
        Insert: {
          account_id: string
          band?: string | null
          confidence?: number | null
          created_at?: string
          evidence_id?: string | null
          kind_slug: string
          noted_at?: string | null
          person_id: string
          project_id: string
          score: number
          source: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          band?: string | null
          confidence?: number | null
          created_at?: string
          evidence_id?: string | null
          kind_slug?: string
          noted_at?: string | null
          person_id?: string
          project_id?: string
          score?: number
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_scale_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_scale_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      persona_insights: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          insight_id: string
          persona_id: string
          project_id: string | null
          relevance_score: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          insight_id: string
          persona_id: string
          project_id?: string | null
          relevance_score?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          insight_id?: string
          persona_id?: string
          project_id?: string | null
          relevance_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "persona_insights_insight_id_fkey"
            columns: ["insight_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "persona_insights_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "persona_distribution"
            referencedColumns: ["persona_id"]
          },
          {
            foreignKeyName: "persona_insights_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "persona_insights_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      personas: {
        Row: {
          account_id: string
          age: string | null
          behaviors: string[] | null
          color: string | null
          color_hex: string | null
          created_at: string
          description: string | null
          differentiators: string[] | null
          education: string | null
          frequency_of_purchase: string | null
          frequency_of_use: string | null
          frustrations: string[] | null
          gender: string | null
          goals: string[] | null
          id: string
          image_url: string | null
          income: string | null
          key_tasks: string[] | null
          kind: string | null
          languages: string | null
          learning_style: string | null
          location: string | null
          motivations: string[] | null
          name: string
          occupation: string | null
          pains: string[] | null
          percentage: number | null
          preferences: string | null
          primary_goal: string | null
          project_id: string | null
          quotes: string[] | null
          role: string | null
          roles: string[] | null
          secondary_goals: string[] | null
          segment: string | null
          sources: string[] | null
          spectra1d: Json | null
          spectra2d: Json | null
          tags: string[] | null
          tech_comfort_level: string | null
          tools_used: string[] | null
          updated_at: string
          values: string[] | null
        }
        Insert: {
          account_id: string
          age?: string | null
          behaviors?: string[] | null
          color?: string | null
          color_hex?: string | null
          created_at?: string
          description?: string | null
          differentiators?: string[] | null
          education?: string | null
          frequency_of_purchase?: string | null
          frequency_of_use?: string | null
          frustrations?: string[] | null
          gender?: string | null
          goals?: string[] | null
          id?: string
          image_url?: string | null
          income?: string | null
          key_tasks?: string[] | null
          kind?: string | null
          languages?: string | null
          learning_style?: string | null
          location?: string | null
          motivations?: string[] | null
          name: string
          occupation?: string | null
          pains?: string[] | null
          percentage?: number | null
          preferences?: string | null
          primary_goal?: string | null
          project_id?: string | null
          quotes?: string[] | null
          role?: string | null
          roles?: string[] | null
          secondary_goals?: string[] | null
          segment?: string | null
          sources?: string[] | null
          spectra1d?: Json | null
          spectra2d?: Json | null
          tags?: string[] | null
          tech_comfort_level?: string | null
          tools_used?: string[] | null
          updated_at?: string
          values?: string[] | null
        }
        Update: {
          account_id?: string
          age?: string | null
          behaviors?: string[] | null
          color?: string | null
          color_hex?: string | null
          created_at?: string
          description?: string | null
          differentiators?: string[] | null
          education?: string | null
          frequency_of_purchase?: string | null
          frequency_of_use?: string | null
          frustrations?: string[] | null
          gender?: string | null
          goals?: string[] | null
          id?: string
          image_url?: string | null
          income?: string | null
          key_tasks?: string[] | null
          kind?: string | null
          languages?: string | null
          learning_style?: string | null
          location?: string | null
          motivations?: string[] | null
          name?: string
          occupation?: string | null
          pains?: string[] | null
          percentage?: number | null
          preferences?: string | null
          primary_goal?: string | null
          project_id?: string | null
          quotes?: string[] | null
          role?: string | null
          roles?: string[] | null
          secondary_goals?: string[] | null
          segment?: string | null
          sources?: string[] | null
          spectra1d?: Json | null
          spectra2d?: Json | null
          tags?: string[] | null
          tech_comfort_level?: string | null
          tools_used?: string[] | null
          updated_at?: string
          values?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "personas_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_answer_evidence: {
        Row: {
          answer_id: string
          created_at: string
          end_seconds: number | null
          evidence_id: string | null
          id: string
          interview_id: string | null
          payload: Json | null
          project_id: string
          source: string
          start_seconds: number | null
          text: string | null
          transcript_chunk_id: string | null
          updated_at: string
        }
        Insert: {
          answer_id: string
          created_at?: string
          end_seconds?: number | null
          evidence_id?: string | null
          id?: string
          interview_id?: string | null
          payload?: Json | null
          project_id: string
          source: string
          start_seconds?: number | null
          text?: string | null
          transcript_chunk_id?: string | null
          updated_at?: string
        }
        Update: {
          answer_id?: string
          created_at?: string
          end_seconds?: number | null
          evidence_id?: string | null
          id?: string
          interview_id?: string | null
          payload?: Json | null
          project_id?: string
          source?: string
          start_seconds?: number | null
          text?: string | null
          transcript_chunk_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_answer_evidence_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "project_answer_metrics"
            referencedColumns: ["project_answer_id"]
          },
          {
            foreignKeyName: "project_answer_evidence_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "project_answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_answer_evidence_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_answer_evidence_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_answer_evidence_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_answer_evidence_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_answers: {
        Row: {
          analysis_next_steps: string | null
          analysis_rationale: string | null
          analysis_run_metadata: Json | null
          analysis_summary: string | null
          answer_text: string | null
          answered_at: string | null
          asked_at: string | null
          confidence: number | null
          created_at: string
          decision_question_id: string | null
          detected_question_text: string | null
          estimated_time_minutes: number | null
          followup_of_answer_id: string | null
          id: string
          interview_id: string | null
          interviewer_user_id: string | null
          order_index: number | null
          origin: string | null
          project_id: string
          prompt_id: string | null
          question_category: string | null
          question_id: string | null
          question_text: string
          research_question_id: string | null
          respondent_person_id: string | null
          skipped_at: string | null
          status: string | null
          time_spent_seconds: number | null
          updated_at: string
        }
        Insert: {
          analysis_next_steps?: string | null
          analysis_rationale?: string | null
          analysis_run_metadata?: Json | null
          analysis_summary?: string | null
          answer_text?: string | null
          answered_at?: string | null
          asked_at?: string | null
          confidence?: number | null
          created_at?: string
          decision_question_id?: string | null
          detected_question_text?: string | null
          estimated_time_minutes?: number | null
          followup_of_answer_id?: string | null
          id?: string
          interview_id?: string | null
          interviewer_user_id?: string | null
          order_index?: number | null
          origin?: string | null
          project_id: string
          prompt_id?: string | null
          question_category?: string | null
          question_id?: string | null
          question_text: string
          research_question_id?: string | null
          respondent_person_id?: string | null
          skipped_at?: string | null
          status?: string | null
          time_spent_seconds?: number | null
          updated_at?: string
        }
        Update: {
          analysis_next_steps?: string | null
          analysis_rationale?: string | null
          analysis_run_metadata?: Json | null
          analysis_summary?: string | null
          answer_text?: string | null
          answered_at?: string | null
          asked_at?: string | null
          confidence?: number | null
          created_at?: string
          decision_question_id?: string | null
          detected_question_text?: string | null
          estimated_time_minutes?: number | null
          followup_of_answer_id?: string | null
          id?: string
          interview_id?: string | null
          interviewer_user_id?: string | null
          order_index?: number | null
          origin?: string | null
          project_id?: string
          prompt_id?: string | null
          question_category?: string | null
          question_id?: string | null
          question_text?: string
          research_question_id?: string | null
          respondent_person_id?: string | null
          skipped_at?: string | null
          status?: string | null
          time_spent_seconds?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_answers_decision_question_id_fkey"
            columns: ["decision_question_id"]
            isOneToOne: false
            referencedRelation: "decision_question_summary"
            referencedColumns: ["decision_question_id"]
          },
          {
            foreignKeyName: "project_answers_decision_question_id_fkey"
            columns: ["decision_question_id"]
            isOneToOne: false
            referencedRelation: "decision_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_answers_followup_of_answer_id_fkey"
            columns: ["followup_of_answer_id"]
            isOneToOne: false
            referencedRelation: "project_answer_metrics"
            referencedColumns: ["project_answer_id"]
          },
          {
            foreignKeyName: "project_answers_followup_of_answer_id_fkey"
            columns: ["followup_of_answer_id"]
            isOneToOne: false
            referencedRelation: "project_answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_answers_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_answers_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_answers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_answers_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "interview_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_answers_research_question_id_fkey"
            columns: ["research_question_id"]
            isOneToOne: false
            referencedRelation: "research_question_summary"
            referencedColumns: ["research_question_id"]
          },
          {
            foreignKeyName: "project_answers_research_question_id_fkey"
            columns: ["research_question_id"]
            isOneToOne: false
            referencedRelation: "research_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_answers_respondent_person_id_fkey"
            columns: ["respondent_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      project_assets: {
        Row: {
          account_id: string
          asset_type: Database["public"]["Enums"]["asset_type"]
          column_count: number | null
          content_md: string | null
          content_raw: string | null
          content_tsv: unknown
          created_at: string
          created_by: string | null
          description: string | null
          duration_sec: number | null
          embedding: string | null
          embedding_generated_at: string | null
          embedding_model: string | null
          file_extension: string | null
          file_size_bytes: number | null
          id: string
          media_key: string | null
          mime_type: string | null
          original_filename: string | null
          processing_metadata: Json | null
          project_id: string
          row_count: number | null
          source_metadata: Json | null
          source_type: string | null
          source_url: string | null
          status: string | null
          table_data: Json | null
          tags: string[] | null
          thumbnail_key: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id: string
          asset_type: Database["public"]["Enums"]["asset_type"]
          column_count?: number | null
          content_md?: string | null
          content_raw?: string | null
          content_tsv?: unknown
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_sec?: number | null
          embedding?: string | null
          embedding_generated_at?: string | null
          embedding_model?: string | null
          file_extension?: string | null
          file_size_bytes?: number | null
          id?: string
          media_key?: string | null
          mime_type?: string | null
          original_filename?: string | null
          processing_metadata?: Json | null
          project_id: string
          row_count?: number | null
          source_metadata?: Json | null
          source_type?: string | null
          source_url?: string | null
          status?: string | null
          table_data?: Json | null
          tags?: string[] | null
          thumbnail_key?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string
          asset_type?: Database["public"]["Enums"]["asset_type"]
          column_count?: number | null
          content_md?: string | null
          content_raw?: string | null
          content_tsv?: unknown
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_sec?: number | null
          embedding?: string | null
          embedding_generated_at?: string | null
          embedding_model?: string | null
          file_extension?: string | null
          file_size_bytes?: number | null
          id?: string
          media_key?: string | null
          mime_type?: string | null
          original_filename?: string | null
          processing_metadata?: Json | null
          project_id?: string
          row_count?: number | null
          source_metadata?: Json | null
          source_type?: string | null
          source_url?: string | null
          status?: string | null
          table_data?: Json | null
          tags?: string[] | null
          thumbnail_key?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_people: {
        Row: {
          created_at: string | null
          created_by: string | null
          first_seen_at: string | null
          id: string
          interview_count: number | null
          last_seen_at: string | null
          person_id: string
          project_id: string
          relationship_type: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          first_seen_at?: string | null
          id?: string
          interview_count?: number | null
          last_seen_at?: string | null
          person_id: string
          project_id: string
          relationship_type?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          first_seen_at?: string | null
          id?: string
          interview_count?: number | null
          last_seen_at?: string | null
          person_id?: string
          project_id?: string
          relationship_type?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_people_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_people_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_question_analysis: {
        Row: {
          confidence: number | null
          created_at: string
          goal_achievement_summary: string | null
          id: string
          next_steps: string | null
          project_id: string
          question_id: string
          question_type: Database["public"]["Enums"]["research_analysis_question_kind"]
          run_id: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          goal_achievement_summary?: string | null
          id?: string
          next_steps?: string | null
          project_id: string
          question_id: string
          question_type: Database["public"]["Enums"]["research_analysis_question_kind"]
          run_id: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          goal_achievement_summary?: string | null
          id?: string
          next_steps?: string | null
          project_id?: string
          question_id?: string
          question_type?: Database["public"]["Enums"]["research_analysis_question_kind"]
          run_id?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_question_analysis_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_question_analysis_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "project_research_analysis_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      project_research_analysis_runs: {
        Row: {
          created_at: string
          custom_instructions: string | null
          id: string
          min_confidence: number | null
          project_id: string
          recommended_actions: Json | null
          run_summary: string | null
          triggered_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_instructions?: string | null
          id?: string
          min_confidence?: number | null
          project_id: string
          recommended_actions?: Json | null
          run_summary?: string | null
          triggered_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_instructions?: string | null
          id?: string
          min_confidence?: number | null
          project_id?: string
          recommended_actions?: Json | null
          run_summary?: string | null
          triggered_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_research_analysis_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_research_plans: {
        Row: {
          created_at: string
          created_by: string | null
          goal: string
          id: string
          meta: Json | null
          project_id: string
          status: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          goal: string
          id?: string
          meta?: Json | null
          project_id: string
          status?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          goal?: string
          id?: string
          meta?: Json | null
          project_id?: string
          status?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_research_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_section_kinds: {
        Row: {
          id: string
        }
        Insert: {
          id: string
        }
        Update: {
          id?: string
        }
        Relationships: []
      }
      project_sections: {
        Row: {
          content_md: string | null
          content_tsv: unknown
          created_at: string
          created_by: string | null
          id: string
          kind: string
          meta: Json | null
          position: number | null
          project_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content_md?: string | null
          content_tsv?: unknown
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          meta?: Json | null
          position?: number | null
          project_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content_md?: string | null
          content_tsv?: unknown
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          meta?: Json | null
          position?: number | null
          project_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_sections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          account_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          project_settings: Json
          slug: string | null
          status: string | null
          target_segments: Json | null
          updated_at: string
          workflow_type: Database["public"]["Enums"]["project_workflow_type"]
        }
        Insert: {
          account_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          project_settings?: Json
          slug?: string | null
          status?: string | null
          target_segments?: Json | null
          updated_at?: string
          workflow_type?: Database["public"]["Enums"]["project_workflow_type"]
        }
        Update: {
          account_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          project_settings?: Json
          slug?: string | null
          status?: string | null
          target_segments?: Json | null
          updated_at?: string
          workflow_type?: Database["public"]["Enums"]["project_workflow_type"]
        }
        Relationships: []
      }
      research_link_responses: {
        Row: {
          completed: boolean
          created_at: string
          email: string | null
          evidence_id: string | null
          id: string
          person_id: string | null
          phone: string | null
          research_link_id: string
          response_mode: string
          responses: Json
          updated_at: string
          utm_params: Json | null
          video_url: string | null
        }
        Insert: {
          completed?: boolean
          created_at?: string
          email?: string | null
          evidence_id?: string | null
          id?: string
          person_id?: string | null
          phone?: string | null
          research_link_id: string
          response_mode?: string
          responses?: Json
          updated_at?: string
          utm_params?: Json | null
          video_url?: string | null
        }
        Update: {
          completed?: boolean
          created_at?: string
          email?: string | null
          evidence_id?: string | null
          id?: string
          person_id?: string | null
          phone?: string | null
          research_link_id?: string
          response_mode?: string
          responses?: Json
          updated_at?: string
          utm_params?: Json | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_link_responses_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_link_responses_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_link_responses_research_link_id_fkey"
            columns: ["research_link_id"]
            isOneToOne: false
            referencedRelation: "research_links"
            referencedColumns: ["id"]
          },
        ]
      }
      research_links: {
        Row: {
          account_id: string
          ai_analysis: Json | null
          ai_analysis_updated_at: string | null
          ai_autonomy: string
          allow_chat: boolean
          allow_video: boolean
          allow_voice: boolean
          calendar_url: string | null
          created_at: string
          default_response_mode: string
          description: string | null
          hero_cta_helper: string | null
          hero_cta_label: string | null
          hero_subtitle: string | null
          hero_title: string | null
          id: string
          identity_field: string
          identity_mode: string
          instructions: string | null
          is_live: boolean
          name: string
          project_id: string | null
          questions: Json
          redirect_url: string | null
          research_goals: Json | null
          slug: string
          statistics: Json | null
          stats_updated_at: string | null
          updated_at: string
          walkthrough_thumbnail_url: string | null
          walkthrough_video_url: string | null
        }
        Insert: {
          account_id: string
          ai_analysis?: Json | null
          ai_analysis_updated_at?: string | null
          ai_autonomy?: string
          allow_chat?: boolean
          allow_video?: boolean
          allow_voice?: boolean
          calendar_url?: string | null
          created_at?: string
          default_response_mode?: string
          description?: string | null
          hero_cta_helper?: string | null
          hero_cta_label?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          identity_field?: string
          identity_mode?: string
          instructions?: string | null
          is_live?: boolean
          name: string
          project_id?: string | null
          questions?: Json
          redirect_url?: string | null
          research_goals?: Json | null
          slug: string
          statistics?: Json | null
          stats_updated_at?: string | null
          updated_at?: string
          walkthrough_thumbnail_url?: string | null
          walkthrough_video_url?: string | null
        }
        Update: {
          account_id?: string
          ai_analysis?: Json | null
          ai_analysis_updated_at?: string | null
          ai_autonomy?: string
          allow_chat?: boolean
          allow_video?: boolean
          allow_voice?: boolean
          calendar_url?: string | null
          created_at?: string
          default_response_mode?: string
          description?: string | null
          hero_cta_helper?: string | null
          hero_cta_label?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          identity_field?: string
          identity_mode?: string
          instructions?: string | null
          is_live?: boolean
          name?: string
          project_id?: string | null
          questions?: Json
          redirect_url?: string | null
          research_goals?: Json | null
          slug?: string
          statistics?: Json | null
          stats_updated_at?: string | null
          updated_at?: string
          walkthrough_thumbnail_url?: string | null
          walkthrough_video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_plan_data_sources: {
        Row: {
          id: string
          plan_id: string
          project_id: string
          source: string
        }
        Insert: {
          id?: string
          plan_id: string
          project_id: string
          source: string
        }
        Update: {
          id?: string
          plan_id?: string
          project_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_plan_data_sources_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "project_research_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_plan_data_sources_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_question_evidence_types: {
        Row: {
          evidence_type: string
          id: string
          project_id: string
          research_question_id: string
        }
        Insert: {
          evidence_type: string
          id?: string
          project_id: string
          research_question_id: string
        }
        Update: {
          evidence_type?: string
          id?: string
          project_id?: string
          research_question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_question_evidence_types_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_question_evidence_types_research_question_id_fkey"
            columns: ["research_question_id"]
            isOneToOne: false
            referencedRelation: "research_question_summary"
            referencedColumns: ["research_question_id"]
          },
          {
            foreignKeyName: "research_question_evidence_types_research_question_id_fkey"
            columns: ["research_question_id"]
            isOneToOne: false
            referencedRelation: "research_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      research_question_methods: {
        Row: {
          id: string
          method: string
          project_id: string
          research_question_id: string
        }
        Insert: {
          id?: string
          method: string
          project_id: string
          research_question_id: string
        }
        Update: {
          id?: string
          method?: string
          project_id?: string
          research_question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_question_methods_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_question_methods_research_question_id_fkey"
            columns: ["research_question_id"]
            isOneToOne: false
            referencedRelation: "research_question_summary"
            referencedColumns: ["research_question_id"]
          },
          {
            foreignKeyName: "research_question_methods_research_question_id_fkey"
            columns: ["research_question_id"]
            isOneToOne: false
            referencedRelation: "research_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      research_questions: {
        Row: {
          created_at: string
          created_by: string | null
          decision_question_id: string | null
          id: string
          plan_id: string | null
          project_id: string
          rationale: string | null
          text: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          decision_question_id?: string | null
          id?: string
          plan_id?: string | null
          project_id: string
          rationale?: string | null
          text: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          decision_question_id?: string | null
          id?: string
          plan_id?: string | null
          project_id?: string
          rationale?: string | null
          text?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_questions_decision_question_id_fkey"
            columns: ["decision_question_id"]
            isOneToOne: false
            referencedRelation: "decision_question_summary"
            referencedColumns: ["decision_question_id"]
          },
          {
            foreignKeyName: "research_questions_decision_question_id_fkey"
            columns: ["decision_question_id"]
            isOneToOne: false
            referencedRelation: "decision_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_questions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "project_research_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_questions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_lens_hygiene_events: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          message: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string | null
          slot_id: string | null
          summary_id: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          slot_id?: string | null
          summary_id: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          slot_id?: string | null
          summary_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_lens_hygiene_events_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "sales_lens_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_lens_hygiene_events_summary_id_fkey"
            columns: ["summary_id"]
            isOneToOne: false
            referencedRelation: "sales_lens_summaries"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_lens_slots: {
        Row: {
          confidence: number | null
          created_at: string
          date_value: string | null
          description: string | null
          evidence_refs: Json
          hygiene: Json
          id: string
          label: string | null
          numeric_value: number | null
          owner_person_id: string | null
          owner_person_key: string | null
          position: number | null
          related_organization_ids: string[]
          related_person_ids: string[]
          slot: string
          status: string | null
          summary_id: string
          text_value: string | null
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          date_value?: string | null
          description?: string | null
          evidence_refs?: Json
          hygiene?: Json
          id?: string
          label?: string | null
          numeric_value?: number | null
          owner_person_id?: string | null
          owner_person_key?: string | null
          position?: number | null
          related_organization_ids?: string[]
          related_person_ids?: string[]
          slot: string
          status?: string | null
          summary_id: string
          text_value?: string | null
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          date_value?: string | null
          description?: string | null
          evidence_refs?: Json
          hygiene?: Json
          id?: string
          label?: string | null
          numeric_value?: number | null
          owner_person_id?: string | null
          owner_person_key?: string | null
          position?: number | null
          related_organization_ids?: string[]
          related_person_ids?: string[]
          slot?: string
          status?: string | null
          summary_id?: string
          text_value?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_lens_slots_owner_person_id_fkey"
            columns: ["owner_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_lens_slots_summary_id_fkey"
            columns: ["summary_id"]
            isOneToOne: false
            referencedRelation: "sales_lens_summaries"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_lens_stakeholders: {
        Row: {
          account_id: string
          candidate_person_key: string | null
          confidence: number | null
          created_at: string
          display_name: string
          email: string | null
          evidence_refs: Json
          id: string
          influence: string | null
          labels: string[]
          organization_id: string | null
          person_id: string | null
          person_key: string | null
          project_id: string
          role: string | null
          summary_id: string
          updated_at: string
        }
        Insert: {
          account_id: string
          candidate_person_key?: string | null
          confidence?: number | null
          created_at?: string
          display_name: string
          email?: string | null
          evidence_refs?: Json
          id?: string
          influence?: string | null
          labels?: string[]
          organization_id?: string | null
          person_id?: string | null
          person_key?: string | null
          project_id: string
          role?: string | null
          summary_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          candidate_person_key?: string | null
          confidence?: number | null
          created_at?: string
          display_name?: string
          email?: string | null
          evidence_refs?: Json
          id?: string
          influence?: string | null
          labels?: string[]
          organization_id?: string | null
          person_id?: string | null
          person_key?: string | null
          project_id?: string
          role?: string | null
          summary_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_lens_stakeholders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_lens_stakeholders_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_lens_stakeholders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_lens_stakeholders_summary_id_fkey"
            columns: ["summary_id"]
            isOneToOne: false
            referencedRelation: "sales_lens_summaries"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_lens_summaries: {
        Row: {
          account_id: string
          attendee_person_ids: string[]
          attendee_person_keys: string[]
          attendee_unlinked: Json
          computed_at: string
          computed_by: string | null
          created_at: string
          framework: Database["public"]["Enums"]["sales_framework"]
          hygiene_summary: Json
          id: string
          interview_id: string | null
          metadata: Json
          opportunity_id: string | null
          project_id: string
          source_kind: string
          updated_at: string
        }
        Insert: {
          account_id: string
          attendee_person_ids?: string[]
          attendee_person_keys?: string[]
          attendee_unlinked?: Json
          computed_at?: string
          computed_by?: string | null
          created_at?: string
          framework: Database["public"]["Enums"]["sales_framework"]
          hygiene_summary?: Json
          id?: string
          interview_id?: string | null
          metadata?: Json
          opportunity_id?: string | null
          project_id: string
          source_kind?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          attendee_person_ids?: string[]
          attendee_person_keys?: string[]
          attendee_unlinked?: Json
          computed_at?: string
          computed_by?: string | null
          created_at?: string
          framework?: Database["public"]["Enums"]["sales_framework"]
          hygiene_summary?: Json
          id?: string
          interview_id?: string | null
          metadata?: Json
          opportunity_id?: string | null
          project_id?: string
          source_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_lens_summaries_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_lens_summaries_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_lens_summaries_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_lens_summaries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          account_id: string
          created_at: string
          definition: string | null
          embedding: string | null
          id: string
          project_id: string | null
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
          id?: string
          project_id?: string | null
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
          id?: string
          project_id?: string | null
          set_name?: string | null
          tag?: string
          term?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      task_activity: {
        Row: {
          activity_type: string
          content: string | null
          created_at: string
          field_name: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
          source: string | null
          task_id: string
          user_id: string | null
        }
        Insert: {
          activity_type: string
          content?: string | null
          created_at?: string
          field_name?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          source?: string | null
          task_id: string
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          content?: string | null
          created_at?: string
          field_name?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          source?: string | null
          task_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_activity_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_links: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          entity_id: string
          entity_type: string
          id: string
          link_type: string
          task_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          entity_id: string
          entity_type: string
          id?: string
          link_type?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          link_type?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_links_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          account_id: string
          actual_hours: number | null
          assigned_to: Json | null
          benefit: string | null
          blocks_task_ids: string[] | null
          cluster: string
          completed_at: string | null
          created_at: string
          created_by: string
          depends_on_task_ids: string[] | null
          description: string | null
          due_date: string | null
          estimated_effort: string | null
          id: string
          impact: number | null
          parent_task_id: string | null
          priority: number
          project_id: string
          reason: string | null
          segments: string | null
          source_theme_id: string | null
          stage: string | null
          status: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          actual_hours?: number | null
          assigned_to?: Json | null
          benefit?: string | null
          blocks_task_ids?: string[] | null
          cluster: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          depends_on_task_ids?: string[] | null
          description?: string | null
          due_date?: string | null
          estimated_effort?: string | null
          id?: string
          impact?: number | null
          parent_task_id?: string | null
          priority?: number
          project_id: string
          reason?: string | null
          segments?: string | null
          source_theme_id?: string | null
          stage?: string | null
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          actual_hours?: number | null
          assigned_to?: Json | null
          benefit?: string | null
          blocks_task_ids?: string[] | null
          cluster?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          depends_on_task_ids?: string[] | null
          description?: string | null
          due_date?: string | null
          estimated_effort?: string | null
          id?: string
          impact?: number | null
          parent_task_id?: string | null
          priority?: number
          project_id?: string
          reason?: string | null
          segments?: string | null
          source_theme_id?: string | null
          stage?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_source_theme_id_fkey"
            columns: ["source_theme_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
        ]
      }
      theme_evidence: {
        Row: {
          account_id: string
          confidence: number | null
          created_at: string | null
          created_by: string | null
          evidence_id: string
          id: string
          project_id: string | null
          rationale: string | null
          theme_id: string
        }
        Insert: {
          account_id: string
          confidence?: number | null
          created_at?: string | null
          created_by?: string | null
          evidence_id: string
          id?: string
          project_id?: string | null
          rationale?: string | null
          theme_id: string
        }
        Update: {
          account_id?: string
          confidence?: number | null
          created_at?: string | null
          created_by?: string | null
          evidence_id?: string
          id?: string
          project_id?: string | null
          rationale?: string | null
          theme_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "theme_evidence_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "theme_evidence_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "theme_evidence_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
        ]
      }
      themes: {
        Row: {
          account_id: string
          anti_examples: string[] | null
          category: string | null
          confidence: number | null
          contradictions: string | null
          created_at: string
          created_by: string | null
          desired_outcome: string | null
          details: string | null
          embedding: string | null
          embedding_generated_at: string | null
          embedding_model: string | null
          emotional_response: string | null
          evidence: string | null
          exclusion_criteria: string | null
          id: string
          impact: string | null
          inclusion_criteria: string | null
          interview_id: string | null
          journey_stage: string | null
          jtbd: string | null
          motivation: string | null
          name: string
          novelty: string | null
          opportunity_ideas: string[] | null
          pain: string | null
          priority: number | null
          project_id: string | null
          related_tags: string[] | null
          statement: string | null
          synonyms: string[] | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id: string
          anti_examples?: string[] | null
          category?: string | null
          confidence?: number | null
          contradictions?: string | null
          created_at?: string
          created_by?: string | null
          desired_outcome?: string | null
          details?: string | null
          embedding?: string | null
          embedding_generated_at?: string | null
          embedding_model?: string | null
          emotional_response?: string | null
          evidence?: string | null
          exclusion_criteria?: string | null
          id?: string
          impact?: string | null
          inclusion_criteria?: string | null
          interview_id?: string | null
          journey_stage?: string | null
          jtbd?: string | null
          motivation?: string | null
          name: string
          novelty?: string | null
          opportunity_ideas?: string[] | null
          pain?: string | null
          priority?: number | null
          project_id?: string | null
          related_tags?: string[] | null
          statement?: string | null
          synonyms?: string[] | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string
          anti_examples?: string[] | null
          category?: string | null
          confidence?: number | null
          contradictions?: string | null
          created_at?: string
          created_by?: string | null
          desired_outcome?: string | null
          details?: string | null
          embedding?: string | null
          embedding_generated_at?: string | null
          embedding_model?: string | null
          emotional_response?: string | null
          evidence?: string | null
          exclusion_criteria?: string | null
          id?: string
          impact?: string | null
          inclusion_criteria?: string | null
          interview_id?: string | null
          journey_stage?: string | null
          jtbd?: string | null
          motivation?: string | null
          name?: string
          novelty?: string | null
          opportunity_ideas?: string[] | null
          pain?: string | null
          priority?: number | null
          project_id?: string | null
          related_tags?: string[] | null
          statement?: string | null
          synonyms?: string[] | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "themes_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "themes_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "themes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_seq: {
        Row: {
          account_id: string
          next_seq: number
          thread_id: string
        }
        Insert: {
          account_id: string
          next_seq?: number
          thread_id: string
        }
        Update: {
          account_id?: string
          next_seq?: number
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_seq_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: true
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      threads: {
        Row: {
          account_id: string
          created_at: string
          id: string
          resource_id: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          resource_id?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          resource_id?: string | null
        }
        Relationships: []
      }
      ui_events: {
        Row: {
          account_id: string
          actor: string
          artifact_id: string | null
          client_event_id: string
          created_at: string
          event_type: string
          id: string
          path: string
          seq: number
          thread_id: string
          trace_id: string | null
          value: Json | null
        }
        Insert: {
          account_id: string
          actor: string
          artifact_id?: string | null
          client_event_id: string
          created_at?: string
          event_type: string
          id?: string
          path: string
          seq: number
          thread_id: string
          trace_id?: string | null
          value?: Json | null
        }
        Update: {
          account_id?: string
          actor?: string
          artifact_id?: string | null
          client_event_id?: string
          created_at?: string
          event_type?: string
          id?: string
          path?: string
          seq?: number
          thread_id?: string
          trace_id?: string | null
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ui_events_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ui_events_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      ui_state: {
        Row: {
          account_id: string
          seq: number
          state_key: string
          state_value: Json
          thread_id: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          account_id: string
          seq: number
          state_key: string
          state_value: Json
          thread_id: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          account_id?: string
          seq?: number
          state_key?: string
          state_value?: Json
          thread_id?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "ui_state_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          company_description: string | null
          company_name: string | null
          company_website: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          image_url: string | null
          industry: string | null
          is_platform_admin: boolean
          language: string | null
          last_name: string | null
          last_used_account_id: string | null
          last_used_project_id: string | null
          legacy_trial_provisioned_at: string | null
          metadata: Json | null
          mobile_phone: string | null
          notification_preferences: Json
          onboarding_completed: boolean
          onboarding_steps: Json
          referral_source: string | null
          role: string | null
          signup_data: Json | null
          theme: string | null
          title: string | null
          trial_goals: Json | null
          ui_preferences: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          company_description?: string | null
          company_name?: string | null
          company_website?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          image_url?: string | null
          industry?: string | null
          is_platform_admin?: boolean
          language?: string | null
          last_name?: string | null
          last_used_account_id?: string | null
          last_used_project_id?: string | null
          legacy_trial_provisioned_at?: string | null
          metadata?: Json | null
          mobile_phone?: string | null
          notification_preferences?: Json
          onboarding_completed?: boolean
          onboarding_steps?: Json
          referral_source?: string | null
          role?: string | null
          signup_data?: Json | null
          theme?: string | null
          title?: string | null
          trial_goals?: Json | null
          ui_preferences?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          company_description?: string | null
          company_name?: string | null
          company_website?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          image_url?: string | null
          industry?: string | null
          is_platform_admin?: boolean
          language?: string | null
          last_name?: string | null
          last_used_account_id?: string | null
          last_used_project_id?: string | null
          legacy_trial_provisioned_at?: string | null
          metadata?: Json | null
          mobile_phone?: string | null
          notification_preferences?: Json
          onboarding_completed?: boolean
          onboarding_steps?: Json
          referral_source?: string | null
          role?: string | null
          signup_data?: Json | null
          theme?: string | null
          title?: string | null
          trial_goals?: Json | null
          ui_preferences?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      votes: {
        Row: {
          account_id: string
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          project_id: string
          updated_at: string | null
          user_id: string
          vote_value: number
        }
        Insert: {
          account_id: string
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          project_id: string
          updated_at?: string | null
          user_id: string
          vote_value: number
        }
        Update: {
          account_id?: string
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          project_id?: string
          updated_at?: string | null
          user_id?: string
          vote_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "votes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      conversations: {
        Row: {
          account_id: string | null
          context_confidence: number | null
          context_reasoning: string | null
          conversation_analysis: Json | null
          created_at: string | null
          created_by: string | null
          duration_sec: number | null
          file_extension: string | null
          high_impact_themes: string[] | null
          id: string | null
          interaction_context:
            | Database["public"]["Enums"]["interaction_context"]
            | null
          interview_date: string | null
          interview_type: string | null
          interviewer_id: string | null
          key_takeaways: string | null
          lens_visibility: string | null
          media_type: string | null
          media_url: string | null
          observations_and_notes: string | null
          open_questions_and_next_steps: string | null
          original_filename: string | null
          participant_pseudonym: string | null
          person_id: string | null
          processing_metadata: Json | null
          project_id: string | null
          relevant_answers: string[] | null
          segment: string | null
          source_type: string | null
          status: Database["public"]["Enums"]["interview_status"] | null
          thumbnail_url: string | null
          title: string | null
          transcript: string | null
          transcript_formatted: Json | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          account_id?: string | null
          context_confidence?: number | null
          context_reasoning?: string | null
          conversation_analysis?: Json | null
          created_at?: string | null
          created_by?: string | null
          duration_sec?: number | null
          file_extension?: string | null
          high_impact_themes?: string[] | null
          id?: string | null
          interaction_context?:
            | Database["public"]["Enums"]["interaction_context"]
            | null
          interview_date?: string | null
          interview_type?: string | null
          interviewer_id?: string | null
          key_takeaways?: string | null
          lens_visibility?: string | null
          media_type?: string | null
          media_url?: string | null
          observations_and_notes?: string | null
          open_questions_and_next_steps?: string | null
          original_filename?: string | null
          participant_pseudonym?: string | null
          person_id?: string | null
          processing_metadata?: Json | null
          project_id?: string | null
          relevant_answers?: string[] | null
          segment?: string | null
          source_type?: string | null
          status?: Database["public"]["Enums"]["interview_status"] | null
          thumbnail_url?: string | null
          title?: string | null
          transcript?: string | null
          transcript_formatted?: Json | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          account_id?: string | null
          context_confidence?: number | null
          context_reasoning?: string | null
          conversation_analysis?: Json | null
          created_at?: string | null
          created_by?: string | null
          duration_sec?: number | null
          file_extension?: string | null
          high_impact_themes?: string[] | null
          id?: string | null
          interaction_context?:
            | Database["public"]["Enums"]["interaction_context"]
            | null
          interview_date?: string | null
          interview_type?: string | null
          interviewer_id?: string | null
          key_takeaways?: string | null
          lens_visibility?: string | null
          media_type?: string | null
          media_url?: string | null
          observations_and_notes?: string | null
          open_questions_and_next_steps?: string | null
          original_filename?: string | null
          participant_pseudonym?: string | null
          person_id?: string | null
          processing_metadata?: Json | null
          project_id?: string | null
          relevant_answers?: string[] | null
          segment?: string | null
          source_type?: string | null
          status?: Database["public"]["Enums"]["interview_status"] | null
          thumbnail_url?: string | null
          title?: string | null
          transcript?: string | null
          transcript_formatted?: Json | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interviews_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_question_summary: {
        Row: {
          answered_answer_count: number | null
          decision_question_id: string | null
          decision_question_text: string | null
          evidence_count: number | null
          interview_count: number | null
          open_answer_count: number | null
          persona_count: number | null
          project_id: string | null
          research_question_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "decision_questions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      persona_distribution: {
        Row: {
          account_id: string | null
          color_hex: string | null
          combined_percentage: number | null
          created_at: string | null
          description: string | null
          interview_count: number | null
          interview_percentage: number | null
          legacy_interview_count: number | null
          legacy_percentage: number | null
          persona_id: string | null
          persona_name: string | null
          total_interview_count: number | null
          total_interviews: number | null
          total_interviews_with_participants: number | null
          total_legacy_interviews: number | null
          updated_at: string | null
        }
        Relationships: []
      }
      project_answer_metrics: {
        Row: {
          answered_at: string | null
          decision_question_id: string | null
          evidence_count: number | null
          interview_count: number | null
          interview_id: string | null
          persona_count: number | null
          project_answer_id: string | null
          project_id: string | null
          prompt_id: string | null
          research_question_id: string | null
          respondent_person_id: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_answers_decision_question_id_fkey"
            columns: ["decision_question_id"]
            isOneToOne: false
            referencedRelation: "decision_question_summary"
            referencedColumns: ["decision_question_id"]
          },
          {
            foreignKeyName: "project_answers_decision_question_id_fkey"
            columns: ["decision_question_id"]
            isOneToOne: false
            referencedRelation: "decision_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_answers_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_answers_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_answers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_answers_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "interview_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_answers_research_question_id_fkey"
            columns: ["research_question_id"]
            isOneToOne: false
            referencedRelation: "research_question_summary"
            referencedColumns: ["research_question_id"]
          },
          {
            foreignKeyName: "project_answers_research_question_id_fkey"
            columns: ["research_question_id"]
            isOneToOne: false
            referencedRelation: "research_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_answers_respondent_person_id_fkey"
            columns: ["respondent_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      project_sections_latest: {
        Row: {
          content_md: string | null
          content_tsv: unknown
          created_at: string | null
          id: string | null
          kind: string | null
          meta: Json | null
          position: number | null
          project_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_sections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_question_summary: {
        Row: {
          answered_answer_count: number | null
          decision_question_id: string | null
          evidence_count: number | null
          interview_count: number | null
          open_answer_count: number | null
          persona_count: number | null
          project_id: string | null
          research_question_id: string | null
          research_question_text: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_questions_decision_question_id_fkey"
            columns: ["decision_question_id"]
            isOneToOne: false
            referencedRelation: "decision_question_summary"
            referencedColumns: ["decision_question_id"]
          },
          {
            foreignKeyName: "research_questions_decision_question_id_fkey"
            columns: ["decision_question_id"]
            isOneToOne: false
            referencedRelation: "decision_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_questions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invitation: {
        Args: { lookup_invitation_token: string }
        Returns: Json
      }
      auto_generate_themes_from_clusters: {
        Args: {
          account_id_param: string
          max_clusters?: number
          merge_threshold?: number
          project_id_param: string
          similarity_threshold?: number
        }
        Returns: {
          action: string
          cluster_rank: number
          facet_count: number
          message: string
          theme_id: string
          theme_name: string
        }[]
      }
      auto_link_persona_insights: {
        Args: { p_insight_id: string }
        Returns: undefined
      }
      cleanup_expired_invitations: { Args: never; Returns: number }
      create_account: { Args: { name?: string; slug?: string }; Returns: Json }
      create_account_id: {
        Args: { name?: string; primary_owner_user_id?: string; slug?: string }
        Returns: string
      }
      create_invitation: {
        Args: {
          account_id: string
          account_role: Database["accounts"]["Enums"]["account_role"]
          invitation_type: Database["accounts"]["Enums"]["invitation_type"]
          invitee_email?: string
        }
        Returns: Json
      }
      current_user_account_role: {
        Args: { p_account_id: string }
        Returns: Json
      }
      delete_invitation: { Args: { invitation_id: string }; Returns: undefined }
      delete_themes_for_interview: {
        Args: { p_interview_id: string }
        Returns: undefined
      }
      find_duplicate_themes: {
        Args: { project_id_param: string; similarity_threshold?: number }
        Returns: {
          similarity: number
          theme_id_1: string
          theme_id_2: string
          theme_name_1: string
          theme_name_2: string
        }[]
      }
      find_evidence_facet_clusters: {
        Args: {
          kind_slug_filter?: string
          limit_results?: number
          project_id_param: string
          similarity_threshold?: number
        }
        Returns: {
          combined_evidence_count: number
          evidence_facet_id_1: string
          evidence_facet_id_2: string
          kind_slug_1: string
          kind_slug_2: string
          label_1: string
          label_2: string
          similarity: number
        }[]
      }
      find_person_facet_clusters: {
        Args: {
          kind_slug_param: string
          project_id_param: string
          similarity_threshold?: number
        }
        Returns: {
          combined_person_count: number
          facet_account_id_1: number
          facet_account_id_2: number
          label_1: string
          label_2: string
          person_facet_id_1: string
          person_facet_id_2: string
          similarity: number
        }[]
      }
      find_similar_assets: {
        Args: {
          match_count?: number
          match_threshold?: number
          project_id_param: string
          query_embedding: string
        }
        Returns: {
          asset_type: Database["public"]["Enums"]["asset_type"]
          column_count: number
          content_md: string
          description: string
          id: string
          row_count: number
          similarity: number
          table_data: Json
          title: string
        }[]
      }
      find_similar_evidence: {
        Args: {
          match_count?: number
          match_threshold?: number
          project_id_param: string
          query_embedding: string
        }
        Returns: {
          id: string
          similarity: number
          verbatim: string
        }[]
      }
      find_similar_evidence_by_interview: {
        Args: {
          interview_id_param: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          anchors: Json
          chunk: string
          feels: string[]
          gains: string[]
          gist: string
          id: string
          pains: string[]
          similarity: number
          thinks: string[]
          verbatim: string
        }[]
      }
      find_similar_evidence_facets: {
        Args: {
          kind_slug_filter?: string
          match_count?: number
          match_threshold?: number
          project_id_param: string
          query_embedding: string
        }
        Returns: {
          confidence: number
          evidence_id: string
          id: string
          kind_slug: string
          label: string
          quote: string
          similarity: number
        }[]
      }
      find_similar_person_facets: {
        Args: {
          kind_slug_filter?: string
          match_count?: number
          match_threshold?: number
          project_id_param: string
          query_embedding: string
        }
        Returns: {
          confidence: number
          facet_account_id: number
          kind_slug: string
          label: string
          person_id: string
          similarity: number
        }[]
      }
      find_similar_themes: {
        Args: {
          match_count?: number
          match_threshold?: number
          project_id_param: string
          query_embedding: string
        }
        Returns: {
          id: string
          name: string
          similarity: number
          statement: string
        }[]
      }
      find_themes_by_person_facet: {
        Args: {
          facet_label_query: string
          match_count?: number
          match_threshold?: number
          project_id_param: string
        }
        Returns: {
          person_count: number
          similarity: number
          theme_id: string
          theme_name: string
          theme_pain: string
        }[]
      }
      generate_theme_from_cluster: {
        Args: {
          account_id_param: string
          cluster_facet_ids: string[]
          project_id_param: string
          similarity_threshold?: number
          theme_category_param?: string
          theme_jtbd_param?: string
          theme_name_param: string
          theme_pain_param?: string
          theme_statement_param?: string
        }
        Returns: {
          action: string
          message: string
          theme_id: string
        }[]
      }
      get_account: { Args: { account_id: string }; Returns: Json }
      get_account_billing_status: {
        Args: { account_id: string }
        Returns: Json
      }
      get_account_by_slug: { Args: { slug: string }; Returns: Json }
      get_account_id: { Args: { slug: string }; Returns: string }
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
      get_account_research_link_ids: { Args: never; Returns: string[] }
      get_accounts: { Args: never; Returns: Json }
      get_admin_daily_usage: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          event_count: number
          total_cost_usd: number
          total_credits: number
          total_tokens: number
          unique_accounts: number
          usage_date: string
        }[]
      }
      get_admin_daily_usage_by_feature: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          event_count: number
          feature_source: string
          total_cost_usd: number
          total_credits: number
          total_tokens: number
          usage_date: string
        }[]
      }
      get_admin_recent_login_activity: {
        Args: { p_feature_limit?: number; p_user_limit?: number }
        Returns: {
          last_sign_in_at: string
          recent_features: Json
          user_email: string
          user_id: string
          user_name: string
        }[]
      }
      get_admin_usage_by_account: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          account_id: string
          account_name: string
          event_count: number
          total_cost_usd: number
          total_credits: number
          total_tokens: number
        }[]
      }
      get_admin_usage_by_feature: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          event_count: number
          feature_source: string
          total_cost_usd: number
          total_credits: number
          total_tokens: number
        }[]
      }
      get_admin_usage_by_user: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          event_count: number
          total_cost_usd: number
          total_credits: number
          total_tokens: number
          user_email: string
          user_id: string
          user_name: string
        }[]
      }
      get_annotation_counts: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_project_id: string
        }
        Returns: {
          annotation_type: string
          count: number
        }[]
      }
      get_cluster_strength: {
        Args: { cluster_facet_ids: string[]; project_id_param: string }
        Returns: {
          total_evidence_count: number
          total_org_count: number
          total_people_count: number
        }[]
      }
      get_evidence_cluster: {
        Args: {
          limit_results?: number
          project_id_param: string
          seed_facet_id: string
          similarity_threshold?: number
        }
        Returns: {
          evidence_count: number
          facet_id: string
          kind_slug: string
          label: string
          similarity: number
        }[]
      }
      get_monthly_usage_summary: {
        Args: { p_account_id: string }
        Returns: {
          event_count: number
          feature_source: string
          total_cost_usd: number
          total_credits: number
          total_tokens: number
        }[]
      }
      get_personal_account: { Args: never; Returns: Json }
      get_research_link_response_counts: {
        Args: { link_ids: string[] }
        Returns: {
          research_link_id: string
          response_count: number
        }[]
      }
      get_user_accounts: { Args: never; Returns: Json }
      get_user_flags: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_project_id: string
        }
        Returns: {
          flag_type: string
          flag_value: boolean
          metadata: Json
        }[]
      }
      get_user_response_account_ids: { Args: never; Returns: string[] }
      get_user_response_link_ids: { Args: never; Returns: string[] }
      get_user_vote: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_project_id: string
        }
        Returns: number
      }
      get_vote_counts: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_project_id: string
        }
        Returns: {
          downvotes: number
          total_votes: number
          upvotes: number
        }[]
      }
      ingest_ui_event: {
        Args: {
          p_account_id: string
          p_actor: string
          p_artifact_id: string
          p_client_event_id: string
          p_event_type: string
          p_path: string
          p_thread_id: string
          p_trace_id: string
          p_value: Json
        }
        Returns: Json
      }
      insert_theme: {
        Args: {
          p_account_id: string
          p_created_by?: string
          p_inclusion_criteria?: string
          p_interview_id: string
          p_name: string
          p_project_id: string
          p_statement?: string
          p_updated_by?: string
        }
        Returns: string
      }
      invoke_edge_function: {
        Args: { func_name: string; payload: Json }
        Returns: undefined
      }
      is_email_account_member: {
        Args: { check_account_id: string; check_email: string }
        Returns: boolean
      }
      is_platform_admin: { Args: never; Returns: boolean }
      leave_account: { Args: { account_id: string }; Returns: undefined }
      list_invitations_for_current_user: { Args: never; Returns: Json }
      log_invitation_audit: {
        Args: {
          p_account_id: string
          p_account_role?: Database["accounts"]["Enums"]["account_role"]
          p_action: string
          p_details?: Json
          p_invitation_id: string
          p_invitee_email?: string
        }
        Returns: undefined
      }
      lookup_invitation: {
        Args: { lookup_invitation_token: string }
        Returns: Json
      }
      process_embedding_queue: { Args: never; Returns: string }
      process_facet_embedding_queue: { Args: never; Returns: string }
      process_person_facet_embedding_queue: { Args: never; Returns: string }
      process_transcribe_queue: { Args: never; Returns: string }
      record_usage_event: {
        Args: {
          p_account_id: string
          p_credits_charged: number
          p_estimated_cost_usd: number
          p_feature_source: string
          p_idempotency_key?: string
          p_input_tokens: number
          p_model: string
          p_output_tokens: number
          p_project_id: string
          p_provider: string
          p_resource_id?: string
          p_resource_type?: string
          p_user_id: string
        }
        Returns: string
      }
      remove_account_member: {
        Args: { account_id: string; user_id: string }
        Returns: undefined
      }
      search_themes_semantic: {
        Args: {
          match_count?: number
          match_threshold?: number
          project_id_param: string
          query_text: string
        }
        Returns: {
          category: string
          id: string
          journey_stage: string
          name: string
          pain: string
          similarity: number
          statement: string
        }[]
      }
      service_role_upsert_customer_subscription: {
        Args: { account_id: string; customer?: Json; subscription?: Json }
        Returns: undefined
      }
      set_current_account_id: {
        Args: { new_account_id: string }
        Returns: {
          account_id: string | null
          app_activity: Json
          created_at: string
          created_by: string | null
          current_account_id: string | null
          current_project_id: string | null
          id: string
          metadata: Json
          onboarding_completed: boolean
          role: string | null
          title: string | null
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "account_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sync_insight_tags: {
        Args: {
          p_account_id: string
          p_insight_id: string
          p_tag_names: string[]
        }
        Returns: undefined
      }
      sync_opportunity_insights: {
        Args: { p_insight_ids: string[]; p_opportunity_id: string }
        Returns: undefined
      }
      update_account: {
        Args: {
          account_id: string
          name?: string
          public_metadata?: Json
          replace_metadata?: boolean
          slug?: string
        }
        Returns: Json
      }
      update_account_user_role: {
        Args: {
          account_id: string
          make_primary_owner?: boolean
          new_account_role: Database["accounts"]["Enums"]["account_role"]
          user_id: string
        }
        Returns: undefined
      }
      update_project_people_stats: {
        Args: { p_person_id: string; p_project_id: string }
        Returns: undefined
      }
      upsert_signup_data: {
        Args: { p_signup_data: Json; p_user_id: string }
        Returns: undefined
      }
      user_has_response_for_link: {
        Args: { link_id: string }
        Returns: boolean
      }
    }
    Enums: {
      asset_type:
        | "table"
        | "pdf"
        | "document"
        | "image"
        | "audio"
        | "video"
        | "link"
      interaction_context:
        | "research"
        | "sales"
        | "support"
        | "internal"
        | "debrief"
        | "personal"
      interview_status:
        | "draft"
        | "scheduled"
        | "uploading"
        | "uploaded"
        | "transcribing"
        | "transcribed"
        | "processing"
        | "ready"
        | "tagged"
        | "archived"
        | "error"
      job_status: "pending" | "in_progress" | "done" | "error" | "retry"
      project_workflow_type: "research" | "sales" | "conversation_analysis"
      research_analysis_question_kind: "decision" | "research"
      sales_framework: "BANT_GPCT" | "SPICED" | "MEDDIC" | "MAP"
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
  accounts: {
    Enums: {
      account_role: ["owner", "member", "viewer"],
      invitation_type: ["one_time", "24_hour"],
      subscription_status: [
        "trialing",
        "active",
        "canceled",
        "incomplete",
        "incomplete_expired",
        "past_due",
        "unpaid",
      ],
    },
  },
  billing: {
    Enums: {
      credit_event_type: ["grant", "purchase", "spend", "expire", "refund"],
      credit_source: ["plan", "purchase", "promo", "manual"],
      entitlement_source: ["plan", "addon", "promo", "override"],
    },
  },
  public: {
    Enums: {
      asset_type: [
        "table",
        "pdf",
        "document",
        "image",
        "audio",
        "video",
        "link",
      ],
      interaction_context: [
        "research",
        "sales",
        "support",
        "internal",
        "debrief",
        "personal",
      ],
      interview_status: [
        "draft",
        "scheduled",
        "uploading",
        "uploaded",
        "transcribing",
        "transcribed",
        "processing",
        "ready",
        "tagged",
        "archived",
        "error",
      ],
      job_status: ["pending", "in_progress", "done", "error", "retry"],
      project_workflow_type: ["research", "sales", "conversation_analysis"],
      research_analysis_question_kind: ["decision", "research"],
      sales_framework: ["BANT_GPCT", "SPICED", "MEDDIC", "MAP"],
    },
  },
} as const
