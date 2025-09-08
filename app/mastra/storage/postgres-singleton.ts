import { PostgresStore } from "@mastra/pg"

// Global singleton to prevent duplicate database connections
let postgresStoreInstance: PostgresStore | null = null

export function getSharedPostgresStore(): PostgresStore {
	if (!postgresStoreInstance) {
		const connectionString = process.env.SUPABASE_DB_URL
		if (!connectionString) {
			throw new Error("SUPABASE_DB_URL environment variable is required for PostgresStore")
		}

		postgresStoreInstance = new PostgresStore({
			connectionString,
		})
	}

	return postgresStoreInstance
}

// For cleanup if needed
export function resetPostgresStore(): void {
	postgresStoreInstance = null
}
