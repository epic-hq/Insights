/**
 * Integration test setup
 * Configures test environment for real DB operations
 */

import { afterAll, beforeAll } from "vitest";
import { testDb } from "~/test/utils/testDb";

// Environment variables should be loaded by dotenvx or set in test environment
// Ensure required environment variables are set
if (!process.env.TEST_SUPABASE_URL) {
	throw new Error(
		"TEST_SUPABASE_URL must be set in environment for integration tests. Run with: dotenvx run -- pnpm test:integration"
	);
}
if (!process.env.TEST_SUPABASE_ANON_KEY) {
	throw new Error(
		"TEST_SUPABASE_ANON_KEY must be set in environment for integration tests. Run with: dotenvx run -- pnpm test:integration"
	);
}

if (process.env.SUPABASE_URL && process.env.TEST_SUPABASE_URL === process.env.SUPABASE_URL) {
	throw new Error("Refusing to run integration tests: TEST_SUPABASE_URL matches SUPABASE_URL");
}

beforeAll(async () => {
	// Verify test database connection
	const { error } = await testDb.from("projects").select("id").limit(1);
	if (error) {
		throw new Error(`Test database connection failed: ${error.message}`);
	}
});

afterAll(async () => {
	// Clean up database connections
	await testDb.removeAllChannels();
});
