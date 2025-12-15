import { beforeEach, describe, expect, it, vi } from "vitest"
import { action } from "./api.share-invite"

// Mock dependencies
vi.mock("~/emails/clients.server", () => ({
	sendEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("~/features/teams/db/invitations", () => ({
	createInvitation: vi.fn(),
}))

vi.mock("~/paths", () => ({
	PATHS: {
		AUTH: {
			HOST: "https://app.example.com",
		},
	},
}))

vi.mock("consola", () => ({
	default: {
		log: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}))

// Mock the email component - it's a React component so we need to mock it
vi.mock("../../emails/share-invite.tsx", () => ({
	default: vi.fn(() => null),
}))

import { sendEmail } from "~/emails/clients.server"
import { createInvitation } from "~/features/teams/db/invitations"

const mockSendEmail = vi.mocked(sendEmail)
const mockCreateInvitation = vi.mocked(createInvitation)

// Helper to create mock context
function createMockContext(
	overrides: Partial<{
		supabase: any
		claims: any
		user_metadata: any
	}> = {}
) {
	// Use 'in' check to allow explicit null values
	const mockSupabase =
		"supabase" in overrides
			? overrides.supabase
			: {
					from: vi.fn().mockReturnValue({
						select: vi.fn().mockReturnValue({
							eq: vi.fn().mockReturnValue({
								single: vi.fn().mockResolvedValue({
									data: { name: "Test Team" },
									error: null,
								}),
							}),
						}),
					}),
				}

	return {
		get: vi.fn().mockReturnValue({
			supabase: mockSupabase,
			claims: overrides.claims ?? {
				email: "inviter@example.com",
				name: "Test User",
			},
			user_metadata: overrides.user_metadata ?? {
				name: "Test User",
				email: "inviter@example.com",
			},
			account_id: "test-account-id",
		}),
	}
}

// Helper to create form data
function createFormData(data: Record<string, string>) {
	const formData = new FormData()
	for (const [key, value] of Object.entries(data)) {
		formData.set(key, value)
	}
	return formData
}

// Valid form data for testing
const validFormData = {
	targetEmail: "recipient@example.com",
	accountId: "d7b69d5e-a952-41a6-931f-e2fed1d82e85",
	resourceLink: "https://app.example.com/a/d7b69d5e-a952-41a6-931f-e2fed1d82e85/project/evidence/123",
	resourceName: "Test Evidence",
	resourceType: "evidence",
}

describe("api/share-invite", () => {
	beforeEach(() => {
		vi.clearAllMocks()

		// Default mock for createInvitation
		mockCreateInvitation.mockResolvedValue({
			data: { token: "test-invite-token-123" },
			error: null,
		})

		// Default mock for sendEmail (success)
		mockSendEmail.mockResolvedValue(undefined)
	})

	describe("HTTP Method Validation", () => {
		it("should return 405 for GET requests", async () => {
			const request = new Request("http://localhost/api/share-invite", {
				method: "GET",
			})

			const response = await action({
				request,
				context: createMockContext(),
				params: {},
			})

			expect(response.status).toBe(405)
			const data = await response.json()
			expect(data.error).toBe("Method not allowed")
		})

		it("should return 405 for PUT requests", async () => {
			const request = new Request("http://localhost/api/share-invite", {
				method: "PUT",
				body: createFormData(validFormData),
			})

			const response = await action({
				request,
				context: createMockContext(),
				params: {},
			})

			expect(response.status).toBe(405)
		})
	})

	describe("Authentication", () => {
		it("should return 401 when supabase client is null", async () => {
			const request = new Request("http://localhost/api/share-invite", {
				method: "POST",
				body: createFormData(validFormData),
			})

			const response = await action({
				request,
				context: createMockContext({ supabase: null }),
				params: {},
			})

			expect(response.status).toBe(401)
			const data = await response.json()
			expect(data.error).toBe("Unauthorized")
		})
	})

	describe("Form Validation", () => {
		it("should return 400 for missing targetEmail", async () => {
			const formData = { ...validFormData }
			delete (formData as any).targetEmail

			const request = new Request("http://localhost/api/share-invite", {
				method: "POST",
				body: createFormData(formData),
			})

			const response = await action({
				request,
				context: createMockContext(),
				params: {},
			})

			expect(response.status).toBe(400)
			const data = await response.json()
			expect(data.error).toBe("Invalid share payload")
		})

		it("should return 400 for invalid email format", async () => {
			const request = new Request("http://localhost/api/share-invite", {
				method: "POST",
				body: createFormData({ ...validFormData, targetEmail: "not-an-email" }),
			})

			const response = await action({
				request,
				context: createMockContext(),
				params: {},
			})

			expect(response.status).toBe(400)
		})

		it("should return 400 for invalid accountId (not UUID)", async () => {
			const request = new Request("http://localhost/api/share-invite", {
				method: "POST",
				body: createFormData({ ...validFormData, accountId: "not-a-uuid" }),
			})

			const response = await action({
				request,
				context: createMockContext(),
				params: {},
			})

			expect(response.status).toBe(400)
		})

		it("should return 400 for invalid resourceLink (not URL)", async () => {
			const request = new Request("http://localhost/api/share-invite", {
				method: "POST",
				body: createFormData({ ...validFormData, resourceLink: "not-a-url" }),
			})

			const response = await action({
				request,
				context: createMockContext(),
				params: {},
			})

			expect(response.status).toBe(400)
		})

		it("should return 400 for empty resourceName", async () => {
			const request = new Request("http://localhost/api/share-invite", {
				method: "POST",
				body: createFormData({ ...validFormData, resourceName: "" }),
			})

			const response = await action({
				request,
				context: createMockContext(),
				params: {},
			})

			expect(response.status).toBe(400)
		})

		it("should return 400 for empty resourceType", async () => {
			const request = new Request("http://localhost/api/share-invite", {
				method: "POST",
				body: createFormData({ ...validFormData, resourceType: "" }),
			})

			const response = await action({
				request,
				context: createMockContext(),
				params: {},
			})

			expect(response.status).toBe(400)
		})

		it("should accept shareUrl as alternative to resourceLink", async () => {
			const formData = new FormData()
			formData.set("targetEmail", validFormData.targetEmail)
			formData.set("accountId", validFormData.accountId)
			formData.set("shareUrl", validFormData.resourceLink) // Use shareUrl instead
			formData.set("resourceName", validFormData.resourceName)
			formData.set("resourceType", validFormData.resourceType)

			const request = new Request("http://localhost/api/share-invite", {
				method: "POST",
				body: formData,
			})

			const response = await action({
				request,
				context: createMockContext(),
				params: {},
			})

			expect(response.status).toBe(200)
		})
	})

	describe("Invitation Creation", () => {
		it("should call createInvitation with correct parameters", async () => {
			const request = new Request("http://localhost/api/share-invite", {
				method: "POST",
				body: createFormData(validFormData),
			})

			await action({
				request,
				context: createMockContext(),
				params: {},
			})

			expect(mockCreateInvitation).toHaveBeenCalledWith(
				expect.objectContaining({
					account_id: validFormData.accountId,
					account_role: "member",
					invitation_type: "one_time",
					invitee_email: validFormData.targetEmail,
				})
			)
		})

		it("should return 500 when invitation creation fails", async () => {
			mockCreateInvitation.mockResolvedValue({
				data: null,
				error: { message: "Database error" },
			})

			const request = new Request("http://localhost/api/share-invite", {
				method: "POST",
				body: createFormData(validFormData),
			})

			const response = await action({
				request,
				context: createMockContext(),
				params: {},
			})

			expect(response.status).toBe(500)
			const data = await response.json()
			expect(data.error).toBe("Failed to create invitation")
		})

		it("should return 500 when no token is returned", async () => {
			mockCreateInvitation.mockResolvedValue({
				data: {}, // No token
				error: null,
			})

			const request = new Request("http://localhost/api/share-invite", {
				method: "POST",
				body: createFormData(validFormData),
			})

			const response = await action({
				request,
				context: createMockContext(),
				params: {},
			})

			expect(response.status).toBe(500)
			const data = await response.json()
			expect(data.error).toBe("Failed to create invitation")
		})
	})

	describe("Email Sending", () => {
		it("should send email with correct parameters on success", async () => {
			const request = new Request("http://localhost/api/share-invite", {
				method: "POST",
				body: createFormData(validFormData),
			})

			await action({
				request,
				context: createMockContext(),
				params: {},
			})

			expect(mockSendEmail).toHaveBeenCalledWith(
				expect.objectContaining({
					to: validFormData.targetEmail,
					subject: expect.stringContaining("invited you to join"),
					reply_to: "inviter@example.com",
				})
			)
		})

		it("should include note in email when provided", async () => {
			const formDataWithNote = {
				...validFormData,
				note: "Check out this evidence!",
			}

			const request = new Request("http://localhost/api/share-invite", {
				method: "POST",
				body: createFormData(formDataWithNote),
			})

			const response = await action({
				request,
				context: createMockContext(),
				params: {},
			})

			expect(response.status).toBe(200)
			expect(mockSendEmail).toHaveBeenCalled()
		})

		it("should return 500 when email sending fails", async () => {
			mockSendEmail.mockRejectedValue(new Error("SMTP error"))

			const request = new Request("http://localhost/api/share-invite", {
				method: "POST",
				body: createFormData(validFormData),
			})

			const response = await action({
				request,
				context: createMockContext(),
				params: {},
			})

			expect(response.status).toBe(500)
			const data = await response.json()
			expect(data.error).toBe("Unable to send invite right now")
		})
	})

	describe("Success Response", () => {
		it("should return ok: true on successful invitation", async () => {
			const request = new Request("http://localhost/api/share-invite", {
				method: "POST",
				body: createFormData(validFormData),
			})

			const response = await action({
				request,
				context: createMockContext(),
				params: {},
			})

			expect(response.status).toBe(200)
			const data = await response.json()
			expect(data.ok).toBe(true)
		})
	})

	describe("Inviter Name Fallbacks", () => {
		it("should use user_metadata.name as inviter name when available", async () => {
			const request = new Request("http://localhost/api/share-invite", {
				method: "POST",
				body: createFormData(validFormData),
			})

			await action({
				request,
				context: createMockContext({
					user_metadata: { name: "John Doe" },
					claims: { email: "john@example.com" },
				}),
				params: {},
			})

			expect(mockSendEmail).toHaveBeenCalledWith(
				expect.objectContaining({
					subject: expect.stringContaining("John Doe"),
				})
			)
		})

		it("should fall back to claims.email when name is not available", async () => {
			const request = new Request("http://localhost/api/share-invite", {
				method: "POST",
				body: createFormData(validFormData),
			})

			await action({
				request,
				context: createMockContext({
					user_metadata: {},
					claims: { email: "fallback@example.com" },
				}),
				params: {},
			})

			expect(mockSendEmail).toHaveBeenCalledWith(
				expect.objectContaining({
					subject: expect.stringContaining("fallback@example.com"),
				})
			)
		})

		it("should fall back to 'A teammate' when no name or email", async () => {
			const request = new Request("http://localhost/api/share-invite", {
				method: "POST",
				body: createFormData(validFormData),
			})

			await action({
				request,
				context: createMockContext({
					user_metadata: {},
					claims: {},
				}),
				params: {},
			})

			expect(mockSendEmail).toHaveBeenCalledWith(
				expect.objectContaining({
					subject: expect.stringContaining("A teammate"),
				})
			)
		})
	})
})
