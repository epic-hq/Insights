/**
 * API endpoint for researching an organization from the detail page
 * Calls the researchCompanyWebsite function to get company data
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { redirect } from "react-router"
import { getOrganizationById, updateOrganization } from "~/features/organizations/db"
import { researchCompanyWebsite } from "~/mastra/tools/research-company-website"
import { userContext } from "~/server/user-context"
import type { Database } from "~/types"
import { createProjectRoutes } from "~/utils/routes.server"

export async function action({ params, context }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	// Cast to work around duplicate type issue from @supabase/supabase-js module
	const supabase = ctx.supabase as unknown as SupabaseClient<Database>
	const accountId = params.accountId
	const projectId = params.projectId
	const organizationId = params.organizationId

	if (!accountId || !projectId || !organizationId) {
		return { success: false, error: "Missing required parameters" }
	}

	const routes = createProjectRoutes(accountId, projectId)

	// Get the organization to find its website
	const { data: org, error: orgError } = await getOrganizationById({
		supabase,
		accountId,
		projectId,
		id: organizationId,
	})

	if (orgError || !org) {
		return { success: false, error: "Organization not found" }
	}

	if (!org.website_url) {
		return { success: false, error: "No website URL to research" }
	}

	consola.info("[organization-research] Starting research for:", org.name, {
		website: org.website_url,
	})

	// Research the company website
	const result = await researchCompanyWebsite(org.website_url)

	if (!result.success || !result.data) {
		return {
			success: false,
			error: result.error || "Research failed",
		}
	}

	// Build update data - only fill in fields that are currently empty
	const updateFields: Record<string, string | null> = {}

	if (result.data.industry && !org.industry) {
		updateFields.industry = result.data.industry
	}
	if (result.data.description && !org.description) {
		updateFields.description = result.data.description
	}

	if (Object.keys(updateFields).length > 0) {
		const { error: updateError } = await updateOrganization({
			supabase,
			accountId,
			id: organizationId,
			data: updateFields,
		})

		if (updateError) {
			consola.error("[organization-research] Failed to update org:", updateError)
		} else {
			consola.info("[organization-research] Updated organization with:", updateFields)
		}
	}

	// Redirect back to the organization detail page
	return redirect(routes.organizations.detail(organizationId))
}
