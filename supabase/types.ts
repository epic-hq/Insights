type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
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
					extensions?: Json
					variables?: Json
					query?: string
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
	public: {
		Tables: {
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
					embedding: string | null
					emotional_response: string | null
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
				}
				Insert: {
					category: string
					confidence?: string | null
					contradictions?: string | null
					created_at?: string
					desired_outcome?: string | null
					embedding?: string | null
					emotional_response?: string | null
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
				}
				Update: {
					category?: string
					confidence?: string | null
					contradictions?: string | null
					created_at?: string
					desired_outcome?: string | null
					embedding?: string | null
					emotional_response?: string | null
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
			interviews: {
				Row: {
					created_at: string
					duration_min: number | null
					id: string
					interview_date: string | null
					interviewer_id: string | null
					org_id: string
					participant_pseudonym: string | null
					project_id: string
					segment: string | null
					status: string
					title: string | null
				}
				Insert: {
					created_at?: string
					duration_min?: number | null
					id?: string
					interview_date?: string | null
					interviewer_id?: string | null
					org_id: string
					participant_pseudonym?: string | null
					project_id: string
					segment?: string | null
					status: string
					title?: string | null
				}
				Update: {
					created_at?: string
					duration_min?: number | null
					id?: string
					interview_date?: string | null
					interviewer_id?: string | null
					org_id?: string
					participant_pseudonym?: string | null
					project_id?: string
					segment?: string | null
					status?: string
					title?: string | null
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
				}
				Insert: {
					created_at?: string
					id?: string
					kanban_status?: string | null
					org_id: string
					owner_id?: string | null
					related_insight_ids?: string[] | null
					title: string
				}
				Update: {
					created_at?: string
					id?: string
					kanban_status?: string | null
					org_id?: string
					owner_id?: string | null
					related_insight_ids?: string[] | null
					title?: string
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
				}
				Insert: {
					created_at?: string
					id?: string
					name: string
				}
				Update: {
					created_at?: string
					id?: string
					name?: string
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
				}
				Insert: {
					color_hex?: string | null
					created_at?: string
					description?: string | null
					id?: string
					name: string
					org_id: string
					percentage?: number | null
				}
				Update: {
					color_hex?: string | null
					created_at?: string
					description?: string | null
					id?: string
					name?: string
					org_id?: string
					percentage?: number | null
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
				}
				Insert: {
					created_at?: string
					id?: string
					insight_id: string
					org_id: string
					quote: string
					timestamp_sec?: number | null
				}
				Update: {
					created_at?: string
					id?: string
					insight_id?: string
					org_id?: string
					quote?: string
					timestamp_sec?: number | null
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
				}
				Insert: {
					code?: string | null
					created_at?: string
					description?: string | null
					id?: string
					org_id: string
					title: string
				}
				Update: {
					code?: string | null
					created_at?: string
					description?: string | null
					id?: string
					org_id?: string
					title?: string
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
				}
				Insert: {
					category?: string | null
					color_hex?: string | null
					created_at?: string
					embedding?: string | null
					id?: string
					name: string
					org_id: string
				}
				Update: {
					category?: string | null
					color_hex?: string | null
					created_at?: string
					embedding?: string | null
					id?: string
					name?: string
					org_id?: string
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
			transcripts: {
				Row: {
					created_at: string
					id: string
					interview_id: string
					org_id: string
					source_json: Json | null
					text: string | null
				}
				Insert: {
					created_at?: string
					id?: string
					interview_id: string
					org_id: string
					source_json?: Json | null
					text?: string | null
				}
				Update: {
					created_at?: string
					id?: string
					interview_id?: string
					org_id?: string
					source_json?: Json | null
					text?: string | null
				}
				Relationships: [
					{
						foreignKeyName: "transcripts_interview_id_fkey"
						columns: ["interview_id"]
						isOneToOne: false
						referencedRelation: "interviews"
						referencedColumns: ["id"]
					},
					{
						foreignKeyName: "transcripts_org_id_fkey"
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
					role: string
					user_id: string
				}
				Insert: {
					joined_at?: string
					org_id: string
					role: string
					user_id: string
				}
				Update: {
					joined_at?: string
					org_id?: string
					role?: string
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
			[_ in never]: never
		}
		Enums: {
			[_ in never]: never
		}
		CompositeTypes: {
			[_ in never]: never
		}
	}
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

// biome-ignore lint
type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
		| { schema: keyof Database },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof Database
	}
		? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
				Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
		: never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
	? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
			Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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

// biome-ignore lint
type TablesInsert<
	DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof Database },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof Database
	}
		? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
		: never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
	? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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

// biome-ignore lint
type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof Database },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof Database
	}
		? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
		: never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
	? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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

// biome-ignore lint
type Enums<
	DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof Database },
	EnumName extends DefaultSchemaEnumNameOrOptions extends {
		schema: keyof Database
	}
		? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
		: never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
	? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
		? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
		: never

// biome-ignore lint
type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] | { schema: keyof Database },
	CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
		schema: keyof Database
	}
		? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
		: never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
	? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
		? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
		: never

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DatabaseConstants = {
	graphql_public: {
		Enums: {},
	},
	public: {
		Enums: {},
	},
} as const
