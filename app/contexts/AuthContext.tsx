import type { JwtPayload } from "@supabase/supabase-js"
import consola from "consola"
import { createContext, useContext, useMemo } from "react"
import { useParams } from "react-router"
import { PATHS } from "~/paths"
import type { AccountSettings, UserSettings } from "~/types"

interface AuthContextType {
	user: JwtPayload | null
	loading: boolean
	signOut: () => Promise<void>
	accountId: string
	projectId: string
	account_settings: AccountSettings | null
	user_settings: UserSettings | null
}

const AuthContext = createContext<AuthContextType>({
	user: null,
	loading: true,
	signOut: async () => {},
	accountId: "",
	projectId: "",
	account_settings: null,
	user_settings: null,
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
	organizations?: unknown
	account_settings?: AccountSettings
	user_settings?: UserSettings
}

export function AuthProvider({ children, user, account_settings, user_settings }: AuthProviderProps) {
	const loading = false // No loading needed with SSR data

	const params = useParams()

	// Get accountId from organizations prop (top account) or fallback to URL params
	const accountId = useMemo(() => {
		// Fallback to URL params
		if (params.accountId) {
			return params.accountId
		}
		consola.error("No accountId available from organizations prop or URL params")
		return ""
	}, [params.accountId])

	// Get projectId from top account's first project or fallback to URL params
	const projectId = useMemo(() => {
		// Fallback to URL params
		if (params.projectId) {
			return params.projectId
		}
		return ""
	}, [params.projectId])

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
		account_settings,
		user_settings,
	}

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
