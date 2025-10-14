import consola from "consola"
import { useEffect } from "react"
import { type ActionFunctionArgs, Link, redirect, useFetcher } from "react-router"
import { LoginForm } from "~/components/login-form"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/server"
import { PATHS } from "~/paths"
import { extractUtmParamsFromSearch, hasUtmParams, mergeUtmParams, UTM_COOKIE_NAME, type UtmParams } from "~/utils/utm"

export const action = async ({ request }: ActionFunctionArgs) => {
	const { client: supabase, headers } = getServerClient(request)

	const formData = await request.formData()

	const email = formData.get("email") as string
	const password = formData.get("password") as string

	const { error } = await supabase.auth.signInWithPassword({
		email,
		password,
	})

	if (error) {
		return {
			error: error instanceof Error ? error.message : "An error occurred",
		}
	}

	// Update this route to redirect to an authenticated route. The user already has an active session.
	return redirect("/login_success", { headers })
}

export default function Login() {
	const fetcher = useFetcher<typeof action>()

	const error = fetcher.data?.error
	const loading = fetcher.state === "submitting"

	// Persist incoming UTM params so they survive Supabase redirects
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
			consola.warn("[AUTH] Failed to persist UTM params", error)
		}
	}, [])

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-sm">
				<div className="flex flex-col gap-6">
					<Card>
						<CardHeader>
							<CardTitle className="mb-6 text-2xl">Login</CardTitle>
							{/* <CardDescription>Enter your email below to login to your account</CardDescription> */}
						</CardHeader>
						<CardContent className="space-y-8">
							<LoginForm />
							<fetcher.Form method="post">
								<div className="flex flex-col gap-6">
									<div className="grid gap-2">
										<Label htmlFor="email">Email</Label>
										<Input id="email" name="email" type="email" placeholder="m@example.com" required />
									</div>
									<div className="grid gap-2">
										<div className="flex items-center">
											<Label htmlFor="password">Password</Label>
											<Link
												to="/forgot-password"
												className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
											>
												Forgot your password?
											</Link>
										</div>
										<Input id="password" type="password" name="password" required />
									</div>
									{error && <p className="text-red-500 text-sm">{error}</p>}
									<Button type="submit" className="w-full" disabled={loading}>
										{loading ? "Logging in..." : "Login"}
									</Button>
								</div>
								<div className="mt-4 text-center text-sm">
									Don&apos;t have an account?{" "}
									<Link to="/sign-up" className="underline underline-offset-4">
										Sign up
									</Link>
								</div>
							</fetcher.Form>
						</CardContent>
					</Card>
				</div>
				{/* Footer */}
				<div className="mt-8 text-center text-slate-500 text-xs dark:text-slate-400">
					<p>By signing in, you agree to our Terms of Service and Privacy Policy.</p>
				</div>
			</div>
		</div>
	)
}
