import { createContext } from "react-router";
import type { AccountSettings, Database, SupabaseClient, UserSettings } from "~/types"; // Use merged/override types

export type UserMetadata = {
	avatar_url?: string | null;
	email?: string | null;
	name?: string | null;
};

export type UserAccount = {
	account_id: string;
	name?: string | null;
	personal_account?: boolean | null;
	account_role?: string | null;
	is_primary_owner?: boolean | null;
	slug?: string | null;
	billing_enabled?: boolean | null;
	billing_status?: string | null;
};

export type AuthClaims = {
	sub: string;
	email?: string | null;
	user_metadata?: UserMetadata & Record<string, unknown>;
	app_metadata?: Record<string, unknown> | null;
	access_token?: string | null;
	jwt?: string | null;
	[key: string]: unknown;
};

export type UserContext = {
	claims: AuthClaims | null;
	account_id: string;
	user_metadata: UserMetadata;
	supabase: SupabaseClient<Database> | null;
	headers: Headers;
	authHeaders?: Headers; // Token refresh headers to include in response
	accountSettings?: AccountSettings;
	user_settings?: UserSettings;
	accounts?: UserAccount[];
	currentAccount?: UserAccount | null;
};

export const userContext = createContext<UserContext>({
	claims: null,
	account_id: "",
	user_metadata: {},
	supabase: null,
	headers: new Headers(),
	accountSettings: undefined,
	user_settings: undefined,
});

export function requireUserSupabase(ctx: UserContext): SupabaseClient {
	if (!ctx.supabase) {
		throw new Response("Database connection not available", { status: 500 });
	}

	return ctx.supabase as SupabaseClient;
}
