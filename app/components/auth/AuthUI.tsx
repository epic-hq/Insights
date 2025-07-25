import { Auth } from "@supabase/auth-ui-react"
import { ThemeSupa, type ThemeVariables } from "@supabase/auth-ui-shared"
import consola from "consola"
import { getSupabaseClient } from "~/lib/supabase/client"

interface AuthUIProps {
	/** Absolute or relative URL to redirect after successful auth */
	redirectTo?: string
	/** Optional appearance overrides for Supabase Auth UI */
	appearance?: Parameters<typeof Auth>[0]["appearance"]
}

export function AuthUI({ redirectTo, appearance }: AuthUIProps) {
	// const { clientEnv } = useRouteLoaderData("root") as { clientEnv: Env }
	// const supabase = createClient(clientEnv.SUPABASE_URL, clientEnv.SUPABASE_ANON_KEY)

	consola.log("redirectTo", redirectTo)
	let supabase: ReturnType<typeof getSupabaseClient> | undefined
	try {
		supabase = getSupabaseClient()
	} catch {
		return (
			<div className="rounded-md border border-red-200 bg-red-50 p-4">
				<p className="text-red-800 text-sm">Authentication unavailable. Please check your Supabase configuration.</p>
			</div>
		)
	}

	return (
		<Auth
			supabaseClient={supabase}
			appearance={{
				// --- high‑contrast palette
				theme: ThemeSupa,
				variables: {
					default: {
						colors: {
							brand: "#2563EB", // blue‑600
							brandAccent: "#1D4ED8", // blue‑700 (hover)
							brandButtonText: "#FFFFFF", // keep text white
						},
					} as ThemeVariables,
				},
				// --- tighten Tailwind classes
				className: {
					button:
						"bg-primary-600 hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-400 text-white font-semibold rounded-md transition-colors",
					anchor: "text-primary-600 hover:text-primary-700",
					input: "rounded-md border-gray-300 focus:border-primary-600 focus:ring-primary-600",
					label: "text-gray-700 font-medium",
				},
				...appearance,
			}}
			providers={["google"]}
			redirectTo={redirectTo}
		/>
	)
}
