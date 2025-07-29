import { AuthUI } from "~/components/auth/AuthUI"
import { PATHS } from "~/paths"

export default function AuthPage() {
	return (
		<div className="flex min-h-screen justify-center bg-gray-50 pt-[15vh]">
			<div className="w-full max-w-md p-8">
				<div className="mb-8 text-center">
					<h1 className="font-bold text-2xl text-gray-900">Welcome to Insights</h1>
					<p className="mt-2 text-gray-600">Sign in to access your dashboard</p>
				</div>
				<AuthUI redirectTo={PATHS.AUTH.CALLBACK} />
			</div>
		</div>
	)
}
