import type { User } from "@supabase/supabase-js"
import consola from "consola"
import { createContext, useContext } from "react"

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
	signOut?: () => Promise<void>
}

export function AuthProvider({ children, user, signOut }: AuthProviderProps) {
	consola.log("AuthProvider user:", user)
	const loading = false // No loading needed with SSR data

	// Sign out function
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
