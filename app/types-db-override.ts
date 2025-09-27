import type { Database as SupabaseDB } from "~/../supabase/types"
import { MergeDeep } from 'type-fest'
import type { GetAccountsResponse } from "./types-accounts"


export type Database = MergeDeep<
	SupabaseDB,
	{
		public: {
			Functions: {
				// Override the return types of functions for stricter types
				get_accounts: {
					Returns: GetAccountsResponse
				}
			}
		}
	}
>