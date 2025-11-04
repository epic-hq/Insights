import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "~/types"

export const getThemes = async ({
	supabase,
	projectId,
}: {
	supabase: SupabaseClient<Database>
	projectId: string
}) => {
	return await supabase
		.from("themes")
		.select("*, theme_evidence(count)")
		.eq("project_id", projectId)
		.order("updated_at", { ascending: false })
}
