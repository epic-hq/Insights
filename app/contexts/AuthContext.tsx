import type { Session, User } from "@supabase/supabase-js"
import { createContext, useContext, useEffect, useState } from "react"
import { createClient } from "~/lib/supabase/client"

interface AuthContextType {
	session: Session | null
	user: User | null
	loading: boolean
}

const AuthContext = createContext<AuthContextType>({
	session: null,
	user: null,
	loading: true,
})

export const useAuth = () => {
	const context = useContext(AuthContext)
	if (!context) {
		throw new Error("useAuth must be used within an AuthProvider")
	}
	return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [session, setSession] = useState<Session | null>(null)
	const [loading, setLoading] = useState(true)
	const supabase = createClient()

	useEffect(() => {
		// Skip auth setup if no client (SSR)
		if (!supabase) {
			setLoading(false)
			return
		}

		// Get initial session
		supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
			setSession(session)
			setLoading(false)
		})

		// Listen for auth changes
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
			setSession(session)
			setLoading(false)
		})

		return () => subscription.unsubscribe()
	}, [supabase])

	const value = {
		session,
		user: session?.user ?? null,
		loading,
	}

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
