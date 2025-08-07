import consola from "consola"
import { type LoaderFunctionArgs, redirect } from "react-router"

export async function loader({ request }: LoaderFunctionArgs) {
	const requestUrl = new URL(request.url)
	const next = requestUrl.searchParams.get("next") || "/home"

	consola.log("[LOGIN_SUCCESS] redirecting to home")
	return redirect(next)
}

// Default component for cases where loader doesn't redirect immediately
export default function LoginSuccess() {
	return (
		<div className="flex h-screen items-center justify-center">
			<div className="text-center">
				<h2 className="font-semibold text-lg">You're in!</h2>
				<p className="text-gray-600">You can now start using the app.</p>
			</div>
		</div>
	)
}
