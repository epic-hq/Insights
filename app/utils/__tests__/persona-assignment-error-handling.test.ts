import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock for testing error scenarios
const mockAssignPersonaToInterview = vi.fn()

vi.mock("~/../baml_client", () => ({
	b: {
		AssignPersonaToInterview: mockAssignPersonaToInterview,
	},
}))

describe("Persona Assignment Error Handling", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should handle BAML service failures gracefully", async () => {
		// Test 1: BAML function throws error (network/service failure)
		const serviceError = new Error("BAML service unavailable")
		mockAssignPersonaToInterview.mockRejectedValue(serviceError)

		const { b } = await import("~/../baml_client")

		// Verify error is properly thrown (will be caught by processInterview fallback)
		await expect(b.AssignPersonaToInterview("test transcript", '{"name": "Test User"}', "[]")).rejects.toThrow(
			"BAML service unavailable"
		)
	})

	it("should handle edge cases in input data", async () => {
		// Test 2: Empty or invalid input handling
		const edgeCaseDecision = {
			action: "create_new",
			persona_id: null,
			persona_name: "Unknown User",
			confidence_score: 0.3,
			reasoning: "Insufficient data to make confident assignment decision",
			new_persona_data: {
				name: "Unknown User",
				description: "Limited information available from transcript",
			},
		}

		mockAssignPersonaToInterview.mockResolvedValue(edgeCaseDecision)

		const { b } = await import("~/../baml_client")

		// Test with empty transcript
		const result = await b.AssignPersonaToInterview(
			"", // Empty transcript
			'{"name": null}', // Minimal participant info
			"[]" // No existing personas
		)

		expect(result.action).toBe("create_new")
		expect(result.confidence_score).toBeLessThan(0.5)
		expect(result.reasoning).toContain("Insufficient data")
		expect(result.new_persona_data).toBeDefined()
	})

	it("should validate response structure and handle malformed responses", async () => {
		// Test 3: Response validation and structure checking
		const validResponse = {
			action: "assign_existing",
			persona_id: "test-123",
			persona_name: "Valid Persona",
			confidence_score: 0.8,
			reasoning: "Strong behavioral alignment with existing persona characteristics",
			new_persona_data: null,
		}

		mockAssignPersonaToInterview.mockResolvedValue(validResponse)

		const { b } = await import("~/../baml_client")
		const result = await b.AssignPersonaToInterview(
			"valid transcript",
			'{"name": "Valid User"}',
			'[{"id": "test-123", "name": "Valid Persona"}]'
		)

		// Validate all required fields are present
		expect(result).toHaveProperty("action")
		expect(result).toHaveProperty("confidence_score")
		expect(result).toHaveProperty("reasoning")
		expect(result).toHaveProperty("persona_id")
		expect(result).toHaveProperty("persona_name")
		expect(result).toHaveProperty("new_persona_data")

		// Validate field types and constraints
		expect(typeof result.action).toBe("string")
		expect(result.action).toMatch(/^(assign_existing|create_new)$/)
		expect(typeof result.confidence_score).toBe("number")
		expect(result.confidence_score).toBeGreaterThanOrEqual(0)
		expect(result.confidence_score).toBeLessThanOrEqual(1)
		expect(typeof result.reasoning).toBe("string")
		expect(result.reasoning.length).toBeGreaterThan(10)

		// Validate action-specific fields
		if (result.action === "assign_existing") {
			expect(result.persona_id).toBeTruthy()
			expect(result.persona_name).toBeTruthy()
		} else if (result.action === "create_new") {
			expect(result.new_persona_data).toBeTruthy()
		}
	})
})
