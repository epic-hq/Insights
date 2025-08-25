import { CopilotKit } from "@copilotkit/react-core"
import "@copilotkit/react-ui/styles.css"
import "~/styles/copilot-overrides.css"
import consola from "consola"
import { Outlet, useLoaderData, useRouteLoaderData, useParams, redirect } from "react-router"
import MainNav from "~/components/navigation/MainNav"
import PageHeader from "~/components/navigation/PageHeader"
import { AuthProvider } from "~/contexts/AuthContext"
import { CurrentProjectProvider } from "~/contexts/current-project-context"
import { getAuthenticatedUser, getRlsClient } from "~/lib/supabase/server"
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
			const supabase = jwt ? getRlsClient(jwt) : (await import("~/lib/supabase/server")).getServerClient(request).client

			// Get user's settings and accounts in parallel
			const [userSettingsResult, userAccountsResult] = await Promise.all([
				supabase.from("user_settings").select("*").eq("user_id", user.sub).single(),
				supabase.rpc("get_user_accounts"),
			])

			const { data: user_settings } = userSettingsResult
			const { data: accounts, error: accountsError } = userAccountsResult

			if (accountsError) {
				consola.error("Get user accounts error in middleware:", accountsError)
				throw redirect("/login")
			}

			// Determine current account: use last_used_account_id from user_settings, validate it's available
			let currentAccount = null
			if (user_settings?.last_used_account_id && Array.isArray(accounts)) {
				currentAccount = accounts.find((acc: any) => acc.account_id === user_settings.last_used_account_id)
			}

			// Fallback: first non-personal account, or first account if only personal
			if (!currentAccount && Array.isArray(accounts)) {
				currentAccount = accounts.find((acc: any) => !acc.personal_account) || accounts[0]
			}

			if (!currentAccount) {
				consola.error("No accounts found for user")
				throw redirect("/login")
			}

			// Get account settings using user's personal account (account_settings is per personal account, not team)
			// Note: This should eventually be migrated to user_settings for clarity
			const { data: accountSettings } = await supabase
				.from("account_settings")
				.select("*")
				.eq("account_id", user.sub)
				.maybeSingle()

			// Set user context for all child loaders/actions to access
			context.set(userContext, {
				claims: user,
				account_id: currentAccount.account_id, // Use team account, not user.sub
				user_metadata: user.user_metadata,
				supabase,
				headers: request.headers,
				user_settings: user_settings || {},
				accounts: accounts || [],
				accountSettings: accountSettings || {},
				currentAccount,
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

		return {
			lang,
			auth: {
				user: user.claims,
				accountId: user.account_id,
			},
			accounts: user.accounts || [],
			account_settings: user.accountSettings || {},
			user_settings: user.user_settings || {},
		}
	} catch (error) {
		consola.error("Protected layout loader error:", error)
		throw redirect("/login")
	}
}

export default function ProtectedLayout() {
	const { auth, accounts, account_settings, user_settings } = useLoaderData<typeof loader>()
	const { clientEnv } = useRouteLoaderData("root")
	const params = useParams()

	return (
		<AuthProvider
			user={auth.user}
			organizations={accounts}
			account_settings={account_settings}
			user_settings={user_settings}
		>
			<CurrentProjectProvider>
				<CopilotKit
					agent="mainAgent"
					runtimeUrl="/api/copilotkit"
					publicApiKey="ck_pub_ee4a155857823bf6b0a4f146c6c9a72f"
					showDevConsole={clientEnv?.NODE_ENV === "development"}
					headers={{
						"X-UserId": String(auth?.user?.sub ?? ""),
						"X-AccountId": String(params.accountId ?? auth?.accountId ?? ""),
						"X-ProjectId": String(params.projectId ?? ""),
					}}
				>
					<MainNav />
					<PageHeader title="" showBreadcrumbs={false} />
					<Outlet />

					{/* Persistent AI Chat Button */}
					<div className="fixed right-0 bottom-0 left-0 z-40 border-gray-800 border-t bg-black p-3">
						<div className="grid grid-cols-3 gap-2">
							{/* First two slots can be empty or used for other global actions */}
							<div />
							<div />

							{/* AI Chat Button - always in the third position */}
							{/* <AIChatButton /> */}
						</div>
					</div>
				</CopilotKit>
			</CurrentProjectProvider>
		</AuthProvider>
	)
}
