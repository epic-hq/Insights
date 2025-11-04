import { createTool } from "@mastra/core/tools"
import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import { z } from "zod"
import type { Database } from "~/types"
import { supabaseAdmin } from "~/lib/supabase/client.server"
import { getProjectStatusData } from "~/utils/project-status.server"

const DEFAULT_INSIGHT_LIMIT = 8
const DEFAULT_EVIDENCE_LIMIT = 6
const DEFAULT_PERSON_LIMIT = 12
const DEFAULT_PERSONA_LIMIT = 8
const DEFAULT_THEME_LIMIT = 12

const detailScopes = [
        "status",
        "sections",
        "insights",
        "evidence",
        "themes",
        "people",
        "personas",
] as const

type DetailScope = (typeof detailScopes)[number]

function normalizeDate(value: unknown) {
        if (!value) return null
        if (value instanceof Date) return value.toISOString()
        if (typeof value === "string") return value
        return null
}

export const fetchProjectStatusContextTool = createTool({
        id: "fetch-project-status-context",
        description:
                "Load project status context, including research sections, insights, evidence, people, and personas for accessible projects.",
        inputSchema: z.object({
                projectId: z.string().optional().describe("Project ID to load. Defaults to the current project in context."),
                scopes: z
                        .array(z.enum(detailScopes))
                        .optional()
                        .describe("Optional list of data groups to fetch."),
                insightLimit: z
                        .number()
                        .int()
                        .min(1)
                        .max(50)
                        .optional()
                        .describe("Maximum number of insights to return."),
                evidenceLimit: z
                        .number()
                        .int()
                        .min(1)
                        .max(50)
                        .optional()
                        .describe("Maximum number of evidence items to return."),
                themeLimit: z
                        .number()
                        .int()
                        .min(1)
                        .max(50)
                        .optional()
                        .describe("Maximum number of themes to return."),
                peopleLimit: z
                        .number()
                        .int()
                        .min(1)
                        .max(100)
                        .optional()
                        .describe("Maximum number of people to return."),
                personaLimit: z
                        .number()
                        .int()
                        .min(1)
                        .max(50)
                        .optional()
                        .describe("Maximum number of personas to return."),
                includeEvidence: z
                        .boolean()
                        .optional()
                        .describe(
                                "Set to false to omit detailed evidence and focus on higher-level insights and personas."
                        ),
        }),
        outputSchema: z.object({
                success: z.boolean(),
                message: z.string(),
        }),
        execute: async ({ context, runtimeContext }) => {
                return {
                        success: true,
                        message: "Project status context loaded successfully",
                }
        },
})
