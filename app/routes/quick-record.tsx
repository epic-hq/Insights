/**
 * Route: /quick-record
 * Purpose: Create a project automatically and start recording immediately
 */

import { type LoaderFunctionArgs, redirect } from "react-router"
import { createProject } from "~/features/projects/db"
import { userContext } from "~/server/user-context"

export async function loader({ context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)

	if (!ctx?.claims) {
		return redirect("/login")
	}

	const { supabase, account_id } = ctx

	try {
		// Generate automatic project title with timestamp
		const now = new Date()
		const timestamp = now.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
		})
		const projectName = `Quick Recording ${timestamp}`

		// Create project with minimal data
		const { data: project } = await createProject({
			supabase,
			data: {
				name: projectName,
				description: "Auto-generated project for quick recording",
				slug: `quick-${Date.now()}`,
				account_id: account_id,
			},
		})

		if (!project) {
			throw new Error("Failed to create project")
		}

		// Redirect to the project's onboarding upload screen for immediate recording
		return redirect(`/a/${account_id}/${project.id}/onboarding/upload?quick=true`)
	} catch (error) {
		console.error("Quick record project creation failed:", error)
		// Fallback to regular project creation
		return redirect("/projects/new?quick=true")
	}
}

// This route only handles the redirect, no component needed
export default function QuickRecord() {
	return <div>Creating project...</div>
}
