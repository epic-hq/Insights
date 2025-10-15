import consola from "consola"
import { Outlet, redirect, useLoaderData } from "react-router"
import MainNav, { projectNavLinks } from "~/components/navigation/MainNav"
import PageHeader from "~/components/navigation/PageHeader"
import { CurrentProjectProvider } from "~/contexts/current-project-context"
import { getAuthenticatedUser, getRlsClient } from "~/lib/supabase/client.server"
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

			// Extract JWT from user claims (assumes JWT is available as user?.jwt or similar)
			const jwt = user?.jwt || user?.access_token || null

			// Use RLS client if JWT is present, otherwise fallback to anon client
			const supabase = jwt ? getRlsClient(jwt) : (await import("~/lib/supabase/client.server")).getServerClient(request).client

			// Set user context for all child loaders/actions to access
			context.set(userContext, {
				claims: user,
				account_id: user.sub,
				user_metadata: user.user_metadata,
				supabase,
				headers: request.headers,
			})
			consola.log("_ProtectedLayout Authentication middleware success\n")
		} catch (error) {
			consola.error("_ProtectedLayout Authentication middleware error:", error)
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
		<CurrentProjectProvider>
			<MainNav links={projectNavLinks} />
			<PageHeader title="" />
			<Outlet />
		</CurrentProjectProvider>
	)
}
