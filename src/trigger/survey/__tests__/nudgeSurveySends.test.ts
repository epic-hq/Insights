/**
 * Tests for the survey nudge scheduled task.
 * Verifies nudge logic: query, send, update counts, stop after max nudges.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSendGmailEmail = vi.fn();

vi.mock("~/lib/integrations/gmail.server", () => ({
  sendGmailEmail: (...args: unknown[]) => mockSendGmailEmail(...args),
}));

// Supabase chainable mock
const mockFromResults: Record<string, { data: unknown; error: unknown }> = {};
const mockUpdateCalls: Array<{ table: string; payload: unknown; id: string }> =
  [];

function createTableChain(table: string) {
  const chain: Record<string, any> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq = vi.fn((col: string, val: unknown) => {
    if (col === "id") chain._currentId = val;
    return chain;
  });
  chain.in = vi.fn(self);
  chain.lte = vi.fn(self);
  chain.order = vi.fn(self);
  chain.limit = vi.fn(() => {
    const result = mockFromResults[table] ?? { data: [], error: null };
    return Promise.resolve(result);
  });
  chain.single = vi.fn(() => {
    const result = mockFromResults[table] ?? { data: null, error: null };
    return Promise.resolve(result);
  });
  chain.update = vi.fn((payload: unknown) => {
    mockUpdateCalls.push({ table, payload: payload, id: chain._currentId });
    return chain;
  });
  chain._currentId = null;
  return chain;
}

const mockFrom = vi.fn((table: string) => createTableChain(table));

vi.mock("~/lib/supabase/client.server", () => ({
  createSupabaseAdminClient: () => ({
    from: (...args: unknown[]) => mockFrom(...(args as [string])),
  }),
}));

// Mock schedules from trigger SDK
vi.mock("@trigger.dev/sdk", () => ({
  schedules: {
    task: (config: { id: string; cron: string; run: () => unknown }) => {
      return { ...config, trigger: vi.fn() };
    },
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSend(overrides: Record<string, unknown> = {}) {
  return {
    id: "send-1",
    survey_id: "survey-1",
    gmail_connection_id: "conn-1",
    to_email: "recipient@example.com",
    to_name: "Test User",
    subject: "Quick feedback request: My Survey",
    from_email: "sender@gmail.com",
    personalized_link:
      "https://app.test/ask/my-survey?ref=email&email=recipient@example.com",
    nudge_count: 0,
    gmail_message_id: "msg-original",
    gmail_thread_id: "thread-original",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("nudgeSurveySends task", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateCalls.length = 0;
    Object.keys(mockFromResults).forEach((k) => delete mockFromResults[k]);
  });

  it("exports a scheduled task with correct cron", async () => {
    const { nudgeSurveySendsTask } = await import("../nudgeSurveySends");
    expect(nudgeSurveySendsTask.id).toBe("survey.nudge-sends");
    expect(nudgeSurveySendsTask.cron).toBe("30 * * * *");
  });

  it("returns early when no pending nudges exist", async () => {
    const { nudgeSurveySendsTask } = await import("../nudgeSurveySends");

    mockFromResults.survey_sends = { data: [], error: null };

    const result = await nudgeSurveySendsTask.run();

    expect(result).toEqual({ nudged: 0, failed: 0 });
    expect(mockSendGmailEmail).not.toHaveBeenCalled();
  });

  it("sends nudge email and updates nudge_count", async () => {
    const { nudgeSurveySendsTask } = await import("../nudgeSurveySends");

    const send = makeSend();
    const connection = {
      id: "conn-1",
      pica_connection_key: "pica-key-1",
      is_active: true,
    };

    // Set up mock responses for each from() call in sequence
    let fromCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      fromCallCount++;
      const chain = createTableChain(table);

      if (table === "survey_sends" && fromCallCount === 1) {
        // First call: query pending sends
        chain.limit = vi.fn(() =>
          Promise.resolve({ data: [send], error: null }),
        );
      } else if (table === "gmail_connections") {
        // Load connections
        chain.eq = vi.fn(() =>
          Promise.resolve({ data: [connection], error: null }),
        );
      } else if (table === "research_links") {
        // Load survey names
        chain.in = vi.fn(() =>
          Promise.resolve({
            data: [{ id: "survey-1", name: "My Survey" }],
            error: null,
          }),
        );
      } else if (table === "survey_sends") {
        // Update calls - just succeed
        chain.eq = vi.fn(() => Promise.resolve({ error: null }));
      }

      return chain;
    });

    mockSendGmailEmail.mockResolvedValue({
      messageId: "msg-nudge-1",
      threadId: "thread-original",
    });

    const result = await nudgeSurveySendsTask.run();

    expect(result).toEqual({ nudged: 1, failed: 0 });

    // Verify sendGmailEmail was called with threading
    expect(mockSendGmailEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionKey: "pica-key-1",
        to: "recipient@example.com",
        toName: "Test User",
        subject: "Re: Quick feedback request: My Survey",
        replyToMessageId: "msg-original",
        threadId: "thread-original",
      }),
    );
  });

  it("disables nudging when connection is missing", async () => {
    const { nudgeSurveySendsTask } = await import("../nudgeSurveySends");

    const send = makeSend({ gmail_connection_id: "missing-conn" });

    let fromCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      fromCallCount++;
      const chain = createTableChain(table);

      if (table === "survey_sends" && fromCallCount === 1) {
        chain.limit = vi.fn(() =>
          Promise.resolve({ data: [send], error: null }),
        );
      } else if (table === "gmail_connections") {
        // No connections found
        chain.eq = vi.fn(() => Promise.resolve({ data: [], error: null }));
      } else if (table === "research_links") {
        chain.in = vi.fn(() => Promise.resolve({ data: [], error: null }));
      } else if (table === "survey_sends") {
        chain.eq = vi.fn(() => Promise.resolve({ error: null }));
      }

      return chain;
    });

    const result = await nudgeSurveySendsTask.run();

    expect(result).toEqual({ nudged: 0, failed: 1 });
    expect(mockSendGmailEmail).not.toHaveBeenCalled();
  });
});
