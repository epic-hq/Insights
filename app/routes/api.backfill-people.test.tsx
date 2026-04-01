/**
 * Unit tests for api.backfill-people.tsx
 * Tests the API route for backfilling missing people records
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { action } from "./api.backfill-people";

// Mock dependencies
vi.mock("~/utils/backfillPeople.server", () => ({
	backfillMissingPeople: vi.fn(),
	getInterviewPeopleStats: vi.fn(),
}));

vi.mock("~/lib/supabase/client.server", () => ({
	getServerClient: vi.fn(),
	getAuthenticatedUser: vi.fn(),
}));

import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/client.server";
import { backfillMissingPeople, getInterviewPeopleStats } from "~/utils/backfillPeople.server";

const mockGetAuthenticatedUser = vi.mocked(getAuthenticatedUser);
const mockGetServerClient = vi.mocked(getServerClient);
const mockBackfillMissingPeople = vi.mocked(backfillMissingPeople);
const mockGetInterviewPeopleStats = vi.mocked(getInterviewPeopleStats);

describe("api.backfill-people", () => {
	let mockRequest: Request;

	beforeEach(() => {
		vi.clearAllMocks();

		// Default: authenticated user with account ID
		mockGetAuthenticatedUser.mockResolvedValue({
			user: { id: "user-123", sub: "account-123" },
		} as any);

		mockGetServerClient.mockReturnValue({} as any);
	});

	describe("Authentication", () => {
		it("should return 401 when user is not authenticated", async () => {
			mockGetAuthenticatedUser.mockResolvedValue({ user: null } as any);

			const formData = new FormData();
			formData.append("action", "stats");

			mockRequest = new Request("http://localhost:3000", {
				method: "POST",
				body: formData,
			});

			const response = await action({ request: mockRequest } as any);
			const data = await response.json();

			expect(response.status).toBe(401);
			expect(data.error).toBe("User not authenticated");
		});

		it("should return 400 when account ID is not found", async () => {
			mockGetAuthenticatedUser.mockResolvedValue({
				user: { id: undefined, sub: undefined },
			} as any);

			const formData = new FormData();
			formData.append("action", "stats");

			mockRequest = new Request("http://localhost:3000", {
				method: "POST",
				body: formData,
			});

			const response = await action({ request: mockRequest } as any);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toBe("Account ID not found in user claims");
		});
	});

	describe("Stats Action", () => {
		it("should return stats when action is stats", async () => {
			const mockStats = {
				totalInterviews: 10,
				totalPeople: 8,
				interviewsWithPeople: 8,
				interviewsWithoutPeople: 2,
				duplicatePeople: 1,
			};

			mockGetInterviewPeopleStats.mockResolvedValue(mockStats as any);

			const formData = new FormData();
			formData.append("action", "stats");

			mockRequest = new Request("http://localhost:3000", {
				method: "POST",
				body: formData,
			});

			const response = await action({ request: mockRequest } as any);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.stats).toEqual(mockStats);
			expect(mockGetInterviewPeopleStats).toHaveBeenCalledWith(mockRequest, "account-123");
		});

		it("should handle stats errors gracefully", async () => {
			mockGetInterviewPeopleStats.mockRejectedValue(new Error("Database connection failed"));

			const formData = new FormData();
			formData.append("action", "stats");

			mockRequest = new Request("http://localhost:3000", {
				method: "POST",
				body: formData,
			});

			const response = await action({ request: mockRequest } as any);
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data.error).toBe("Database connection failed");
		});
	});

	describe("Backfill Action", () => {
		it("should run backfill in production mode", async () => {
			const mockResult = {
				totalInterviews: 10,
				interviewsWithoutPeople: 3,
				peopleCreated: 3,
				linksCreated: 3,
				errors: [],
			};

			mockBackfillMissingPeople.mockResolvedValue(mockResult as any);

			const formData = new FormData();
			formData.append("action", "backfill");
			formData.append("dryRun", "false");

			mockRequest = new Request("http://localhost:3000", {
				method: "POST",
				body: formData,
			});

			const response = await action({ request: mockRequest } as any);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.result).toEqual(mockResult);
			expect(data.message).toBe("Backfill completed: Created 3 people and 3 links");
			expect(mockBackfillMissingPeople).toHaveBeenCalledWith(mockRequest, {
				accountId: "account-123",
				dryRun: false,
			});
		});

		it("should run backfill in dry run mode", async () => {
			const mockResult = {
				totalInterviews: 10,
				interviewsWithoutPeople: 3,
				peopleCreated: 3,
				linksCreated: 3,
				errors: [],
			};

			mockBackfillMissingPeople.mockResolvedValue(mockResult as any);

			const formData = new FormData();
			formData.append("action", "backfill");
			formData.append("dryRun", "true");

			mockRequest = new Request("http://localhost:3000", {
				method: "POST",
				body: formData,
			});

			const response = await action({ request: mockRequest } as any);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.result).toEqual(mockResult);
			expect(data.message).toBe("Dry run completed: Would create 3 people and 3 links");
			expect(mockBackfillMissingPeople).toHaveBeenCalledWith(mockRequest, {
				accountId: "account-123",
				dryRun: true,
			});
		});

		it("should handle backfill errors gracefully", async () => {
			mockBackfillMissingPeople.mockRejectedValue(new Error("Failed to connect to database"));

			const formData = new FormData();
			formData.append("action", "backfill");
			formData.append("dryRun", "false");

			mockRequest = new Request("http://localhost:3000", {
				method: "POST",
				body: formData,
			});

			const response = await action({ request: mockRequest } as any);
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data.error).toBe("Failed to connect to database");
		});

		it("should return backfill results with errors", async () => {
			const mockResult = {
				totalInterviews: 10,
				interviewsWithoutPeople: 5,
				peopleCreated: 3,
				linksCreated: 3,
				errors: [
					"Failed to create person for interview interview-1: Constraint violation",
					"Failed to create link for interview interview-2: Foreign key error",
				],
			};

			mockBackfillMissingPeople.mockResolvedValue(mockResult as any);

			const formData = new FormData();
			formData.append("action", "backfill");
			formData.append("dryRun", "false");

			mockRequest = new Request("http://localhost:3000", {
				method: "POST",
				body: formData,
			});

			const response = await action({ request: mockRequest } as any);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.result.errors).toHaveLength(2);
			expect(data.message).toBe("Backfill completed: Created 3 people and 3 links");
		});
	});

	describe("Invalid Actions", () => {
		it("should return 400 for invalid action", async () => {
			const formData = new FormData();
			formData.append("action", "invalid");

			mockRequest = new Request("http://localhost:3000", {
				method: "POST",
				body: formData,
			});

			const response = await action({ request: mockRequest } as any);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toBe("Invalid action. Use 'stats' or 'backfill'");
		});

		it("should return 400 when no action is provided", async () => {
			const formData = new FormData();

			mockRequest = new Request("http://localhost:3000", {
				method: "POST",
				body: formData,
			});

			const response = await action({ request: mockRequest } as any);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toBe("Invalid action. Use 'stats' or 'backfill'");
		});
	});

	describe("Edge Cases", () => {
		it("should handle malformed form data gracefully", async () => {
			// Create request with invalid form data
			mockRequest = new Request("http://localhost:3000", {
				method: "POST",
				body: "invalid-form-data",
			});

			const response = await action({ request: mockRequest } as any);
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data.error).toBeDefined();
		});

		it("should default dryRun to false when not specified", async () => {
			const mockResult = {
				totalInterviews: 5,
				interviewsWithoutPeople: 1,
				peopleCreated: 1,
				linksCreated: 1,
				errors: [],
			};

			mockBackfillMissingPeople.mockResolvedValue(mockResult as any);

			const formData = new FormData();
			formData.append("action", "backfill");
			// Note: dryRun not specified

			mockRequest = new Request("http://localhost:3000", {
				method: "POST",
				body: formData,
			});

			const response = await action({ request: mockRequest } as any);
			const _data = await response.json();

			expect(response.status).toBe(200);
			expect(mockBackfillMissingPeople).toHaveBeenCalledWith(mockRequest, {
				accountId: "account-123",
				dryRun: false, // Should default to false
			});
		});

		it("should handle user with no sub, falling back to id", async () => {
			mockGetAuthenticatedUser.mockResolvedValue({
				user: { id: "user-123", sub: undefined },
			} as any);

			const mockStats = { totalInterviews: 5 };
			mockGetInterviewPeopleStats.mockResolvedValue(mockStats as any);

			const formData = new FormData();
			formData.append("action", "stats");

			mockRequest = new Request("http://localhost:3000", {
				method: "POST",
				body: formData,
			});

			const response = await action({ request: mockRequest } as any);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(mockGetInterviewPeopleStats).toHaveBeenCalledWith(mockRequest, "user-123");
		});
	});
});
