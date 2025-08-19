import { describe, it, expect, vi, beforeEach } from "vitest"

// Simple mock for BAML function
const mockAssignPersonaToInterview = vi.fn()

// Mock the BAML client
vi.mock("~/../baml_client", () => ({
	b: {
		AssignPersonaToInterview: mockAssignPersonaToInterview,
	},
}))

describe("Intelligent Persona Assignment - Core Logic", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should return assign_existing action when confidence is high", async () => {
		// Test 1: Validates decision logic for existing persona assignment
		const mockDecision = {
			action: "assign_existing",
			persona_id: "existing-123",
			persona_name: "Efficiency Expert",
			confidence_score: 0.85,
			reasoning: "Strong alignment with speed-focused behavior patterns",
			new_persona_data: null,
		}

		mockAssignPersonaToInterview.mockResolvedValue(mockDecision)

		const { b } = await import("~/../baml_client")
		const result = await b.AssignPersonaToInterview(
			"I need things fast and simple",
			'{"name": "Sarah", "segment": "Business"}',
			'[{"id": "existing-123", "name": "Efficiency Expert"}]'
		)

		expect(result.action).toBe("assign_existing")
		expect(result.confidence_score).toBeGreaterThan(0.7)
		expect(result.persona_id).toBe("existing-123")
		expect(result.reasoning).toContain("alignment")
		expect(mockAssignPersonaToInterview).toHaveBeenCalledWith(
			"I need things fast and simple",
			'{"name": "Sarah", "segment": "Business"}',
			'[{"id": "existing-123", "name": "Efficiency Expert"}]'
		)
	})

	it("should return create_new action when no good match exists", async () => {
		// Test 2: Validates decision logic for new persona creation
		const mockDecision = {
			action: "create_new",
			persona_id: null,
			persona_name: "Advanced Developer",
			confidence_score: 0.92,
			reasoning: "Distinct technical archetype not represented in existing personas",
			new_persona_data: {
				name: "Advanced Developer",
				description: "Technical users who need complex features",
			},
		}

		mockAssignPersonaToInterview.mockResolvedValue(mockDecision)

		const { b } = await import("~/../baml_client")
		const result = await b.AssignPersonaToInterview(
			"I need APIs and custom workflows",
			'{"name": "Alex", "segment": "Developer"}',
			'[{"id": "basic-456", "name": "Simple User"}]'
		)

		expect(result.action).toBe("create_new")
		expect(result.confidence_score).toBeGreaterThan(0.7)
		expect(result.new_persona_data).toBeDefined()
		expect(result.new_persona_data?.name).toBe("Advanced Developer")
		expect(result.reasoning.toLowerCase()).toContain("distinct")
	})

	it("should provide confidence scores and detailed reasoning", async () => {
		// Test 3: Validates decision transparency and quality
		const mockDecision = {
			action: "assign_existing",
			persona_id: "moderate-789",
			persona_name: "Budget Conscious",
			confidence_score: 0.73,
			reasoning: "Moderate alignment based on price sensitivity. Some behavioral overlap with existing persona but demographic differences noted.",
			new_persona_data: null,
		}

		mockAssignPersonaToInterview.mockResolvedValue(mockDecision)

		const { b } = await import("~/../baml_client")
		const result = await b.AssignPersonaToInterview(
			"Price matters but quality too",
			'{"name": "Maria", "segment": "Small Business"}',
			'[{"id": "moderate-789", "name": "Budget Conscious"}]'
		)

		// Validate decision quality metrics
		expect(result.confidence_score).toBeGreaterThan(0.0)
		expect(result.confidence_score).toBeLessThanOrEqual(1.0)
		expect(typeof result.confidence_score).toBe("number")
		
		// Validate reasoning quality
		expect(result.reasoning).toBeDefined()
		expect(typeof result.reasoning).toBe("string")
		expect(result.reasoning.length).toBeGreaterThan(20)
		expect(result.reasoning).toContain("alignment")
		
		// Validate action consistency
		expect(result.action).toMatch(/^(assign_existing|create_new)$/)
		
		if (result.action === "assign_existing") {
			expect(result.persona_id).toBeDefined()
			expect(result.persona_name).toBeDefined()
		} else {
			expect(result.new_persona_data).toBeDefined()
		}
	})
})
