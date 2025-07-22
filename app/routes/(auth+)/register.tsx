import { AuthUI } from "~/components/auth/AuthUI"

export default function AuthPage() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-gray-50">
			<div className="w-full max-w-md p-8">
				<div className="mb-8 text-center">
					<h1 className="font-bold text-2xl text-gray-900">Get your free Insights Now</h1>
					<p className="mt-2 text-gray-600">Sign up to access your dashboard</p>
				</div>
				<AuthUI />
			</div>
		</div>
	)
}
