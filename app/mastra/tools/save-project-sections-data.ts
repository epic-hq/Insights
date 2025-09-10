import { createTool } from "@mastra/core/tools"
import consola from "consola"
import { z } from "zod"
import { supabaseAdmin } from "~/lib/supabase/server"
import { upsertProjectSection } from "~/features/projects/db"
import type { Database } from "~/types"

// Helpers to format content consistently with /api/save-project-goals
const formatters = {
  array_numbered: (items: string[], field: string) => ({
    content_md: items.map((v, i) => `${i + 1}. ${v}`).join("\n"),
    meta: { [field]: items },
  }),
  array_spaced: (items: string[], field: string) => ({
    content_md: items.map((v, i) => `${i + 1}. ${v}`).join("\n\n"),
    meta: { [field]: items },
  }),
  goal_with_details: (goal: string, details?: string) => ({
    content_md: `# ${goal}\n\n${details || ""}`,
    meta: { research_goal: goal, research_goal_details: details || "" },
  }),
}

type SectionInput = {
  kind: string
  payload: unknown
}

function toSection(kind: string, payload: unknown): null | {
  kind: string
  content_md: string
  meta: Record<string, unknown>
} {
  switch (kind) {
    case "target_orgs":
    case "target_roles":
    case "decision_questions": {
      if (Array.isArray(payload)) return { kind, ...formatters.array_numbered(payload, kind) }
      return null
    }
    case "assumptions":
    case "unknowns": {
      if (Array.isArray(payload)) return { kind, ...formatters.array_spaced(payload, kind) }
      return null
    }
    case "research_goal": {
      if (typeof payload === "object" && payload && "research_goal" in (payload as any)) {
        const g = payload as { research_goal: string; research_goal_details?: string }
        if (!g.research_goal?.trim()) return null
        return { kind, ...formatters.goal_with_details(g.research_goal, g.research_goal_details) }
      }
      if (typeof payload === "string" && payload.trim()) {
        return { kind, ...formatters.goal_with_details(payload) }
      }
      return null
    }
    default:
      return null
  }
}

export const saveProjectSectionsDataTool = createTool({
  id: "save-project-sections-data",
  description: "Upsert one or more project sections (project_sections) for the given project_id.",
  inputSchema: z.object({
    project_id: z.string().min(1, "project_id is required"),
    research_goal: z.string().optional(),
    research_goal_details: z.string().optional(),
    decision_questions: z.array(z.string()).optional(),
    assumptions: z.array(z.string()).optional(),
    unknowns: z.array(z.string()).optional(),
    target_orgs: z.array(z.string()).optional(),
    target_roles: z.array(z.string()).optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    saved: z.array(z.string()).optional(),
  }),
  execute: async ({ context }) => {
    try {
      const {
        project_id,
        research_goal,
        research_goal_details,
        decision_questions,
        assumptions,
        unknowns,
        target_orgs,
        target_roles,
      } = context

      if (!project_id) {
        return { success: false, message: "Missing project_id to save project sections" }
      }

      const candidates: SectionInput[] = []
      if (research_goal || research_goal_details) {
        candidates.push({ kind: "research_goal", payload: { research_goal: research_goal || "", research_goal_details } })
      }
      if (decision_questions) candidates.push({ kind: "decision_questions", payload: decision_questions })
      if (assumptions) candidates.push({ kind: "assumptions", payload: assumptions })
      if (unknowns) candidates.push({ kind: "unknowns", payload: unknowns })
      if (target_orgs) candidates.push({ kind: "target_orgs", payload: target_orgs })
      if (target_roles) candidates.push({ kind: "target_roles", payload: target_roles })

      const toSave = candidates
        .map(({ kind, payload }) => toSection(kind, payload))
        .filter(Boolean) as { kind: string; content_md: string; meta: Record<string, unknown> }[]

      if (toSave.length === 0) {
        return { success: false, message: "No valid sections provided" }
      }

      const savedKinds: string[] = []
      for (const s of toSave) {
        const res = await upsertProjectSection({
          supabase: supabaseAdmin as any,
          data: {
            project_id,
            kind: s.kind,
            content_md: s.content_md,
            meta: s.meta as Database["public"]["Tables"]["project_sections"]["Insert"]["meta"],
          },
        })
        if ((res as any)?.error) {
          consola.error("Failed to upsert project section", s.kind, (res as any).error)
          return { success: false, message: `Failed saving section: ${s.kind}` }
        }
        savedKinds.push(s.kind)
      }

      return { success: true, message: "Saved project sections", saved: savedKinds }
    } catch (e) {
      consola.error("save-project-sections-data error", e)
      return { success: false, message: `Error: ${e instanceof Error ? e.message : String(e)}` }
    }
  },
})

