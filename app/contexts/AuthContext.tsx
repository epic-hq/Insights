import type { JwtPayload } from "@supabase/supabase-js";
import { createContext, useContext } from "react";
import { PATHS } from "~/paths";
import type { AccountSettings, UserSettings } from "~/types";

interface AuthContextType {
	user: JwtPayload | null;
	loading: boolean;
	signOut: () => Promise<void>;
	account_settings: AccountSettings | null;
	user_settings: UserSettings | null;
}

const AuthContext = createContext<AuthContextType>({
	user: null,
	loading: true,
	signOut: async () => {},
	account_settings: null,
	user_settings: null,
});

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
};

interface AuthProviderProps {
	children: React.ReactNode;
	user?: JwtPayload | null;
	organizations?: unknown;
	account_settings?: AccountSettings;
	user_settings?: UserSettings;
}

export function AuthProvider({ children, user, account_settings, user_settings }: AuthProviderProps) {
	const loading = false; // No loading needed with SSR data

	// Sign out function
	async function signOut() {
		await fetch("/auth/signout", { method: "POST" }); // server does the heavy lifting
		window.location.assign(PATHS.AUTH.LOGIN); // redirect to login page
	}

	const value = {
		user: user || null,
		loading,
		signOut,
		account_settings: account_settings || null,
		user_settings: user_settings || null,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
