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
					redirectTo: `${window.location.origin}/auth/oauth?next=/home`,
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

			<form onSubmit={handleSocialLogin}>
				<div className="flex flex-col gap-6">
					{error && <p className="text-destructive-500 text-sm">{error}</p>}
					<Button type="submit" className="w-full" variant="ghost" disabled={isLoading}>
						{isLoading ? "Logging in..." : <img src="/images/auth/web_light_sq_SI@2x.png" className="h-10" alt="" />}
					</Button>
				</div>
			</form>

		</div>
	)
}
