import type { MergeDeep } from "type-fest"
import type { Json, Database as SupabaseDB } from "~/../supabase/types"
import type {
	AcceptInvitationResponse,
	CreateAccountResponse,
	CreateInvitationResponse,
	GetAccountInvitesResponse,
	GetAccountMembersResponse,
	GetAccountResponse,
	GetAccountsResponse,
	LookupInvitationResponse,
} from "./types-accounts"

export type Database = MergeDeep<
	SupabaseDB,
	{
		public: {
			Tables: {
				research_links: {
					Row: {
						id: string
						account_id: string
						project_id: string | null
						name: string
						slug: string
						description: string | null
						hero_title: string | null
						hero_subtitle: string | null
						hero_cta_label: string | null
						hero_cta_helper: string | null
						redirect_url: string | null
						calendar_url: string | null
						walkthrough_video_url: string | null
						walkthrough_thumbnail_url: string | null
						questions: Json
						allow_chat: boolean
						default_response_mode: "form" | "chat"
						is_live: boolean
						created_at: string
						updated_at: string
					}
					Insert: {
						id?: string
						account_id: string
						project_id?: string | null
						name: string
						slug: string
						description?: string | null
						hero_title?: string | null
						hero_subtitle?: string | null
						hero_cta_label?: string | null
						hero_cta_helper?: string | null
						redirect_url?: string | null
						calendar_url?: string | null
						walkthrough_video_url?: string | null
						walkthrough_thumbnail_url?: string | null
						questions?: Json
						allow_chat?: boolean
						default_response_mode?: "form" | "chat"
						is_live?: boolean
						created_at?: string
						updated_at?: string
					}
					Update: {
						id?: string
						account_id?: string
						project_id?: string | null
						name?: string
						slug?: string
						description?: string | null
						hero_title?: string | null
						hero_subtitle?: string | null
						hero_cta_label?: string | null
						hero_cta_helper?: string | null
						redirect_url?: string | null
						calendar_url?: string | null
						walkthrough_video_url?: string | null
						walkthrough_thumbnail_url?: string | null
						questions?: Json
						allow_chat?: boolean
						default_response_mode?: "form" | "chat"
						is_live?: boolean
						created_at?: string
						updated_at?: string
					}
					Relationships: [
						{
							foreignKeyName: "research_links_account_id_fkey"
							columns: ["account_id"]
							isOneToOne: false
							referencedRelation: "accounts"
							referencedColumns: ["id"]
						},
						{
							foreignKeyName: "research_links_project_id_fkey"
							columns: ["project_id"]
							isOneToOne: false
							referencedRelation: "projects"
							referencedColumns: ["id"]
						},
					]
				}
				research_link_responses: {
					Row: {
						id: string
						research_link_id: string
						email: string
						responses: Json
						response_mode: "form" | "chat"
						completed: boolean
						evidence_id: string | null
						created_at: string
						updated_at: string
					}
					Insert: {
						id?: string
						research_link_id: string
						email: string
						responses?: Json
						response_mode?: "form" | "chat"
						completed?: boolean
						evidence_id?: string | null
						created_at?: string
						updated_at?: string
					}
					Update: {
						id?: string
						research_link_id?: string
						email?: string
						responses?: Json
						response_mode?: "form" | "chat"
						completed?: boolean
						evidence_id?: string | null
						created_at?: string
						updated_at?: string
					}
					Relationships: [
						{
							foreignKeyName: "research_link_responses_research_link_id_fkey"
							columns: ["research_link_id"]
							isOneToOne: false
							referencedRelation: "research_links"
							referencedColumns: ["id"]
						},
						{
							foreignKeyName: "research_link_responses_evidence_id_fkey"
							columns: ["evidence_id"]
							isOneToOne: false
							referencedRelation: "evidence"
							referencedColumns: ["id"]
						},
					]
				}
			}
			Functions: {
				// Override the return types of functions for stricter types
				// --- Accounts ---
				get_accounts: {
					Returns: GetAccountsResponse
				}
				create_account: {
					Returns: CreateAccountResponse
				}
				get_account: {
					Returns: GetAccountResponse
				}
				get_personal_account: {
					Returns: GetAccountResponse
				}
				get_account_by_slug: {
					Returns: GetAccountResponse
				}

				// --- Invitations ---
				get_account_invitations: {
					Returns: GetAccountInvitesResponse
				}
				create_invitation: {
					Returns: CreateInvitationResponse
				}
				lookup_invitation: {
					Returns: LookupInvitationResponse
				}
				accept_invitation: {
					Returns: AcceptInvitationResponse
				}

				// --- Members ---
				get_account_members: {
					Returns: GetAccountMembersResponse
				}
			}
		}
	}
>
