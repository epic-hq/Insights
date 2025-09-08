import consola from "consola"
import { Link, type LoaderFunctionArgs, redirect } from "react-router"

export async function loader({ request }: LoaderFunctionArgs) {
	consola.log("[LOGIN_FAILURE] redirecting to /login")
	return redirect("/login")
}

// Default component for cases where loader doesn't redirect immediately
export default function LoginFailure() {
	return (
		<div className="flex h-screen items-center justify-center">
			<div className="text-center">
				<h2 className="font-semibold text-lg">Login failed...</h2>
				<p className="text-gray-600">Please try again.</p>
				<Link to={"/login"}>Login</Link>
			</div>
		</div>
	)
}
