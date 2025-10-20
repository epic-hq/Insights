import consola from "consola"
import { Outlet, redirect, useLoaderData } from "react-router"
import { z } from "zod"
import { CurrentProjectProvider } from "~/contexts/current-project-context"
import { currentProjectContext } from "~/server/current-project-context"
import { userContext } from "~/server/user-context"
import type { GetAccount, Project, SupabaseClient } from "~/types"
import type { Route } from "../+types/root"

function isUUID(str: string) {
	const uuidSchema = z.string().uuid()
	const isValid = uuidSchema.safeParse(str).success
	consola.log("isUUID:", isValid)
	return isValid
}

async function parse_account_id_from_params({
	account_id_or_slug,
	supabase,
	userAccounts,
}: {
	account_id_or_slug: string
	supabase: SupabaseClient
	userAccounts?: Array<{ account_id: string; slug: string | null }>
}) {
	// If UUID, validate against user's accounts and return directly
	if (isUUID(account_id_or_slug || "")) {
		// Validate user has access to this account
		if (userAccounts) {
			const hasAccess = userAccounts.some((acc) => acc.account_id === account_id_or_slug)
			if (!hasAccess) {
				throw new Response("You must be a member of an account to access it", { status: 403 })
			}
		}
		return account_id_or_slug
	}

	// If slug, look up in user's accounts first
	if (userAccounts) {
		const account = userAccounts.find((acc) => acc.slug === account_id_or_slug)
		if (account) {
			return account.account_id
		}
	}

	// Fallback to RPC for slug lookup
	const getAccountIdResponse = await supabase.rpc("get_account_by_slug", {
		slug: account_id_or_slug,
	})
	if (getAccountIdResponse.error) {
		consola.error("Get account id error:", getAccountIdResponse.error)
		throw new Response(getAccountIdResponse.error.message, { status: 500 })
	}
	const data = getAccountIdResponse.data as GetAccount
	return data.account_id
}

async function parse_project_id_from_params({
	account_id,
	project_id_or_slug,
	supabase,
}: {
	account_id: string
	project_id_or_slug: string
	supabase: SupabaseClient
}) {
	if (isUUID(project_id_or_slug || "")) {
		const getProject = await supabase.from("projects").select("*").eq("id", project_id_or_slug).single()
		if (getProject.error) {
			consola.error("Get project error:", getProject.error)
			return { project: null, error: getProject.error }
		}
		return { project: getProject.data, error: null }
	}
	const getProjectIdResponse = await supabase
		.from("projects")
		.select("*")
		.eq("account_id", account_id)
		.eq("slug", project_id_or_slug)
		.single()
	if (getProjectIdResponse.error) {
		consola.error("Get project id error:", getProjectIdResponse.error)
		return { project: null, error: getProjectIdResponse.error }
	}
	return { project: getProjectIdResponse.data, error: null }
}

// Server-side Authentication Middleware
// This middleware runs before every loader in current-project-layout routes
// It ensures the user is authenticated and sets up the user context
export const middleware: Route.MiddlewareFunction[] = [
	async ({ request, context, params }) => {
		try {
			const ctx = context.get(userContext)
			const supabase = ctx.supabase

			const account_id_or_slug = params?.accountId || ""
			const project_id_or_slug = params?.projectId || ""

			// Get user accounts from middleware context for validation
			const userAccounts = ctx.accounts?.map((acc: any) => ({
				account_id: acc.account_id,
				slug: acc.slug,
			}))

			const parsed_account_id = await parse_account_id_from_params({
				account_id_or_slug,
				supabase,
				userAccounts,
			})

			if (!project_id_or_slug) {
				throw new Response("Project id or slug is required", { status: 400 })
			}

			const { project, error: projectError } = await parse_project_id_from_params({
				account_id: parsed_account_id,
				project_id_or_slug,
				supabase,
			})

			if (projectError) {
				throw new Response(projectError.message, { status: 500 })
			}

			// if (isUUID) {
			// get account
			// return account
			// get project calling
			// return project
			// }

			// Set user context for all child loaders/actions to access
			context.set(currentProjectContext, {
				current_account_id: parsed_account_id,
				current_project_id: project.id,
				account: {} as GetAccount,
				project: {} as Project,
			})
		} catch (error) {
			consola.error("Authentication middleware error:", error)
			throw redirect("/login")
		}
	},
]

export async function loader({ context }: Route.LoaderArgs) {
	try {
		const currentProject = context.get(currentProjectContext)

		return {
			...currentProject,
		}
	} catch (error) {
		consola.error("Protected layout loader error:", error)
		throw new Response("Internal server error", { status: 500 })
	}
}

export default function CurrentProjectLayout() {
	const currentProject = useLoaderData<typeof loader>()
	consola.log("Current project:", currentProject)

	return (
		<CurrentProjectProvider>
			<Outlet />
		</CurrentProjectProvider>
	)
}
