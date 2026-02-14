import { PostgresStore } from "@mastra/pg";

// Global singleton to prevent duplicate database connections
let postgresStoreInstance: PostgresStore | null = null;

export function getSharedPostgresStore(): PostgresStore {
	if (!postgresStoreInstance) {
		const connectionString = process.env.SUPABASE_DB_URL;
		if (!connectionString) {
			throw new Error("SUPABASE_DB_URL environment variable is required for PostgresStore");
		}

		postgresStoreInstance = new PostgresStore({
			id: "insights-postgres-store",
			connectionString,
			// Limit pool size to prevent "Max client connections reached" errors
			// With multiple Fly.io instances/processes, we need to keep this low
			max: 5,
		});
	}

	return postgresStoreInstance;
}

// For cleanup if needed
function _resetPostgresStore(): void {
	postgresStoreInstance = null;
}
