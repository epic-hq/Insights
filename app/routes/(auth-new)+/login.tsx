import { type LoaderFunctionArgs, redirect } from "react-router"
import { LoginForm } from "~/components/login-form"

export async function loader({ request }: LoaderFunctionArgs) {
	const { getAuthenticatedUser } = await import("~/lib/supabase/client.server")
	const user = await getAuthenticatedUser(request)
	if (user) {
		throw redirect("/home")
	}
}

export default function Page() {
	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-sm">
				<LoginForm />
			</div>
		</div>
	)
}
