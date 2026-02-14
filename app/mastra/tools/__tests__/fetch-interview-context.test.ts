// @vitest-environment node

import { RequestContext } from "@mastra/core/di";
import { describe, expect, it, vi } from "vitest";
import { fetchInterviewContextTool } from "../fetch-interview-context";

vi.mock("../../../lib/supabase/client.server", () => ({
  supabaseAdmin: {},
}));

describe("fetchInterviewContextTool", () => {
  it("returns missing interviewId message when no interview context provided", async () => {
    const requestContext = new RequestContext();
    requestContext.set("project_id", "00000000-0000-0000-0000-000000000001");

    const result = await fetchInterviewContextTool.execute(
      {},
      { requestContext },
    );

    // Check it's not a ValidationError before accessing properties
    expect("error" in result && result.error === true).toBe(false);
    if (!("error" in result)) {
      expect(result.success).toBe(false);
      expect(result.message).toContain("Missing or invalid interviewId");
    }
  });

  it("returns missing project message when interviewId is provided but project is absent", async () => {
    const requestContext = new RequestContext();
    // Must be a valid UUID so it passes the interviewId check and reaches the project_id check
    requestContext.set("interview_id", "00000000-0000-0000-0000-000000000002");

    const result = await fetchInterviewContextTool.execute(
      {},
      { requestContext },
    );

    // Check it's not a ValidationError before accessing properties
    expect("error" in result && result.error === true).toBe(false);
    if (!("error" in result)) {
      expect(result.success).toBe(false);
      expect(result.message).toContain("Missing project_id");
    }
  });
});
