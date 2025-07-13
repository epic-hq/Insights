import { createClient } from "@supabase/supabase-js"
import type { Database } from "../../supabase/types"

// On the server we use the service role *anon* key for local dev.
// env already contains SUPABASE_URL and SUPABASE_ANON_KEY when running `supabase start`.
// For production you would inject secrets differently.

const supabaseUrl = process.env.SUPABASE_URL || "http://127.0.0.1:54321"
const supabaseKey = process.env.SUPABASE_ANON_KEY ?? ""

export const db = createClient<Database>(supabaseUrl, supabaseKey, {
	auth: {
		persistSession: false,
	},
})
