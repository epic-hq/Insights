import type { SupabaseClient } from "@supabase/supabase-js"
import { loadAccountMetadata } from "~/features/accounts/server/account-settings.server"
import type { Database } from "~/types"
import { resolveOpportunityStages, type AccountSettingsMetadata } from "../stage-config"

export async function loadOpportunityStages({
	supabase,
	accountId,
}: {
	supabase: SupabaseClient<Database>
	accountId: string
}) {
	const accountMetadata = await loadAccountMetadata({ supabase, accountId })
	const stages = resolveOpportunityStages(accountMetadata as AccountSettingsMetadata)

	return { stages, accountMetadata }
}
