import consola from "consola";
import { useEffect } from "react";
import { type ActionFunctionArgs, Link, redirect, useFetcher, useSearchParams } from "react-router";
import { LogoBrand } from "~/components/branding";
import { LoginForm } from "~/components/login-form";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { getServerClient } from "~/lib/supabase/client.server";
import { extractUtmParamsFromSearch, hasUtmParams, mergeUtmParams, UTM_COOKIE_NAME, type UtmParams } from "~/utils/utm";

export const action = async ({ request }: ActionFunctionArgs) => {
	const { client: supabase, headers } = getServerClient(request);

	const formData = await request.formData();

	const email = formData.get("email") as string;
	const password = formData.get("password") as string;
	const redirectTo = formData.get("redirect") as string | null;

	const { error } = await supabase.auth.signInWithPassword({
		email,
		password,
	});

	if (error) {
		return {
			error: error instanceof Error ? error.message : "An error occurred",
		};
	}

	// Redirect to login_success with the original redirect destination
	const successUrl = redirectTo ? `/login_success?next=${encodeURIComponent(redirectTo)}` : "/login_success";
	return redirect(successUrl, { headers });
};

export default function Login() {
	const fetcher = useFetcher<typeof action>();
	const [searchParams] = useSearchParams();

	const error = fetcher.data?.error || searchParams.get("error");
	const loading = fetcher.state === "submitting";
	const redirectTo = searchParams.get("redirect");

	// Build sign-up URL with redirect param if present
	const signUpUrl = redirectTo ? `/sign-up?redirect=${encodeURIComponent(redirectTo)}` : "/sign-up";

	// Persist incoming UTM params so they survive Supabase redirects
	useEffect(() => {
		const utmParams = extractUtmParamsFromSearch(location.search);
		if (!hasUtmParams(utmParams)) {
			return;
		}

		try {
			const existingRaw = document.cookie
				.split("; ")
				.find((row) => row.startsWith(`${UTM_COOKIE_NAME}=`))
				?.split("=")[1];

			const existing = existingRaw ? (JSON.parse(decodeURIComponent(existingRaw)) as UtmParams) : {};
			const merged = mergeUtmParams(existing, utmParams);
			const cookieValue = encodeURIComponent(JSON.stringify(merged));
			const secure = window.location.protocol === "https:" ? "; Secure" : "";
			const oneWeekSeconds = 60 * 60 * 24 * 7;

			document.cookie = `${UTM_COOKIE_NAME}=${cookieValue}; Path=/; Max-Age=${oneWeekSeconds}; SameSite=Lax${secure}`;
		} catch (error) {
			consola.warn("[AUTH] Failed to persist UTM params", error);
		}
	}, []);

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-3xl">
				<Card className="overflow-hidden">
					<div className="grid md:grid-cols-2">
						{/* Left: Marketing */}
						<div className="hidden flex-col justify-between bg-gradient-to-br from-primary/5 via-transparent to-primary/10 p-8 md:flex">
							<Link to="/">
								<LogoBrand />
								<p className="mt-4 text-lg text-muted-foreground">Get more out of every conversation</p>
							</Link>
							<div className="mb-4 flex items-center gap-3">
								<div />
							</div>
							{/* <p className="mb-4 text-muted-foreground">
													Transform customer interviews into actionable insights with AI-powered analysis.
												</p> */}
							<ul className="space-y-3">
								<li className="flex items-start gap-3">
									<span className="mt-1 text-primary">✓</span>
									<span className="mt-1 text-primary/70">Extract themes and patterns automatically</span>
								</li>
								<li className="flex items-start gap-3">
									<span className="mt-1 text-primary">✓</span>
									<span className="mt-1 text-primary/70">Build personas from real feedback</span>
								</li>
								<li className="flex items-start gap-3">
									<span className="mt-1 text-primary">✓</span>
									<span className="mt-1 text-primary/70">Discover hidden opportunities</span>
								</li>
							</ul>
						</div>

						{/* Right: Login Form */}
						<div className="flex flex-col gap-6 p-8">
							<CardHeader className="ml-0 pl-0">
								<CardTitle className="text-center text-2xl">Login</CardTitle>
							</CardHeader>
							<CardContent className="space-y-8 p-0">
								<LoginForm />
								<fetcher.Form method="post">
									{redirectTo && <input type="hidden" name="redirect" value={redirectTo} />}
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
										<Link to={signUpUrl} className="underline underline-offset-4">
											Sign up
										</Link>
									</div>
								</fetcher.Form>
							</CardContent>
							<div className="text-center text-slate-500 text-xs dark:text-slate-400">
								<p>By signing in, you agree to our Terms of Service and Privacy Policy.</p>
							</div>
						</div>
					</div>
				</Card>
			</div>
		</div>
	);
}
