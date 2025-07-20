import { useAuth } from "~/contexts/AuthContext"
import { AuthUI } from "./AuthUI"

interface AuthGuardProps {
	children: React.ReactNode
	fallback?: React.ReactNode
	redirectTo?: string
}

export function AuthGuard({ children, fallback, redirectTo }: AuthGuardProps) {
	const { session, loading } = useAuth()

	if (loading) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
			</div>
		)
	}

	if (!session) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-gray-50">
				<div className="w-full max-w-md p-8">
					<div className="mb-8 text-center">
						<h1 className="font-bold text-2xl text-gray-900">Welcome to Insights</h1>
						<p className="mt-2 text-gray-600">Sign in to access your dashboard</p>
					</div>
					{fallback || <AuthUI redirectTo={redirectTo} />}
				</div>
			</div>
		)
	}

	return <>{children}</>
}
