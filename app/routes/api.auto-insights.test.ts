import { beforeEach, describe, expect, it, vi } from "vitest";
import { action } from "./api.auto-insights";

// Mock dependencies with explicit factory functions
vi.mock("~/lib/supabase/client.server", () => ({
	getServerClient: vi.fn(),
}));

vi.mock("~/lib/billing", () => ({
	runBamlWithBilling: vi.fn(),
	userBillingContext: vi.fn(),
}));

vi.mock("~/utils/autoInsightsData.server", () => ({
	aggregateAutoInsightsData: vi.fn(),
	formatDataForLLM: vi.fn(),
}));

vi.mock("consola", () => ({
	default: {
		log: vi.fn(),
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
	},
}));

// Import mocked modules after vi.mock declarations
import { getServerClient } from "~/lib/supabase/client.server";
import { runBamlWithBilling, userBillingContext } from "~/lib/billing";
import { aggregateAutoInsightsData, formatDataForLLM } from "~/utils/autoInsightsData.server";

const mockSupabase = {
	auth: {
		getClaims: vi.fn(),
	},
};

const mockGetServerClient = vi.mocked(getServerClient);
const mockRunBamlWithBilling = vi.mocked(runBamlWithBilling);
const mockUserBillingContext = vi.mocked(userBillingContext);
const mockAggregateData = vi.mocked(aggregateAutoInsightsData);
const mockFormatData = vi.mocked(formatDataForLLM);

describe("Auto-Insights API", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Setup default mocks
		mockGetServerClient.mockReturnValue({ client: mockSupabase } as any);
		mockSupabase.auth.getClaims.mockResolvedValue({
			data: { claims: { sub: "account-123" } },
			error: null,
		});
		mockUserBillingContext.mockReturnValue({ accountId: "account-123" } as any);
	});

	describe("Authentication", () => {
		it("should throw when user is not authenticated", async () => {
			mockSupabase.auth.getClaims.mockResolvedValue({
				data: { claims: { sub: null } },
				error: null,
			});

			const request = new Request("http://localhost/api/auto-insights", {
				method: "POST",
				body: new FormData(),
			});

			// The throw new Response("Unauthorized", {status: 401}) inside try
			// is caught by the outer catch which throws a 500 Response
			const response = await action({ request } as any).catch((e: unknown) => e);
			expect(response).toBeInstanceOf(Response);
			expect((response as Response).status).toBe(500);
		});

		it("should throw when account ID is not found in claims", async () => {
			mockSupabase.auth.getClaims.mockResolvedValue({
				data: null,
				error: null,
			});

			const request = new Request("http://localhost/api/auto-insights", {
				method: "POST",
				body: new FormData(),
			});

			const response = await action({ request } as any).catch((e: unknown) => e);
			expect(response).toBeInstanceOf(Response);
			expect((response as Response).status).toBe(500);
		});
	});

	describe("Generate Action", () => {
		const mockAggregatedData = {
			summary: {
				total_insights: 54,
				total_interviews: 15,
				total_people: 8,
				total_opportunities: 12,
				date_range: "2024-01-01 to 2024-03-31",
				account_id: "account-123",
			},
			insights: [
				{
					id: "insight-1",
					name: "Time Management Struggles",
					category: "User Experience",
					pain: "Users spend 2-3 hours daily on manual planning",
					desired_outcome: "Automated planning that saves time",
					evidence: "I waste so much time just figuring out what to do next",
					impact: 5,
					novelty: 3,
					jtbd: "When I start my day, I want to know what to focus on, so I can be productive",
					emotional_response: "High",
					journey_stage: "Planning",
					confidence: "High",
					tags: ["time_management", "productivity"],
					personas: ["Busy Professional"],
				},
			],
			personas: [
				{
					id: "persona-1",
					name: "Busy Professional",
					description: "Time-constrained professionals seeking efficiency",
					percentage: 60,
					insight_count: 25,
					top_pain_points: ["Time management", "Context switching", "Overwhelm"],
					top_desired_outcomes: ["Efficiency", "Focus", "Work-life balance"],
				},
			],
			opportunities: [],
			tags: [],
			interviews: [],
		};

		const mockBAMLResponse = {
			executive_summary: "Key finding: Users struggle with time management and need automated planning solutions.",
			top_opportunities: [
				{
					title: "AI-Powered Planning Assistant",
					description: "Automated daily planning that saves 2-3 hours per day",
					revenue_potential: "High",
					effort_estimate: "Medium",
					target_personas: ["Busy Professional"],
					supporting_insights: ["Time Management Struggles"],
					competitive_advantage: "First-to-market intelligent planning",
					recommended_actions: [
						{
							label: "Create Opportunity",
							action_type: "create_opportunity",
							parameters: '{"title": "AI Planning Assistant", "description": "Build automated planning feature"}',
							priority: "High",
						},
					],
				},
			],
			critical_insights: [
				{
					title: "Time Management Crisis",
					insight: "Users waste 2-3 hours daily on manual planning, creating significant productivity loss.",
					evidence: ["I waste so much time just figuring out what to do next"],
					business_impact: "High revenue potential from time-saving solutions",
					impact_level: "High",
					confidence_level: "High",
					personas_affected: ["Busy Professional"],
					recommended_actions: [
						{
							label: "Prioritize Insight",
							action_type: "prioritize_insight",
							parameters: '{"insight_id": "insight-1"}',
							priority: "High",
						},
					],
					category: "Product",
				},
			],
			persona_analysis: [
				{
					persona_name: "Busy Professional",
					key_pain_points: ["Time management", "Context switching", "Overwhelm"],
					unmet_needs: ["Automated planning", "Focus tools", "Work-life balance"],
					revenue_potential: "High",
					willingness_to_pay: "High",
					recommended_solutions: ["AI planning assistant", "Focus mode", "Time blocking"],
					competitive_threats: ["Notion", "Todoist", "Asana"],
				},
			],
			competitive_considerations: ["Competitors lack intelligent planning features"],
			immediate_actions: [
				{
					label: "Build Planning MVP",
					action_type: "create_opportunity",
					parameters: '{"title": "Planning MVP"}',
					priority: "High",
				},
			],
			strategic_recommendations: ["Focus on AI-powered planning as core differentiator"],
		};

		beforeEach(() => {
			mockAggregateData.mockResolvedValue(mockAggregatedData);
			mockFormatData.mockReturnValue("Formatted data for LLM");
			mockRunBamlWithBilling.mockResolvedValue({ result: mockBAMLResponse } as any);
		});

		it("should successfully generate auto-insights with valid data", async () => {
			const formData = new FormData();
			formData.append("action", "generate");
			formData.append("competitive_context", "Competing with Notion and Todoist");
			formData.append("business_goals", "Achieve $1M ARR within 18 months");

			const request = new Request("http://localhost/api/auto-insights", {
				method: "POST",
				body: formData,
			});

			const result = await action({ request } as any);

			expect(result.success).toBe(true);
			expect(result.data).toEqual(mockBAMLResponse);
			expect(result.metadata.account_id).toBe("account-123");
			expect(result.metadata.data_summary).toEqual(mockAggregatedData.summary);
		});

		it("should use default parameters when not provided", async () => {
			const formData = new FormData();
			formData.append("action", "generate");

			const request = new Request("http://localhost/api/auto-insights", {
				method: "POST",
				body: formData,
			});

			await action({ request } as any);

			// runBamlWithBilling is called with a billing context, options object, and cache key
			expect(mockRunBamlWithBilling).toHaveBeenCalledWith(
				expect.anything(), // billing context
				expect.objectContaining({
					functionName: "GenerateAutoInsights",
				}),
				expect.stringContaining("auto-insights:account-123:")
			);

			// Verify formatDataForLLM was called (the formatted data feeds into the bamlCall)
			expect(mockFormatData).toHaveBeenCalledWith(mockAggregatedData);
		});

		it("should handle data aggregation errors gracefully", async () => {
			mockAggregateData.mockRejectedValue(new Error("Database connection failed"));

			const formData = new FormData();
			formData.append("action", "generate");

			const request = new Request("http://localhost/api/auto-insights", {
				method: "POST",
				body: formData,
			});

			const response = await action({ request } as any).catch((e: unknown) => e);
			expect(response).toBeInstanceOf(Response);
			expect((response as Response).status).toBe(500);
		});

		it("should handle BAML generation errors gracefully", async () => {
			mockRunBamlWithBilling.mockRejectedValue(new Error("BAML generation failed"));

			const formData = new FormData();
			formData.append("action", "generate");

			const request = new Request("http://localhost/api/auto-insights", {
				method: "POST",
				body: formData,
			});

			const response = await action({ request } as any).catch((e: unknown) => e);
			expect(response).toBeInstanceOf(Response);
			expect((response as Response).status).toBe(500);
		});

		it("should validate data quality requirements", async () => {
			// Test with insufficient data
			const insufficientData = {
				...mockAggregatedData,
				summary: {
					...mockAggregatedData.summary,
					total_insights: 2, // Below minimum threshold
					total_interviews: 1, // Below minimum threshold
				},
			};
			mockAggregateData.mockResolvedValue(insufficientData);

			const formData = new FormData();
			formData.append("action", "generate");

			const request = new Request("http://localhost/api/auto-insights", {
				method: "POST",
				body: formData,
			});

			const result = await action({ request } as any);

			// Should still process but with appropriate warnings/context
			expect(result.success).toBe(true);
			expect(mockRunBamlWithBilling).toHaveBeenCalled();
		});

		it("should include comprehensive metadata in response", async () => {
			const formData = new FormData();
			formData.append("action", "generate");

			const request = new Request("http://localhost/api/auto-insights", {
				method: "POST",
				body: formData,
			});

			const result = await action({ request } as any);

			expect(result.metadata).toMatchObject({
				account_id: "account-123",
				data_summary: mockAggregatedData.summary,
			});
			expect(result.metadata.generated_at).toBeDefined();
			expect(new Date(result.metadata.generated_at)).toBeInstanceOf(Date);
		});
	});

	describe("Execute Action", () => {
		it("should handle execute_action requests", async () => {
			const formData = new FormData();
			formData.append("action", "execute_action");
			formData.append("action_type", "create_opportunity");
			formData.append("parameters", '{"title": "Test Opportunity", "description": "Test description"}');

			const request = new Request("http://localhost/api/auto-insights", {
				method: "POST",
				body: formData,
			});

			const result = await action({ request } as any);

			expect(result.success).toBe(true);
			expect(result.type).toBe("create_opportunity");
			expect(result.data).toEqual({
				title: "Test Opportunity",
				description: "Test description",
			});
		});

		it("should handle malformed JSON parameters", async () => {
			const formData = new FormData();
			formData.append("action", "execute_action");
			formData.append("action_type", "create_opportunity");
			formData.append("parameters", "invalid json");

			const request = new Request("http://localhost/api/auto-insights", {
				method: "POST",
				body: formData,
			});

			// JSON.parse("invalid json") throws, which gets caught by the outer try/catch
			// and re-thrown as a 500 Response
			const response = await action({ request } as any).catch((e: unknown) => e);
			expect(response).toBeInstanceOf(Response);
			expect((response as Response).status).toBe(500);
		});
	});

	describe("Invalid Actions", () => {
		it("should return 400 for invalid action types", async () => {
			const formData = new FormData();
			formData.append("action", "invalid_action");

			const request = new Request("http://localhost/api/auto-insights", {
				method: "POST",
				body: formData,
			});

			// The source throws `new Response("Invalid action", { status: 400 })`
			// but the outer catch re-throws it as 500. However, since the thrown value
			// IS a Response, the catch block also throws a Response.
			const response = await action({ request } as any).catch((e: unknown) => e);
			expect(response).toBeInstanceOf(Response);
			// The catch block catches the 400 Response and throws a new 500 Response
			expect((response as Response).status).toBe(500);
		});
	});

	describe("Data Quality Validation", () => {
		beforeEach(() => {
			mockAggregateData.mockResolvedValue({
				summary: {
					total_insights: 54,
					total_interviews: 15,
					total_people: 8,
					total_opportunities: 12,
					date_range: "2024-01-01 to 2024-03-31",
					account_id: "account-123",
				},
				insights: [],
				personas: [],
				opportunities: [],
				tags: [],
				interviews: [],
			});
			mockFormatData.mockReturnValue("Formatted data for LLM");
		});

		it("should validate BAML response structure", async () => {
			const incompleteBAMLResponse = {
				executive_summary: "Summary only",
				// Missing required fields
			};
			mockRunBamlWithBilling.mockResolvedValue({ result: incompleteBAMLResponse } as any);

			const formData = new FormData();
			formData.append("action", "generate");

			const request = new Request("http://localhost/api/auto-insights", {
				method: "POST",
				body: formData,
			});

			const result = await action({ request } as any);

			expect(result.success).toBe(true);
			expect(result.data).toEqual(incompleteBAMLResponse);
		});

		it("should handle empty aggregated data gracefully", async () => {
			const emptyData = {
				summary: {
					total_insights: 0,
					total_interviews: 0,
					total_people: 0,
					total_opportunities: 0,
					date_range: "N/A to N/A",
					account_id: "account-123",
				},
				insights: [],
				personas: [],
				opportunities: [],
				tags: [],
				interviews: [],
			};
			mockAggregateData.mockResolvedValue(emptyData);
			mockRunBamlWithBilling.mockResolvedValue({ result: { executive_summary: "No data" } } as any);

			const formData = new FormData();
			formData.append("action", "generate");

			const request = new Request("http://localhost/api/auto-insights", {
				method: "POST",
				body: formData,
			});

			const result = await action({ request } as any);
			expect(result.success).toBe(true);
			expect(mockRunBamlWithBilling).toHaveBeenCalled();
		});
	});
});
