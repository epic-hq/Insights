import type { Database } from "supabase/types"

type CurrentUserAccountRoleResponse = {
	account_role: Database["accounts"]["Tables"]["account_user"]["Row"]["account_role"]
	is_primary_owner: boolean
	is_personal_account: boolean
}
type GetBillingPlansResponse = Array<{
	id: string
	name: string
	description?: string
	amount: number
	currency: string
	interval: "month" | "year" | "one_time"
	interval_count: 1
	trial_period_days?: 30
	active?: boolean
	metadata?: {
		[key: string]: string
	}
}>
type GetAccountResponse = {
	account_id: string
	role: Database["accounts"]["Tables"]["account_user"]["Row"]["account_role"]
	is_primary_owner: boolean
	name: string
	slug: string
	personal_account: boolean
	created_at: Date
	updated_at: Date
	metadata: {
		[key: string]: any
	}
}
type CreateAccountResponse = GetAccountResponse
type UpdateAccountResponse = GetAccountResponse
type GetAccountsResponse = {
	account_id: string
	role: Database["accounts"]["Tables"]["account_user"]["Row"]["account_role"]
	is_primary_owner: boolean
	name: string
	slug: string
	personal_account: boolean
	created_at: Date
	updated_at: Date
}[]
type GetAccountMembersResponse = {
	name: string
	account_role: Database["accounts"]["Tables"]["account_user"]["Row"]["account_role"]
	is_primary_owner: boolean
}[]
type GetAccountInvitesResponse = {
	invitation_id: string
	account_role: Database["accounts"]["Tables"]["account_user"]["Row"]["account_role"]
	invitation_type: Database["accounts"]["Tables"]["invitations"]["Row"]["invitation_type"]
	created_at: Date
	email?: string | null
}[]
type CreateInvitationResponse = {
	token: string
}
type GetAccountBillingStatusResponse = {
	subscription_active: boolean
	status: Database["accounts"]["Tables"]["billing_subscriptions"]["Row"]["status"]
	billing_email?: string
	account_role: Database["accounts"]["Tables"]["account_user"]["Row"]["account_role"]
	is_primary_owner: boolean
	billing_enabled: boolean
}
type AcceptInvitationResponse = {
	account_id: string
	account_role: Database["accounts"]["Tables"]["account_user"]["Row"]["account_role"]
	slug: string
}
type LookupInvitationResponse = {
	active: boolean
	account_name: string
}

export type {
	AcceptInvitationResponse,
	CreateAccountResponse,
	CreateInvitationResponse,
	GetAccountInvitesResponse,
	GetAccountMembersResponse,
	GetAccountResponse,
	GetAccountsResponse,
	LookupInvitationResponse,
}
