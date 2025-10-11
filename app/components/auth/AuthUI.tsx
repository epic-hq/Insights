import { Auth } from "@supabase/auth-ui-react"
import { ThemeSupa } from "@supabase/auth-ui-shared"
import consola from "consola"
import { useEffect, useRef } from "react"
import { useLocation, useNavigate } from "react-router"
import { getSupabaseClient } from "~/lib/supabase/client"

interface AuthUIProps {
	/** Absolute or relative URL to redirect after successful auth */
	redirectTo?: string
	/** Optional appearance overrides for Supabase Auth UI */
	appearance?: Parameters<typeof Auth>[0]["appearance"]
	/** Auth view - sign_in or sign_up */
	view?: "sign_in" | "sign_up"
}

export function AuthUI({ redirectTo, appearance, view = "sign_in" }: AuthUIProps) {
	// const { clientEnv } = useRouteLoaderData("root") as { clientEnv: Env }
	const navigate = useNavigate()
	const location = useLocation()
	const searchParams = new URLSearchParams(location.search)
	const next = searchParams.get("next") || "/home"
	const isLoginAttempt = useRef(false)

	consola.log("AuthUI props:", { redirectTo, view })

	const supabase = getSupabaseClient()
	if (!supabase) {
		return (
			<div className="rounded-md border border-red-200 bg-red-50 p-4">
				<p className="text-red-800 text-sm">Authentication unavailable. Please check your Supabase configuration.</p>
			</div>
		)
	}

	// Listen for auth state changes to handle successful login
	useEffect(() => {
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange(async (event, _session) => {
			consola.log("[AUTH STATE CHANGE]", event, "isLoginAttempt:", isLoginAttempt.current)

			// Only redirect on SIGNED_IN if we're actively attempting to login
			// This prevents auto-redirect when user lands on login page with existing session
			if (event === "SIGNED_IN" && isLoginAttempt.current) {
				try {
					// Post tokens to server to sync cookies, then navigate via login_success
					const { data: sessionData } = await supabase.auth.getSession()
					const access_token = sessionData.session?.access_token
					const refresh_token = sessionData.session?.refresh_token
					if (access_token && refresh_token) {
						await fetch(`/auth.session?next=${encodeURIComponent(next)}`, {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ access_token, refresh_token }),
						})
					}
					consola.log("[AUTH] Login successful, redirecting to login_success with next:", next)
					isLoginAttempt.current = false
					navigate(`/login_success?next=${encodeURIComponent(next)}`)
				} catch (err) {
					consola.error("[AUTH] Post-auth cookie sync failed:", err)
					isLoginAttempt.current = false
					navigate(next)
				}
			} else if (event === "SIGNED_OUT") {
				// Reset login attempt flag on sign out
				isLoginAttempt.current = false
			}
		})

		return () => {
			subscription.unsubscribe()
		}
	}, [supabase, navigate, next])
	// Handle clicks for both auth buttons and navigation links
	useEffect(() => {
		const handleClick = (e: MouseEvent) => {
			const target = e.target as HTMLElement
			const button = target.closest("button")
			const anchor = target.closest("a")

			// Handle auth button clicks (Sign in / Create account)
			if (button && button.type === "submit") {
				const buttonText = button.textContent
				if (buttonText && (buttonText.includes("Sign in") || buttonText.includes("Create account"))) {
					consola.log("[AUTH] User clicked auth button:", buttonText)
					isLoginAttempt.current = true
				}
			}

			// Handle navigation link clicks, preserving ?next=
			if (anchor?.textContent) {
				if (anchor.textContent.includes("Don't have an account") || anchor.textContent.includes("Sign up")) {
					e.preventDefault()
					navigate(`/register?next=${encodeURIComponent(next)}`)
				} else if (anchor.textContent.includes("Already have an account") || anchor.textContent.includes("Sign in")) {
					e.preventDefault()
					navigate(`/login?next=${encodeURIComponent(next)}`)
				}
			}
		}

		document.addEventListener("click", handleClick)
		return () => document.removeEventListener("click", handleClick)
	}, [navigate, next])
	return (
		<Auth
			supabaseClient={supabase}
			appearance={{
				theme: ThemeSupa,
				variables: {
					default: {
						colors: {
							brand: "#3B82F6", // blue-500
							brandAccent: "#2563EB", // blue-600 (hover)
							brandButtonText: "#FFFFFF",
							defaultButtonBackground: "#F8FAFC", // slate-50
							defaultButtonBackgroundHover: "#F1F5F9", // slate-100
							defaultButtonBorder: "#E2E8F0", // slate-200
							defaultButtonText: "#334155", // slate-700
							dividerBackground: "#E2E8F0", // slate-200
							inputBackground: "#FFFFFF",
							inputBorder: "#E2E8F0", // slate-200
							inputBorderHover: "#CBD5E1", // slate-300
							inputBorderFocus: "#3B82F6", // blue-500
							inputText: "#1E293B", // slate-800
							inputLabelText: "#475569", // slate-600
							inputPlaceholder: "#94A3B8", // slate-400
							messageText: "#DC2626", // red-600 for errors
							messageTextDanger: "#DC2626", // red-600
							anchorTextColor: "#3B82F6", // blue-500
							anchorTextHoverColor: "#2563EB", // blue-600
						},
						space: {
							spaceSmall: "8px",
							spaceMedium: "16px",
							spaceLarge: "24px",
							labelBottomMargin: "8px",
							anchorBottomMargin: "8px",
							emailInputSpacing: "4px",
							socialAuthSpacing: "12px",
							buttonPadding: "12px 16px",
							inputPadding: "12px 16px",
						},
						fontSizes: {
							baseBodySize: "14px",
							baseInputSize: "16px",
							baseLabelSize: "14px",
							baseButtonSize: "16px",
						},
						fonts: {
							bodyFontFamily: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`,
							buttonFontFamily: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`,
							inputFontFamily: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`,
							labelFontFamily: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`,
						},
						borderWidths: {
							buttonBorderWidth: "1px",
							inputBorderWidth: "1px",
						},
						radii: {
							borderRadiusButton: "8px",
							buttonBorderRadius: "8px",
							inputBorderRadius: "8px",
						},
					},
					// Dark mode support
					dark: {
						colors: {
							brand: "#3B82F6", // blue-500
							brandAccent: "#60A5FA", // blue-400 (hover in dark)
							brandButtonText: "#FFFFFF",
							defaultButtonBackground: "#1E293B", // slate-800
							defaultButtonBackgroundHover: "#334155", // slate-700
							defaultButtonBorder: "#475569", // slate-600
							defaultButtonText: "#F1F5F9", // slate-100
							dividerBackground: "#475569", // slate-600
							inputBackground: "#1E293B", // slate-800
							inputBorder: "#475569", // slate-600
							inputBorderHover: "#64748B", // slate-500
							inputBorderFocus: "#3B82F6", // blue-500
							inputText: "#F1F5F9", // slate-100
							inputLabelText: "#CBD5E1", // slate-300
							inputPlaceholder: "#64748B", // slate-500
							messageText: "#EF4444", // red-500 for errors
							messageTextDanger: "#EF4444", // red-500
							anchorTextColor: "#60A5FA", // blue-400
							anchorTextHoverColor: "#93C5FD", // blue-300
						},
					},
				},
				className: {
					container: "space-y-6",
					divider: "relative my-6",
					label: "block text-sm font-medium mb-2",
					input:
						"block w-full rounded-lg border px-4 py-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50",
					button:
						"flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
					anchor: "text-sm font-medium transition-colors underline-offset-4 hover:underline",
					message: "text-sm rounded-lg px-3 py-2 mt-2",
				},
				...appearance,
			}}
			providers={["google"]}
			{...(redirectTo ? { redirectTo } : {})}
			view={view}
			showLinks={true}
			localization={{
				variables: {
					sign_in: {
						email_label: "Email address",
						password_label: "Password",
						button_label: "Sign in",
						loading_button_label: "Signing in...",
						social_provider_text: "Sign in with {{provider}}",
						link_text: "Don't have an account? Sign up",
						email_input_placeholder: "Your email address",
						password_input_placeholder: "Your password",
					},
					sign_up: {
						email_label: "Email address",
						password_label: "Create password",
						button_label: "Create account",
						loading_button_label: "Creating account...",
						social_provider_text: "Sign up with {{provider}}",
						link_text: "Already have an account? Sign in",
						email_input_placeholder: "Your email address",
						password_input_placeholder: "Create a secure password",
					},
				},
			}}
		/>
	)
}
