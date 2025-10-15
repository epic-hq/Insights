import { randomUUID } from "node:crypto"
import { b } from "baml_client"
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { getProjectContextGeneric } from "~/features/questions/db"
import { getServerClient } from "~/lib/supabase/client.server"
import { currentProjectContext } from "~/server/current-project-context"
import { fromManagerResearchMode, type ResearchMode, toManagerResearchMode } from "~/types/research"

const VALIDATION_GATES = ["pain_exists", "awareness", "quantified", "acting"] as const
type ValidationGateSlug = (typeof VALIDATION_GATES)[number]

interface ValidationGateMetaItem {
	slug: ValidationGateSlug
	research_question_id: string
	research_question_text: string
	decision_question_id: string | null
	decision_question_text: string | null
	prompt_ids: string[]
	prompt_texts: string[]
}

type ValidationGateMeta = Record<ValidationGateSlug, ValidationGateMetaItem>

export async function action({ request, context }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	try {
		const formData = await request.formData()
		// Get project context
		let ctxProjectId: string | null = null
		try {
			if (context?.get) {
				const ctxVal = context.get(currentProjectContext)
				ctxProjectId = ctxVal?.projectId || null
			}
		} catch {
			// Context not available, continue
		}

		const project_id = (formData.get("project_id") as string) || ctxProjectId
		if (!project_id) {
			return Response.json({ error: "Project ID is required" }, { status: 400 })
		}

		// Get Supabase client
		const { client: supabase } = getServerClient(request)

		// Extract form parameters
		const target_orgs = formData.get("target_orgs") as string
		const target_roles = formData.get("target_roles") as string
		const research_goal = formData.get("research_goal") as string
		const research_goal_details = formData.get("research_goal_details") as string
		const assumptions = formData.get("assumptions") as string
		const unknowns = formData.get("unknowns") as string
		const custom_instructions = formData.get("custom_instructions") as string
		const requestedResearchMode = formData.get("research_mode") as string | null
		const coerceResearchMode = (value: unknown): ResearchMode | null => {
			if (typeof value !== "string") return null
			const managerMode = toManagerResearchMode(value)
			if (!managerMode) return null
			return fromManagerResearchMode(managerMode)
		}
		let research_mode: ResearchMode = coerceResearchMode(requestedResearchMode) ?? "exploratory"

		// Validate required fields
		if (!research_goal?.trim()) {
			return Response.json({ error: "Research goal is required" }, { status: 400 })
		}

		// Load existing project context if project_id provided
		let projectContext: any = null
		if (project_id) {
			try {
				projectContext = await getProjectContextGeneric(supabase, project_id)
			} catch (error) {
				consola.warn("Could not load project context:", error)
			}
		}
		const mergedContext = (projectContext?.merged ?? {}) as Record<string, unknown>
		if (!requestedResearchMode) {
			const mergedMode =
				coerceResearchMode(mergedContext?.research_mode) ||
				coerceResearchMode(mergedContext?.conversation_type) ||
				coerceResearchMode((mergedContext?.settings as Record<string, unknown> | undefined)?.research_mode)
			if (mergedMode) research_mode = mergedMode
		}

		const modeInstruction = (() => {
			if (research_mode === "validation") {
				return "Validation mode: create exactly four research questions aligned to the validation gates (pain_exists, awareness, quantified, acting) and link prompts to those IDs."
			}
			if (research_mode === "user_testing") {
				return "User testing mode: emphasise usability, comprehension, and adoption evidence when shaping research questions and prompts."
			}
			return "Exploratory mode: balance discovery across goals, pain, workflow, and adoption assumptions."
		})()
		const combinedInstructions = [custom_instructions || "", modeInstruction].filter(Boolean).join("\n\n")

		// Prepare inputs for BAML
		const inputs = {
			target_org: target_orgs || (mergedContext?.target_orgs as string) || projectContext?.target_orgs || "",
			target_roles: target_roles || (mergedContext?.target_roles as string) || projectContext?.target_roles || "",
			research_goal: research_goal || (mergedContext?.research_goal as string) || projectContext?.research_goal || "",
			research_goal_details:
				research_goal_details ||
				(mergedContext?.research_goal_details as string) ||
				projectContext?.research_goal_details ||
				"",
			assumptions: assumptions || (mergedContext?.assumptions as string) || projectContext?.assumptions || "",
			unknowns: unknowns || (mergedContext?.unknowns as string) || projectContext?.unknowns || "",
			custom_instructions: combinedInstructions,
			session_id: randomUUID(),
			round: 1,
			interview_time_limit: 30,
			research_mode,
		}

		consola.log("[RESEARCH STRUCTURE] Generating with inputs:", inputs)

		// Generate research structure using BAML
		const researchStructure = await b.GenerateResearchStructure(inputs)

		consola.log("[RESEARCH STRUCTURE] Generated:", {
			decision_questions: researchStructure.decision_questions.length,
			research_questions: researchStructure.research_questions.length,
			interview_prompts: researchStructure.interview_prompts.length,
		})

		// Save to database in proper structure
		const { error: saveError, validationGateMeta } = await saveResearchStructure(
			supabase,
			project_id,
			researchStructure,
			{
				researchMode: research_mode,
			}
		)

		if (saveError) {
			throw saveError
		}

		return Response.json({
			success: true,
			structure: researchStructure,
			validation_gates: validationGateMeta,
			message: `Generated ${researchStructure.decision_questions.length} decision questions, ${researchStructure.research_questions.length} research questions, and ${researchStructure.interview_prompts.length} interview prompts`,
		})
	} catch (error) {
		consola.error("[RESEARCH STRUCTURE] Generation failed:", error)
		return Response.json(
			{
				error: "Failed to generate research structure",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		)
	}
}

function getValidationGateSlug(id: string): ValidationGateSlug | undefined {
	return VALIDATION_GATES.find((slug) => slug === id) as ValidationGateSlug | undefined
}

async function persistValidationGateMeta(
	supabase: any,
	projectId: string,
	gateMeta: ValidationGateMeta | null,
	researchMode: ResearchMode
) {
	try {
		const { data: questionSection } = await supabase
			.from("project_sections")
			.select("id, content_md, meta, position")
			.eq("project_id", projectId)
			.eq("kind", "questions")
			.limit(1)
			.maybeSingle()

		const existingMeta = (questionSection?.meta as Record<string, any>) ?? {}

		const updatedSettings = {
			...(existingMeta.settings ?? {}),
			research_mode: researchMode,
		}

		const updatedMeta: Record<string, any> = {
			...existingMeta,
			settings: updatedSettings,
		}

		if (gateMeta && Object.keys(gateMeta).length > 0) {
			updatedMeta.validation_gate_map = gateMeta
		} else if (updatedMeta.validation_gate_map) {
			delete updatedMeta.validation_gate_map
		}

		const content_md = questionSection?.content_md ?? "# Questions\n"

		const { error } = await supabase.from("project_sections").upsert(
			{
				project_id: projectId,
				kind: "questions",
				position: questionSection?.position ?? 2,
				content_md,
				meta: updatedMeta,
			},
			{ onConflict: "project_id,kind" }
		)

		if (error) throw error
		return { error: null }
	} catch (error) {
		consola.error("[RESEARCH STRUCTURE] Failed to persist validation gate metadata", error)
		return { error }
	}
}

async function saveResearchStructure(
	supabase: any,
	projectId: string,
	structure: any,
	options?: { researchMode?: ResearchMode }
) {
	try {
		// Generate proper UUIDs for all items since BAML might generate simple numeric IDs
		const idMapping = new Map<string, string>()
		const isValidationMode = options?.researchMode === "validation"
		const validationGateMeta: Partial<Record<ValidationGateSlug, ValidationGateMetaItem>> = {}

		const registerGateMeta = (
			gate: ValidationGateSlug,
			updater: (existing?: ValidationGateMetaItem) => ValidationGateMetaItem
		) => {
			validationGateMeta[gate] = updater(validationGateMeta[gate])
		}

		// Generate UUID mappings for decision questions
		structure.decision_questions.forEach((dq: any) => {
			if (!idMapping.has(dq.id)) {
				idMapping.set(dq.id, randomUUID())
			}
		})
		const decisionLookup = new Map<string, { id: string; text: string }>()
		structure.decision_questions.forEach((dq: any) => {
			const mappedId = idMapping.get(dq.id)
			if (mappedId) {
				decisionLookup.set(dq.id, { id: mappedId, text: dq.text })
			}
		})

		// Generate UUID mappings for research questions
		structure.research_questions.forEach((rq: any) => {
			if (!idMapping.has(rq.id)) {
				idMapping.set(rq.id, randomUUID())
			}
		})

		// Generate UUID mappings for interview prompts
		structure.interview_prompts.forEach((ip: any) => {
			if (!idMapping.has(ip.id)) {
				idMapping.set(ip.id, randomUUID())
			}
		})

		// 1. Save Decision Questions
		const decisionQuestions = structure.decision_questions.map((dq: any) => ({
			id: idMapping.get(dq.id),
			project_id: projectId,
			text: dq.text,
			rationale: dq.rationale,
		}))

		const { error: dqError } = await supabase.from("decision_questions").upsert(decisionQuestions, { onConflict: "id" })

		if (dqError) throw dqError

		// 2. Save Research Questions
		const researchQuestions = structure.research_questions.map((rq: any) => {
			const mappedId = idMapping.get(rq.id)
			const mappedDecisionId = rq.decision_question_id ? (idMapping.get(rq.decision_question_id) ?? null) : null
			const gateSlug = isValidationMode ? getValidationGateSlug(rq.id) : undefined
			if (isValidationMode && gateSlug) {
				registerGateMeta(gateSlug, (existing) => ({
					slug: gateSlug,
					research_question_id: mappedId!,
					research_question_text: rq.text,
					decision_question_id: mappedDecisionId,
					decision_question_text: mappedDecisionId
						? (decisionLookup.get(rq.decision_question_id!)?.text ?? null)
						: null,
					prompt_ids: existing?.prompt_ids ?? [],
					prompt_texts: existing?.prompt_texts ?? [],
				}))
			}
			return {
				id: mappedId,
				project_id: projectId,
				text: rq.text,
				rationale: rq.rationale,
				decision_question_id: mappedDecisionId,
			}
		})

		const { error: rqError } = await supabase.from("research_questions").upsert(researchQuestions, { onConflict: "id" })

		if (rqError) throw rqError

		// 3. Save Interview Prompts
		const interviewPrompts = structure.interview_prompts.map((ip: any) => {
			const mappedId = idMapping.get(ip.id)
			const gateSlug = isValidationMode ? getValidationGateSlug(ip.research_question_id) : undefined
			if (gateSlug && validationGateMeta[gateSlug]) {
				registerGateMeta(gateSlug, (existing) => ({
					...existing!,
					prompt_ids: [...(existing?.prompt_ids ?? []), mappedId!],
					prompt_texts: [...(existing?.prompt_texts ?? []), ip.text],
				}))
			}
			return {
				id: mappedId,
				project_id: projectId,
				text: ip.text,
				category: gateSlug ?? ip.category ?? null,
			}
		})

		const { error: ipError } = await supabase.from("interview_prompts").upsert(interviewPrompts, { onConflict: "id" })

		if (ipError) throw ipError

		// 4. Link Interview Prompts to Research Questions
		const promptResearchLinks = structure.interview_prompts.map((ip: any) => ({
			id: randomUUID(),
			project_id: projectId,
			prompt_id: idMapping.get(ip.id),
			research_question_id: idMapping.get(ip.research_question_id),
		}))

		const { error: linkError } = await supabase
			.from("interview_prompt_research_questions")
			.upsert(promptResearchLinks, { onConflict: "id" })

		if (linkError) throw linkError

		let gateMetaPayload: ValidationGateMeta | null = null
		if (isValidationMode) {
			for (const gate of VALIDATION_GATES) {
				if (!validationGateMeta[gate] || !validationGateMeta[gate]?.research_question_id) {
					delete validationGateMeta[gate]
				}
			}
			if (Object.keys(validationGateMeta).length > 0) {
				gateMetaPayload = validationGateMeta as ValidationGateMeta
			}
		}

		await persistValidationGateMeta(supabase, projectId, gateMetaPayload, options?.researchMode ?? "exploratory")

		consola.log("[RESEARCH STRUCTURE] Saved successfully to database")
		return {
			error: null,
			validationGateMeta: gateMetaPayload,
		}
	} catch (error) {
		consola.error("[RESEARCH STRUCTURE] Database save failed:", error)
		return { error, validationGateMeta: null }
	}
}
