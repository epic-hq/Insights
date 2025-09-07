import type { UUID } from "node:crypto"
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { createProject } from "~/features/projects/db"
import { deriveProjectNameDescription } from "~/features/onboarding/server/signup-derived-project"
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/server"

interface CreateProjectData {
	target_orgs: string[]
	target_roles: string[]
	research_goal: string
	research_goal_details: string
}

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	try {
		// Get authenticated user and their team account
		const user = await getAuthenticatedUser(request)
		if (!user) {
			return Response.json({ error: "User not authenticated" }, { status: 401 })
		}

		const { client: supabase } = getServerClient(request)

		// Get team account from user context
		const { data: userSettings } = await supabase
			.from("user_settings")
			.select("last_used_account_id")
			.eq("user_id", user.sub)
			.single()

		let teamAccountId = userSettings?.last_used_account_id

		// Fallback: get first available team account if no preference set
		if (!teamAccountId) {
			const { data: accounts } = await supabase.rpc("get_user_accounts")
			const teamAccount = accounts?.find((acc: Record<string, unknown>) => !acc.personal_account) || accounts?.[0]
			teamAccountId = teamAccount?.account_id as UUID
		}

		if (!teamAccountId) {
			return Response.json({ error: "No team account found" }, { status: 500 })
		}

		const formData = await request.formData()
		const projectDataStr = formData.get("projectData") as string

		if (!projectDataStr) {
			return Response.json({ error: "Missing project data" }, { status: 400 })
		}

        const projectData: CreateProjectData = JSON.parse(projectDataStr)

        // Prefer signup-data derived name/description; fall back to legacy formula
        let baseProjectName = projectData.research_goal
        let projectDescription = ""
        try {
          const derived = await deriveProjectNameDescription({ supabase, userId: user.sub })
          baseProjectName = derived.name || baseProjectName
          projectDescription = derived.description
        } catch {
          const primaryOrg = projectData.target_orgs[0] || "Organization"
          const primaryRole = projectData.target_roles[0] || "Role"
          projectDescription = `Research project for ${primaryRole} at ${primaryOrg}. Goal: ${projectData.research_goal}`
        }

		// Find available project name by checking for slug conflicts
		let projectName = baseProjectName
		let attempt = 1
		let project = null
		let projectError = null

		while (!project && attempt <= 10) {
			try {
            const { data: createdProject, error } = await createProject({
                supabase,
                data: {
                    name: projectName,
                    description: projectDescription,
                    account_id: teamAccountId,
                },
            })

				if (error) {
					projectError = error
					// If it's a slug conflict, try with a number suffix
					if (error.code === "23505" && error.message?.includes("slug")) {
						attempt++
						projectName = `${baseProjectName} ${attempt}`
						continue
					}
					throw error
				}

				project = createdProject
				break
			} catch (error) {
				projectError = error
				attempt++
				projectName = `${baseProjectName} ${attempt}`
			}
		}

		if (!project) {
			consola.error("Failed to create project after multiple attempts:", projectError)
			return Response.json({ error: "Failed to create project. Please try again." }, { status: 500 })
		}

		consola.log(`Created project: ${project.name} (${project.id}) for account ${teamAccountId}`)

		return Response.json({
			success: true,
			project: {
				id: project.id,
				name: project.name,
				description: project.description,
				account_id: teamAccountId,
			},
		})
	} catch (error) {
		consola.error("Failed to create project:", error)
		return Response.json(
			{
				error: error instanceof Error ? error.message : "Failed to create project",
			},
			{ status: 500 }
		)
	}
}
