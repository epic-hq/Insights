import type { JwtPayload, SupabaseClient } from "@supabase/supabase-js"
import { unstable_createContext } from "react-router"
import type { Database } from "supabase/types"
import type { AccountSettings, UserSettings } from "~/types"

export type UserMetadata = { avatar_url?: string | null; email?: string | null; name?: string | null }
export type UserContext = {
	claims: JwtPayload
	account_id: string
	user_metadata: UserMetadata
	supabase: SupabaseClient<Database>
	headers: Headers
	accountSettings?: AccountSettings
	user_settings?: UserSettings
}

export const userContext = unstable_createContext<UserContext>(undefined)
