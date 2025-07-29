import { redirect } from "react-router"
import type { LoaderFunctionArgs } from "react-router"

export async function loader({ request }: LoaderFunctionArgs) {
	// Handle auth code redirect from Supabase (fallback for misconfigured redirect URLs)
	const url = new URL(request.url)
	const code = url.searchParams.get("code")
	
	if (code) {
		// Redirect to callback route with the code
		return redirect(`/auth/callback?code=${code}`)
	}

	// For authenticated users hitting the root path, redirect to dashboard
	return redirect("/dashboard")
}

// This route should never render since it always redirects
export default function Root() {
	return null
}
