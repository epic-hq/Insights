/**
 * Handles protected project routes, including project context resolution and authentication middleware.
 * Ensures only authenticated users can access project-specific resources and provides project data to child routes.
 */
import consola from "consola"
import { Outlet, redirect } from "react-router-dom"
import { z } from "zod"
import { CurrentProjectProvider } from "~/contexts/current-project-context"
import { currentProjectContext } from "~/server/current-project-context"
import { userContext } from "~/server/user-context"
import type { GetAccount, Project } from "~/types"
import type { Route } from "../+types/root"

function isUUID(str: string) {
	const uuidSchema = z.string().uuid()
	const isValid = uuidSchema.safeParse(str).success
	return isValid
}

// Placeholder: Replace with actual project fetching logic
async function _parse_project_id_from_params({
	project_id_or_slug,
	supabase,
}: {
	project_id_or_slug: string
	supabase: any // SupabaseClient
}) {
	if (isUUID(project_id_or_slug || "")) {
		// TODO: Replace with actual RPC or query to fetch project by UUID
		const project: Project = {} as Project
		return project
	}
	// TODO: Replace with actual RPC or query to fetch project by slug
	const project: Project = {} as Project
	return project
}

// Server-side Authentication Middleware
export const unstable_middleware: Route.unstable_MiddlewareFunction[] = [
	async ({ request, context, params }) => {
		try {
			const ctx = context.get(userContext)
			const _supabase = ctx.supabase
			const project_id_or_slug = params?.projectId || ""
			const account_id = params?.accountId || ""

			// Placeholder: Fetch project and account info
			const project = await _parse_project_id_from_params({
				project_id_or_slug,
				supabase: _supabase,
			})
			const account: GetAccount = {} as GetAccount

			context.set(currentProjectContext, {
				accountId: account_id,
				projectId: project_id_or_slug,
				account,
				project,
			})
			// consola.log("_protected/projects currentProjectContext", project_id_or_slug)
		} catch (error) {
			consola.error("_protected/projects Authentication middleware error:", error)
			throw redirect("/login")
		}
	},
]

export async function loader({ context }: Route.LoaderArgs) {
	try {
		const currentProject = context.get(currentProjectContext)
		// consola.log("_protected/projects loader currentProjectContext", currentProject)
		return {
			...currentProject,
		}
	} catch (error) {
		consola.error("_protected/projects loader error:", error)
		throw new Response("Internal server error", { status: 500 })
	}
}

export default function Projects() {
	// const currentProject = useLoaderData<typeof loader>()
	// consola.log("Projects currentProjectContext:", currentProject)

	return (
		<CurrentProjectProvider>
			<Outlet />
		</CurrentProjectProvider>
	)
}
