import consola from "consola"
import { Outlet, redirect, useLoaderData, useMatches } from "react-router"
import MainNav from "~/components/navigation/MainNav"
import PageHeader from "~/components/navigation/PageHeader"
import { AuthProvider } from "~/contexts/AuthContext"
import { getSupabaseClient } from "~/lib/supabase/client"
import { getServerClient } from "~/lib/supabase/server"
import type { Route } from "../+types/root"

export async function loader({ context, request }: Route.LoaderArgs) {
	const { lang, clientEnv } = context
	// Get server-side authentication state
	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	const signOut = async () => {
		const supabase = getSupabaseClient()
		await supabase.auth.signOut()
	}

	if (!jwt?.claims) {
		return redirect("/login")
	}

	// Get user's accounts and projects using the new cloud function
	// This function is now deployed to the cloud instance with proper schema access
	const { data: accounts, error: accountsError } = await supabase.rpc("get_user_accounts")

	if (accountsError) {
		consola.error("Get user accounts error:", accountsError)
		throw new Response(accountsError.message, { status: 500 })
	}

	consola.log("Projects data:", accounts?.[0].projects)

	return {
		lang,
		clientEnv,
		auth: {
			user: jwt?.claims,
		},
		signOut,
		accounts,
	}
}

function _Breadcrumbs() {
	const matches = useMatches()
	const crumbs = matches
		// first get rid of any matches that don't have handle and crumb
		.filter((match) => Boolean(match.pathname))
		// now map them into an array of elements, passing the loader
		// data to each one
		.map((match) => (match.pathname as { crumb: (data: unknown) => React.ReactNode }).crumb(match.data))

	// consola.log("crumbs", crumbs, "matches: ", matches)

	return (
		<ol>
			{crumbs.map((crumb, index) => (
				<li key={index}>{crumb}</li>
			))}
		</ol>
	)
}

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
