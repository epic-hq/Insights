/**
 * Tests for the send-survey API route action.
 * Verifies validation, batching, and error handling.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetGmailConnection = vi.fn();
const mockSendGmailEmail = vi.fn();
const mockCreateSurveySends = vi.fn();

vi.mock("~/lib/integrations/gmail.server", () => ({
  getGmailConnection: (...args: unknown[]) => mockGetGmailConnection(...args),
  sendGmailEmail: (...args: unknown[]) => mockSendGmailEmail(...args),
  createSurveySends: (...args: unknown[]) => mockCreateSurveySends(...args),
}));

const mockUserContext = {
  claims: { sub: "user-123" },
  supabase: {},
};

vi.mock("~/server/user-context", () => ({
  userContext: {
    // Mock the context.get() interface
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockRequest(body: unknown) {
  return new Request("https://app.test/api/gmail/send-survey", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createMockContext() {
  return {
    get: vi.fn(() => mockUserContext),
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("api.gmail.send-survey action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateSurveySends.mockResolvedValue([]);
  });

  it("returns 401 when user is not authenticated", async () => {
    const { action } = await import("~/routes/api.gmail.send-survey");

    const context = {
      get: vi.fn(() => ({ claims: null })),
    } as any;

    const response = await action({
      context,
      request: createMockRequest({}),
      params: {},
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 400 when required fields are missing", async () => {
    const { action } = await import("~/routes/api.gmail.send-survey");

    const response = await action({
      context: createMockContext(),
      request: createMockRequest({
        accountId: "acc-1",
        // Missing projectId, surveyId, etc.
      }),
      params: {},
    });

    expect(response.status).toBe(400);
  });

  it("returns 400 when no recipients provided", async () => {
    const { action } = await import("~/routes/api.gmail.send-survey");

    const response = await action({
      context: createMockContext(),
      request: createMockRequest({
        accountId: "acc-1",
        projectId: "proj-1",
        surveyId: "survey-1",
        surveySlug: "my-survey",
        surveyName: "My Survey",
        subject: "Test",
        recipients: [],
      }),
      params: {},
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("No recipients provided");
  });

  it("returns 400 when Gmail is not connected", async () => {
    const { action } = await import("~/routes/api.gmail.send-survey");

    mockGetGmailConnection.mockResolvedValue(null);

    const response = await action({
      context: createMockContext(),
      request: createMockRequest({
        accountId: "acc-1",
        projectId: "proj-1",
        surveyId: "survey-1",
        surveySlug: "my-survey",
        surveyName: "My Survey",
        subject: "Feedback request",
        recipients: [{ email: "test@example.com" }],
      }),
      params: {},
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("Gmail not connected");
  });

  it("sends emails and returns success with counts", async () => {
    const { action } = await import("~/routes/api.gmail.send-survey");

    mockGetGmailConnection.mockResolvedValue({
      id: "conn-1",
      email: "sender@gmail.com",
      pica_connection_key: "pica-key",
    });

    mockSendGmailEmail.mockResolvedValue({
      messageId: "msg-1",
      threadId: "thread-1",
    });

    const response = await action({
      context: createMockContext(),
      request: createMockRequest({
        accountId: "acc-1",
        projectId: "proj-1",
        surveyId: "survey-1",
        surveySlug: "my-survey",
        surveyName: "My Survey",
        subject: "Feedback request",
        recipients: [
          { email: "alice@example.com", name: "Alice" },
          { email: "bob@example.com" },
        ],
      }),
      params: {},
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.sent).toBe(2);
    expect(data.failed).toBe(0);
    expect(data.total).toBe(2);

    // Verify sendGmailEmail was called for each recipient
    expect(mockSendGmailEmail).toHaveBeenCalledTimes(2);

    // Verify createSurveySends was called with successful sends
    expect(mockCreateSurveySends).toHaveBeenCalledTimes(1);
  });

  it("handles partial failures gracefully", async () => {
    const { action } = await import("~/routes/api.gmail.send-survey");

    mockGetGmailConnection.mockResolvedValue({
      id: "conn-1",
      email: "sender@gmail.com",
      pica_connection_key: "pica-key",
    });

    // First email succeeds, second fails
    mockSendGmailEmail
      .mockResolvedValueOnce({ messageId: "msg-1", threadId: "thread-1" })
      .mockRejectedValueOnce(new Error("Rate limited"));

    const response = await action({
      context: createMockContext(),
      request: createMockRequest({
        accountId: "acc-1",
        projectId: "proj-1",
        surveyId: "survey-1",
        surveySlug: "my-survey",
        surveyName: "My Survey",
        subject: "Feedback",
        recipients: [
          { email: "alice@example.com" },
          { email: "bob@example.com" },
        ],
      }),
      params: {},
    });

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.sent).toBe(1);
    expect(data.failed).toBe(1);

    // Only successful send should be recorded
    expect(mockCreateSurveySends).toHaveBeenCalledTimes(1);
    const sendRecords = mockCreateSurveySends.mock.calls[0][1];
    expect(sendRecords).toHaveLength(1);
    expect(sendRecords[0].to_email).toBe("alice@example.com");
  });
});
