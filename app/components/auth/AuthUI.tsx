import { Auth } from "@supabase/auth-ui-react"
import { ThemeSupa, type ThemeVariables } from "@supabase/auth-ui-shared"
import { createBrowserClient } from "@supabase/ssr"
import consola from "consola"

interface AuthUIProps {
	/** Absolute or relative URL to redirect after successful auth */
	redirectTo?: string
	/** Optional appearance overrides for Supabase Auth UI */
	appearance?: Parameters<typeof Auth>[0]["appearance"]
}

export function AuthUI({ redirectTo, appearance }: AuthUIProps) {
	// const { clientEnv } = useRouteLoaderData("root") as { clientEnv: Env }

	consola.log("redirectTo", redirectTo)

	const supabase = createBrowserClient(
		"https://rbginqvgkonnoktrttqv.supabase.co",
		"sb_publishable_Tkem8wKHHZSJqyZjMaLpCQ_S2io_bXY"
	)
	// sup_supabasegetSupabaseClient()
	if (!supabase) {
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
