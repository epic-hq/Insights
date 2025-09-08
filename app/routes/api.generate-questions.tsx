import { randomUUID } from "node:crypto"
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { getProjectContextGeneric } from "~/features/questions/db"
import { getServerClient } from "~/lib/supabase/server"
import { currentProjectContext } from "~/server/current-project-context"
import { generateQuestionSetCanonical } from "~/utils/research-analysis.server"

export async function action({ request, context }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	try {
		const formData = await request.formData()
		// Prefer explicit project_id from form, else fall back to server currentProjectContext (if available)
		let ctxProjectId: string | null = null
		try {
			if (context?.get) {
				const ctxVal = context.get(currentProjectContext)
				ctxProjectId = ctxVal?.projectId ?? null
			}
		} catch {
			// context not provided for this route; ignore
		}
		const project_id = ((formData.get("project_id") as string) || ctxProjectId || null) as string | null
		let target_orgs = formData.get("target_orgs") as string
		let target_roles = formData.get("target_roles") as string
		let research_goal = formData.get("research_goal") as string
		let research_goal_details = formData.get("research_goal_details") as string
		let assumptions = formData.get("assumptions") as string
		let unknowns = formData.get("unknowns") as string
		let custom_instructions = ((formData.get("custom_instructions") as string) || "").trim()
		const questionCount = Number(formData.get("questionCount") ?? 10)
		const interview_time_limit = Number(formData.get("interview_time_limit") ?? 60)
		let existingQuestions: string[] = []

		// If project_id is provided, load project context from database
		if (project_id) {
			const { client: supabase } = getServerClient(request)

			try {
				const projectContext = await getProjectContextGeneric(supabase, project_id)

				consola.log("projectContext:", projectContext)

				if (!projectContext) {
					return Response.json(
						{
							error: "Project context not found in database. Please complete project setup first.",
						},
						{ status: 400 }
					)
				}

				const meta = projectContext.merged as any
				// Load from database, keep custom_instructions from request
				target_orgs = meta.target_orgs?.join?.(", ") || meta.target_orgs || target_orgs || ""
				target_roles = meta.target_roles?.join?.(", ") || meta.target_roles || target_roles || ""
				research_goal = meta.research_goal || research_goal || ""
				research_goal_details = meta.research_goal_details || research_goal_details || ""
				assumptions = meta.assumptions?.join?.(", ") || meta.assumptions || assumptions || ""
				unknowns = meta.unknowns?.join?.(", ") || meta.unknowns || unknowns || ""

				// Fallback to project-level custom instructions when request provides none
				if (!custom_instructions || custom_instructions.length === 0) {
					custom_instructions = meta.custom_instructions || meta.settings?.customInstructions || ""
				}

				// Load existing questions to influence dedupe and limit count
				try {
					const { data: questionsSection } = await supabase
						.from("project_sections")
						.select("meta")
						.eq("project_id", project_id)
						.eq("kind", "questions")
						.order("updated_at", { ascending: false })
						.limit(1)
						.single()
					const metaQ: any = questionsSection?.meta || {}
					const qs: any[] = Array.isArray(metaQ.questions) ? metaQ.questions : []
					existingQuestions = qs.map((q: any) => (typeof q === "string" ? q : q?.text)).filter(Boolean)
					if (existingQuestions.length > 0) {
						// Respect front-end provided questionCount; do not override here.
						// Append a dedupe instruction to custom_instructions regardless
						const dedupeList = existingQuestions.slice(0, 25).join("; ")
						const dedupeNote = `Avoid repeating or rephrasing these existing questions: ${dedupeList}. Generate complementary questions.`
						custom_instructions = `${custom_instructions ? custom_instructions + "\n" : ""}${dedupeNote}`
					}
				} catch (e) {
					// Non-fatal
				}
			} catch (error) {
				consola.warn("Could not load project context from database:", error)
			}
		}

		// Validate required fields (only when not loading from database)
		// Only the core trio are required: target_orgs, target_roles, research_goal
		if (!project_id) {
			const missing: string[] = []
			if (!target_orgs?.trim()) missing.push("target_orgs")
			if (!target_roles?.trim()) missing.push("target_roles")
			if (!research_goal?.trim()) missing.push("research_goal")
			// Soft-optional: details/assumptions/unknowns (default to empty if missing)
			research_goal_details = research_goal_details || ""
			assumptions = assumptions || ""
			unknowns = unknowns || ""
			if (missing.length > 0) {
				return Response.json({ error: `Missing required fields: ${missing.join(", ")}` }, { status: 400 })
			}
		}

		// Final validation after potentially loading from database
		// Require only the core trio; default the rest to empty strings
		const coreMissing: string[] = []
		if (!target_orgs?.trim()) coreMissing.push("target_orgs")
		if (!target_roles?.trim()) coreMissing.push("target_roles")
		if (!research_goal?.trim()) coreMissing.push("research_goal")
		research_goal_details = research_goal_details || ""
		assumptions = assumptions || ""
		unknowns = unknowns || ""
		if (coreMissing.length > 0) {
			const baseMsg = `Missing required fields: ${coreMissing.join(", ")}`
			return Response.json({ error: project_id ? `${baseMsg} in project context` : baseMsg }, { status: 400 })
		}

		// consola.log("Generating questions for:", {
		// 	project_id,
		// 	target_orgs,
		// 	target_roles,
		// 	research_goal,
		// 	research_goal_details,
		// 	assumptions,
		// 	unknowns,
		// 	custom_instructions,
		// })

		consola.log("Generating questions (canonical) for:", {
			target_orgs,
			target_roles,
			research_goal,
			research_goal_details,
			assumptions,
			unknowns,
			questionCount,
			interview_time_limit,
			custom_instructions,
		})

		// Helper: sanitize square‑bracket placeholders that sometimes slip through LLMs
		const sanitizeQuestion = (text: string): string => {
			let t = String(text || "")
			// Replace any [placeholder] with a neutral pronoun
			t = t.replace(/\[[^\]]+\]/g, "this")
			// Normalize multiple spaces and spaces before punctuation
			t = t.replace(/\s{2,}/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim()
			return t
		}

		// Try canonical BAML QuestionSet generation; on validation failure, fall back.
		let questionSet: any
		const computedSessionId = `session_${Date.now()}`
		try {
			const ensure = (v: unknown, fallback = "unspecified") => {
				const s = typeof v === "string" ? v : String(v ?? "")
				return s.trim().length > 0 ? s : fallback
			}
			questionSet = await generateQuestionSetCanonical({
				target_orgs: ensure(target_orgs),
				target_roles: ensure(target_roles),
				research_goal: ensure(research_goal, "General research goal"),
				research_goal_details: ensure(research_goal_details, ""),
				assumptions: ensure(assumptions, ""),
				unknowns: ensure(unknowns, ""),
				custom_instructions: ensure(custom_instructions, ""),
				session_id: ensure(computedSessionId),
				round: 1,
				total_per_round: questionCount || 10,
				per_category_min: 1,
				per_category_max: 3,
				interview_time_limit,
			})

			// Sanitize canonical output to remove any placeholders
			if (Array.isArray(questionSet?.questions)) {
				questionSet.questions = questionSet.questions.map((q: any) => ({
					...q,
					text: sanitizeQuestion(q.text),
				}))
			}

			// If canonical returns fewer than requested, top up via fallback suggestions
			try {
				const have = Array.isArray(questionSet?.questions) ? questionSet.questions.length : 0
				const need = Math.max(0, (Number(questionCount) || 10) - have)
				if (need > 0) {
					const { generateResearchQuestions } = await import("~/utils/research-analysis.server")
					const suggestions = await generateResearchQuestions(
						target_orgs,
						target_roles,
						research_goal,
						research_goal_details,
						assumptions,
						unknowns,
						custom_instructions
					)

					const categories = [
						{ id: "core", label: "Core" },
						{ id: "behavior", label: "Behavior" },
						{ id: "pain", label: "Pain" },
						{ id: "solutions", label: "Solutions" },
						{ id: "context", label: "Context" },
					]

					const toQuestion = (categoryId: string) => (q: any, idx: number) => ({
						id: randomUUID(),
						text: sanitizeQuestion(q.question),
						categoryId,
						rationale: q.rationale || undefined,
						tags: [],
						scores: {
							importance: q.priority === 1 ? 0.9 : q.priority === 2 ? 0.7 : 0.55,
							goalMatch: 0.65,
							novelty: 0.6,
						},
						estimatedMinutes: 4.5,
						status: "proposed" as const,
						source: "llm" as const,
						displayOrder: idx + 1,
					})

					// Build per-category pools for balanced selection
					const corePool = (suggestions.core_questions || []).map(toQuestion("goals"))
					const behaviorPool = (suggestions.behavioral_questions || []).map(toQuestion("workflow"))
					const painPool = (suggestions.pain_point_questions || []).map(toQuestion("pain"))
					const solutionsPool = (suggestions.solution_questions || []).map(toQuestion("willingness"))
					const contextPool = (suggestions.context_questions || []).map(toQuestion("context"))

					const existingTexts = new Set(
						(questionSet?.questions || []).map((q: any) =>
							String(q?.text || "")
								.toLowerCase()
								.trim()
						)
					)
					const extras: any[] = []
					// Round-robin across categories to ensure spread
					const pickers = [corePool, painPool, behaviorPool, contextPool, solutionsPool]
					const perCategoryCap = 3
					const takenPerCat = new Map<string, number>()
					let idx = 0
					while (extras.length < need && pickers.some((p) => p.length > 0)) {
						const pool = pickers[idx % pickers.length]
						idx++
						if (pool.length === 0) continue
						const q = pool.shift() as any
						if (!q) continue
						const t = String(q.text || "")
							.toLowerCase()
							.trim()
						if (!t || existingTexts.has(t)) continue
						const cat = q.categoryId || "other"
						const used = takenPerCat.get(cat) || 0
						if (used >= perCategoryCap) continue
						takenPerCat.set(cat, used + 1)
						existingTexts.add(t)
						extras.push(q)
					}
					if (extras.length > 0) {
						questionSet = {
							...(questionSet || {}),
							categories: questionSet?.categories || categories,
							questions: [...(questionSet?.questions || []), ...extras],
						}
					}
				}
			} catch (topUpErr) {
				consola.warn("[api.generate-questions] Top-up via fallback failed", topUpErr)
			}
		} catch (e) {
			consola.warn("[api.generate-questions] Canonical generation failed; using fallback shape.", e)
			// Fallback: use legacy suggestions and adapt to QuestionSet shape expected by UI.
			const { generateResearchQuestions } = await import("~/utils/research-analysis.server")
			const suggestions = await generateResearchQuestions(
				target_orgs,
				target_roles,
				research_goal,
				research_goal_details,
				assumptions,
				unknowns,
				custom_instructions
			)

			const categories = [
				{ id: "core", label: "Core" },
				{ id: "behavior", label: "Behavior" },
				{ id: "pain", label: "Pain" },
				{ id: "solutions", label: "Solutions" },
				{ id: "context", label: "Context" },
			]

			const toQuestion = (categoryId: string) => (q: any, idx: number) => ({
				id: randomUUID(),
				text: sanitizeQuestion(q.question),
				categoryId,
				rationale: q.rationale || undefined,
				tags: [],
				scores: {
					importance: q.priority === 1 ? 0.9 : q.priority === 2 ? 0.7 : 0.55,
					goalMatch: 0.65,
					novelty: 0.6,
				},
				estimatedMinutes: 4.5,
				status: "proposed" as const,
				source: "llm" as const,
				displayOrder: idx + 1,
			})

			// Build balanced pool then select up to requested count
			const corePool = (suggestions.core_questions || []).map(toQuestion("goals"))
			const behaviorPool = (suggestions.behavioral_questions || []).map(toQuestion("workflow"))
			const painPool = (suggestions.pain_point_questions || []).map(toQuestion("pain"))
			const solutionsPool = (suggestions.solution_questions || []).map(toQuestion("willingness"))
			const contextPool = (suggestions.context_questions || []).map(toQuestion("context"))

			const perCategoryCap = 3
			const picks: any[] = []
			const pickers = [corePool, painPool, behaviorPool, contextPool, solutionsPool]
			const caps = new Map<string, number>()
			let idx = 0
			while (picks.length < (Number(questionCount) || 10) && pickers.some((p) => p.length > 0)) {
				const pool = pickers[idx % pickers.length]
				idx++
				if (pool.length === 0) continue
				const q = pool.shift() as any
				if (!q) continue
				const cat = q.categoryId || "other"
				const used = caps.get(cat) || 0
				if (used >= perCategoryCap) continue
				caps.set(cat, used + 1)
				picks.push(q)
			}

			questionSet = {
				sessionId: computedSessionId,
				policy: {
					totalPerRound: questionCount || 10,
					perCategoryMin: 1,
					perCategoryMax: 3,
					dedupeWindowRounds: 2,
					balanceBy: ["category", "novelty"],
				},
				categories,
				questions: picks,
				history: [],
				round: 1,
			}
		}

		// Final guard: ensure we return at least the requested number of questions
		try {
			const desired = Number(questionCount) || 10
			const have = Array.isArray(questionSet?.questions) ? questionSet.questions.length : 0
			if (have < desired) {
				const categories = [
					{ id: "context", label: "Context" },
					{ id: "goals", label: "Goals" },
					{ id: "pain", label: "Pain" },
					{ id: "workflow", label: "Workflow" },
					{ id: "willingness", label: "Adoption" },
				]
				const seeds = (
					Array.isArray(questionSet?.questions) ? questionSet.questions.map((q: any) => String(q.text || "")) : []
				) as string[]
				const baseGoal = (research_goal || "your research goal").slice(0, 140)
				const templates = [
					`What is the main problem you face when ${baseGoal.toLowerCase()}?`,
					`Can you walk me through your current process related to ${baseGoal.toLowerCase()}?`,
					`What outcomes define success for you regarding ${baseGoal.toLowerCase()}?`,
					"What alternatives have you tried and why?",
					"Where do you encounter the most friction today?",
					"How do you evaluate whether a solution is working?",
					"What would make you switch from your current solution?",
					"What constraints (time, budget, tools) shape your approach?",
				]
				const pool: any[] = []
				let tIdx = 0
				while (pool.length < desired - have) {
					const text = templates[tIdx % templates.length]
					tIdx++
					if (seeds.some((s) => s.toLowerCase().trim() === text.toLowerCase().trim())) continue
					const cat = categories[pool.length % categories.length]
					pool.push({
						id: randomUUID(),
						text,
						categoryId: cat.id,
						rationale: undefined,
						tags: [],
						scores: { importance: 0.65, goalMatch: 0.65, novelty: 0.55 },
						estimatedMinutes: 4.5,
						status: "proposed" as const,
						source: "heuristic" as const,
						displayOrder: have + pool.length + 1,
					})
				}
				questionSet = {
					...(questionSet || {}),
					categories: questionSet?.categories || categories,
					questions: [...(questionSet?.questions || []), ...pool],
				}
			}
		} catch (e) {
			consola.warn("[api.generate-questions] Ensuring minimum count failed", e)
		}

		consola.log("BAML questionSet result:", JSON.stringify(questionSet, null, 2))

		// Ensure all questions have unique, stable IDs
		if (questionSet?.questions && Array.isArray(questionSet.questions)) {
			questionSet.questions = questionSet.questions.map((question: any) => ({
				...question,
				id: question.id && typeof question.id === "string" && question.id.length > 0 ? question.id : randomUUID(),
			}))
		}

		return Response.json({
			success: true,
			questionSet,
		})
	} catch (error) {
		consola.error("Failed to generate questions:", error)
		return Response.json(
			{
				error: "Failed to generate questions",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		)
	}
}
