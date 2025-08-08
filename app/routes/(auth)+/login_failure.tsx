import consola from "consola"
import { type LoaderFunctionArgs, redirect } from "react-router"

export async function loader({ request }: LoaderFunctionArgs) {
	consola.log("[LOGIN_FAILURE] No code or error occurred, redirecting to login_failure")
	setTimeout(() => {
		return redirect("/(auth)+/login")
	}, 3000)
}

// Default component for cases where loader doesn't redirect immediately
export default function LoginFailure() {
	return (
		<div className="flex h-screen items-center justify-center">
			<div className="text-center">
				<h2 className="font-semibold text-lg">Login failed...</h2>
				<p className="text-gray-600">Please try again.</p>
			</div>
		</div>
	)
}
