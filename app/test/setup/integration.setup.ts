/**
 * Integration test setup
 * Configures test environment for real DB operations
 */

import { afterAll, beforeAll } from "vitest"
import { testDb } from "~/test/utils/testDb"

beforeAll(async () => {
	// Verify test database connection
	const { error } = await testDb.from("projects").select("id").limit(1)
	if (error) {
		throw new Error(`Test database connection failed: ${error.message}`)
	}
})

afterAll(async () => {
	// Clean up database connections
	await testDb.removeAllChannels()
})
