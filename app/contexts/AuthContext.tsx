import type { Session, User } from "@supabase/supabase-js"
import consola from "consola"
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
	let DEV_FAKE_AUTH = false
	if (typeof window !== "undefined") {
		DEV_FAKE_AUTH = window.env.DEV_FAKE_AUTH === "true"
	}

	consola.log("DEV_FAKE_AUTH", DEV_FAKE_AUTH)

	const [session, setSession] = useState<Session | null>(null)
	const [loading, setLoading] = useState(true)
	const supabase = createClient()

	useEffect(() => {
		if (DEV_FAKE_AUTH) {
			// Fake user and session for dev mode
			const fakeUser: User = {
				id: "dev-fake-user",
				app_metadata: { provider: "dev" },
				user_metadata: { email: "dev@local.test", name: "Dev User" },
				aud: "authenticated",
				created_at: new Date().toISOString(),
				email: "dev@local.test",
				phone: undefined,
				role: "authenticated",
				confirmed_at: new Date().toISOString(),
				last_sign_in_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				identities: [],
				// Add any other required User fields here
			}
			const fakeSession: Session = {
				access_token: "dev-fake-access-token",
				token_type: "bearer",
				expires_in: 3600,
				refresh_token: "dev-fake-refresh-token",
				user: fakeUser,
				expires_at: Math.floor(Date.now() / 1000) + 3600,
				provider_token: null,
				provider_refresh_token: null,
			}
			setSession(fakeSession)
			setLoading(false)
			return
		}

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
	}, [supabase, DEV_FAKE_AUTH])

	const value = {
		session,
		user: session?.user ?? null,
		loading,
	}

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
