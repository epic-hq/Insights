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
	const {
		data: { user },
	} = await supabase.auth.getUser()
	const _claims = await supabase.auth.getClaims()
	const signOut = async () => {
		const supabase = getSupabaseClient()
		await supabase.auth.signOut()
	}

	if (!user) {
		return redirect("/login")
	}

	return {
		lang,
		clientEnv,
		auth: {
			user,
		},
		signOut,
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
	const { auth } = useLoaderData<typeof loader>()
	// consola.log("AuthProvider  user:", auth.user)
	return (
		// <div className="mx-auto max-w-[1440px] pt-4">
		<AuthProvider user={auth.user}>
			<MainNav />
			<PageHeader title="" />
			<Outlet />
		</AuthProvider>
		// </div>
	)
}
