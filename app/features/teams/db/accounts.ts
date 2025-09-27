// import { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import type { SupabaseClient } from "~/types"
import { z } from "zod"

export const getAccounts = async ({ supabase }: { supabase: SupabaseClient }) => {
	// return await supabase.rpc('get_accounts')
	const { data, error } = await supabase.rpc('get_accounts')
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
	slug: z.string()
})
export type CreateTeamAccountRequest = z.infer<typeof createTeamAccountSchema>

export const createTeamAccount = async ({ supabase, name, slug }: { supabase: SupabaseClient } & CreateTeamAccountRequest) => {
	const validatedData = createTeamAccountSchema.parse({ name, slug })
	return await supabase.rpc('create_account', {
		name: validatedData.name,
		slug: validatedData.slug
	})
}

export const updateAccountNameSchema = z.object({
	account_id: z.uuid(),
	name: z.string(),
})
export type UpdateAccountNameRequest = z.infer<typeof updateAccountNameSchema>

export const updateAccountName = async ({ supabase, account_id, name }: { supabase: SupabaseClient } & UpdateAccountNameRequest) => {
	const validatedData = updateAccountNameSchema.parse({ account_id, name })
	return await supabase.rpc('update_account', {
		account_id: validatedData.account_id,
		name: validatedData.name
	})
}

export const updateAccountSlugSchema = z.object({
	account_id: z.uuid(),
	slug: z.string(),
})
export type UpdateAccountSlugRequest = z.infer<typeof updateAccountSlugSchema>

export const updateAccountSlug = async ({ supabase, account_id, slug }: { supabase: SupabaseClient } & UpdateAccountSlugRequest) => {
	const validatedData = updateAccountSlugSchema.parse({ account_id, slug })
	return await supabase.rpc('update_account', {
		account_id: validatedData.account_id,
		slug: validatedData.slug
	})
}