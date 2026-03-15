import type { Database } from "~/types";

// Repo-owned schemas are generated into the canonical Database type.
export type OwnedSchemaName = "public" | "accounts" | "billing" | "pgmq_public";

// Platform-managed or remote-only capabilities should stay behind wrappers.
export type PlatformSchemaName = "auth" | "storage" | "extensions" | "graphql_public" | "pgmq";

export type PgmqPublicDatabase = Pick<Database, "pgmq_public">;

export interface AuthUserReference {
	id: string;
	email?: string | null;
	phone?: string | null;
}

export interface StorageObjectReference {
	bucket: string;
	path: string;
}
