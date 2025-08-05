import type { JwtPayload } from "@supabase/supabase-js"
import consola from "consola"
import { createContext, useContext, useMemo } from "react"
import { useParams } from "react-router"
import { PATHS } from "~/paths"
import type { AccountSettings } from "~/types"

interface AuthContextType {
	user: JwtPayload | null
	loading: boolean
	signOut: () => Promise<void>
	accountId: string
	projectId: string
	account_settings: AccountSettings | null
}

const AuthContext = createContext<AuthContextType>({
	user: null,
	loading: true,
	signOut: async () => {},
	accountId: "",
	projectId: "",
	account_settings: null,
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
	account_settings?: AccountSettings
}

export function AuthProvider({ children, user, organizations, account_settings }: AuthProviderProps) {
	const loading = false // No loading needed with SSR data

	const params = useParams()

	// Get accountId from organizations prop (top account) or fallback to URL params
	const accountId = useMemo(() => {
		// First try to get from organizations prop (top account)
		if (organizations?.[0]?.account_id) {
			return organizations[0].account_id
		}
		// Fallback to URL params
		if (params.accountId) {
			return params.accountId
		}
		consola.error("No accountId available from organizations prop or URL params")
		return ""
	}, [organizations, params.accountId])

	// Get projectId from top account's first project or fallback to URL params
	const projectId = useMemo(() => {
		// First try to get from organizations prop (first project of top account)
		if (organizations?.[0]?.projects?.[0]?.id) {
			return organizations[0].projects[0].id
		}
		// Fallback to URL params
		if (params.projectId) {
			return params.projectId
		}
		return ""
	}, [organizations, params.projectId])

	// Sign out function
	async function signOut() {
		await fetch("/auth/signout", { method: "POST" }) // server does the heavy lifting
		window.location.assign(PATHS.AUTH.LOGIN) // redirect to login page
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
		accountId,
		projectId,
		organizations,
		account_settings,
	}

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
