import type { User } from "@supabase/supabase-js"
import { createContext, useContext } from "react"
import { PATHS } from "~/paths"

interface AuthContextType {
	user: User | null
	loading: boolean
	signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
	user: null,
	loading: true,
	signOut: async () => {},
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
	user?: User | null
}

export function AuthProvider({ children, user }: AuthProviderProps) {
	const loading = false // No loading needed with SSR data

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
	}

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
