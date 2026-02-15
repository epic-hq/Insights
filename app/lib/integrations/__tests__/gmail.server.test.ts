/**
 * Tests for Gmail integration server functions.
 * Tests database operations and email sending logic with mocked Supabase and Pica.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPicaPassthrough = vi.fn();

vi.mock("~/lib/integrations/pica.server", () => ({
  picaPassthrough: (...args: unknown[]) => mockPicaPassthrough(...args),
}));

// Chainable Supabase mock
function createChainMock(resolveWith: { data: unknown; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.insert = vi.fn(self);
  chain.update = vi.fn(self);
  chain.upsert = vi.fn(self);
  chain.delete = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.in = vi.fn(self);
  chain.lte = vi.fn(self);
  chain.or = vi.fn(self);
  chain.order = vi.fn(self);
  chain.limit = vi.fn(self);
  chain.single = vi.fn(() => Promise.resolve(resolveWith));
  chain.maybeSingle = vi.fn(() => Promise.resolve(resolveWith));
  // For queries that don't end with .single()
  chain.then = vi.fn((resolve) => resolve(resolveWith));
  return chain;
}

function createMockSupabase() {
  const tableChains: Record<string, ReturnType<typeof createChainMock>> = {};

  return {
    from: vi.fn((table: string) => {
      if (!tableChains[table]) {
        tableChains[table] = createChainMock({ data: null, error: null });
      }
      return tableChains[table];
    }),
    _setTableResponse(
      table: string,
      response: { data: unknown; error: unknown },
    ) {
      tableChains[table] = createChainMock(response);
    },
    _getTableChain(table: string) {
      return tableChains[table];
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("gmail.server", () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
  });

  describe("getGmailConnection", () => {
    it("returns connection when found", async () => {
      const { getGmailConnection } =
        await import("~/lib/integrations/gmail.server");

      const mockConnection = {
        id: "conn-1",
        user_id: "user-1",
        account_id: "acc-1",
        pica_connection_id: "pica-1",
        pica_connection_key: "key-1",
        email: "test@gmail.com",
        is_active: true,
      };

      mockSupabase._setTableResponse("gmail_connections", {
        data: mockConnection,
        error: null,
      });

      const result = await getGmailConnection(
        mockSupabase as any,
        "user-1",
        "acc-1",
      );

      expect(result).toEqual(mockConnection);
      expect(mockSupabase.from).toHaveBeenCalledWith("gmail_connections");
    });

    it("returns null when no connection exists", async () => {
      const { getGmailConnection } =
        await import("~/lib/integrations/gmail.server");

      mockSupabase._setTableResponse("gmail_connections", {
        data: null,
        error: { code: "PGRST116", message: "not found" },
      });

      const result = await getGmailConnection(
        mockSupabase as any,
        "user-1",
        "acc-1",
      );

      expect(result).toBeNull();
    });
  });

  describe("getSurveySendStats", () => {
    it("returns null when no sends exist", async () => {
      const { getSurveySendStats } =
        await import("~/lib/integrations/gmail.server");

      // Override the chain to resolve directly (no .single())
      const chain = createChainMock({ data: [], error: null });
      mockSupabase.from = vi.fn(() => chain);
      // Since getSurveySendStats doesn't call .single(), we need the chain
      // to resolve the query. We override the terminal to return data directly.
      chain.eq = vi.fn(() => Promise.resolve({ data: [], error: null }));

      const result = await getSurveySendStats(mockSupabase as any, "survey-1");

      expect(result).toBeNull();
    });

    it("computes stats correctly from send records", async () => {
      const { getSurveySendStats } =
        await import("~/lib/integrations/gmail.server");

      const sends = [
        { status: "sent", nudge_enabled: true, next_nudge_at: null },
        { status: "sent", nudge_enabled: true, next_nudge_at: null },
        { status: "opened", nudge_enabled: true, next_nudge_at: null },
        {
          status: "completed",
          nudge_enabled: false,
          next_nudge_at: null,
        },
        {
          status: "completed",
          nudge_enabled: false,
          next_nudge_at: null,
        },
      ];

      const chain = createChainMock({ data: sends, error: null });
      mockSupabase.from = vi.fn(() => chain);
      chain.eq = vi.fn(() => Promise.resolve({ data: sends, error: null }));

      const result = await getSurveySendStats(mockSupabase as any, "survey-1");

      expect(result).toEqual({
        total: 5,
        sent: 2,
        opened: 1,
        completed: 2,
        pendingNudge: 0,
      });
    });
  });

  describe("getBatchSurveySendStats", () => {
    it("returns empty object for no survey IDs", async () => {
      const { getBatchSurveySendStats } =
        await import("~/lib/integrations/gmail.server");

      const result = await getBatchSurveySendStats(mockSupabase as any, []);
      expect(result).toEqual({});
    });

    it("groups stats by survey ID", async () => {
      const { getBatchSurveySendStats } =
        await import("~/lib/integrations/gmail.server");

      const sends = [
        { survey_id: "s1", status: "sent" },
        { survey_id: "s1", status: "completed" },
        { survey_id: "s2", status: "sent" },
        { survey_id: "s2", status: "opened" },
        { survey_id: "s2", status: "completed" },
      ];

      const chain = createChainMock({ data: sends, error: null });
      mockSupabase.from = vi.fn(() => chain);
      chain.in = vi.fn(() => Promise.resolve({ data: sends, error: null }));

      const result = await getBatchSurveySendStats(mockSupabase as any, [
        "s1",
        "s2",
      ]);

      expect(result).toEqual({
        s1: { total: 2, sent: 1, opened: 0, completed: 1 },
        s2: { total: 3, sent: 1, opened: 1, completed: 1 },
      });
    });
  });

  describe("sendGmailEmail", () => {
    it("sends email via Pica passthrough and returns messageId/threadId", async () => {
      const { sendGmailEmail } =
        await import("~/lib/integrations/gmail.server");

      mockPicaPassthrough.mockResolvedValue({
        data: { id: "msg-123", threadId: "thread-456" },
      });

      const result = await sendGmailEmail({
        connectionKey: "key-1",
        to: "recipient@example.com",
        from: "sender@gmail.com",
        subject: "Test subject",
        bodyHtml: "<p>Hello</p>",
      });

      expect(result).toEqual({
        messageId: "msg-123",
        threadId: "thread-456",
      });

      // Verify Pica was called with correct platform and path
      expect(mockPicaPassthrough).toHaveBeenCalledWith(
        "key-1",
        "gmail",
        expect.objectContaining({
          method: "POST",
          path: "/gmail/v1/users/me/messages/send",
        }),
      );
    });

    it("includes threading headers for reply emails", async () => {
      const { sendGmailEmail } =
        await import("~/lib/integrations/gmail.server");

      mockPicaPassthrough.mockResolvedValue({
        data: { id: "msg-456", threadId: "thread-789" },
      });

      await sendGmailEmail({
        connectionKey: "key-1",
        to: "recipient@example.com",
        from: "sender@gmail.com",
        subject: "Re: Test",
        bodyHtml: "<p>Follow up</p>",
        replyToMessageId: "original-msg-id",
        threadId: "thread-789",
      });

      // The raw email body should contain In-Reply-To header
      const callArgs = mockPicaPassthrough.mock.calls[0];
      const body = callArgs[2].body;
      expect(body.raw).toBeDefined();
      expect(body.threadId).toBe("thread-789");

      // Decode the raw message to verify headers
      const decoded = Buffer.from(
        body.raw.replace(/-/g, "+").replace(/_/g, "/"),
        "base64",
      ).toString();
      expect(decoded).toContain("In-Reply-To: original-msg-id");
      expect(decoded).toContain("References: original-msg-id");
    });

    it("base64url encodes the email correctly", async () => {
      const { sendGmailEmail } =
        await import("~/lib/integrations/gmail.server");

      mockPicaPassthrough.mockResolvedValue({
        data: { id: "msg-1", threadId: "thread-1" },
      });

      await sendGmailEmail({
        connectionKey: "key-1",
        to: "test@example.com",
        toName: "Test User",
        from: "sender@gmail.com",
        subject: "Survey invite",
        bodyHtml: "<p>Take the survey</p>",
      });

      const raw = mockPicaPassthrough.mock.calls[0][2].body.raw;
      // base64url should NOT contain +, /, or =
      expect(raw).not.toMatch(/[+/=]/);
    });
  });

  describe("createSurveySends", () => {
    it("returns empty array for empty input", async () => {
      const { createSurveySends } =
        await import("~/lib/integrations/gmail.server");

      const result = await createSurveySends(mockSupabase as any, []);
      expect(result).toEqual([]);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it("inserts sends with nudge defaults", async () => {
      const { createSurveySends } =
        await import("~/lib/integrations/gmail.server");

      const insertedRecords = [
        {
          id: "send-1",
          status: "sent",
          nudge_enabled: true,
          nudge_count: 0,
        },
      ];

      const chain = createChainMock({
        data: insertedRecords,
        error: null,
      });
      mockSupabase.from = vi.fn(() => chain);
      chain.select = vi.fn(() =>
        Promise.resolve({ data: insertedRecords, error: null }),
      );

      const result = await createSurveySends(mockSupabase as any, [
        {
          account_id: "acc-1",
          project_id: "proj-1",
          survey_id: "survey-1",
          gmail_connection_id: "conn-1",
          to_email: "recipient@example.com",
          subject: "Test",
          from_email: "sender@gmail.com",
        },
      ]);

      expect(result).toHaveLength(1);
      // Verify insert was called with nudge_enabled: true
      const insertCall = chain.insert.mock.calls[0][0];
      expect(insertCall[0].nudge_enabled).toBe(true);
      expect(insertCall[0].status).toBe("sent");
      expect(insertCall[0].next_nudge_at).toBeDefined();
    });
  });

  describe("markSurveySendCompleted", () => {
    it("updates matching sends to completed status", async () => {
      const { markSurveySendCompleted } =
        await import("~/lib/integrations/gmail.server");

      const chain = createChainMock({ data: null, error: null });
      mockSupabase.from = vi.fn(() => chain);
      chain.or = vi.fn(() => Promise.resolve({ error: null }));

      await markSurveySendCompleted(
        mockSupabase as any,
        "survey-1",
        "test@example.com",
      );

      expect(mockSupabase.from).toHaveBeenCalledWith("survey_sends");
      // Verify update payload includes completed status and disabled nudge
      const updatePayload = chain.update.mock.calls[0][0];
      expect(updatePayload.status).toBe("completed");
      expect(updatePayload.nudge_enabled).toBe(false);
      expect(updatePayload.next_nudge_at).toBeNull();
      expect(updatePayload.completed_at).toBeDefined();
    });
  });
});
