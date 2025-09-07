import consola from "consola"
import { AuthUI } from "~/components/auth/AuthUI"
import { PATHS } from "~/paths"

export default function AuthPage() {
    const redirectTo = `${PATHS.AUTH.HOST}${PATHS.AUTH.CALLBACK}`
    consola.debug(`login redirectTo (for OAuth only): ${redirectTo}`)
    return (
		<div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
			<div className="container relative flex min-h-screen flex-col items-center justify-center">
				{/* Logo/Branding */}
				<div className="mb-8">
					<div className="flex items-center gap-3 font-bold text-3xl">
						<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 font-bold text-lg text-white shadow-lg">
							U
						</div>
						<span className="bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent dark:from-blue-400 dark:to-blue-300">
							UpSight
						</span>
					</div>
					<p className="mt-3 text-center text-slate-600 dark:text-slate-400">Key insights for better outcomes</p>
				</div>

				<div className="w-full max-w-md">
					{/* Main Auth Card */}
					<div className="rounded-2xl border-0 bg-white/80 p-8 shadow-2xl backdrop-blur-sm dark:bg-slate-900/80">
						<div className="mb-6 text-center">
							<h1 className="font-bold text-2xl text-slate-900 dark:text-slate-100">Welcome back</h1>
							<p className="mt-2 text-slate-600 text-sm dark:text-slate-400">Sign in to your UpSight account</p>
						</div>

                        <AuthUI view="sign_in" redirectTo={redirectTo} />
                    </div>

					{/* Footer */}
					<div className="mt-8 text-center text-slate-500 text-xs dark:text-slate-400">
						<p>By signing in, you agree to our Terms of Service and Privacy Policy.</p>
					</div>
				</div>
			</div>
		</div>
	)
}
