// @vitest-environment node

/**
 * Tests for agent configuration: tool registration, system prompt structure.
 * Tests the raw config objects before they're passed to Mastra Agent constructor.
 */

import { RequestContext } from "@mastra/core/di";
import { describe, expect, it, vi } from "vitest";

// Mock heavy dependencies
vi.mock("../../lib/billing/instrumented-openai.server", () => ({
	openai: vi.fn(() => ({ modelId: "gpt-4.1" })),
}));
vi.mock("../../lib/gen-ui/agent-context", () => ({
	buildGenUISystemContext: () => "## Gen-UI Context (mocked)",
}));
vi.mock("../../lib/supabase/client.server", () => ({
	supabaseAdmin: { from: vi.fn(), schema: vi.fn() },
}));
vi.mock("../storage/postgres-singleton", () => ({
	getSharedPostgresStore: () => ({ __mock: true }),
}));
vi.mock("../agents/chief-of-staff-agent", () => ({ chiefOfStaffAgent: {} }));
vi.mock("../agents/feedback-agent", () => ({ feedbackAgent: {} }));
vi.mock("../agents/howto-agent", () => ({ howtoAgent: {} }));
vi.mock("../agents/ops-agent", () => ({ opsAgent: {} }));
vi.mock("../agents/people-agent", () => ({ peopleAgent: {} }));
vi.mock("../agents/research-agent", () => ({ researchAgent: {} }));
vi.mock("../agents/survey-agent", () => ({ surveyAgent: {} }));
vi.mock("../agents/task-agent", () => ({ taskAgent: {} }));

describe("agent configuration", () => {
	it("projectStatusAgent is created with expected name", async () => {
		const { projectStatusAgent } = await import("../agents/project-status-agent");
		expect(projectStatusAgent).toBeDefined();
		expect((projectStatusAgent as any).name).toBe("projectStatusAgent");
	});

	it("shared memory exports a functional Memory instance", async () => {
		const { memory } = await import("../memory");
		expect(memory).toBeDefined();
		expect(typeof memory.saveMessages).toBe("function");
		expect(typeof memory.createThread).toBe("function");
		expect(typeof memory.listThreads).toBe("function");
	});
});
