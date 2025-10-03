import { useState } from "react"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { createClient } from "~/lib/supabase/client"
import { cn } from "~/lib/utils"

export function LoginForm({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
	const [error, setError] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(false)

	const handleSocialLogin = async (e: React.FormEvent) => {
		e.preventDefault()
		const supabase = createClient()
		setIsLoading(true)
		setError(null)

		try {
			const { error } = await supabase.auth.signInWithOAuth({
				provider: "google",
				options: {
					redirectTo: `${window.location.origin}/auth-new/oauth?next=/home`,
				},
			})

			if (error) throw error
		} catch (error: unknown) {
			setError(error instanceof Error ? error.message : "An error occurred")
			setIsLoading(false)
		}
	}

	return (
		<div className={cn("flex flex-col gap-6", className)} {...props}>
			<Card>
				<CardHeader>
					<CardTitle className="text-2xl">Welcome!</CardTitle>
					<CardDescription>Sign in to your account to continue</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSocialLogin}>
						<div className="flex flex-col gap-6">
							{error && <p className="text-destructive-500 text-sm">{error}</p>}
							<Button type="submit" className="w-full" disabled={isLoading}>
								{isLoading ? "Logging in..." : "Continue with Google"}
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	)
}
