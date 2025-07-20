import { Auth } from "@supabase/auth-ui-react"
import { ThemeSupa, type ThemeVariables } from "@supabase/auth-ui-shared"
import { createClient } from "~/lib/supabase/client"

interface AuthUIProps {
	redirectTo?: string
	appearance?: {
		theme?: typeof ThemeSupa
		variables?: {
			default?: ThemeVariables
		}
	}
}

export function AuthUI({ redirectTo, appearance }: AuthUIProps) {
	const supabase = createClient()

	// Don't render if no client available (SSR or missing env vars)
	if (!supabase) {
		return (
			<div className="rounded-md border border-red-200 bg-red-50 p-4">
				<p className="text-red-800 text-sm">Authentication unavailable. Please check your configuration.</p>
			</div>
		)
	}

	return (
		<Auth
			supabaseClient={supabase}
			appearance={{
				theme: ThemeSupa,
				variables: {
					default: {
						colors: {
							brand: "hsl(var(--primary))",
							brandAccent: "hsl(var(--primary))",
						},
					} as ThemeVariables,
				},
				...appearance,
			}}
			providers={[]}
			redirectTo={redirectTo}
		/>
	)
}
