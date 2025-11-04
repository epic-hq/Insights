// @vitest-environment node

import { RuntimeContext } from "@mastra/core/di"
import { describe, expect, it, vi } from "vitest"
import { fetchInterviewContextTool } from "../fetch-interview-context"

vi.mock("~/lib/supabase/client.server", () => ({
        supabaseAdmin: {},
}))

describe("fetchInterviewContextTool", () => {
        it("returns missing interviewId message when no interview context provided", async () => {
                const runtimeContext = new RuntimeContext()
                runtimeContext.set("project_id", "project-123")

                const result = await fetchInterviewContextTool.execute({
                        context: {},
                        runtimeContext,
                })

                expect(result.success).toBe(false)
                expect(result.message).toContain("Missing interviewId")
        })

        it("returns missing project message when interviewId is provided but project is absent", async () => {
                const runtimeContext = new RuntimeContext()
                runtimeContext.set("interview_id", "interview-123")

                const result = await fetchInterviewContextTool.execute({
                        context: {},
                        runtimeContext,
                })

                expect(result.success).toBe(false)
                expect(result.message).toContain("Missing project_id")
        })
})
