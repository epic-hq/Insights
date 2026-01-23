import { Link, useSearchParams } from "react-router"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card"

/**
 * User-friendly error messages for common auth error codes
 */
function getErrorContent(code: string | null, description: string | null) {
	switch (code) {
		case "otp_expired":
			return {
				title: "Link Expired",
				message: "This password reset link has expired. Reset links are only valid for a limited time.",
				action: {
					label: "Request New Link",
					href: "/forgot-password",
				},
			}

		case "otp_disabled":
		case "validation_failed":
			return {
				title: "Invalid Link",
				message: "This link is invalid or has already been used. Each reset link can only be used once.",
				action: {
					label: "Request New Link",
					href: "/forgot-password",
				},
			}

		case "user_not_found":
			return {
				title: "Account Not Found",
				message: "We couldn't find an account with that email address. Please check your email and try again.",
				action: {
					label: "Try Again",
					href: "/forgot-password",
				},
			}

		case "oauth_user":
			return {
				title: "Sign In With Google",
				message:
					"Your account uses Google sign-in. You don't need a password - just click the Google button to sign in.",
				action: {
					label: "Sign In",
					href: "/sign-in",
				},
			}

		default:
			// Check description for OAuth-related errors
			if (description?.toLowerCase().includes("oauth") || description?.toLowerCase().includes("google")) {
				return {
					title: "Sign In With Google",
					message:
						"Your account uses Google sign-in. You don't need a password - just click the Google button to sign in.",
					action: {
						label: "Sign In",
						href: "/sign-in",
					},
				}
			}

			return {
				title: "Something Went Wrong",
				message: description || "We encountered an error processing your request. Please try again.",
				action: {
					label: "Go to Sign In",
					href: "/sign-in",
				},
			}
	}
}

export default function AuthErrorPage() {
	const [searchParams] = useSearchParams()
	const code = searchParams.get("code")
	const description = searchParams.get("description")

	const content = getErrorContent(code, description)

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-sm">
				<Card>
					<CardHeader>
						<CardTitle className="text-xl">{content.title}</CardTitle>
						<CardDescription>{content.message}</CardDescription>
					</CardHeader>
					<CardContent>{code && <p className="text-muted-foreground text-xs">Error code: {code}</p>}</CardContent>
					<CardFooter className="flex gap-2">
						<Button asChild>
							<Link to={content.action.href}>{content.action.label}</Link>
						</Button>
						<Button variant="outline" asChild>
							<Link to="/">Go Home</Link>
						</Button>
					</CardFooter>
				</Card>
			</div>
		</div>
	)
}
