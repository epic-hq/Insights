import consola from "consola"
import { Outlet, redirect, useLoaderData } from "react-router"
import MainNav from "~/components/navigation/MainNav"
import PageHeader from "~/components/navigation/PageHeader"
import { AuthProvider } from "~/contexts/AuthContext"
import { CurrentProjectProvider } from "~/contexts/current-project-context"
import { getAuthenticatedUser, getRlsClient } from "~/lib/supabase/server"
import { loadContext } from "~/server/load-context"
import { userContext } from "~/server/user-context"
import AIChatButton from "~/components/chat/AIChatButton"
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
			const supabase = jwt ? getRlsClient(jwt) : (await import("~/lib/supabase/server")).getServerClient(request).client

			// Set user context for all child loaders/actions to access
			context.set(userContext, {
				claims: user,
				account_id: user.sub,
				user_metadata: user.user_metadata,
				supabase,
				headers: request.headers,
			})
			// consola.log("_ProtectedLayout Authentication middleware success\n")
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

		// Get current account_settings using personal user_id so we know which account and project to use
		const { data: accountSettings, error: accountSettingsError } = await supabase
			.from("account_settings")
			.select("*")
			.eq("account_id", accountId)
			.single()
		if (accountSettingsError) {
			consola.error("Get account settings error:", accountSettingsError)
			throw new Response(accountSettingsError.message, { status: 500 })
		}
		// consola.log("_ProtectedLayout Account settings:", accountSettings)
		// save in middleware context
		context.set(userContext, {
			...user,
			accountSettings,
		})

		return {
			lang,
			auth: {
				user: claims,
				accountId,
			},
			accounts: accounts || [],
			account_settings: accountSettings || {},
		}
	} catch (error) {
		consola.error("Protected layout loader error:", error)
		throw redirect("/login")
	}
}

export default function ProtectedLayout() {
	const { auth, accounts, account_settings } = useLoaderData<typeof loader>()

	return (
		<AuthProvider user={auth.user} organizations={accounts} account_settings={account_settings}>
			<CurrentProjectProvider>
				<MainNav />
				<PageHeader title="" />
				<Outlet />
				
				{/* Persistent AI Chat Button */}
				<div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-800 bg-black p-3">
					<div className="grid grid-cols-3 gap-2">
						{/* First two slots can be empty or used for other global actions */}
						<div />
						<div />
						
						{/* AI Chat Button - always in the third position */}
						<AIChatButton />
					</div>
				</div>
			</CurrentProjectProvider>
		</AuthProvider>
	)
}
