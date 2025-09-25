import { randomUUID } from "node:crypto"
import { b } from "baml_client"
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { getProjectContextGeneric } from "~/features/questions/db"
import { getServerClient } from "~/lib/supabase/server"
import { currentProjectContext } from "~/server/current-project-context"

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

		// Prepare inputs for BAML
		const inputs = {
			target_org: target_orgs || projectContext?.target_orgs || "",
			target_roles: target_roles || projectContext?.target_roles || "",
			research_goal: research_goal || projectContext?.research_goal || "",
			research_goal_details: research_goal_details || projectContext?.research_goal_details || "",
			assumptions: assumptions || projectContext?.assumptions || "",
			unknowns: unknowns || projectContext?.unknowns || "",
			custom_instructions: custom_instructions || "",
			session_id: randomUUID(),
			round: 1,
			interview_time_limit: 30,
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
		const { error: saveError } = await saveResearchStructure(supabase, project_id, researchStructure)

		if (saveError) {
			throw saveError
		}

		return Response.json({
			success: true,
			structure: researchStructure,
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

async function saveResearchStructure(supabase: any, projectId: string, structure: any) {
	try {
		// Generate proper UUIDs for all items since BAML might generate simple numeric IDs
		const idMapping = new Map<string, string>()
		
		// Generate UUID mappings for decision questions
		structure.decision_questions.forEach((dq: any) => {
			if (!idMapping.has(dq.id)) {
				idMapping.set(dq.id, randomUUID())
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
		const researchQuestions = structure.research_questions.map((rq: any) => ({
			id: idMapping.get(rq.id),
			project_id: projectId,
			text: rq.text,
			rationale: rq.rationale,
			decision_question_id: idMapping.get(rq.decision_question_id),
		}))

		const { error: rqError } = await supabase.from("research_questions").upsert(researchQuestions, { onConflict: "id" })

		if (rqError) throw rqError

		// 3. Save Interview Prompts
		const interviewPrompts = structure.interview_prompts.map((ip: any) => ({
			id: idMapping.get(ip.id),
			project_id: projectId,
			text: ip.text,
		}))

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

		consola.log("[RESEARCH STRUCTURE] Saved successfully to database")
		return { error: null }
	} catch (error) {
		consola.error("[RESEARCH STRUCTURE] Database save failed:", error)
		return { error }
	}
}
