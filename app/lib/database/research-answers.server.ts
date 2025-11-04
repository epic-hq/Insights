import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "~/types"

type Tables = Database["public"]["Tables"]

type DecisionSummaryRow = {
	project_id: string
	decision_question_id: string
	decision_question_text: string | null
	research_question_count: number | null
	answered_answer_count: number | null
	open_answer_count: number | null
	evidence_count: number | null
	interview_count: number | null
	persona_count: number | null
}

type ResearchSummaryRow = {
	project_id: string
	research_question_id: string
	decision_question_id: string | null
	research_question_text: string | null
	answered_answer_count: number | null
	open_answer_count: number | null
	evidence_count: number | null
	interview_count: number | null
	persona_count: number | null
}

type AnswerMetricRow = {
	project_id: string
	project_answer_id: string
	prompt_id: string | null
	research_question_id: string | null
	decision_question_id: string | null
	interview_id: string | null
	respondent_person_id: string | null
	status: Tables["project_answers"]["Row"]["status"]
	answered_at: string | null
	evidence_count: number | null
	interview_count: number | null
	persona_count: number | null
}

interface ResearchAnswerEvidence {
	id: string
	verbatim: string
	support: Tables["evidence"]["Row"]["support"]
	modality: Tables["evidence"]["Row"]["modality"]
	anchors: Tables["evidence"]["Row"]["anchors"]
	interview_id: string | null
	created_at: string | null
}

interface ResearchAnswerNode {
	id: string
	question_text: string
	question_category: string | null
	status: Tables["project_answers"]["Row"]["status"]
	order_index: number | null
	answered_at: string | null
	interview: {
		id: string | null
		title: string | null
		interview_date: string | null
	}
	respondent: {
		id: string | null
		name: string | null
	}
	answer_text: string | null
	detected_question_text: string | null
	analysis_summary: string | null
	analysis_rationale: string | null
	analysis_next_steps: string | null
	metrics: {
		evidence_count: number
		interview_count: number
		persona_count: number
	}
	evidence: ResearchAnswerEvidence[]
}

interface ResearchQuestionNode {
	id: string
	text: string
	metrics: {
		answered_answer_count: number
		open_answer_count: number
		evidence_count: number
		interview_count: number
		persona_count: number
	}
	analysis?: {
		summary: string | null
		confidence: number | null
		next_steps: string | null
	}
	answers: ResearchAnswerNode[]
}

interface DecisionQuestionNode {
	id: string
	text: string
	metrics: {
		research_question_count: number
		answered_answer_count: number
		open_answer_count: number
		evidence_count: number
		interview_count: number
		persona_count: number
	}
	analysis?: {
		summary: string | null
		confidence: number | null
		next_steps: string | null
		goal_achievement_summary: string | null
	}
	research_questions: ResearchQuestionNode[]
}

interface ResearchAnswerRollup {
	decision_questions: DecisionQuestionNode[]
	research_questions_without_decision: ResearchQuestionNode[]
	orphan_answers: ResearchAnswerNode[]
	latest_analysis_run: {
		id: string
		run_summary: string | null
		recommended_actions: string[]
	} | null
}

function safeInt(value: number | null | undefined): number {
	if (typeof value === "number" && Number.isFinite(value)) return value
	return 0
}

function safeNumber(value: number | null | undefined): number | null {
	if (typeof value === "number" && Number.isFinite(value)) return value
	return null
}

function toStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return []
	return value
		.filter((item): item is string => typeof item === "string")
		.map((item) => item.trim())
		.filter((item) => item.length > 0)
}

export async function getResearchAnswerRollup(
	supabase: SupabaseClient<Database>,
	projectId: string
): Promise<ResearchAnswerRollup> {
	const [decisionSummaryRes, researchSummaryRes, answerMetricsRes, answersRes, questionAnalysisRes, latestRunRes] =
		await Promise.all([
			supabase.from("decision_question_summary").select("*").eq("project_id", projectId),
			supabase.from("research_question_summary").select("*").eq("project_id", projectId),
			supabase.from("project_answer_metrics").select("*").eq("project_id", projectId),
			supabase
				.from("project_answers")
				.select(
					"id, project_id, interview_id, respondent_person_id, question_text, question_category, order_index, status, answered_at, answer_text, detected_question_text, research_question_id, decision_question_id, analysis_summary, analysis_rationale, analysis_next_steps"
				)
				.eq("project_id", projectId),
			supabase
				.from("project_question_analysis")
				.select("question_type, question_id, summary, confidence, next_steps, goal_achievement_summary, created_at")
				.eq("project_id", projectId)
				.order("created_at", { ascending: false }),
			supabase
				.from("project_research_analysis_runs")
				.select("id, run_summary, recommended_actions, created_at")
				.eq("project_id", projectId)
				.order("created_at", { ascending: false })
				.limit(1),
		])

	if (decisionSummaryRes.error) throw decisionSummaryRes.error
	if (researchSummaryRes.error) throw researchSummaryRes.error
	if (answerMetricsRes.error) throw answerMetricsRes.error
	if (answersRes.error) throw answersRes.error
	if (questionAnalysisRes.error) throw questionAnalysisRes.error
	if (latestRunRes.error) throw latestRunRes.error

	const decisionSummary = (decisionSummaryRes.data || []) as DecisionSummaryRow[]
	const researchSummary = (researchSummaryRes.data || []) as ResearchSummaryRow[]
	const answerMetrics = (answerMetricsRes.data || []) as AnswerMetricRow[]
	const answers = answersRes.data || []
	const questionAnalysisRows = questionAnalysisRes.data || []
	const latestAnalysisRunRow = latestRunRes.data?.[0] ?? null

	const questionAnalysisMap = new Map<
		string,
		{
			summary: string | null
			confidence: number | null
			next_steps: string | null
			goal_achievement_summary: string | null
		}
	>()

	for (const row of questionAnalysisRows) {
		const key = `kind:${row.question_type}|id:${row.question_id}`
		if (!questionAnalysisMap.has(key)) {
			questionAnalysisMap.set(key, {
				summary: row.summary ?? null,
				confidence: safeNumber(row.confidence),
				next_steps: row.next_steps ?? null,
				goal_achievement_summary: row.goal_achievement_summary ?? null,
			})
		}
	}

	const answerIds = answers.map((ans) => ans.id)
	const interviewIds = [...new Set(answers.map((ans) => ans.interview_id).filter(Boolean))] as string[]
	const personIds = [...new Set(answers.map((ans) => ans.respondent_person_id).filter(Boolean))] as string[]

	const [interviewsRes, peopleRes, evidenceRes] = await Promise.all([
		interviewIds.length
			? supabase.from("interviews").select("id, title, interview_date").in("id", interviewIds)
			: Promise.resolve({ data: [], error: null }),
		personIds.length
			? supabase.from("people").select("id, name").in("id", personIds)
			: Promise.resolve({ data: [], error: null }),
		answerIds.length
			? supabase
					.from("evidence")
					.select("id, project_answer_id, verbatim, support, modality, anchors, interview_id, created_at")
					.in("project_answer_id", answerIds)
					.order("created_at", { ascending: true })
			: Promise.resolve({ data: [], error: null }),
	])

	if (interviewsRes.error) throw interviewsRes.error
	if (peopleRes.error) throw peopleRes.error
	if (evidenceRes.error) throw evidenceRes.error

	const interviewsById = new Map(
		(interviewsRes.data || []).map((row) => [
			row.id,
			row as { id: string; title: string | null; interview_date: string | null },
		])
	)
	const peopleById = new Map((peopleRes.data || []).map((row) => [row.id, row as { id: string; name: string | null }]))

	const evidence_by_answer = new Map<string, ResearchAnswerNode["evidence"]>()
	for (const ev of evidenceRes.data || []) {
		if (!ev.project_answer_id) continue
		const list = evidence_by_answer.get(ev.project_answer_id) || []
		list.push({
			id: ev.id,
			verbatim: ev.verbatim,
			support: ev.support,
			modality: ev.modality,
			anchors: ev.anchors,
			interview_id: ev.interview_id,
			created_at: ev.created_at,
		})
		evidence_by_answer.set(ev.project_answer_id, list)
	}

	const metrics_by_answer_id = new Map(answerMetrics.map((row) => [row.project_answer_id, row]))

	const answerNodes = new Map<string, ResearchAnswerNode>()
	for (const ans of answers) {
		const metrics = metrics_by_answer_id.get(ans.id)
		const interview = ans.interview_id ? interviewsById.get(ans.interview_id) : null
		const respondent = ans.respondent_person_id ? peopleById.get(ans.respondent_person_id) : null

		answerNodes.set(ans.id, {
			id: ans.id,
			question_text: ans.question_text,
			question_category: ans.question_category,
			status: ans.status,
			order_index: ans.order_index,
			answered_at: ans.answered_at,
			interview: {
				id: ans.interview_id ?? null,
				title: interview?.title ?? null,
				interview_date: interview?.interview_date ?? null,
			},
			respondent: {
				id: ans.respondent_person_id ?? null,
				name: respondent?.name ?? null,
			},
			answer_text: ans.answer_text ?? null,
			detected_question_text: ans.detected_question_text ?? null,
			analysis_summary: ans.analysis_summary ?? null,
			analysis_rationale: ans.analysis_rationale ?? null,
			analysis_next_steps: ans.analysis_next_steps ?? null,
			metrics: {
				evidence_count: safeInt(metrics?.evidence_count ?? evidence_by_answer.get(ans.id)?.length ?? 0),
				interview_count: safeInt(metrics?.interview_count),
				persona_count: safeInt(metrics?.persona_count),
			},
			evidence: evidence_by_answer.get(ans.id) ?? [],
		})
	}

	const researchNodes = new Map<string, ResearchQuestionNode>()
	for (const rqRow of researchSummary) {
		const node: ResearchQuestionNode = {
			id: rqRow.research_question_id,
			text: rqRow.research_question_text ?? "Untitled research question",
			metrics: {
				answered_answer_count: safeInt(rqRow.answered_answer_count),
				open_answer_count: safeInt(rqRow.open_answer_count),
				evidence_count: safeInt(rqRow.evidence_count),
				interview_count: safeInt(rqRow.interview_count),
				persona_count: safeInt(rqRow.persona_count),
			},
			answers: [],
		}

		const analysis = questionAnalysisMap.get(`kind:research|id:${node.id}`)
		if (analysis) {
			node.analysis = {
				summary: analysis.summary,
				confidence: analysis.confidence,
				next_steps: analysis.next_steps,
			}
		}
		researchNodes.set(node.id, node)
	}

	for (const ans of answers) {
		const node = answerNodes.get(ans.id)
		if (!node) continue

		if (ans.research_question_id && researchNodes.has(ans.research_question_id)) {
			researchNodes.get(ans.research_question_id)?.answers.push(node)
		}
	}

	const decisionsMap = new Map<string, DecisionQuestionNode>()
	for (const dqRow of decisionSummary) {
		const node: DecisionQuestionNode = {
			id: dqRow.decision_question_id,
			text: dqRow.decision_question_text ?? "Untitled decision question",
			metrics: {
				research_question_count: safeInt(dqRow.research_question_count),
				answered_answer_count: safeInt(dqRow.answered_answer_count),
				open_answer_count: safeInt(dqRow.open_answer_count),
				evidence_count: safeInt(dqRow.evidence_count),
				interview_count: safeInt(dqRow.interview_count),
				persona_count: safeInt(dqRow.persona_count),
			},
			research_questions: [],
		}

		const analysis = questionAnalysisMap.get(`kind:decision|id:${node.id}`)
		if (analysis) {
			node.analysis = {
				summary: analysis.summary,
				confidence: analysis.confidence,
				next_steps: analysis.next_steps,
				goal_achievement_summary: analysis.goal_achievement_summary,
			}
		}
		decisionsMap.set(node.id, node)
	}

	const research_questions_without_decision: ResearchQuestionNode[] = []
	for (const rq of researchNodes.values()) {
		const summary = researchSummary.find((row) => row.research_question_id === rq.id)
		const decisionId = summary?.decision_question_id ?? null
		if (decisionId && decisionsMap.has(decisionId)) {
			decisionsMap.get(decisionId)?.research_questions.push(rq)
		} else {
			research_questions_without_decision.push(rq)
		}
	}

	const orphan_answers: ResearchAnswerNode[] = []
	for (const node of answerNodes.values()) {
		const ans = answers.find((a) => a.id === node.id)
		if (!ans) continue
		if (!ans.research_question_id && !["planned", "asked"].includes(ans.status)) {
			orphan_answers.push(node)
		}
	}

	const latestAnalysis = latestAnalysisRunRow
		? {
				id: latestAnalysisRunRow.id,
				run_summary: latestAnalysisRunRow.run_summary ?? null,
				recommended_actions: toStringArray(latestAnalysisRunRow.recommended_actions),
			}
		: null

	return {
		decision_questions: Array.from(decisionsMap.values()),
		research_questions_without_decision,
		orphan_answers,
		latest_analysis_run: latestAnalysis,
		analysis_results: questionAnalysisRows.map((row) => ({
			question_type: row.question_type,
			question_id: row.question_id,
			summary: row.summary ?? "",
			confidence: safeNumber(row.confidence) ?? 0,
			next_steps: row.next_steps,
			goal_achievement_summary: row.goal_achievement_summary,
		})),
	}
}

async function _getDecisionQuestionDetail(supabase: SupabaseClient<Database>, decisionQuestionId: string) {
	const { data, error } = await supabase
		.from("decision_questions")
		.select("id, project_id, text, rationale")
		.eq("id", decisionQuestionId)
		.single()

	if (error) throw error
	return data
}

async function _getResearchQuestionDetail(supabase: SupabaseClient<Database>, researchQuestionId: string) {
	const { data, error } = await supabase
		.from("research_questions")
		.select("id, project_id, decision_question_id, text, rationale")
		.eq("id", researchQuestionId)
		.single()

	if (error) throw error
	return data
}

async function _getProjectAnswerDetail(supabase: SupabaseClient<Database>, projectAnswerId: string) {
	const { data, error } = await supabase
		.from("project_answers")
		.select(
			"id, project_id, interview_id, respondent_person_id, question_text, question_category, status, answered_at, order_index, answer_text, detected_question_text"
		)
		.eq("id", projectAnswerId)
		.single()

	if (error) throw error

	const evidenceRes = await supabase
		.from("evidence")
		.select("id, verbatim, support, modality, anchors, interview_id, created_at")
		.eq("project_answer_id", projectAnswerId)
		.order("created_at", { ascending: false })

	if (evidenceRes.error) throw evidenceRes.error

	return {
		answer: data,
		evidence: evidenceRes.data ?? [],
	}
}
