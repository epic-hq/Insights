import type { MergeDeep } from "type-fest"
import type { Database as SupabaseDB } from "~/../supabase/types"
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
