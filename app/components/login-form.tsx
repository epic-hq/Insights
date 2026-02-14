import { useState } from "react";
import { useSearchParams } from "react-router";
import { Button } from "~/components/ui/button";
import { createClient } from "~/lib/supabase/client";
import { cn } from "~/lib/utils";

export function LoginForm({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [searchParams] = useSearchParams();

	const handleSocialLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		const supabase = createClient();
		setIsLoading(true);
		setError(null);

		try {
			// Get the redirect URL from query params, fallback to /home
			const redirectUrl = searchParams.get("next") || searchParams.get("redirect") || "/home";

			const { error } = await supabase.auth.signInWithOAuth({
				provider: "google",
				options: {
					redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectUrl)}`,
				},
			});

			if (error) throw error;
		} catch (error: unknown) {
			setError(error instanceof Error ? error.message : "An error occurred");
			setIsLoading(false);
		}
	};

	return (
		<div className={cn("flex flex-col gap-6", className)} {...props}>
			<form onSubmit={handleSocialLogin}>
				<div className="flex flex-col gap-6">
					{error && <p className="text-destructive-500 text-sm">{error}</p>}
					<Button
						type="submit"
						className="w-full hover:bg-transparent hover:opacity-80"
						variant="ghost"
						disabled={isLoading}
					>
						{isLoading ? "Logging in..." : <img src="/images/auth/web_light_sq_SI@2x.png" className="h-10" alt="" />}
					</Button>
				</div>
			</form>
		</div>
	);
}
