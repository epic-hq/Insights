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
                data: z
                        .object({
                                accountId: z.string().optional(),
                                userId: z.string().optional(),
                                projects: z
                                        .array(
                                                z.object({
                                                        id: z.string(),
                                                        name: z.string().nullable(),
                                                        description: z.string().nullable(),
                                                        updated_at: z.string().nullable(),
                                                        isCurrent: z.boolean().optional(),
                                                })
                                        )
                                        .optional(),
                                project: z
                                        .object({
                                                id: z.string(),
                                                name: z.string().nullable(),
                                                description: z.string().nullable(),
                                                icp: z.string().nullable(),
                                        })
                                        .optional(),
                                status: z.unknown().optional(),
                                researchSections: z
                                        .array(
                                                z.object({
                                                        id: z.string(),
                                                        kind: z.string(),
                                                        content: z.string().nullable(),
                                                        meta: z.record(z.any()).nullable(),
                                                        updated_at: z.string().nullable(),
                                                })
                                        )
                                        .optional(),
                                insights: z
                                        .array(
                                                z.object({
                                                        id: z.string(),
                                                        name: z.string(),
                                                        category: z.string().nullable(),
                                                        summary: z.string().nullable(),
                                                        confidence: z.string().nullable(),
                                                        impact: z.number().nullable(),
                                                        pain: z.string().nullable(),
                                                        desired_outcome: z.string().nullable(),
                                                        journey_stage: z.string().nullable(),
                                                        created_at: z.string().nullable(),
                                                })
                                        )
                                        .optional(),
                                evidence: z
                                        .array(
                                                z.object({
                                                        id: z.string(),
                                                        gist: z.string().nullable(),
                                                        verbatim: z.string().nullable(),
                                                        context_summary: z.string().nullable(),
                                                        modality: z.string().nullable(),
                                                        interview_id: z.string().nullable(),
                                                        project_answer_id: z.string().nullable(),
                                                        created_at: z.string().nullable(),
                                                        tags: z.array(z.string()).nullable(),
                                                        personas: z.array(z.string()).nullable(),
                                                })
                                        )
                                        .optional(),
                                themes: z
                                        .array(
                                                z.object({
                                                        id: z.string(),
                                                        name: z.string().nullable(),
                                                        statement: z.string().nullable(),
                                                        inclusion_criteria: z.array(z.string()).nullable(),
                                                        exclusion_criteria: z.array(z.string()).nullable(),
                                                        synonyms: z.array(z.string()).nullable(),
                                                        anti_examples: z.array(z.string()).nullable(),
                                                        created_at: z.string().nullable(),
                                                        updated_at: z.string().nullable(),
                                                        evidence_ids: z.array(z.string()).optional(),
                                                        evidence_count: z.number().optional(),
                                                })
                                        )
                                        .optional(),
                                people: z
                                        .array(
                                                z.object({
                                                        id: z.string(),
                                                        name: z.string().nullable(),
                                                        role: z.string().nullable(),
                                                        title: z.string().nullable(),
                                                        company: z.string().nullable(),
                                                        segment: z.string().nullable(),
                                                        updated_at: z.string().nullable(),
                                                })
                                        )
                                        .optional(),
                                personas: z
                                        .array(
                                                z.object({
                                                        id: z.string(),
                                                        name: z.string(),
                                                        segment: z.string().nullable(),
                                                        primary_goal: z.string().nullable(),
                                                        pains: z.array(z.string()).nullable(),
                                                        motivations: z.array(z.string()).nullable(),
                                                        updated_at: z.string().nullable(),
                                                })
                                        )
                                        .optional(),
                        })
                        .nullable()
                        .optional(),
        }),
        execute: async ({ context, runtimeContext }) => {
                try {
                        const supabase = supabaseAdmin as unknown as SupabaseClient<Database>
                        const requestedProjectId = context.projectId
                        const requestedScopes = new Set<DetailScope>((context.scopes as DetailScope[] | undefined) ?? detailScopes)
                        const insightLimit = context.insightLimit ?? DEFAULT_INSIGHT_LIMIT
                        const evidenceLimit = context.evidenceLimit ?? DEFAULT_EVIDENCE_LIMIT
                        const themeLimit = context.themeLimit ?? DEFAULT_THEME_LIMIT
                        const peopleLimit = context.peopleLimit ?? DEFAULT_PERSON_LIMIT
                        const personaLimit = context.personaLimit ?? DEFAULT_PERSONA_LIMIT
                        const includeEvidence = context.includeEvidence ?? true

                        if (!includeEvidence) {
                                requestedScopes.delete("evidence")
                        }

                        const userId = runtimeContext.get("user_id") || undefined
                        const accountIdFromContext = runtimeContext.get("account_id") || undefined
                        const projectIdFromContext = runtimeContext.get("project_id") || undefined

                        let membershipAccountIds: string[] = []
                        if (userId) {
                                const { data: memberships, error: membershipError } = await supabase
                                        .from("account_user")
                                        .select("account_id")
                                        .eq("user_id", userId)

                                if (membershipError) {
                                        consola.error("[project-status-tool] membership lookup failed", membershipError)
                                        return {
                                                success: false,
                                                message: "Unable to verify account access",
                                        }
                                }

                                membershipAccountIds = (memberships || []).map((m) => m.account_id).filter(Boolean)
                        }
                        const candidateAccountIds = new Set<string>()
                        if (accountIdFromContext) {
                                candidateAccountIds.add(accountIdFromContext)
                        }
                        for (const id of membershipAccountIds) {
                                candidateAccountIds.add(id)
                        }

                        if (candidateAccountIds.size === 0) {
                                return {
                                        success: false,
                                        message: "No accessible accounts found for this user.",
                                }
                        }

                        if (
                                accountIdFromContext &&
                                membershipAccountIds.length > 0 &&
                                !membershipAccountIds.includes(accountIdFromContext)
                        ) {
                                return {
                                        success: false,
                                        message: "User does not have access to the requested account.",
                                }
                        }

                        const accountIdList = Array.from(candidateAccountIds)

                        const { data: projects, error: projectsError } = await supabase
                                .from("projects")
                                .select("id,name,description,account_id,updated_at")
                                .in("account_id", accountIdList)
                                .order("updated_at", { ascending: false })

                        if (projectsError) {
                                consola.error("[project-status-tool] project fetch failed", projectsError)
                                return {
                                        success: false,
                                        message: "Failed to load projects for this account.",
                                }
                        }

                        if (!projects || projects.length === 0) {
                                return {
                                        success: false,
                                        message: "No projects found for the current account.",
                                }
                        }

                        const resolvedProjectId = (() => {
                                const candidate = requestedProjectId || projectIdFromContext
                                if (!candidate) return null
                                return projects.some((p) => p.id === candidate) ? candidate : null
                        })()

                        if (!resolvedProjectId) {
                                return {
                                        success: true,
                                        message: "Select a project to inspect using the projectId parameter.",
                                        data: {
                                                accountId: accountIdFromContext,
                                                userId,
                                                projects: projects.map((p) => ({
                                                        id: p.id,
                                                        name: p.name,
                                                        description: p.description,
                                                        updated_at: normalizeDate(p.updated_at),
                                                        isCurrent: p.id === projectIdFromContext,
                                                })),
                                        },
                                }
                        }

                        const projectRow = projects.find((p) => p.id === resolvedProjectId)
                        if (!projectRow) {
                                return {
                                        success: false,
                                        message: "Project is not accessible for this user.",
                                }
                        }

                        const results: {
                                sections?: any[]
                                insights?: any[]
                                evidence?: any[]
                                themes?: any[]
                                people?: any[]
                                personas?: any[]
                        } = {}

                        const promises: Promise<void>[] = []

                        if (requestedScopes.has("sections")) {
                                promises.push(
                                        supabase
                                                .from("project_sections")
                                                .select("id,kind,meta,content_md,updated_at")
                                                .eq("project_id", resolvedProjectId)
                                                .then(({ data, error }) => {
                                                        if (error) throw error
                                                        results.sections = data || []
                                                })
                                )
                        }

                        if (requestedScopes.has("insights")) {
                                promises.push(
                                        supabase
                                                .from("insights")
                                                .select("id,name,category,details,confidence,impact,pain,desired_outcome,journey_stage,created_at")
                                                .eq("project_id", resolvedProjectId)
                                                .order("updated_at", { ascending: false })
                                                .limit(insightLimit)
                                                .then(({ data, error }) => {
                                                        if (error) throw error
                                                        results.insights = data || []
                                                })
                                )
                        }

                        if (requestedScopes.has("evidence")) {
                                promises.push(
                                        supabase
                                                .from("evidence")
                                                .select(
                                                        "id,gist,verbatim,context_summary,modality,interview_id,project_answer_id,created_at,kind_tags,personas"
                                                )
                                                .eq("project_id", resolvedProjectId)
                                                .order("created_at", { ascending: false })
                                                .limit(evidenceLimit)
                                                .then(({ data, error }) => {
                                                        if (error) throw error
                                                        results.evidence = data || []
                                                })
                                )
                        }

                        if (requestedScopes.has("people")) {
                                promises.push(
                                        supabase
                                                .from("people")
                                                .select("id,name,role,title,company,segment,updated_at")
                                                .eq("project_id", resolvedProjectId)
                                                .order("updated_at", { ascending: false })
                                                .limit(peopleLimit)
                                                .then(({ data, error }) => {
                                                        if (error) throw error
                                                        results.people = data || []
                                                })
                                )
                        }

                        if (requestedScopes.has("personas")) {
                                                promises.push(
                                                        supabase
                                                                .from("personas")
                                                                .select("id,name,segment,primary_goal,pains,motivations,updated_at")
                                                                .eq("project_id", resolvedProjectId)
                                                                .order("updated_at", { ascending: false })
                                                                .limit(personaLimit)
                                                                .then(({ data, error }) => {
                                                                        if (error) throw error
                                                                        results.personas = data || []
                                                                })
                                                )
                        }

                        if (requestedScopes.has("themes")) {
                                promises.push(
                                        (async () => {
                                                const { data, error } = await supabase
                                                        .from("themes")
                                                        .select(
                                                                "id,name,statement,inclusion_criteria,exclusion_criteria,synonyms,anti_examples,created_at,updated_at"
                                                        )
                                                        .eq("project_id", resolvedProjectId)
                                                        .order("updated_at", { ascending: false, nullsFirst: false })
                                                        .limit(themeLimit)

                                                if (error) throw error

                                                const themes = data || []
                                                if (themes.length === 0) {
                                                        results.themes = []
                                                        return
                                                }

                                                const themeIds = themes
                                                        .map((theme) => (theme as { id?: string }).id)
                                                        .filter((id): id is string => typeof id === "string" && id.length > 0)

                                                if (themeIds.length === 0) {
                                                        results.themes = themes
                                                        return
                                                }

                                                const { data: themeEvidence, error: themeEvidenceError } = await supabase
                                                        .from("theme_evidence")
                                                        .select("theme_id,evidence_id")
                                                        .eq("project_id", resolvedProjectId)
                                                        .in("theme_id", themeIds)

                                                if (themeEvidenceError) throw themeEvidenceError

                                                const evidenceByTheme = new Map<string, string[]>()
                                                for (const link of themeEvidence || []) {
                                                        const themeId = (link as { theme_id?: string }).theme_id
                                                        const evidenceId = (link as { evidence_id?: string }).evidence_id
                                                        if (!themeId || !evidenceId) continue
                                                        const list = evidenceByTheme.get(themeId) ?? []
                                                        list.push(evidenceId)
                                                        evidenceByTheme.set(themeId, list)
                                                }

                                                results.themes = themes.map((theme) => {
                                                        const id = (theme as { id?: string }).id as string | undefined
                                                        const evidenceIds = id ? evidenceByTheme.get(id) ?? [] : []
                                                        return {
                                                                ...theme,
                                                                evidence_ids: evidenceIds,
                                                                evidence_count: evidenceIds.length,
                                                        }
                                                })
                                        })()
                                )
                        }

                        await Promise.all(promises)

                        let statusData: Awaited<ReturnType<typeof getProjectStatusData>> | null = null
                        if (requestedScopes.has("status")) {
                                statusData = await getProjectStatusData(resolvedProjectId, supabase)
                        }

                        return {
                                success: true,
                                message: "Loaded project status context.",
                                data: {
                                        accountId: accountIdFromContext,
                                        userId,
                                        projects: projects.map((p) => ({
                                                id: p.id,
                                                name: p.name,
                                                description: p.description,
                                                updated_at: normalizeDate(p.updated_at),
                                                isCurrent: p.id === resolvedProjectId,
                                        })),
                                        project: {
                                                id: projectRow.id,
                                                name: projectRow.name,
                                                description: projectRow.description,
                                                icp: projectRow.description,
                                        },
                                        status: statusData
                                                ? {
                                                          ...statusData,
                                                          lastUpdated: normalizeDate(statusData.lastUpdated),
                                                  }
                                                : undefined,
                                        researchSections: results.sections?.map((section) => ({
                                                id: section.id as string,
                                                kind: (section as { kind: string }).kind,
                                                content: (section as { content_md?: string | null }).content_md ?? null,
                                                meta: ((section as { meta?: unknown }).meta as Record<string, unknown>) ?? null,
                                                updated_at: normalizeDate((section as { updated_at?: string | null }).updated_at ?? null),
                                        })),
                                        insights: results.insights?.map((insight) => ({
                                                id: insight.id as string,
                                                name: insight.name as string,
                                                category: insight.category as string | null,
                                                summary: (insight as { details?: string | null }).details ?? null,
                                                confidence: (insight as { confidence?: string | null }).confidence ?? null,
                                                impact: (insight as { impact?: number | null }).impact ?? null,
                                                pain: (insight as { pain?: string | null }).pain ?? null,
                                                desired_outcome: (insight as { desired_outcome?: string | null }).desired_outcome ?? null,
                                                journey_stage: (insight as { journey_stage?: string | null }).journey_stage ?? null,
                                                created_at: normalizeDate((insight as { created_at?: string | null }).created_at ?? null),
                                        })),
                                        evidence: results.evidence?.map((item) => ({
                                                id: item.id as string,
                                                gist: (item as { gist?: string | null }).gist ?? null,
                                                verbatim: (item as { verbatim?: string | null }).verbatim ?? null,
                                                context_summary: (item as { context_summary?: string | null }).context_summary ?? null,
                                                modality: (item as { modality?: string | null }).modality ?? null,
                                                interview_id: (item as { interview_id?: string | null }).interview_id ?? null,
                                                project_answer_id: (item as { project_answer_id?: string | null }).project_answer_id ?? null,
                                                created_at: normalizeDate((item as { created_at?: string | null }).created_at ?? null),
                                                tags: Array.isArray((item as { kind_tags?: unknown }).kind_tags)
                                                        ? ((item as { kind_tags?: string[] }).kind_tags ?? null)
                                                        : null,
                                                personas: Array.isArray((item as { personas?: unknown }).personas)
                                                        ? ((item as { personas?: string[] }).personas ?? null)
                                                        : null,
                                        })),
                                        themes: results.themes?.map((theme) => ({
                                                id: theme.id as string,
                                                name: (theme as { name?: string | null }).name ?? null,
                                                statement: (theme as { statement?: string | null }).statement ?? null,
                                                inclusion_criteria: Array.isArray((theme as { inclusion_criteria?: unknown }).inclusion_criteria)
                                                        ? ((theme as { inclusion_criteria?: string[] }).inclusion_criteria ?? null)
                                                        : null,
                                                exclusion_criteria: Array.isArray((theme as { exclusion_criteria?: unknown }).exclusion_criteria)
                                                        ? ((theme as { exclusion_criteria?: string[] }).exclusion_criteria ?? null)
                                                        : null,
                                                synonyms: Array.isArray((theme as { synonyms?: unknown }).synonyms)
                                                        ? ((theme as { synonyms?: string[] }).synonyms ?? null)
                                                        : null,
                                                anti_examples: Array.isArray((theme as { anti_examples?: unknown }).anti_examples)
                                                        ? ((theme as { anti_examples?: string[] }).anti_examples ?? null)
                                                        : null,
                                                created_at: normalizeDate((theme as { created_at?: string | null }).created_at ?? null),
                                                updated_at: normalizeDate((theme as { updated_at?: string | null }).updated_at ?? null),
                                                evidence_ids: Array.isArray((theme as { evidence_ids?: unknown }).evidence_ids)
                                                        ? ((theme as { evidence_ids?: string[] }).evidence_ids ?? undefined)
                                                        : undefined,
                                                evidence_count:
                                                        typeof (theme as { evidence_count?: unknown }).evidence_count === "number"
                                                                ? ((theme as { evidence_count?: number }).evidence_count ?? undefined)
                                                                : (Array.isArray((theme as { evidence_ids?: unknown }).evidence_ids)
                                                                          ? (theme as { evidence_ids?: string[] }).evidence_ids?.length
                                                                          : undefined),
                                        })),
                                        people: results.people?.map((person) => ({
                                                id: person.id as string,
                                                name: (person as { name?: string | null }).name ?? null,
                                                role: (person as { role?: string | null }).role ?? null,
                                                title: (person as { title?: string | null }).title ?? null,
                                                company: (person as { company?: string | null }).company ?? null,
                                                segment: (person as { segment?: string | null }).segment ?? null,
                                                updated_at: normalizeDate((person as { updated_at?: string | null }).updated_at ?? null),
                                        })),
                                        personas: results.personas?.map((persona) => ({
                                                id: persona.id as string,
                                                name: persona.name as string,
                                                segment: (persona as { segment?: string | null }).segment ?? null,
                                                primary_goal: (persona as { primary_goal?: string | null }).primary_goal ?? null,
                                                pains: Array.isArray((persona as { pains?: unknown }).pains)
                                                        ? ((persona as { pains?: string[] }).pains ?? null)
                                                        : null,
                                                motivations: Array.isArray((persona as { motivations?: unknown }).motivations)
                                                        ? ((persona as { motivations?: string[] }).motivations ?? null)
                                                        : null,
                                                updated_at: normalizeDate((persona as { updated_at?: string | null }).updated_at ?? null),
                                        })),
                                },
                        }
                } catch (error) {
                        consola.error("[project-status-tool] unexpected error", error)
                        return {
                                success: false,
                                message: "Unexpected error loading project data.",
                        }
                }
        },
})
