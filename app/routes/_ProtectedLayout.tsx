import consola from "consola"
import posthog from "posthog-js"
import { useEffect } from "react"
import { redirect, useLoaderData, useLocation, useNavigation, useParams, useRouteLoaderData } from "react-router"
import { AppLayout } from "~/components/layout/AppLayout"
import { AuthProvider } from "~/contexts/AuthContext"
import { CurrentProjectProvider } from "~/contexts/current-project-context"
import { getProjects } from "~/features/projects/db"
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

			// Set user context for all child loaders/actions to access
			context.set(userContext, {
				claims: user,
				account_id: currentAccount.account_id, // Use team account, not user.sub
				user_metadata: user.user_metadata,
				supabase,
				headers: request.headers,
				user_settings: user_settings || {},
				accounts: accounts || [],
				currentAccount,
			})
			// consola.log("_ProtectedLayout Authentication middleware success\n")

			// Check if signup process is completed
			const signupCompleted = user_settings?.signup_data?.completed === true
			const signupChatRequired = process.env.SIGNUP_CHAT_REQUIRED === "true"
			if (signupChatRequired && !signupCompleted) {
				consola.log("Signup not completed. Redirecting to signup-chat.", { signupCompleted, signupChatRequired })
				throw redirect("/signup-chat")
			}

			// Check if user has any projects, if not redirect to onboarding
			const projectsResult = await getProjects({
				supabase,
				accountId: currentAccount.account_id,
			})

			const userProjects = projectsResult.data || []
			if (userProjects.length === 0) {
				// Check current path to avoid redirect loops
				const url = new URL(request.url)
				const pathname = url.pathname

				// Don't redirect if already in onboarding or project creation
				if (!pathname.includes("/projects/new") && !pathname.includes("onboarding=true")) {
					consola.log("No projects found. SKIPPING: Redirecting to project creation with onboarding. going /home")
					// throw redirect("/projects/new?onboarding=true")
					// throw redirect("/home")
				}
			}

			consola.log("User authenticated and has projects.")
			// Continue without redirect for normal flow
		} catch (error) {
			// Preserve intended redirects thrown above (e.g., to /signup-chat)
			if (error instanceof Response) {
				throw error
			}
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
			user_settings: user.user_settings || {},
		}
	} catch (error) {
		consola.error("Protected layout loader error:", error)
		throw redirect("/login")
	}
}

export default function ProtectedLayout() {
	const { auth, accounts, user_settings } = useLoaderData<typeof loader>()
	const { clientEnv } = useRouteLoaderData("root")
	const _params = useParams()
	const navigation = useNavigation()
	const location = useLocation()

	const isLoading = navigation.state === "loading"

	// Don't show JourneyNav on home route, project creation, and realtime routes
	const isHomePage = location.pathname === "/home"
	const isProjectNew = location.pathname.includes("/projects/new")
	const isRealtimePage = location.pathname.includes("/realtime")
	const showJourneyNav = !isHomePage && !isProjectNew && !isRealtimePage

	useEffect(() => {
		// Identify user with person properties
		// Only set properties that are explicitly set by the user
		const identifyProps: Record<string, unknown> = {
			email: auth.user.email,
			full_name: auth.user.user_metadata?.full_name,
		}

		// Only add role and company if they exist in user_settings
		if (user_settings?.role) {
			identifyProps.role = user_settings.role
		}
		if (user_settings?.company_name) {
			identifyProps.company_name = user_settings.company_name
		}

		posthog.identify(auth.user.sub, identifyProps)

		// Set group analytics for account-level tracking
		if (auth.accountId) {
			posthog.group("account", auth.accountId, {
				plan: "free", // TODO: Get actual plan from account settings
				seats: accounts?.length || 1,
			})
		}
		// consola.log("[protectedLayout] Identify user: ", auth.user)
	}, [auth.user, auth.accountId, user_settings, accounts])

	return (
		<AuthProvider user={auth.user} organizations={accounts} user_settings={user_settings}>
			<CurrentProjectProvider>
				<div className="min-h-screen bg-background">
					{/* Global Loading Indicator */}
					{isLoading && (
						<div className="fixed top-0 right-0 left-0 z-50 h-1 bg-gray-200">
							<div className="h-full animate-pulse bg-blue-600" style={{ width: "30%" }}>
								<div className="h-full animate-[loading_2s_ease-in-out_infinite] bg-gradient-to-r from-blue-600 to-blue-400" />
							</div>
						</div>
					)}

					<AppLayout showJourneyNav={showJourneyNav} />
				</div>
			</CurrentProjectProvider>
		</AuthProvider>
	)
}
