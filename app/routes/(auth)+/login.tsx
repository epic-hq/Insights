import consola from "consola"
import { AuthUI } from "~/components/auth/AuthUI"
import { PATHS } from "~/paths"

export default function AuthPage() {
	consola.debug(`redirectTo: ${PATHS.AUTH.HOST}${PATHS.AUTH.CALLBACK}`)
	return (
		<div className="flex min-h-screen justify-center bg-gray-50 pt-[15vh]">
			<div className="w-full max-w-md p-8">
				<div className="mb-8 text-center">
					<h1 className="font-bold text-2xl text-gray-900">Upsight</h1>
					<p className="mt-2 text-gray-600">Key insights for better outcomes</p>
				</div>
				<AuthUI redirectTo={`${PATHS.AUTH.HOST}${PATHS.AUTH.CALLBACK}`} />
				<div className="flex justify-center py-12 text-gray-400 text-xs">
					redirectTo: {PATHS.AUTH.HOST}
					{PATHS.AUTH.CALLBACK}
				</div>
			</div>
		</div>
	)
}
