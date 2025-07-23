import type { JwtPayload } from "@supabase/supabase-js"
import consola from "consola"
import { createContext, useContext, useMemo } from "react"
import { useParams, useRouteLoaderData } from "react-router"
import { PATHS } from "~/paths"

interface AuthContextType {
	user: JwtPayload | null
	loading: boolean
	signOut: () => Promise<void>
	orgId: string
	projectId: string
}

const AuthContext = createContext<AuthContextType>({
	user: null,
	loading: true,
	signOut: async () => {},
	orgId: "",
	projectId: "",
})

export const useAuth = () => {
	const context = useContext(AuthContext)
	if (!context) {
		throw new Error("useAuth must be used within an AuthProvider")
	}
	return context
}

interface AuthProviderProps {
	children: React.ReactNode
	user?: JwtPayload | null
	organizations?: any
}

export function AuthProvider({ children, user, organizations }: AuthProviderProps) {
	const _loaderData = useRouteLoaderData("_NavLayout")
	// send back orgs and proj
	// const { organizations } = loaderData

	const loading = false // No loading needed with SSR data

	const params = useParams()

	const orgId = useMemo(() => {
		if (!params.orgId) {
			consola.error("No orgId provided")
			// TODO: Get orgId from supabase
			return ""
		}
		return params.orgId
	}, [params.orgId])
	const projectId = useMemo(() => {
		if (!params.projectId) {
			return ""
		}
		return params.projectId
	}, [params.projectId])

	// Sign out function
	async function signOut() {
		await fetch("/auth/signout", { method: "POST" }) // server does the heavy lifting
		window.location.assign(PATHS.DASHBOARD) // ensures the UI resets
	}
	// const signOut = async () => {
	// 	const supabase = createClient()
	// 	await supabase.auth.signOut()
	// 	consola.log("after signOut")
	// 	// Redirect to dashboard after sign-out
	// 	window.location.assign(PATHS.DASHBOARD)
	// }

	const value = {
		user: user || null,
		loading,
		signOut,
		orgId,
		projectId,
		organizations,
	}

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
