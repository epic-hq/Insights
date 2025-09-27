// import { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import type { SupabaseClient } from "~/types"

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