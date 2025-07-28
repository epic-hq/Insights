import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "~/types"

export const getPersonas = async ({
	supabase,
	accountId,
}: {
	supabase: SupabaseClient<Database>
	accountId: string
}) => {
	return await supabase.from("personas").select("*").eq("account_id", accountId)
}
