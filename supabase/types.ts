export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
	// Allows to automatically instanciate createClient with right options
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
					created_at: string | null
					created_by: string | null
					id: string
					name: string | null
					personal_account: boolean
					primary_owner_user_id: string
					private_metadata: Json | null
					public_metadata: Json | null
					slug: string | null
					updated_at: string | null
					updated_by: string | null
				}
				Insert: {
					created_at?: string | null
					created_by?: string | null
					id?: string
					name?: string | null
					personal_account?: boolean
					primary_owner_user_id?: string
					private_metadata?: Json | null
					public_metadata?: Json | null
					slug?: string | null
					updated_at?: string | null
					updated_by?: string | null
				}
				Update: {
					created_at?: string | null
					created_by?: string | null
					id?: string
					name?: string | null
					personal_account?: boolean
					primary_owner_user_id?: string
					private_metadata?: Json | null
					public_metadata?: Json | null
					slug?: string | null
					updated_at?: string | null
					updated_by?: string | null
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
					created: string
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
					created?: string
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
					created?: string
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
			invitations: {
				Row: {
					account_id: string
					account_name: string | null
					account_role: Database["accounts"]["Enums"]["account_role"]
					created_at: string | null
					id: string
					invitation_type: Database["accounts"]["Enums"]["invitation_type"]
					invited_by_user_id: string
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
			generate_token: {
				Args: { length: number }
				Returns: string
			}
			get_accounts_with_role: {
				Args: { passed_in_role?: Database["accounts"]["Enums"]["account_role"] }
				Returns: string[]
			}
			get_config: {
				Args: Record<PropertyKey, never>
				Returns: Json
			}
			has_role_on_account: {
				Args: {
					account_id: string
					account_role?: Database["accounts"]["Enums"]["account_role"]
				}
				Returns: boolean
			}
			is_set: {
				Args: { field_name: string }
				Returns: boolean
			}
		}
		Enums: {
			account_role: "owner" | "member"
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
	graphql_public: {
		Tables: {
			[_ in never]: never
		}
		Views: {
			[_ in never]: never
		}
		Functions: {
			graphql: {
				Args: {
					operationName?: string
					query?: string
					variables?: Json
					extensions?: Json
				}
				Returns: Json
			}
		}
		Enums: {
			[_ in never]: never
		}
		CompositeTypes: {
			[_ in never]: never
		}
	}
	pgmq_public: {
		Tables: {
			[_ in never]: never
		}
		Views: {
			[_ in never]: never
		}
		Functions: {
			archive: {
				Args: { queue_name: string; message_id: number }
				Returns: boolean
			}
			delete: {
				Args: { queue_name: string; message_id: number }
				Returns: boolean
			}
			send: {
				Args: { queue_name: string; message: Json; sleep_seconds?: number }
				Returns: number[]
			}
			send_batch: {
				Args: { queue_name: string; messages: Json[]; sleep_seconds?: number }
				Returns: number[]
			}
		}
		Enums: {
			[_ in never]: never
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
			insight_tags: {
				Row: {
					account_id: string
					created_at: string | null
					created_by: string | null
					id: string
					insight_id: string
					tag: string
				}
				Insert: {
					account_id: string
					created_at?: string | null
					created_by?: string | null
					id?: string
					insight_id: string
					tag: string
				}
				Update: {
					account_id?: string
					created_at?: string | null
					created_by?: string | null
					id?: string
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
			interview_people: {
				Row: {
					created_at: string
					created_by: string | null
					interview_id: string
					person_id: string
					role: string | null
					updated_at: string
					updated_by: string | null
				}
				Insert: {
					created_at?: string
					created_by?: string | null
					interview_id: string
					person_id: string
					role?: string | null
					updated_at?: string
					updated_by?: string | null
				}
				Update: {
					created_at?: string
					created_by?: string | null
					interview_id?: string
					person_id?: string
					role?: string | null
					updated_at?: string
					updated_by?: string | null
				}
				Relationships: [
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
				]
			}
			interview_tags: {
				Row: {
					account_id: string
					created_at: string | null
					created_by: string | null
					id: string
					interview_id: string
					tag: string
				}
				Insert: {
					account_id: string
					created_at?: string | null
					created_by?: string | null
					id?: string
					interview_id: string
					tag: string
				}
				Update: {
					account_id?: string
					created_at?: string | null
					created_by?: string | null
					id?: string
					interview_id?: string
					tag?: string
				}
				Relationships: [
					{
						foreignKeyName: "interview_tags_interview_id_fkey"
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
			opportunity_insights: {
				Row: {
					created_at: string | null
					created_by: string | null
					id: string
					insight_id: string
					opportunity_id: string
					weight: number | null
				}
				Insert: {
					created_at?: string | null
					created_by?: string | null
					id?: string
					insight_id: string
					opportunity_id: string
					weight?: number | null
				}
				Update: {
					created_at?: string | null
					created_by?: string | null
					id?: string
					insight_id?: string
					opportunity_id?: string
					weight?: number | null
				}
				Relationships: [
					{
						foreignKeyName: "opportunity_insights_insight_id_fkey"
						columns: ["insight_id"]
						isOneToOne: false
						referencedRelation: "insights"
						referencedColumns: ["id"]
					},
					{
						foreignKeyName: "opportunity_insights_opportunity_id_fkey"
						columns: ["opportunity_id"]
						isOneToOne: false
						referencedRelation: "opportunities"
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
					name_hash: string | null
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
					name_hash?: string | null
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
					name_hash?: string | null
					occupation?: string | null
					persona?: string | null
					preferences?: string | null
					segment?: string | null
					updated_at?: string
				}
				Relationships: []
			}
			persona_insights: {
				Row: {
					created_at: string | null
					created_by: string | null
					id: string
					insight_id: string
					persona_id: string
					relevance_score: number | null
				}
				Insert: {
					created_at?: string | null
					created_by?: string | null
					id?: string
					insight_id: string
					persona_id: string
					relevance_score?: number | null
				}
				Update: {
					created_at?: string | null
					created_by?: string | null
					id?: string
					insight_id?: string
					persona_id?: string
					relevance_score?: number | null
				}
				Relationships: [
					{
						foreignKeyName: "persona_insights_insight_id_fkey"
						columns: ["insight_id"]
						isOneToOne: false
						referencedRelation: "insights"
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
				]
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
					role: string | null
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
					role?: string | null
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
					role?: string | null
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
			persona_distribution: {
				Row: {
					account_id: string | null
					color_hex: string | null
					created_at: string | null
					description: string | null
					participant_interview_count: number | null
					participant_percentage: number | null
					persona_id: string | null
					persona_name: string | null
					segment_interview_count: number | null
					segment_percentage: number | null
					total_participant_interviews: number | null
					total_segment_interviews: number | null
					updated_at: string | null
				}
				Relationships: []
			}
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
					account_role: Database["accounts"]["Enums"]["account_role"]
					invitation_type: Database["accounts"]["Enums"]["invitation_type"]
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
					new_account_role: Database["accounts"]["Enums"]["account_role"]
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
	: DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
		? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
				Row: infer R
			}
			? R
			: never
		: never

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
	DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
	DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
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
			account_role: ["owner", "member"],
			invitation_type: ["one_time", "24_hour"],
			subscription_status: ["trialing", "active", "canceled", "incomplete", "incomplete_expired", "past_due", "unpaid"],
		},
	},
	graphql_public: {
		Enums: {},
	},
	pgmq_public: {
		Enums: {},
	},
	public: {
		Enums: {
			interview_status: ["draft", "scheduled", "uploaded", "transcribed", "processing", "ready", "tagged", "archived"],
		},
	},
} as const
