import consola from "consola"
import { useEffect } from "react"
import { type LoaderFunctionArgs, redirect, useLocation } from "react-router"
import { AuthUI } from "~/components/auth/AuthUI"
import { getAuthenticatedUser } from "~/lib/supabase/client.server"
import { PATHS } from "~/paths"
import { extractUtmParamsFromSearch, hasUtmParams, mergeUtmParams, UTM_COOKIE_NAME, type UtmParams } from "~/utils/utm"

export async function loader({ request }: LoaderFunctionArgs) {
	const user = await getAuthenticatedUser(request)
	if (user) {
		throw redirect("/home")
	}
}

export default function AuthPage() {
	const location = useLocation()
	const params = new URLSearchParams(location.search)
	const next = params.get("next") || "/home"
	const redirectTo = `${PATHS.AUTH.HOST}${PATHS.AUTH.CALLBACK}?next=${encodeURIComponent(next)}`
	consola.log(`register redirectTo: ${redirectTo}`)

	useEffect(() => {
		const utmParams = extractUtmParamsFromSearch(location.search)
		if (!hasUtmParams(utmParams)) {
			return
		}

		try {
			const existingRaw = document.cookie
				.split("; ")
				.find((row) => row.startsWith(`${UTM_COOKIE_NAME}=`))
				?.split("=")[1]

			const existing = existingRaw ? (JSON.parse(decodeURIComponent(existingRaw)) as UtmParams) : {}
			const merged = mergeUtmParams(existing, utmParams)
			const cookieValue = encodeURIComponent(JSON.stringify(merged))
			const secure = window.location.protocol === "https:" ? "; Secure" : ""
			const oneWeekSeconds = 60 * 60 * 24 * 7

			document.cookie = `${UTM_COOKIE_NAME}=${cookieValue}; Path=/; Max-Age=${oneWeekSeconds}; SameSite=Lax${secure}`
		} catch (error) {
			consola.warn("[REGISTER] Failed to persist UTM params", error)
		}
	}, [location.search])

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
			<div className="container relative flex min-h-screen flex-col items-center justify-center">
				{/* Logo/Branding */}
				<div className="mb-8">
					<div className="flex items-center gap-3 font-bold text-3xl">
						<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 font-bold text-lg text-white shadow-lg">
							U
						</div>
						<span className="bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent dark:from-blue-400 dark:to-blue-300">
							UpSight
						</span>
					</div>
					<p className="mt-3 text-center text-slate-600 dark:text-slate-400">Key insights for better outcomes</p>
				</div>

				<div className="w-full max-w-md">
					{/* Main Auth Card */}
					<div className="rounded-2xl border-0 bg-white/80 p-8 shadow-2xl backdrop-blur-sm dark:bg-slate-900/80">
						<div className="mb-6 text-center">
							<p className="mt-2 text-slate-600 text-sm dark:text-slate-400">Start your journey with UpSight today</p>
						</div>

						<AuthUI redirectTo={redirectTo} view="sign_up" />
					</div>

					{/* Footer */}
					<div className="mt-8 text-center text-slate-500 text-xs dark:text-slate-400">
						<p>By creating an account, you agree to our Terms of Service and Privacy Policy.</p>
					</div>
				</div>
			</div>
		</div>
	)
}
