import { z } from "zod"
import type { RpcArgs, SupabaseClient } from "~/types"

// Fetch recent invitations for a specific account (last 24 hours)
export const getAccountInvitations = async ({
	supabase,
	account_id,
	results_limit,
	results_offset,
}: {
	supabase: SupabaseClient
	account_id: string
	results_limit?: number
	results_offset?: number
}) => {
	return await supabase.rpc("get_account_invitations", {
		account_id,
		results_limit,
		results_offset,
	})
}

export const CreateInvitationSchema = z.object({
	account_id: z.string().uuid(),
	account_role: z.enum(["owner", "member"]).default("member"),
	invitation_type: z.enum(["one_time", "24_hour"]).default("one_time"),
	invitee_email: z.string().email().optional(),
})
/**
 * @description
 * Allow team owner to create an invitation
 */
export const createInvitation = async ({
	supabase,
	account_id,
	account_role,
	invitation_type,
	invitee_email,
}: { supabase: SupabaseClient } & z.input<typeof CreateInvitationSchema>) => {
	const validated = CreateInvitationSchema.parse({ account_id, account_role, invitation_type, invitee_email })
	return await supabase.rpc("create_invitation", validated)
}

type LookupInvitationRequest = RpcArgs<"lookup_invitation">
export const lookupInvitation = async ({
	supabase,
	lookup_invitation_token,
}: { supabase: SupabaseClient } & LookupInvitationRequest) => {
	return await supabase.rpc("lookup_invitation", { lookup_invitation_token })
}

type AcceptInvitationRequest = RpcArgs<"accept_invitation">
/**
 * @description
 * Allow user to accept an invitation
 */
export const acceptInvitation = async ({
	supabase,
	lookup_invitation_token,
}: { supabase: SupabaseClient } & AcceptInvitationRequest) => {
	return await supabase.rpc("accept_invitation", { lookup_invitation_token })
}

type DeleteInvitationRequest = RpcArgs<"delete_invitation">
/**
 * @description
 * Allow admin to delete an invitation
 */
export const deleteInvitation = async ({
	supabase,
	invitation_id,
}: { supabase: SupabaseClient } & DeleteInvitationRequest) => {
	return await supabase.rpc("delete_invitation", { invitation_id })
}
