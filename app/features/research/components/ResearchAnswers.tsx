import { ChevronRight, Lightbulb, Users } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import type { RouteDefinitions } from "~/utils/route-definitions"

export interface ResearchAnswerEvidence {
	id: string
	verbatim: string
	support: string
	modality: string
	anchors: any
	interview_id: string | null
	created_at: string | null
}

export interface ResearchAnswerNode {
	id: string
	question_text: string
	question_category: string | null
	status: string
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
	metrics: {
		evidence_count: number
		interview_count: number
		persona_count: number
	}
	evidence: ResearchAnswerEvidence[]
}

export interface ResearchQuestionNode {
	id: string
	text: string
	metrics: {
		answered_answer_count: number
		open_answer_count: number
		evidence_count: number
		interview_count: number
		persona_count: number
	}
	answers: ResearchAnswerNode[]
}

export interface DecisionQuestionNode {
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
	research_questions: ResearchQuestionNode[]
}

export interface ResearchAnswersData {
	decision_questions: DecisionQuestionNode[]
	research_questions_without_decision: ResearchQuestionNode[]
	orphan_answers: ResearchAnswerNode[]
	analysis_results?: Array<{
		question_type: "decision" | "research"
		question_id: string
		summary: string
		confidence: number
		next_steps: string | null
		goal_achievement_summary: string | null
	}>
}

interface ResearchAnswersProps {
	projectId: string
	className?: string
	projectRoutes?: RouteDefinitions
	onMetrics?: (metrics: { answered: number; open: number; total: number }) => void
	onData?: (data: ResearchAnswersData | null) => void
}

const answered_statuses = new Set(["answered", "ad_hoc"])
const open_statuses = new Set(["planned", "asked"])

function summarizeMetrics(data: ResearchAnswersData | null): { answered: number; open: number; total: number } {
	if (!data) return { answered: 0, open: 0, total: 0 }

	const research_map = new Map<string, ResearchQuestionNode>()
	data.decision_questions.forEach((decision) => {
		decision.research_questions.forEach((rq) => {
			if (!research_map.has(rq.id)) research_map.set(rq.id, rq)
		})
	})
	data.research_questions_without_decision.forEach((rq) => {
		if (!research_map.has(rq.id)) research_map.set(rq.id, rq)
	})

	let answered = 0
	let open = 0

	research_map.forEach((rq) => {
		const answered_from_metrics = rq.metrics.answered_answer_count
		const open_from_metrics = rq.metrics.open_answer_count

		const answered_fallback = rq.answers.filter((ans) => answered_statuses.has(ans.status)).length
		const open_fallback = rq.answers.filter((ans) => open_statuses.has(ans.status)).length

		answered += answered_from_metrics ?? answered_fallback
		open += open_from_metrics ?? open_fallback
	})

	const orphan_answered = data.orphan_answers.filter((ans) => answered_statuses.has(ans.status)).length
	const orphan_open = data.orphan_answers.filter((ans) => open_statuses.has(ans.status)).length

	answered += orphan_answered
	open += orphan_open

	const total = answered + open
	return { answered, open, total }
}

function MetricBadge({ label, value }: { label: string; value: number }) {
	return (
		<Badge variant="outline" className="flex items-center gap-1 text-xs">
			<span className="font-medium">{value}</span>
			<span className="text-muted-foreground">{label}</span>
		</Badge>
	)
}

function AnswerRow({
	answer,
	projectRoutes,
}: {
	answer: ResearchAnswerNode
	projectRoutes?: RouteDefinitions
}) {
	const firstEvidenceId = answer.evidence[0]?.id
	const evidenceLink = firstEvidenceId && projectRoutes ? projectRoutes.evidence.detail(firstEvidenceId) : null
	const interviewLink = answer.interview.id && projectRoutes ? projectRoutes.interviews.detail(answer.interview.id) : null
	const detailLink = evidenceLink ?? interviewLink
	const detailLabel = evidenceLink ? "View evidence" : "View interview"

	const evidence_list = useMemo(() => {
		return [...answer.evidence].sort((a, b) => {
			const a_time = a.created_at ? new Date(a.created_at).getTime() : 0
			const b_time = b.created_at ? new Date(b.created_at).getTime() : 0
			return a_time - b_time
		})
	}, [answer.evidence])

	return (
		<div className="space-y-2 rounded-md border border-border/60 bg-card/40 p-3">
			<div className="flex items-center justify-between gap-2">
				<div className="font-medium text-foreground text-sm">
					{answer.question_text}
					{answer.question_category && (
						<Badge variant="secondary" className="ml-2 text-xs capitalize">
							{answer.question_category.replace(/_/g, " ")}
						</Badge>
					)}
				</div>
				<div className="flex items-center gap-2">
					<MetricBadge label="evidence" value={answer.metrics.evidence_count} />
					<MetricBadge label="interviews" value={answer.metrics.interview_count} />
					<MetricBadge label="personas" value={answer.metrics.persona_count} />
				</div>
			</div>
			{answer.answer_text && <p className="line-clamp-3 text-muted-foreground text-sm">{answer.answer_text}</p>}
			{evidence_list.length > 0 && (
				<div className="space-y-1 border-border/60 border-t border-dashed pt-2">
					{evidence_list.slice(0, 2).map((ev) => (
						<blockquote key={ev.id} className="text-muted-foreground text-sm">
							“{ev.verbatim}”
						</blockquote>
					))}
					{evidence_list.length > 2 && (
						<div className="text-muted-foreground text-xs">+{evidence_list.length - 2} more evidence snippets</div>
					)}
				</div>
			)}
			<div className="flex items-center justify-between gap-2 border-border/60 border-t border-dashed pt-2 text-muted-foreground text-xs">
				<span>
					{answer.respondent.name ? answer.respondent.name : "Unknown participant"}
					{answer.answered_at ? ` · ${new Date(answer.answered_at).toLocaleDateString()}` : null}
				</span>
				{detailLink ? (
					<Link to={detailLink} className="inline-flex items-center gap-1 text-primary">
						{detailLabel} <ChevronRight className="h-3 w-3" />
					</Link>
				) : null}
			</div>
		</div>
	)
}

function ResearchQuestionSection({
	question,
	projectRoutes,
}: {
	question: ResearchQuestionNode
	projectRoutes?: RouteDefinitions
}) {
	return (
		<div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<h4 className="font-semibold text-foreground text-sm">{question.text}</h4>
					<MetricBadge label="answers" value={question.metrics.answered_answer_count} />
					<MetricBadge label="open" value={question.metrics.open_answer_count} />
				</div>
				<div className="flex items-center gap-2">
					<MetricBadge label="evidence" value={question.metrics.evidence_count} />
					<MetricBadge label="personas" value={question.metrics.persona_count} />
				</div>
			</div>
			<div className="space-y-3">
				{question.answers.length === 0 ? (
					<p className="text-muted-foreground text-sm">No interview answers linked yet.</p>
				) : (
					question.answers.map((answer) => (
						<AnswerRow key={answer.id} answer={answer} projectRoutes={projectRoutes} />
					))
				)}
			</div>
		</div>
	)
}

function DecisionQuestionSection({
	decision,
	projectRoutes,
}: {
	decision: DecisionQuestionNode
	projectRoutes?: RouteDefinitions
}) {
	return (
		<div className="space-y-4 rounded-xl border border-border bg-card">
			<div className="flex items-center justify-between gap-2 border-border/60 border-b px-4 py-3">
				<div className="flex items-center gap-2">
					<Lightbulb className="h-4 w-4 text-primary" />
					<h3 className="font-semibold text-base text-foreground">{decision.text}</h3>
				</div>
				<div className="flex items-center gap-2">
					<MetricBadge label="research goals" value={decision.metrics.research_question_count} />
					<MetricBadge label="answers" value={decision.metrics.answered_answer_count} />
					<MetricBadge label="evidence" value={decision.metrics.evidence_count} />
				</div>
			</div>
			<div className="space-y-4 px-4 pb-4">
				{decision.research_questions.length === 0 ? (
					<p className="text-muted-foreground text-sm">No research questions linked yet.</p>
				) : (
					decision.research_questions.map((rq) => (
						<ResearchQuestionSection key={rq.id} question={rq} projectRoutes={projectRoutes} />
					))
				)}
			</div>
		</div>
	)
}

export function ResearchAnswers({ projectId, className, projectRoutes, onMetrics, onData }: ResearchAnswersProps) {
	const [data, setData] = useState<ResearchAnswersData | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		let cancelled = false
		const fetchData = async () => {
			try {
				setLoading(true)
				onData?.(null)
				const response = await fetch(`/api.research-answers?projectId=${projectId}`)
				if (!response.ok) {
					const body = await response.json().catch(() => ({}))
					throw new Error(body?.error || response.statusText)
				}
				const body = (await response.json()) as { data: ResearchAnswersData }
				if (!cancelled) {
					setData(body.data)
					setError(null)
					onMetrics?.(summarizeMetrics(body.data))
					onData?.(body.data)
				}
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : "Failed to load research answers")
					onMetrics?.({ answered: 0, open: 0, total: 0 })
					onData?.(null)
				}
			} finally {
				if (!cancelled) setLoading(false)
			}
		}

		void fetchData()

		return () => {
			cancelled = true
		}
	}, [projectId, onData, onMetrics])

	const sections = useMemo(() => data ?? null, [data])

	useEffect(() => {
		if (loading) return
		if (!data) {
			onMetrics?.({ answered: 0, open: 0, total: 0 })
		}
	}, [data, loading, onMetrics])

	if (loading) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle>Research Answers</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="h-6 w-48 animate-pulse rounded bg-muted" />
					<div className="h-20 w-full animate-pulse rounded bg-muted" />
					<div className="h-20 w-full animate-pulse rounded bg-muted" />
				</CardContent>
			</Card>
		)
	}

	if (error) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle>Research Answers</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-destructive text-sm">{error}</p>
				</CardContent>
			</Card>
		)
	}

	if (!sections) {
		return null
	}

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Users className="h-4 w-4 text-primary" /> Research Answers
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-6">
				{sections.decision_questions.length === 0 && sections.research_questions_without_decision.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No decision or research questions linked yet. Capture questions in the planner to see interview answers roll
						up here.
					</p>
				) : null}

				{sections.decision_questions.map((decision) => (
					<DecisionQuestionSection
						key={decision.id}
						decision={decision}
						projectRoutes={projectRoutes}
					/>
				))}

				{sections.research_questions_without_decision.length > 0 && (
					<div className="space-y-4 rounded-xl border border-border bg-muted/10 p-4">
						<div className="flex items-center gap-2">
							<Lightbulb className="h-4 w-4 text-muted-foreground" />
							<h3 className="font-semibold text-foreground text-sm">Research Questions (no linked decision)</h3>
						</div>
						<div className="space-y-4">
							{sections.research_questions_without_decision.map((rq) => (
								<ResearchQuestionSection key={rq.id} question={rq} projectRoutes={projectRoutes} />
							))}
						</div>
					</div>
				)}

				{sections.orphan_answers.length > 0 && (
					<div className="space-y-3 rounded-xl border border-border/60 border-dashed bg-muted/20 p-4">
						<div className="flex items-center gap-2 font-semibold text-foreground text-sm">
							<Lightbulb className="h-4 w-4 text-muted-foreground" />
							Answers without linked research question
						</div>
						<div className="space-y-3">
							{sections.orphan_answers.map((answer) => (
								<AnswerRow key={answer.id} answer={answer} projectRoutes={projectRoutes} />
							))}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	)
}
