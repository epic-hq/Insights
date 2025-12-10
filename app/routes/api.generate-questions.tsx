import { randomUUID } from "node:crypto"
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { getProjectContextGeneric } from "~/features/questions/db"
import { getServerClient } from "~/lib/supabase/client.server"
import { currentProjectContext } from "~/server/current-project-context"
import { fromManagerResearchMode, type ResearchMode, toManagerResearchMode } from "~/types/research"
import { generateQuestionSetCanonical } from "~/utils/research-analysis.server"

export async function action({ request, context }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	try {
		const formData = await request.formData()
		const { client: supabase } = getServerClient(request)

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
		if (!project_id) {
			return Response.json(
				{ error: "Project ID is required to generate and save interview questions" },
				{ status: 400 }
			)
		}

		let target_orgs = formData.get("target_orgs") as string
		let target_roles = formData.get("target_roles") as string
		let research_goal = formData.get("research_goal") as string
		let research_goal_details = formData.get("research_goal_details") as string
		let assumptions = formData.get("assumptions") as string
		let unknowns = formData.get("unknowns") as string
		const requestedResearchMode = formData.get("research_mode") as string | null
		const coerceResearchMode = (value: unknown): ResearchMode | null => {
			if (typeof value !== "string") return null
			const managerMode = toManagerResearchMode(value)
			if (!managerMode) return null
			return fromManagerResearchMode(managerMode)
		}
		let research_mode: ResearchMode = coerceResearchMode(requestedResearchMode) ?? "exploratory"
		const initialCustomInstructions = ((formData.get("custom_instructions") as string) || "").trim()
		const customInstructionParts: string[] = []
		if (initialCustomInstructions) {
			customInstructionParts.push(initialCustomInstructions)
		}
		// Determine questionCount later once we know if this is a first-time generation
		const questionCountRaw = formData.get("questionCount")
		let questionCount: number | null = null
		const interview_time_limit = Number(formData.get("interview_time_limit") ?? 30)
		let existingQuestions: string[] = []
		let existingSectionMeta: any = null
		let existingSectionContent: string | null = null
		let existingSectionPosition: number | null = null

		// If project_id is provided, load project context from database
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
			if (!requestedResearchMode) {
				const metaMode =
					coerceResearchMode(meta.research_mode) ||
					coerceResearchMode(meta.conversation_type) ||
					coerceResearchMode(meta.settings?.research_mode)
				if (metaMode) research_mode = metaMode
			}

			// Fallback to project-level custom instructions when request provides none
			if (!initialCustomInstructions) {
				const projectLevelInstructions =
					(typeof meta.custom_instructions === "string" && meta.custom_instructions.trim()) ||
					(typeof meta.settings?.customInstructions === "string" && meta.settings?.customInstructions.trim()) ||
					""
				if (projectLevelInstructions) {
					customInstructionParts.push(projectLevelInstructions)
				}
			}

			// Load existing questions/section meta to influence dedupe and persistence
			try {
				const { data: questionsSection } = await supabase
					.from("project_sections")
					.select("meta, content_md, position")
					.eq("project_id", project_id)
					.eq("kind", "questions")
					.order("updated_at", { ascending: false })
					.limit(1)
					.single()

				existingSectionMeta = questionsSection?.meta ?? null
				existingSectionContent = questionsSection?.content_md ?? null
				existingSectionPosition = questionsSection?.position ?? null

				const metaQ: any = existingSectionMeta || {}
				const qs: any[] = Array.isArray(metaQ.questions) ? metaQ.questions : []
				existingQuestions = qs.map((q: any) => (typeof q === "string" ? q : q?.text)).filter(Boolean)
				if (existingQuestions.length > 0) {
					// Respect front-end provided questionCount; do not override here.
					// Append a dedupe instruction to custom_instructions regardless
					const dedupeList = existingQuestions.slice(0, 25).join("; ")
					const dedupeNote = `Avoid repeating or rephrasing these existing questions: ${dedupeList}. Generate complementary questions.`
					customInstructionParts.push(dedupeNote)
				}
				if (!requestedResearchMode) {
					const settingsMode =
						coerceResearchMode(metaQ?.settings?.research_mode) ||
						coerceResearchMode(metaQ?.settings?.conversation_type) ||
						coerceResearchMode(metaQ?.settings?.purpose)
					if (settingsMode) research_mode = settingsMode
				}
			} catch (_e) {
				// Non-fatal
			}
		} catch (error) {
			consola.warn("Could not load project context from database:", error)
		}

		let decisionQuestionTexts: string[] = []
		let researchQuestionTexts: string[] = []
		try {
			const [decisionQuery, researchQuery] = await Promise.all([
				supabase
					.from("decision_questions")
					.select("text")
					.eq("project_id", project_id)
					.order("created_at", { ascending: true, nullsFirst: false }),
				supabase
					.from("research_questions")
					.select("text")
					.eq("project_id", project_id)
					.order("created_at", { ascending: true, nullsFirst: false }),
			])

			if (!decisionQuery.error) {
				decisionQuestionTexts = (decisionQuery.data || [])
					.map((row) => (typeof row?.text === "string" ? row.text.trim() : ""))
					.filter(Boolean)
			}
			if (!researchQuery.error) {
				researchQuestionTexts = (researchQuery.data || [])
					.map((row) => (typeof row?.text === "string" ? row.text.trim() : ""))
					.filter(Boolean)
			}
		} catch (error) {
			consola.warn("Failed to load research structure for question generation:", error)
		}

		const structureNotes: string[] = []
		if (decisionQuestionTexts.length > 0) {
			structureNotes.push("Anchor the interview plan to these decisions:")
			decisionQuestionTexts.slice(0, 5).forEach((text, idx) => {
				structureNotes.push(`${idx + 1}. ${text}`)
			})
		}
		if (researchQuestionTexts.length > 0) {
			structureNotes.push("Ensure questions help answer these research questions:")
			researchQuestionTexts.slice(0, 6).forEach((text, idx) => {
				structureNotes.push(`${idx + 1}. ${text}`)
			})
		}
		if (structureNotes.length > 0) {
			customInstructionParts.push(structureNotes.join("\n"))
		}
		if (research_mode === "validation") {
			customInstructionParts.push(
				"Validation mode: create prompts that gather evidence for Pain Exists, Awareness, Quantified Impact, and Acting. Prefer using categoryId values pain, awareness, quantified, acting when appropriate, and keep questions outcome-oriented."
			)
		}
		if (research_mode === "user_testing") {
			customInstructionParts.push(
				"User testing mode: focus on usability tasks, comprehension, adoption signals, and points of friction when people interact with the solution."
			)
		}

		const combinedCustomInstructions = customInstructionParts.filter(Boolean).join("\n\n")

		// Decide on questionCount default now that we know if this is first-time
		// Priority: explicit request value > inferred default (8 if first-time else 10)
		if (typeof questionCountRaw === "string" && questionCountRaw.trim().length > 0) {
			const parsed = Number(questionCountRaw)
			questionCount = Number.isFinite(parsed) && parsed > 0 ? parsed : null
		}
		if (!questionCount) {
			const firstTime = existingQuestions.length === 0
			questionCount = firstTime ? 8 : 10
		}

		// Final validation after potentially loading from database
		const coreMissing: string[] = []
		if (!target_roles?.trim()) coreMissing.push("target_roles")
		if (!research_goal?.trim()) coreMissing.push("research_goal")
		research_goal_details = research_goal_details || ""
		assumptions = assumptions || ""
		unknowns = unknowns || ""
		if (coreMissing.length > 0) {
			const baseMsg = `Missing required fields: ${coreMissing.join(", ")}`
			consola.warn(`[api.generate-questions] ${baseMsg} for project ${project_id}`)
			return Response.json(
				{
					error: `${baseMsg}. Please complete project setup first by filling in your research goal and target roles.`,
					missingFields: coreMissing,
				},
				{ status: 400 }
			)
		}

		consola.log("Generating questions (canonical) for:", {
			target_orgs,
			target_roles,
			research_goal,
			research_goal_details,
			assumptions,
			unknowns,
			questionCount,
			interview_time_limit,
			custom_instructions: combinedCustomInstructions,
		})

		// Helper: sanitize square‑bracket placeholders that sometimes slip through LLMs
		const sanitizeQuestion = (text: string): string => {
			let t = String(text || "")
			// Replace any [placeholder] with a neutral pronoun
			t = t.replace(/\[[^\]]+\]/g, "this")
			// Normalize multiple spaces and spaces before punctuation
			t = t
				.replace(/\s{2,}/g, " ")
				.replace(/\s+([,.;:!?])/g, "$1")
				.trim()
			return t
		}

		// Try canonical BAML QuestionSet generation
		let questionSet: any
		const computedSessionId = `session_${Date.now()}`
		try {
			const ensure = (v: unknown, fallback = "unspecified") => {
				const s = typeof v === "string" ? v : String(v ?? "")
				return s.trim().length > 0 ? s : fallback
			}

			const canonicalParams = {
				target_orgs: ensure(target_orgs),
				target_roles: ensure(target_roles),
				research_goal: ensure(research_goal, "General research goal"),
				research_goal_details: ensure(research_goal_details, ""),
				assumptions: ensure(assumptions, ""),
				unknowns: ensure(unknowns, ""),
				custom_instructions: ensure(combinedCustomInstructions, ""),
				session_id: ensure(computedSessionId),
				round: 1,
				total_per_round: questionCount || 10,
				per_category_min: 1,
				per_category_max: 3,
				interview_time_limit,
				research_mode,
			}

			consola.log("[BAML DEBUG] Calling generateQuestionSetCanonical with params:", canonicalParams)
			questionSet = await generateQuestionSetCanonical(canonicalParams)
			consola.log("[BAML DEBUG] Canonical result:", {
				hasQuestions: Array.isArray(questionSet?.questions),
				questionCount: questionSet?.questions?.length || 0,
				questions: questionSet?.questions?.slice(0, 3).map((q: any) => q.text) || [],
				fullResult: questionSet,
			})

			// Sanitize canonical output to remove any placeholders
			if (Array.isArray(questionSet?.questions)) {
				questionSet.questions = questionSet.questions.map((q: any) => ({
					...q,
					text: sanitizeQuestion(q.text),
				}))
			}
		} catch (e) {
			consola.error("[BAML ERROR] Canonical generation failed:", {
				error: e,
				errorMessage: e instanceof Error ? e.message : String(e),
				errorStack: e instanceof Error ? e.stack : undefined,
				params: {
					target_orgs,
					target_roles,
					research_goal,
					research_goal_details,
					assumptions,
					unknowns,
					custom_instructions: combinedCustomInstructions,
				},
			})
			throw e
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

		// Ensure all questions have unique, stable IDs and sanitize text length/format
		const sanitizeText = (text: string): string => {
			try {
				let t = String(text || "")
					.replace(/\s+/g, " ")
					.trim()
				// Remove any bracketed placeholders that may slip through
				t = t
					.replace(/\[[^\]]*\]/g, "")
					.replace(/\{[^}]*\}/g, "")
					.replace(/<[^>]*>/g, "")
					.replace(/\s+/g, " ")
					.trim()
				const MAX = 140
				if (t.length <= MAX) return t
				// Prefer cutting at a natural boundary before MAX
				const cut = t.slice(0, MAX)
				const lastPunct = Math.max(cut.lastIndexOf("?"), cut.lastIndexOf("."), cut.lastIndexOf("!"))
				const lastSpace = cut.lastIndexOf(" ")
				const end = lastPunct >= 40 ? lastPunct + 1 : lastSpace >= 40 ? lastSpace : MAX
				return (
					cut
						.slice(0, end)
						.trim()
						.replace(/[,:;-]$/, "") + (end < t.length ? "…" : "")
				)
			} catch {
				return String(text || "").slice(0, 140)
			}
		}

		if (questionSet?.questions && Array.isArray(questionSet.questions)) {
			const usedIds = new Set<string>()
			questionSet.questions = questionSet.questions.map((question: any) => {
				let id = question.id && typeof question.id === "string" && question.id.length > 0 ? question.id : randomUUID()
				while (usedIds.has(id)) {
					id = randomUUID()
				}
				usedIds.add(id)
				return {
					...question,
					id,
					text: sanitizeText(question.text),
				}
			})
		}

		const generatedQuestions = Array.isArray(questionSet?.questions) ? questionSet.questions : []
		if (generatedQuestions.length === 0) {
			return Response.json(
				{ error: "No questions were generated. Please adjust your inputs and try again." },
				{ status: 500 }
			)
		}

		const estimatedMinutesFallback = Math.max(
			1,
			Math.round(interview_time_limit / Math.max(generatedQuestions.length, 1))
		)

		const promptPayloads = generatedQuestions.map((question: any, index: number) => {
			const id = typeof question.id === "string" && question.id.length > 0 ? question.id : randomUUID()
			const categoryId =
				typeof question.categoryId === "string" && question.categoryId.length > 0 ? question.categoryId : "context"
			const scores =
				typeof question.scores === "object" && question.scores !== null
					? question.scores
					: { importance: 0.65, goalMatch: 0.65, novelty: 0.55 }
			const estimatedMinutes =
				typeof question.estimatedMinutes === "number" && Number.isFinite(question.estimatedMinutes)
					? Math.max(1, Math.round(question.estimatedMinutes))
					: estimatedMinutesFallback

			return {
				id,
				project_id,
				text: String(question.text ?? ""),
				category: categoryId,
				estimated_time_minutes: estimatedMinutes,
				is_must_have: Boolean(question.isMustHave),
				status: typeof question.status === "string" && question.status.length > 0 ? question.status : "selected",
				order_index: index + 1,
				scores,
				source: typeof question.source === "string" && question.source.length > 0 ? question.source : "ai",
				rationale: question.rationale ?? null,
				is_selected: true,
				selected_order: index,
			}
		})

		const { data: upsertedPrompts, error: promptError } = await supabase
			.from("interview_prompts")
			.upsert(promptPayloads, { onConflict: "id" })
			.select("id")

		if (promptError) {
			consola.error("[api.generate-questions] Failed to persist interview prompts", promptError)
			return Response.json(
				{
					error: "Failed to save generated questions",
					details: promptError.message,
				},
				{ status: 500 }
			)
		}

		type PromptPayload = (typeof promptPayloads)[number]
		const newQuestionIds = new Set(promptPayloads.map((p: PromptPayload) => p.id))
		const existingSectionQuestions = Array.isArray(existingSectionMeta?.questions) ? existingSectionMeta.questions : []
		const filteredExistingSectionQuestions = existingSectionQuestions.filter(
			(q: any) => q && typeof q.id === "string" && !newQuestionIds.has(q.id)
		)

		const sectionQuestionEntries = promptPayloads.map((payload: PromptPayload, _index: number) => ({
			id: payload.id,
			text: payload.text,
			categoryId: payload.category,
			scores: payload.scores,
			rationale: payload.rationale || "",
			status: payload.status,
			timesAnswered: 0,
			source: payload.source,
			isMustHave: payload.is_must_have,
			estimatedMinutes: payload.estimated_time_minutes,
			selectedOrder: payload.selected_order,
			isSelected: true,
		}))

		const sectionQuestions = [...filteredExistingSectionQuestions, ...sectionQuestionEntries]

		const sectionMetaSettings = {
			...(existingSectionMeta?.settings ?? {}),
			timeMinutes: interview_time_limit,
			customInstructions: combinedCustomInstructions,
			lastGeneratedAt: new Date().toISOString(),
			lastGeneratedCount: generatedQuestions.length,
			research_mode,
			purpose: research_mode,
		}

		const updatedSectionMeta = {
			...(existingSectionMeta ?? {}),
			questions: sectionQuestions,
			settings: sectionMetaSettings,
		}

		const { error: sectionError } = await supabase.from("project_sections").upsert(
			{
				project_id,
				kind: "questions",
				position: existingSectionPosition ?? 2,
				content_md:
					existingSectionContent ?? `# Questions\n\nGenerated ${generatedQuestions.length} interview questions via AI.`,
				meta: updatedSectionMeta,
			},
			{ onConflict: "project_id,kind" }
		)

		if (sectionError) {
			consola.error("[api.generate-questions] Failed to update project section meta", sectionError)
			return Response.json(
				{
					error: "Failed to update project question metadata",
					details: sectionError.message,
				},
				{ status: 500 }
			)
		}

		return Response.json({
			success: true,
			questionSet,
			savedPromptIds: upsertedPrompts?.map((row) => row.id) ?? [],
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
