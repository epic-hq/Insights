import consola from "consola"
import { Outlet, redirect, useLoaderData } from "react-router"
import MainNav from "~/components/navigation/MainNav"
import PageHeader from "~/components/navigation/PageHeader"
import { AuthProvider } from "~/contexts/AuthContext"
import { getAuthenticatedUser } from "~/lib/supabase/server"
import { loadContext } from "~/server/load-context"
import { userContext } from "~/server/user-context"
import type { Route } from "../+types/root"

// Server-side Authentication Middleware
// This middleware runs before every loader in protected routes
// It ensures the user is authenticated and sets up the user context
export const unstable_middleware: Route.unstable_MiddlewareFunction[] = [
	async ({ request, context, params }) => {
		try {
			const user = await getAuthenticatedUser(request)
			if (!user) {
				throw redirect("/login")
			}

			// Get Supabase client from the authenticated user context
			const { getServerClient } = await import("~/lib/supabase/server")
			const { client, headers } = getServerClient(request)

			// Extract current projectId from URL params (or fallback to null)
			// TODO: Move currentProjectId to specific route segment file then delete this from context
			const currentProjectId = params?.projectId || null
			// consola.log("mw: ", currentProjectId)

			// Set user context for all child loaders/actions to access
			context.set(userContext, {
				claims: user,
				account_id: user.sub,
				user_metadata: user.user_metadata,
				supabase: client,
				headers,
				current_project_id: currentProjectId,
			})
		} catch (error) {
			consola.error("Authentication middleware error:", error)
			throw redirect("/login")
		}
	},
]

export async function loader({ context }: Route.LoaderArgs) {
	try {
		const loadContextInstance = context.get(loadContext)
		const { lang } = loadContextInstance
		const user = context.get(userContext)
		const accountId = user.account_id
		const supabase = user.supabase
		const claims = user.claims

		// Get user's accounts using the cloud function
		// This function has proper schema access and handles multi-tenancy
		const { data: accounts, error: accountsError } = await supabase.rpc("get_user_accounts")

		if (accountsError) {
			consola.error("Get user accounts error:", accountsError)
			throw new Response(accountsError.message, { status: 500 })
		}

		return {
			lang,
			auth: {
				user: claims,
				accountId,
				currentProjectId: user.current_project_id || null,
			},
			accounts: accounts || [],
		}
	} catch (error) {
		consola.error("Protected layout loader error:", error)
		throw redirect("/login")
	}
}

export default function ProtectedLayout() {
	const { auth, accounts } = useLoaderData<typeof loader>()

	return (
		<AuthProvider user={auth.user} organizations={accounts} currentProjectId={auth.currentProjectId}>
			<MainNav />
			<PageHeader title="" />
			<Outlet />
		</AuthProvider>
	)
}
