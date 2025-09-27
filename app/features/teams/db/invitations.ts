import z from "zod"
import type { RpcArgs, SupabaseClient } from "~/types"

export const getInvitations = async ({ supabase }: { supabase: SupabaseClient }) => {
	return await supabase.rpc("get_account_invitations")
}

export const CreateInvitationSchema = z.object({
	account_id: z.uuid(),
	account_role: z.enum(["owner", "member"]).default("member"),
	invitation_type: z.enum(["one_time", "24_hour"]).default("one_time"),
})
export const createInvitation = async ({
	supabase,
	account_id,
	account_role,
	invitation_type,
}: { supabase: SupabaseClient } & z.input<typeof CreateInvitationSchema>) => {
	const validated = CreateInvitationSchema.parse({ account_id, account_role, invitation_type })
	return await supabase.rpc("create_invitation", validated)
}


export type LookupInvitationRequest = RpcArgs<'lookup_invitation'>
export const lookupInvitation = async ({ supabase, lookup_invitation_token }: { supabase: SupabaseClient } & LookupInvitationRequest) => {
	return await supabase.rpc("lookup_invitation", { lookup_invitation_token })
}

export type AcceptInvitationRequest = RpcArgs<'accept_invitation'>
export const acceptInvitation = async ({ supabase, lookup_invitation_token }: { supabase: SupabaseClient } & AcceptInvitationRequest) => {
	return await supabase.rpc("accept_invitation", { lookup_invitation_token })
}

export type DeleteInvitationRequest = RpcArgs<'delete_invitation'>
export const deleteInvitation = async ({ supabase, invitation_id }: { supabase: SupabaseClient } & DeleteInvitationRequest) => {
	return await supabase.rpc("delete_invitation", { invitation_id })
}
