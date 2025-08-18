import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "~/types"

export const getPersonas = async ({
	supabase,
	accountId,
	projectId,
}: {
	supabase: SupabaseClient<Database>
	accountId: string
	projectId: string
}) => {
	return await supabase
		.from("personas")
		.select(`
			*,
			people_personas(count)
		`)
		.eq("project_id", projectId)
}
