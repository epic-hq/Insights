// import { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import { z } from "zod"
import type { SupabaseClient } from "~/types"

export const getAccounts = async ({ supabase }: { supabase: SupabaseClient }) => {
	// return await supabase.rpc('get_accounts')
	const { data, error } = await supabase.rpc("get_accounts")
	if (error) {
		consola.error("Get accounts error:", error)
		return { data, error }
	}
	consola.log("get_accounts result", data)
	const teamAccounts = data?.filter((account) => account?.personal_account === false)
	const personalAccount = data?.filter((account) => account?.personal_account === true)[0]
	return { data: { accounts: data, teamAccounts, personalAccount }, error }
}

const createTeamAccountSchema = z.object({
	name: z.string(),
	slug: z.string(),
})
type CreateTeamAccountRequest = z.infer<typeof createTeamAccountSchema>

export const createTeamAccount = async ({
	supabase,
	name,
	slug,
}: { supabase: SupabaseClient } & CreateTeamAccountRequest) => {
	const validatedData = createTeamAccountSchema.parse({ name, slug })
	return await supabase.rpc("create_account", {
		name: validatedData.name,
		slug: validatedData.slug,
	})
}

const updateAccountNameSchema = z.object({
	account_id: z.uuid(),
	name: z.string(),
})
type UpdateAccountNameRequest = z.infer<typeof updateAccountNameSchema>

const _updateAccountName = async ({
	supabase,
	account_id,
	name,
}: { supabase: SupabaseClient } & UpdateAccountNameRequest) => {
	const validatedData = updateAccountNameSchema.parse({ account_id, name })
	return await supabase.rpc("update_account", {
		account_id: validatedData.account_id,
		name: validatedData.name,
	})
}

const updateAccountSlugSchema = z.object({
	account_id: z.uuid(),
	slug: z.string(),
})
type UpdateAccountSlugRequest = z.infer<typeof updateAccountSlugSchema>

const _updateAccountSlug = async ({
	supabase,
	account_id,
	slug,
}: { supabase: SupabaseClient } & UpdateAccountSlugRequest) => {
	const validatedData = updateAccountSlugSchema.parse({ account_id, slug })
	return await supabase.rpc("update_account", {
		account_id: validatedData.account_id,
		slug: validatedData.slug,
	})
}

const getAccountSchema = z.object({
	account_id: z.uuid(),
})
type GetAccountRequest = z.infer<typeof getAccountSchema>

export const getAccount = async ({ supabase, account_id }: { supabase: SupabaseClient } & GetAccountRequest) => {
	// const validatedData = getAccountSchema.parse({ account_id })
	const { data, error } = await supabase.rpc("get_account", {
		account_id,
	})
	// const { data: test } = await supabase.schema("accounts").from("accounts").select("*").eq("id", validatedData.account_id)
	consola.log("Get account result", data)
	// consola.log("Get account result from table", test)
	if (error) {
		consola.error("Get account error:", error)
		return { data, error }
	}
	return { data, error }
}

const getAccountMembersSchema = z.object({
	account_id: z.uuid(),
})
type GetAccountMembersRequest = z.infer<typeof getAccountMembersSchema>

export const getAccountMembers = async ({
	supabase,
	account_id,
}: { supabase: SupabaseClient } & GetAccountMembersRequest) => {
	const validatedData = getAccountMembersSchema.parse({ account_id })
	const { data, error } = await supabase.rpc("get_account_members", {
		account_id: validatedData.account_id,
	})
	if (error) {
		consola.error("Get account members error:", error)
		return { data, error }
	}
	return { data, error }
}

const updateAccountUserRoleSchema = z.object({
	account_id: z.uuid(),
	user_id: z.uuid(),
	role: z.enum(["owner", "member"]),
})
type UpdateAccountUserRoleRequest = z.infer<typeof updateAccountUserRoleSchema>

export const updateAccountUserRole = async ({
	supabase,
	account_id,
	user_id,
	role,
}: { supabase: SupabaseClient } & UpdateAccountUserRoleRequest) => {
	const validatedData = updateAccountUserRoleSchema.parse({ account_id, user_id, role })
	return await supabase.rpc("update_account_user_role", {
		account_id: validatedData.account_id,
		user_id: validatedData.user_id,
		new_account_role: validatedData.role,
	})
}
