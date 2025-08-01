import type { JwtPayload, SupabaseClient } from "@supabase/supabase-js"
import { unstable_createContext } from "react-router"
import type { Database } from "supabase/types"

export type UserMetadata = { avatar_url?: string | null; email?: string | null; name?: string | null }
export type UserContext = {
	claims: JwtPayload
	account_id: string
	user_metadata: UserMetadata
	supabase: SupabaseClient<Database>
	headers: Headers
	current_project_id: string | null
}

export const userContext = unstable_createContext<UserContext>(undefined)
