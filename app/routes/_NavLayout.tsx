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
export const unstable_middleware: Route.unstable_MiddlewareFunction[] = [
	async ({ request, context }) => {
		const user = await getAuthenticatedUser(request)
		if (!user) {
			throw redirect("/login")
		}
		// Get Supabase client from the authenticated user context
		// Note: getServerClient is imported in the user context setup
		const { getServerClient } = await import("~/lib/supabase/server")
		const { client, headers } = getServerClient(request)
		context.set(userContext, {
			claims: user,
			account_id: user.sub,
			user_metadata: user.user_metadata,
			supabase: client,
			headers,
		})
	},
]

export async function loader({ context }: Route.LoaderArgs) {
	const loadContextInstance = context.get(loadContext)
	const { lang } = loadContextInstance
	const user = context.get(userContext)
	const _account_id = user.account_id
	const supabase = user.supabase
	const claims = user.claims

	// Get server-side authentication state
	// Note: signOut will be handled client-side via AuthProvider
	const signOut = async () => {
		const { getSupabaseClient } = await import("~/lib/supabase/client")
		const supabase = getSupabaseClient()
		await supabase.auth.signOut()
	}

	// Get user's accounts and projects using the new cloud function
	// This function is now deployed to the cloud instance with proper schema access
	const { data: accounts, error: accountsError } = await supabase.rpc("get_user_accounts")

	if (accountsError) {
		consola.error("Get user accounts error:", accountsError)
		throw new Response(accountsError.message, { status: 500 })
	}

	return {
		lang,
		auth: {
			user: claims,
		},
		signOut,
		accounts,
	}
}

// Breadcrumbs functionality removed for now - can be re-implemented later with proper typing
// function _Breadcrumbs() {
// 	const matches = useMatches()
// 	// Implementation would need proper typing for match.pathname and crumb function
// 	return null
// }

export default function NavLayout() {
	const { auth, accounts } = useLoaderData<typeof loader>()
	// consola.log("AuthProvider  user:", auth.user)
	return (
		// <div className="mx-auto max-w-[1440px] pt-4">
		<AuthProvider user={auth.user} organizations={accounts}>
			<MainNav />
			<PageHeader title="" />
			<Outlet />
		</AuthProvider>
		// </div>
	)
}
