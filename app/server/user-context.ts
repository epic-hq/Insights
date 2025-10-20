import type { JwtPayload, SupabaseClient } from "@supabase/supabase-js"
import { createContext } from "react-router"
import type { Database } from "supabase/types"
import type { AccountSettings, UserSettings } from "~/types"

export type UserMetadata = { avatar_url?: string | null; email?: string | null; name?: string | null }

export type UserAccount = {
	account_id: string
	name?: string | null
	personal_account?: boolean | null
}

export type UserContext = {
	claims: JwtPayload | null
	account_id: string
	user_metadata: UserMetadata
	supabase: SupabaseClient<Database> | null
	headers: Headers
	accountSettings?: AccountSettings
	user_settings?: UserSettings
	accounts?: UserAccount[]
}

export const userContext = createContext<UserContext>({
	claims: null,
	account_id: "",
	user_metadata: {},
	supabase: null,
	headers: new Headers(),
	accountSettings: undefined,
	user_settings: undefined,
})
