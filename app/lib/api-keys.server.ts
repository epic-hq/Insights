/**
 * API Key management for MCP server authentication.
 *
 * Key format: upsk_<32 hex chars> (64 chars total including prefix)
 * Storage: Only the SHA-256 hash is persisted; the raw key is shown once at creation.
 *
 * Used by:
 *  - MCP stdio server: resolves UPSIGHT_API_KEY env var at startup
 *  - MCP HTTP server (future): resolves Authorization: Bearer header per-request
 *  - Project settings UI: generate, list, revoke keys
 */

import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";

/**
 * The `project_api_keys` table is defined in `supabase/schemas/50_api_keys.sql`
 * but has not yet been included in the generated `database.types.ts`.
 * Until `pnpm db:types` is re-run against a database with this table,
 * we type the Supabase client loosely for api-key operations only.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiKeyRecord {
	id: string;
	account_id: string;
	project_id: string;
	name: string;
	key_prefix: string;
	scopes: string[];
	last_used_at: string | null;
	expires_at: string | null;
	created_at: string;
	created_by: string | null;
	revoked_at: string | null;
}

export interface GeneratedApiKey {
	/** The full key — returned exactly once at creation time */
	rawKey: string;
	/** The record persisted in the database */
	record: ApiKeyRecord;
}

export interface ResolvedApiKey {
	accountId: string;
	projectId: string;
	scopes: string[];
	keyId: string;
}

// ---------------------------------------------------------------------------
// Key generation & hashing
// ---------------------------------------------------------------------------

const KEY_PREFIX = "upsk_";

/** Generate a new raw API key: upsk_<32 hex chars> */
export function generateRawApiKey(): string {
	return `${KEY_PREFIX}${randomBytes(32).toString("hex")}`;
}

/** SHA-256 hash a raw key for storage/lookup */
export function hashApiKey(rawKey: string): string {
	return createHash("sha256").update(rawKey).digest("hex");
}

/** Extract display prefix: "upsk_a1b2c3d4" (first 8 chars after prefix) */
export function keyDisplayPrefix(rawKey: string): string {
	return rawKey.slice(0, KEY_PREFIX.length + 8);
}

// ---------------------------------------------------------------------------
// Database operations
// ---------------------------------------------------------------------------

/** Create a new API key for a project. Returns the raw key (show-once). */
export async function createApiKey(
	supabase: AnySupabaseClient,
	opts: {
		accountId: string;
		projectId: string;
		name: string;
		scopes?: string[];
		createdBy?: string | null;
		expiresAt?: string | null;
	}
): Promise<GeneratedApiKey> {
	const rawKey = generateRawApiKey();
	const keyHash = hashApiKey(rawKey);
	const prefix = keyDisplayPrefix(rawKey);

	const { data, error } = await supabase
		.from("project_api_keys")
		.insert({
			account_id: opts.accountId,
			project_id: opts.projectId,
			name: opts.name,
			key_prefix: prefix,
			key_hash: keyHash,
			scopes: opts.scopes ?? ["read"],
			created_by: opts.createdBy ?? null,
			expires_at: opts.expiresAt ?? null,
		})
		.select()
		.single();

	if (error || !data) {
		consola.error("[api-keys] Failed to create API key", error);
		throw new Error(`Failed to create API key: ${error?.message ?? "unknown"}`);
	}

	return { rawKey, record: data as ApiKeyRecord };
}

/** Resolve a raw API key to its project/account context. Returns null if invalid/revoked/expired. */
export async function resolveApiKey(supabase: AnySupabaseClient, rawKey: string): Promise<ResolvedApiKey | null> {
	if (!rawKey || !rawKey.startsWith(KEY_PREFIX)) {
		return null;
	}

	const keyHash = hashApiKey(rawKey);

	const { data, error } = await supabase
		.from("project_api_keys")
		.select("id, account_id, project_id, scopes, expires_at")
		.eq("key_hash", keyHash)
		.is("revoked_at", null)
		.single();

	if (error || !data) {
		consola.warn("[api-keys] API key lookup failed", { error: error?.message });
		return null;
	}

	// Check expiration
	if (data.expires_at && new Date(data.expires_at) < new Date()) {
		consola.warn("[api-keys] API key expired", { keyId: data.id });
		return null;
	}

	// Update last_used_at (fire-and-forget, don't block resolution)
	supabase
		.from("project_api_keys")
		.update({ last_used_at: new Date().toISOString() })
		.eq("id", data.id)
		.then(({ error: updateError }) => {
			if (updateError) {
				consola.warn("[api-keys] Failed to update last_used_at", updateError);
			}
		});

	return {
		accountId: data.account_id,
		projectId: data.project_id,
		scopes: (data.scopes as string[]) ?? ["read"],
		keyId: data.id,
	};
}

/** List active (non-revoked) API keys for a project. Never returns the hash. */
export async function listApiKeys(supabase: AnySupabaseClient, projectId: string): Promise<ApiKeyRecord[]> {
	const { data, error } = await supabase
		.from("project_api_keys")
		.select(
			"id, account_id, project_id, name, key_prefix, scopes, last_used_at, expires_at, created_at, created_by, revoked_at"
		)
		.eq("project_id", projectId)
		.is("revoked_at", null)
		.order("created_at", { ascending: false });

	if (error) {
		consola.error("[api-keys] Failed to list API keys", error);
		throw new Error(`Failed to list API keys: ${error.message}`);
	}

	return (data ?? []) as ApiKeyRecord[];
}

/** Soft-revoke an API key. */
export async function revokeApiKey(supabase: AnySupabaseClient, keyId: string, projectId: string): Promise<void> {
	const { error } = await supabase
		.from("project_api_keys")
		.update({ revoked_at: new Date().toISOString() })
		.eq("id", keyId)
		.eq("project_id", projectId);

	if (error) {
		consola.error("[api-keys] Failed to revoke API key", error);
		throw new Error(`Failed to revoke API key: ${error.message}`);
	}
}
