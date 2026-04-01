import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock modules that trigger env validation at module scope
vi.mock("~/lib/supabase/client.server", () => ({
	getServerClient: vi.fn(() => ({ client: {} })),
	createSupabaseAdminClient: vi.fn(),
	getAuthenticatedUser: vi.fn(),
}));
vi.mock("~/lib/posthog.server", () => ({
	getPostHogServerClient: vi.fn(() => ({
		capture: vi.fn(),
	})),
}));
vi.mock("consola", () => ({
	default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn(), debug: vi.fn() },
}));
vi.mock("~/server/user-context", () => ({
	userContext: "FAKE_USER_CONTEXT",
}));
vi.mock("~/server/current-project-context", () => ({
	currentProjectContext: "FAKE_CURRENT_PROJECT_CONTEXT",
}));

// Mock the db module so handlers don't touch real supabase chains
const mockGetAnnotationsForEntity = vi.fn();
const mockCreateAnnotation = vi.fn();
const mockUpdateAnnotation = vi.fn();
const mockDeleteAnnotation = vi.fn();
const mockGetVoteCountsForEntity = vi.fn();
const mockGetVoteCountsForEntities = vi.fn();
const mockUpsertVote = vi.fn();
const mockRemoveVote = vi.fn();
const mockGetUserFlagsForEntity = vi.fn();
const mockSetEntityFlag = vi.fn();

vi.mock("../db", () => ({
	getAnnotationsForEntity: (...args: unknown[]) => mockGetAnnotationsForEntity(...args),
	createAnnotation: (...args: unknown[]) => mockCreateAnnotation(...args),
	updateAnnotation: (...args: unknown[]) => mockUpdateAnnotation(...args),
	deleteAnnotation: (...args: unknown[]) => mockDeleteAnnotation(...args),
	getVoteCountsForEntity: (...args: unknown[]) => mockGetVoteCountsForEntity(...args),
	getVoteCountsForEntities: (...args: unknown[]) => mockGetVoteCountsForEntities(...args),
	upsertVote: (...args: unknown[]) => mockUpsertVote(...args),
	removeVote: (...args: unknown[]) => mockRemoveVote(...args),
	getUserFlagsForEntity: (...args: unknown[]) => mockGetUserFlagsForEntity(...args),
	setEntityFlag: (...args: unknown[]) => mockSetEntityFlag(...args),
}));

import { action as annotationsAction, loader as annotationsLoader } from "../api/annotations";
import { action as entityFlagsAction, loader as entityFlagsLoader } from "../api/entity-flags";
import { action as votesAction, loader as votesLoader } from "../api/votes";

// Valid UUIDs for tests
const ACCOUNT_ID = "d7b69d5e-a952-4a7b-8c9d-0e1f2a3b4c5d";
const PROJECT_ID = "e8c7af6f-b063-5b8c-9dae-1f2g3h4i5j6k";
const USER_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const ENTITY_ID = "f9d8e7c6-b5a4-4321-8765-fedcba987654";

// Mock Supabase client (used by votes handler which calls getServerClient directly)
const mockSupabase = {
	from: vi.fn(),
	rpc: vi.fn(),
	auth: {
		getClaims: vi.fn(() => Promise.resolve({ data: { claims: { sub: USER_ID, account_id: ACCOUNT_ID } } })),
	},
};

// Build a mock context whose .get() returns different values based on the context key
function buildMockContext(overrides?: {
	userCtx?: Record<string, unknown>;
	projectCtx?: Record<string, unknown>;
}) {
	const userCtx = overrides?.userCtx ?? {
		supabase: mockSupabase,
		account_id: ACCOUNT_ID,
		claims: { sub: USER_ID },
	};
	const projectCtx = overrides?.projectCtx ?? {
		accountId: ACCOUNT_ID,
		projectId: PROJECT_ID,
		account: null,
		project: null,
	};

	return {
		get: vi.fn((key: unknown) => {
			if (key === "FAKE_USER_CONTEXT") return userCtx;
			if (key === "FAKE_CURRENT_PROJECT_CONTEXT") return projectCtx;
			return undefined;
		}),
	};
}

describe("Annotations API Routes", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("/api/annotations", () => {
		it("should handle GET request for annotations", async () => {
			const request = new Request(
				`http://localhost/api/annotations?entityType=insight&entityId=${ENTITY_ID}`
			);

			mockGetAnnotationsForEntity.mockResolvedValue({
				data: [
					{
						id: "1",
						content: "Test comment",
						annotation_type: "comment",
						created_at: new Date().toISOString(),
					},
				],
				error: null,
			});

			const mockContext = buildMockContext();
			const response = await annotationsLoader({ request, context: mockContext, params: {} });

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.annotations).toBeDefined();
			expect(Array.isArray(data.annotations)).toBe(true);
		});

		it("should handle POST request to create annotation", async () => {
			const formData = new FormData();
			formData.append("action", "add-comment");
			formData.append("entityType", "insight");
			formData.append("entityId", ENTITY_ID);
			formData.append("content", "New comment");

			const request = new Request("http://localhost/api/annotations", {
				method: "POST",
				body: formData,
			});

			mockCreateAnnotation.mockResolvedValue({
				data: {
					id: "1",
					content: "New comment",
					annotation_type: "comment",
					created_at: new Date().toISOString(),
				},
				error: null,
			});

			const mockContext = buildMockContext();
			const response = await annotationsAction({ request, context: mockContext, params: {} });

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.annotation).toBeDefined();
			expect(data.annotation.content).toBe("New comment");
		});

		it("should handle validation errors", async () => {
			const formData = new FormData();
			// "add-comment" action but missing entityId and content
			formData.append("action", "add-comment");
			formData.append("entityType", "insight");

			const request = new Request("http://localhost/api/annotations", {
				method: "POST",
				body: formData,
			});

			const mockContext = buildMockContext();
			const response = await annotationsAction({ request, context: mockContext, params: {} });

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.error).toBeDefined();
		});
	});

	describe("/api/votes", () => {
		it("should handle GET request for vote counts", async () => {
			const request = new Request(
				`http://localhost/api/votes?entityType=insight&entityId=${ENTITY_ID}`
			);

			mockGetVoteCountsForEntity.mockResolvedValue({
				data: { upvotes: 5, downvotes: 2 },
				error: null,
			});

			const mockContext = buildMockContext();
			const response = await votesLoader({
				request,
				context: mockContext,
				params: { projectId: PROJECT_ID },
			});

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.voteCounts).toBeDefined();
			expect(data.voteCounts.upvotes).toBe(5);
			expect(data.voteCounts.downvotes).toBe(2);
		});

		it("should handle POST request to upsert vote", async () => {
			const formData = new FormData();
			formData.append("action", "upsert-vote");
			formData.append("entityType", "insight");
			formData.append("entityId", ENTITY_ID);
			formData.append("voteValue", "1");

			const request = new Request("http://localhost/api/votes", {
				method: "POST",
				body: formData,
			});

			mockUpsertVote.mockResolvedValue({
				data: {
					id: "1",
					vote_value: 1,
					created_at: new Date().toISOString(),
				},
				error: null,
			});

			mockGetVoteCountsForEntity.mockResolvedValue({
				data: { upvotes: 1, downvotes: 0 },
				error: null,
			});

			const mockContext = buildMockContext();
			const response = await votesAction({
				request,
				context: mockContext,
				params: { projectId: PROJECT_ID },
			});

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.vote).toBeDefined();
			expect(data.vote.vote_value).toBe(1);
		});

		it("should handle vote removal", async () => {
			const formData = new FormData();
			formData.append("action", "remove-vote");
			formData.append("entityType", "insight");
			formData.append("entityId", ENTITY_ID);

			const request = new Request("http://localhost/api/votes", {
				method: "POST",
				body: formData,
			});

			mockRemoveVote.mockResolvedValue({ error: null });

			mockGetVoteCountsForEntity.mockResolvedValue({
				data: { upvotes: 0, downvotes: 0 },
				error: null,
			});

			const mockContext = buildMockContext();
			const response = await votesAction({
				request,
				context: mockContext,
				params: { projectId: PROJECT_ID },
			});

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.success).toBe(true);
		});
	});

	describe("/api/entity-flags", () => {
		it("should handle GET request for user flags", async () => {
			const request = new Request(
				`http://localhost/api/entity-flags?entityType=insight&entityId=${ENTITY_ID}`
			);

			mockGetUserFlagsForEntity.mockResolvedValue({
				data: [
					{
						id: "1",
						flag_type: "starred",
						flag_value: true,
						created_at: new Date().toISOString(),
					},
				],
				error: null,
			});

			const mockContext = buildMockContext();
			const response = await entityFlagsLoader({
				request,
				context: mockContext,
				params: { projectId: PROJECT_ID },
			});

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.flags).toBeDefined();
			expect(Array.isArray(data.flags)).toBe(true);
		});

		it("should handle POST request to set flag", async () => {
			const formData = new FormData();
			formData.append("action", "set-flag");
			formData.append("entityType", "insight");
			formData.append("entityId", ENTITY_ID);
			formData.append("flagType", "archived");
			formData.append("flagValue", "true");

			const request = new Request("http://localhost/api/entity-flags", {
				method: "POST",
				body: formData,
			});

			mockSetEntityFlag.mockResolvedValue({
				data: {
					id: "1",
					flag_type: "archived",
					flag_value: true,
					created_at: new Date().toISOString(),
				},
				error: null,
			});

			mockGetUserFlagsForEntity.mockResolvedValue({
				data: [
					{
						id: "1",
						flag_type: "archived",
						flag_value: true,
						created_at: new Date().toISOString(),
					},
				],
				error: null,
			});

			const mockContext = buildMockContext();
			const response = await entityFlagsAction({
				request,
				context: mockContext,
				params: { projectId: PROJECT_ID, accountId: ACCOUNT_ID },
			});

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.flag).toBeDefined();
			expect(data.flag.flag_type).toBe("archived");
			expect(data.flag.flag_value).toBe(true);
		});
	});

	describe("Error Handling", () => {
		it("should handle database errors gracefully", async () => {
			const request = new Request(
				`http://localhost/api/annotations?entityType=insight&entityId=${ENTITY_ID}`
			);

			mockGetAnnotationsForEntity.mockResolvedValue({
				data: null,
				error: { message: "Database error" },
			});

			const mockContext = buildMockContext();
			const response = await annotationsLoader({ request, context: mockContext, params: {} });

			expect(response.status).toBe(500);
			const data = await response.json();
			expect(data.error).toBeDefined();
		});

		it("should handle missing authentication", async () => {
			const request = new Request(
				`http://localhost/api/annotations?entityType=insight&entityId=${ENTITY_ID}`
			);

			// annotations loader checks accountId and projectId - returns 400 when missing
			const mockContext = buildMockContext({
				userCtx: { supabase: mockSupabase, account_id: null, claims: null },
				projectCtx: { accountId: null, projectId: null, account: null, project: null },
			});

			const response = await annotationsLoader({ request, context: mockContext, params: {} });

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.error).toBeDefined();
		});
	});
});
