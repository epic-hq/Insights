/**
 * GenericLensView - Renders any conversation lens analysis based on template definition
 *
 * Dynamically renders sections and fields based on the template structure,
 * supporting text, text_array, numeric, date, and boolean field types.
 * Supports inline editing for text fields.
 */

import {
	AlertCircle,
	AlertTriangle,
	ArrowUpRight,
	Calendar,
	CheckCircle2,
	ClipboardList,
	Clock,
	Info,
	Loader2,
	Mail,
	MessageSquare,
	User,
	Users,
	XCircle,
} from "lucide-react"
import { useState } from "react"
import { Link, useFetcher } from "react-router"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import InlineEdit from "~/components/ui/inline-edit"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { cn } from "~/lib/utils"
import type { LensAnalysisWithTemplate, LensTemplate } from "../lib/loadLensAnalyses.server"
import { EvidenceModal } from "./EvidenceModal"
import { EvidenceTimestampBadges, hydrateEvidenceRefs } from "./EvidenceTimestampBadges"

type EvidenceRecord = {
	id: string
	anchors?: unknown
	start_ms?: number | null
	gist?: string | null
}

type Props = {
	analysis: LensAnalysisWithTemplate | null
	template?: LensTemplate
	isLoading?: boolean
	editable?: boolean
	/** Map of evidence ID to evidence record for hydrating timestamps */
	evidenceMap?: Map<string, EvidenceRecord>
}

/**
 * Parse a text_array value that might be stored as a string
 * BAML sometimes returns arrays as string representations like "[item1, item2]"
 */
function parseTextArrayValue(value: any): string[] | null {
	if (Array.isArray(value)) {
		return value.length > 0 ? value : null
	}

	if (typeof value === "string") {
		const trimmed = value.trim()
		// Check if it looks like a string-encoded array: [item1, item2, ...]
		if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
			// Try to parse as JSON first
			try {
				const parsed = JSON.parse(trimmed)
				if (Array.isArray(parsed) && parsed.length > 0) {
					return parsed
				}
			} catch {
				// Not valid JSON, try manual parsing
				// Format: [item1, item2., item3]
				const inner = trimmed.slice(1, -1).trim()
				if (inner) {
					// Split by comma, but be careful of commas inside items
					// Simple split works for most cases
					const items = inner
						.split(/,\s*(?=[A-Z])/)
						.map((s) => s.trim())
						.filter(Boolean)
					if (items.length > 0) {
						return items
					}
				}
			}
		}
		// Single non-empty string - return as single-item array
		if (trimmed) {
			return [trimmed]
		}
	}

	return null
}

type EvidenceRefForField = {
	evidenceId: string
	startMs?: number | null
	transcriptSnippet?: string | null
}

/**
 * Distribute evidence refs across array items
 * Since BAML gives us evidence at the field level, we distribute them evenly or by order
 * If we have same number of evidence as items, map 1:1
 * Otherwise, distribute round-robin style
 */
function distributeEvidenceToItems(items: string[], evidenceRefs: EvidenceRefForField[]): EvidenceRefForField[][] {
	const result: EvidenceRefForField[][] = items.map(() => [])

	if (items.length === evidenceRefs.length) {
		// Perfect 1:1 mapping
		evidenceRefs.forEach((ev, i) => {
			result[i].push(ev)
		})
	} else if (evidenceRefs.length > 0) {
		// Distribute evidence across items
		// Simple approach: assign evidence to items proportionally
		evidenceRefs.forEach((ev, i) => {
			const targetIndex = Math.floor((i / evidenceRefs.length) * items.length)
			result[Math.min(targetIndex, items.length - 1)].push(ev)
		})
	}

	return result
}

/**
 * Inline evidence link that opens a modal instead of navigating
 */
function InlineEvidenceLink({ evidenceRef, projectPath }: { evidenceRef: EvidenceRefForField; projectPath: string }) {
	const [modalOpen, setModalOpen] = useState(false)
	const ms = evidenceRef.startMs ?? 0
	const startTime = Math.floor(ms / 1000)
	const timeLabel = `${Math.floor(ms / 1000 / 60)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`

	return (
		<>
			<button
				type="button"
				onClick={(e) => {
					e.preventDefault()
					e.stopPropagation()
					setModalOpen(true)
				}}
				className="font-mono text-primary text-xs hover:underline"
				title={evidenceRef.transcriptSnippet || "View evidence"}
			>
				[{timeLabel}]
			</button>
			<EvidenceModal
				open={modalOpen}
				onOpenChange={setModalOpen}
				evidenceId={evidenceRef.evidenceId}
				startTime={startTime}
				projectPath={projectPath}
			/>
		</>
	)
}

/**
 * Purpose-built layout for the Q&A conversation lens (qa-summary)
 * Presents question/answer pairs inline with a single follow-up list.
 */
function QALensView({
	analysis,
	analysisData,
	evidenceMap,
}: {
	analysis: LensAnalysisWithTemplate | null
	analysisData: any
	evidenceMap?: Map<string, EvidenceRecord>
}) {
	const qaPairs = Array.isArray(analysisData?.qa_pairs) ? analysisData.qa_pairs : []
	const unansweredQuestions = Array.isArray(analysisData?.unanswered_questions)
		? analysisData.unanswered_questions.filter(Boolean)
		: []
	const keyTakeaways = Array.isArray(analysisData?.key_takeaways) ? analysisData.key_takeaways.filter(Boolean) : []
	const topics = Array.isArray(analysisData?.topics_covered) ? analysisData.topics_covered.filter(Boolean) : []
	const confidence = analysis?.confidence_score ?? analysisData?.overall_confidence ?? null

	// Collect follow-ups: combine unanswered items + flagged pairs
	const followUps: Array<{ question: string; reason: string }> = []
	const seen = new Set<string>()
	for (const question of unansweredQuestions) {
		if (typeof question === "string" && question.trim() && !seen.has(question.trim())) {
			seen.add(question.trim())
			followUps.push({ question: question.trim(), reason: "Unanswered" })
		}
	}
	for (const pair of qaPairs) {
		const text = typeof pair?.question === "string" ? pair.question.trim() : ""
		if (pair?.follow_up_needed && text && !seen.has(text)) {
			seen.add(text)
			followUps.push({ question: text, reason: "Needs follow-up" })
		}
	}

	const renderEvidenceBadges = (evidenceIds?: string[]) => {
		if (!evidenceIds || evidenceIds.length === 0) return null
		const refs = evidenceMap ? hydrateEvidenceRefs(evidenceIds, evidenceMap) : undefined
		return (
			<EvidenceTimestampBadges evidenceRefs={refs} evidenceIds={!refs ? evidenceIds : undefined} className="mt-2" />
		)
	}

	return (
		<div className="space-y-6">
			{analysisData?.executive_summary ? (
				<div className="rounded-lg border-primary border-l-4 bg-primary/5 p-4 dark:bg-primary/10">
					<p className="font-medium text-sm leading-relaxed">{analysisData.executive_summary}</p>
				</div>
			) : null}

			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex flex-wrap items-center gap-2">
					{topics.map((topic: string) => (
						<Badge key={topic} variant="outline" className="text-xs">
							{topic}
						</Badge>
					))}
				</div>
				<div className="flex items-center gap-2 text-muted-foreground text-sm">
					{confidence !== null && confidence !== undefined && <ConfidenceIndicator confidence={confidence} />}
					{analysis?.processed_at ? <span>Analyzed {new Date(analysis.processed_at).toLocaleDateString()}</span> : null}
				</div>
			</div>

			<section className="space-y-3">
				<div className="flex items-center justify-between">
					<h3 className="font-semibold text-lg">Question / Answer pairs</h3>
					{qaPairs.length > 0 && (
						<Badge variant="secondary" className="text-xs">
							{qaPairs.length} pairs
						</Badge>
					)}
				</div>

				{qaPairs.length === 0 ? (
					<p className="text-muted-foreground text-sm italic">No question/answer pairs captured yet.</p>
				) : (
					<div className="space-y-3">
						{qaPairs.map((pair: any, idx: number) => {
							return (
								<div key={pair?.question_evidence_id || idx} className="rounded-lg border bg-card/70 p-4">
									<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
										<div className="flex flex-wrap items-center gap-2">
											{pair?.topic ? (
												<Badge variant="outline" className="text-xs">
													{pair.topic}
												</Badge>
											) : null}
											{pair?.follow_up_needed ? (
												<Badge variant="destructive" className="text-xs">
													Follow up
												</Badge>
											) : null}
										</div>
										<ConfidenceIndicator confidence={pair?.confidence} />
									</div>

									<div className="space-y-2">
										<p className="text-muted-foreground text-xs uppercase tracking-wide">Question</p>
										<p className="font-medium text-foreground text-sm leading-relaxed">
											{pair?.question || "Question not captured"}
										</p>
										{renderEvidenceBadges(pair?.question_evidence_id ? [pair.question_evidence_id] : undefined)}
									</div>

									<div className="mt-4 space-y-2">
										<p className="text-muted-foreground text-xs uppercase tracking-wide">Answer</p>
										<p className="text-foreground text-sm leading-relaxed">{pair?.answer || "No answer captured"}</p>
										{pair?.answer_verbatim ? (
											<blockquote className="rounded-md border-primary/50 border-l-2 bg-muted/40 px-3 py-2 text-muted-foreground text-sm italic">
												“{pair.answer_verbatim}”
											</blockquote>
										) : null}
										{renderEvidenceBadges(pair?.answer_evidence_ids)}
									</div>
								</div>
							)
						})}
					</div>
				)}
			</section>

			{followUps.length > 0 && (
				<section className="space-y-3">
					<div className="flex items-center gap-2">
						<ClipboardList className="h-4 w-4 text-muted-foreground" />
						<h3 className="font-semibold text-lg">Next steps</h3>
						<Badge variant="outline" className="text-xs">
							{followUps.length}
						</Badge>
					</div>
					<ul className="space-y-2">
						{followUps.map((item, idx) => (
							<li key={`${item.question}-${idx}`} className="rounded-md border bg-muted/20 p-3">
								<p className="font-medium text-sm">{item.question}</p>
								<p className="text-muted-foreground text-xs">{item.reason}</p>
							</li>
						))}
					</ul>
				</section>
			)}

			{keyTakeaways.length > 0 && (
				<section className="space-y-2">
					<h3 className="font-semibold text-lg">Key takeaways</h3>
					<ul className="list-disc space-y-1 pl-5 text-sm">
						{keyTakeaways.map((takeaway: string, idx: number) => (
							<li key={`${takeaway}-${idx}`} className="text-foreground">
								{takeaway}
							</li>
						))}
					</ul>
				</section>
			)}
		</div>
	)
}

/**
 * Render a field value based on its type
 * Supports inline editing for text fields when editable=true
 * For text_array fields, can show inline evidence links
 */
function FieldValue({
	value,
	fieldType,
	editable,
	onSubmit,
	evidenceRefs,
	projectPath,
}: {
	value: any
	fieldType: string
	editable?: boolean
	onSubmit?: (value: string) => void
	evidenceRefs?: EvidenceRefForField[]
	projectPath?: string
}) {
	if (value === null || value === undefined) {
		return <span className="text-muted-foreground italic">Not captured</span>
	}

	switch (fieldType) {
		case "text_array": {
			const arrayValue = parseTextArrayValue(value)
			if (!arrayValue) {
				return <span className="text-muted-foreground italic">None</span>
			}

			// If we have evidence refs and projectPath, try to match evidence to items by text similarity
			// Since evidence_ids are at the field level, we distribute them across items
			const evidencePerItem =
				evidenceRefs && projectPath && evidenceRefs.length > 0
					? distributeEvidenceToItems(arrayValue, evidenceRefs)
					: null

			return (
				<ul className="list-inside list-disc space-y-1">
					{arrayValue.map((item, i) => {
						const itemEvidence = evidencePerItem?.[i]

						return (
							<li key={i} className="text-sm">
								<span>{item}</span>
								{itemEvidence && itemEvidence.length > 0 && projectPath && (
									<span className="ml-1 inline-flex gap-1">
										{itemEvidence.map((ev) => (
											<InlineEvidenceLink key={ev.evidenceId} evidenceRef={ev} projectPath={projectPath} />
										))}
									</span>
								)}
							</li>
						)
					})}
				</ul>
			)
		}

		case "boolean":
			return value ? <Badge variant="default">Yes</Badge> : <Badge variant="secondary">No</Badge>

		case "numeric":
			return <span className="font-mono">{value}</span>

		case "date":
			return (
				<span>
					{new Date(value).toLocaleDateString(undefined, {
						year: "numeric",
						month: "short",
						day: "numeric",
					})}
				</span>
			)

		default:
			// Text fields support inline editing
			if (editable && onSubmit) {
				return (
					<InlineEdit
						value={String(value)}
						onSubmit={onSubmit}
						multiline={String(value).length > 100}
						textClassName="text-sm"
						placeholder="Click to edit"
						showEditButton
					/>
				)
			}
			return <span>{String(value)}</span>
	}
}

/**
 * Render confidence indicator with tooltip explanation
 */
function ConfidenceIndicator({ confidence }: { confidence: string | number | null }) {
	if (!confidence) return null

	const level =
		typeof confidence === "number"
			? confidence > 0.7
				? "high"
				: confidence > 0.4
					? "medium"
					: "low"
			: confidence.toLowerCase()

	const colors = {
		high: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
		medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
		low: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
		inconclusive: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
	}

	const tooltipText = "AI confidence score based on transcript clarity, explicit statements, and supporting evidence"

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<Badge variant="outline" className={cn("cursor-help", colors[level as keyof typeof colors] || colors.medium)}>
						{typeof confidence === "number" ? `${Math.round(confidence * 100)}%` : confidence}
					</Badge>
				</TooltipTrigger>
				<TooltipContent>
					<p className="max-w-xs text-sm">{tooltipText}</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	)
}

/**
 * Render a section from the template
 * fields format: [{field_key, value, confidence, evidence_ids}]
 */
function SectionView({
	sectionDef,
	fields,
	editable,
	onFieldUpdate,
	evidenceMap,
	projectPath,
}: {
	sectionDef: LensTemplate["template_definition"]["sections"][0]
	fields: any[]
	editable?: boolean
	onFieldUpdate?: (sectionKey: string, fieldKey: string, value: string) => void
	evidenceMap?: Map<string, EvidenceRecord>
	projectPath?: string
}) {
	if (!fields || fields.length === 0) {
		return <div className="py-4 text-muted-foreground text-sm italic">No data extracted for this section</div>
	}

	// Build a map for quick lookup
	const fieldMap = new Map(fields.map((f) => [f.field_key, f]))

	return (
		<div className="space-y-3 rounded-lg border bg-card p-4">
			{sectionDef.fields.map((fieldDef) => {
				const field = fieldMap.get(fieldDef.field_key)
				const hasValue = field && field.value !== null && field.value !== undefined
				const isTextArray = fieldDef.field_type === "text_array"

				// For text_array, check if it has actual items
				const arrayValue = isTextArray && hasValue ? parseTextArrayValue(field.value) : null
				const effectivelyHasValue = isTextArray ? (arrayValue?.length ?? 0) > 0 : hasValue

				const isTextType = fieldDef.field_type === "text"
				const canEdit = !!(editable && isTextType && onFieldUpdate && hasValue)

				// Hydrate evidence refs with timestamps if we have the evidence map
				const evidenceRefs =
					hasValue && field.evidence_ids?.length > 0 && evidenceMap
						? hydrateEvidenceRefs(field.evidence_ids, evidenceMap)
						: undefined

				// Status icon
				const StatusIcon = effectivelyHasValue ? CheckCircle2 : XCircle
				const statusIconColor = effectivelyHasValue ? "text-emerald-600" : "text-gray-400"

				return (
					<div key={fieldDef.field_key} className="flex items-start gap-3">
						<StatusIcon className={cn("mt-0.5 h-4 w-4 flex-shrink-0", statusIconColor)} />
						<div className="min-w-0 flex-1">
							<div className="mb-1">
								<span className="font-medium text-muted-foreground text-sm">{fieldDef.field_name}</span>
							</div>
							<div className="text-sm">
								{effectivelyHasValue ? (
									<FieldValue
										value={field?.value}
										fieldType={fieldDef.field_type}
										editable={canEdit}
										onSubmit={
											canEdit ? (value) => onFieldUpdate(sectionDef.section_key, fieldDef.field_key, value) : undefined
										}
										evidenceRefs={evidenceRefs}
										projectPath={projectPath}
									/>
								) : (
									<span className="text-muted-foreground italic">Not captured</span>
								)}
							</div>
							{/* Show evidence timestamps as badges for non-array fields (arrays show inline) */}
							{!isTextArray && hasValue && field?.evidence_ids?.length > 0 && (
								<EvidenceTimestampBadges
									evidenceRefs={evidenceRefs}
									evidenceIds={evidenceRefs ? undefined : field.evidence_ids}
								/>
							)}
						</div>
					</div>
				)
			})}
		</div>
	)
}

// ─────────────────────────────────────────────────────────────────────────────
// Rich Entity Components
// ─────────────────────────────────────────────────────────────────────────────

const INFLUENCE_BADGE_COLORS: Record<string, string> = {
	high: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
	medium: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800",
	low: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
}

const LABEL_DISPLAY: Record<string, { label: string; className: string }> = {
	economic_buyer: {
		label: "Economic Buyer",
		className: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
	},
	champion: { label: "Champion", className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
	blocker: { label: "Blocker", className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
	technical_evaluator: {
		label: "Technical",
		className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
	},
	end_user: { label: "End User", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" },
	coach: { label: "Coach", className: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" },
}

/**
 * Render a stakeholder card with linking and inline editing support
 */
function StakeholderCard({
	stakeholder,
	routes,
	evidenceMap,
	editable,
	onUpdate,
}: {
	stakeholder: any
	routes?: ReturnType<typeof useProjectRoutes>
	evidenceMap?: Map<string, EvidenceRecord>
	editable?: boolean
	onUpdate?: (updates: Record<string, unknown>) => void
}) {
	const evidenceRefs =
		stakeholder.evidence_ids?.length > 0 && evidenceMap
			? hydrateEvidenceRefs(stakeholder.evidence_ids, evidenceMap)
			: undefined

	return (
		<div className="rounded-lg border bg-card p-3">
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<User className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
						{stakeholder.person_id && routes ? (
							<Link
								to={routes.people.detail(stakeholder.person_id)}
								className="font-medium text-primary hover:underline"
							>
								{stakeholder.name}
							</Link>
						) : editable && onUpdate ? (
							<InlineEdit
								value={stakeholder.name || ""}
								onSubmit={(value) => onUpdate({ name: value })}
								textClassName="font-medium text-sm"
								placeholder="Enter name"
								showEditButton
							/>
						) : (
							<span className="font-medium">{stakeholder.name}</span>
						)}
					</div>
					{editable && onUpdate ? (
						<div className="mt-0.5">
							<InlineEdit
								value={stakeholder.role || ""}
								onSubmit={(value) => onUpdate({ role: value })}
								textClassName="text-muted-foreground text-sm"
								placeholder="Add role"
								showEditButton
							/>
						</div>
					) : stakeholder.role ? (
						<p className="mt-0.5 text-muted-foreground text-sm">{stakeholder.role}</p>
					) : null}
					{stakeholder.organization && (
						<p className="text-muted-foreground text-xs">
							{stakeholder.organization}
							{stakeholder.email && (
								<>
									{" "}
									· <Mail className="inline h-3 w-3" /> {stakeholder.email}
								</>
							)}
						</p>
					)}
				</div>
				<div className="flex flex-col items-end gap-1">
					{stakeholder.influence && (
						<Badge variant="outline" className={cn("text-xs", INFLUENCE_BADGE_COLORS[stakeholder.influence])}>
							{stakeholder.influence} influence
						</Badge>
					)}
					<ConfidenceIndicator confidence={stakeholder.confidence} />
				</div>
			</div>

			{/* Labels */}
			{stakeholder.labels?.length > 0 && (
				<div className="mt-2 flex flex-wrap gap-1">
					{stakeholder.labels.map((label: string) => {
						const displayInfo = LABEL_DISPLAY[label] || { label, className: "bg-gray-100 text-gray-600" }
						return (
							<Badge key={label} variant="secondary" className={cn("text-xs", displayInfo.className)}>
								{displayInfo.label}
							</Badge>
						)
					})}
				</div>
			)}

			{/* Evidence timestamps */}
			{stakeholder.evidence_ids?.length > 0 && (
				<EvidenceTimestampBadges
					evidenceRefs={evidenceRefs}
					evidenceIds={evidenceRefs ? undefined : stakeholder.evidence_ids}
					className="mt-2"
				/>
			)}
		</div>
	)
}

/**
 * Render a next step card with inline editing support
 * Links to the task when task_id is present (tasks are created when lens is applied)
 */
function NextStepCard({
	nextStep,
	evidenceMap,
	editable,
	onUpdate,
	routes,
}: {
	nextStep: any
	evidenceMap?: Map<string, EvidenceRecord>
	editable?: boolean
	onUpdate?: (updates: Record<string, unknown>) => void
	routes?: ReturnType<typeof useProjectRoutes>
}) {
	const evidenceRefs =
		nextStep.evidence_ids?.length > 0 && evidenceMap
			? hydrateEvidenceRefs(nextStep.evidence_ids, evidenceMap)
			: undefined

	// Task status colors (from tasks table)
	const taskStatusColors: Record<string, string> = {
		backlog: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
		todo: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
		in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
		blocked: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
		review: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
		done: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
		archived: "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500",
	}

	// Legacy next_step status colors (for pre-task-linking data)
	const legacyStatusColors: Record<string, string> = {
		pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
		in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
		completed: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
	}

	const statusColors = nextStep.task_id ? taskStatusColors : legacyStatusColors

	return (
		<div className="rounded-lg border bg-card p-3">
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0 flex-1">
					{/* Title - link to task if available */}
					{nextStep.task_id && routes ? (
						<Link
							to={`${routes.priorities()}?taskId=${nextStep.task_id}`}
							className="group inline-flex items-center gap-1 font-medium text-primary text-sm hover:underline"
						>
							{nextStep.description}
							<ArrowUpRight className="h-3 w-3 opacity-50 transition-opacity group-hover:opacity-100" />
						</Link>
					) : editable && onUpdate ? (
						<InlineEdit
							value={nextStep.description || ""}
							onSubmit={(value) => onUpdate({ description: value })}
							textClassName="font-medium text-sm"
							placeholder="Enter description"
							multiline
							showEditButton
						/>
					) : (
						<p className="font-medium text-sm">{nextStep.description}</p>
					)}
					<div className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
						{editable && onUpdate && !nextStep.task_id ? (
							<span className="flex items-center gap-1">
								<User className="h-3 w-3" />
								<InlineEdit
									value={nextStep.owner || ""}
									onSubmit={(value) => onUpdate({ owner: value })}
									textClassName="text-muted-foreground text-xs"
									placeholder="Add owner"
									showEditButton
								/>
							</span>
						) : nextStep.owner ? (
							<span className="flex items-center gap-1">
								<User className="h-3 w-3" /> {nextStep.owner}
							</span>
						) : null}
						{editable && onUpdate && !nextStep.task_id ? (
							<span className="flex items-center gap-1">
								<Calendar className="h-3 w-3" />
								<InlineEdit
									value={nextStep.due_date || ""}
									onSubmit={(value) => onUpdate({ due_date: value })}
									textClassName="text-muted-foreground text-xs"
									placeholder="Add due date"
									showEditButton
								/>
							</span>
						) : nextStep.due_date ? (
							<span className="flex items-center gap-1">
								<Calendar className="h-3 w-3" /> {nextStep.due_date}
							</span>
						) : null}
						{/* Show task indicator */}
						{nextStep.task_id && (
							<span className="flex items-center gap-1 text-primary">
								<CheckCircle2 className="h-3 w-3" /> Task
							</span>
						)}
					</div>
				</div>
				<div className="flex flex-col items-end gap-1">
					{nextStep.priority && (
						<Badge
							variant={
								nextStep.priority === "high" ? "destructive" : nextStep.priority === "medium" ? "default" : "secondary"
							}
							className="text-xs"
						>
							{nextStep.priority}
						</Badge>
					)}
					{nextStep.status && (
						<Badge variant="outline" className={cn("text-xs", statusColors[nextStep.status] || "")}>
							{nextStep.status.replace("_", " ")}
						</Badge>
					)}
				</div>
			</div>

			{/* Evidence timestamps */}
			{nextStep.evidence_ids?.length > 0 && (
				<EvidenceTimestampBadges
					evidenceRefs={evidenceRefs}
					evidenceIds={evidenceRefs ? undefined : nextStep.evidence_ids}
					className="mt-2"
				/>
			)}
		</div>
	)
}

/**
 * Render an objection card with inline editing support
 */
function ObjectionCard({
	objection,
	evidenceMap,
	editable,
	onUpdate,
}: {
	objection: any
	evidenceMap?: Map<string, EvidenceRecord>
	editable?: boolean
	onUpdate?: (updates: Record<string, unknown>) => void
}) {
	const evidenceRefs =
		objection.evidence_ids?.length > 0 && evidenceMap
			? hydrateEvidenceRefs(objection.evidence_ids, evidenceMap)
			: undefined

	const statusColors: Record<string, string> = {
		raised: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
		addressed: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
		unresolved: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
	}

	return (
		<div className="rounded-lg border bg-card p-3">
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<MessageSquare className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
						{editable && onUpdate ? (
							<InlineEdit
								value={objection.objection || ""}
								onSubmit={(value) => onUpdate({ objection: value })}
								textClassName="font-medium text-sm"
								placeholder="Enter objection"
								multiline
								showEditButton
							/>
						) : (
							<span className="font-medium text-sm">{objection.objection}</span>
						)}
					</div>
					{editable && onUpdate ? (
						<div className="mt-1">
							<span className="text-muted-foreground text-sm">Response: </span>
							<InlineEdit
								value={objection.response || ""}
								onSubmit={(value) => onUpdate({ response: value })}
								textClassName="text-muted-foreground text-sm"
								placeholder="Add response"
								multiline
								showEditButton
							/>
						</div>
					) : objection.response ? (
						<p className="mt-1 text-muted-foreground text-sm">Response: {objection.response}</p>
					) : null}
				</div>
				<div className="flex flex-col items-end gap-1">
					<Badge variant="outline" className="text-xs">
						{objection.type}
					</Badge>
					{objection.status && (
						<Badge variant="outline" className={cn("text-xs", statusColors[objection.status] || "")}>
							{objection.status}
						</Badge>
					)}
				</div>
			</div>

			{/* Evidence timestamps */}
			{objection.evidence_ids?.length > 0 && (
				<EvidenceTimestampBadges
					evidenceRefs={evidenceRefs}
					evidenceIds={evidenceRefs ? undefined : objection.evidence_ids}
					className="mt-2"
				/>
			)}
		</div>
	)
}

/**
 * Render hygiene warnings
 */
function HygieneWarnings({ hygiene }: { hygiene: any[] }) {
	if (!hygiene || hygiene.length === 0) return null

	const severityIcons: Record<string, React.ReactNode> = {
		critical: <AlertCircle className="h-4 w-4 text-red-600" />,
		warning: <AlertTriangle className="h-4 w-4 text-amber-600" />,
		info: <Info className="h-4 w-4 text-blue-600" />,
	}

	const severityColors: Record<string, string> = {
		critical: "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/30",
		warning: "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/30",
		info: "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/30",
	}

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="flex items-center gap-2 text-lg">
					<AlertTriangle className="h-5 w-5 text-amber-600" />
					Missing Information
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2">
				{hygiene.map((item: any, idx: number) => (
					<div
						key={idx}
						className={cn("flex items-start gap-2 rounded border p-2", severityColors[item.severity] || "")}
					>
						{severityIcons[item.severity] || severityIcons.info}
						<div>
							<span className="text-sm">{item.message}</span>
							{item.field_key && <span className="ml-1 text-muted-foreground text-xs">({item.field_key})</span>}
						</div>
					</div>
				))}
			</CardContent>
		</Card>
	)
}

/**
 * Status indicator for pending/processing/failed analyses
 */
function StatusIndicator({ status, errorMessage }: { status: string; errorMessage?: string | null }) {
	switch (status) {
		case "pending":
			return (
				<div className="flex items-center gap-2 py-8 text-muted-foreground">
					<Clock className="h-5 w-5" />
					<span>Analysis pending...</span>
				</div>
			)
		case "processing":
			return (
				<div className="flex items-center gap-2 py-8 text-blue-600">
					<Loader2 className="h-5 w-5 animate-spin" />
					<span>Analyzing conversation...</span>
				</div>
			)
		case "failed":
			return (
				<div className="flex items-center gap-2 py-8 text-destructive">
					<AlertCircle className="h-5 w-5" />
					<span>{errorMessage || "Analysis failed"}</span>
				</div>
			)
		case "completed":
			return null
		default:
			return null
	}
}

export function GenericLensView({ analysis, template, isLoading, editable = false, evidenceMap }: Props) {
	const fetcher = useFetcher()
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath)

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		)
	}

	// Use template from analysis if not provided separately
	const templateDef = template?.template_definition || analysis?.template.template_definition

	if (!analysis && !template) {
		return <div className="py-12 text-center text-muted-foreground">No analysis available</div>
	}

	// Show status for non-completed analyses
	if (analysis && analysis.status !== "completed") {
		return (
			<Card>
				<CardHeader>
					<CardTitle>{analysis.template.template_name}</CardTitle>
					{analysis.template.summary && <CardDescription>{analysis.template.summary}</CardDescription>}
				</CardHeader>
				<CardContent className="flex justify-center">
					<StatusIndicator status={analysis.status} errorMessage={analysis.error_message} />
				</CardContent>
			</Card>
		)
	}

	// No template definition
	if (!templateDef) {
		return <div className="py-12 text-center text-muted-foreground">Template definition not available</div>
	}

	const analysisData = analysis?.analysis_data || {}
	const sections = analysisData.sections || []
	const templateKey = template?.template_key || analysis?.template_key

	// Dedicated presentation for Q&A lens (qa-summary) focused on readable Q/A pairs
	if (templateKey === "qa-summary") {
		return <QALensView analysis={analysis} analysisData={analysisData} evidenceMap={evidenceMap} />
	}

	// Build a map of section data by section_key
	// Format: sections[].fields = [{field_key, value, confidence, evidence_ids}]
	// Also includes summary for each section
	const sectionDataMap: Record<string, { fields: any[]; summary?: string }> = {}
	for (const section of sections) {
		if (section.section_key) {
			sectionDataMap[section.section_key] = {
				fields: section.fields || [],
				summary: section.summary,
			}
		}
	}

	// Handler for field updates via inline edit
	const handleFieldUpdate = (sectionKey: string, fieldKey: string, value: string) => {
		if (!analysis?.id) return

		fetcher.submit(
			{
				analysisId: analysis.id,
				sectionKey,
				fieldKey,
				value,
			},
			{
				method: "post",
				action: "/api/update-lens-analysis-field",
			}
		)
	}

	// Handler for entity updates via inline edit
	const handleEntityUpdate = (
		entityType: "stakeholders" | "next_steps" | "objections",
		entityIndex: number,
		updates: Record<string, unknown>
	) => {
		if (!analysis?.id) return

		fetcher.submit(
			{
				analysisId: analysis.id,
				entityType,
				entityIndex: String(entityIndex),
				updates: JSON.stringify(updates),
			},
			{
				method: "post",
				action: "/api/update-lens-entity",
			}
		)
	}

	return (
		<div className="space-y-6">
			{/* Executive Summary (TLDR) */}
			{analysisData.executive_summary && (
				<div className="rounded-lg border-primary border-l-4 bg-primary/5 p-4 dark:bg-primary/10">
					<p className="font-medium text-sm">{analysisData.executive_summary}</p>
				</div>
			)}

			{/* Header with confidence and date */}
			{analysis && (
				<div className="flex items-center justify-end gap-3">
					{analysis.confidence_score !== null && <ConfidenceIndicator confidence={analysis.confidence_score} />}
					<span className="text-muted-foreground text-sm">
						Analyzed {analysis.processed_at ? new Date(analysis.processed_at).toLocaleDateString() : "recently"}
					</span>
				</div>
			)}

			{/* Render each section */}
			{templateDef.sections.map((sectionDef) => {
				const sectionData = sectionDataMap[sectionDef.section_key]
				const hasSummary = sectionData?.summary
				const hasFields = sectionData?.fields && sectionData.fields.length > 0

				return (
					<Card key={sectionDef.section_key}>
						<CardHeader className="pb-3">
							<CardTitle className="text-lg">{sectionDef.section_name}</CardTitle>
							{sectionDef.description && <CardDescription>{sectionDef.description}</CardDescription>}
						</CardHeader>
						<CardContent className="space-y-3">
							{/* Section Summary - punchy TLDR for this section */}
							{hasSummary && <p className="text-foreground/90 text-sm leading-relaxed">{sectionData.summary}</p>}
							{/* Detailed fields */}
							{hasFields && (
								<details className="group">
									<summary className="flex cursor-pointer items-center gap-1 text-muted-foreground text-xs hover:text-foreground">
										<span className="transition-transform group-open:rotate-90">▶</span>
										View details ({sectionData.fields.length} fields)
									</summary>
									<div className="mt-3">
										<SectionView
											sectionDef={sectionDef}
											fields={sectionData.fields}
											editable={editable}
											onFieldUpdate={handleFieldUpdate}
											evidenceMap={evidenceMap}
											projectPath={projectPath}
										/>
									</div>
								</details>
							)}
							{/* Fallback when no data */}
							{!hasSummary && !hasFields && (
								<p className="text-muted-foreground text-sm italic">No data extracted for this section</p>
							)}
						</CardContent>
					</Card>
				)
			})}

			{/* Rich Entity Rendering - Stakeholders */}
			{analysisData.entities?.some((e: any) => e.entity_type === "stakeholders" && e.stakeholders?.length > 0) && (
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="flex items-center gap-2 text-lg">
							<Users className="h-5 w-5" />
							Stakeholders
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						{analysisData.entities
							.filter((e: any) => e.entity_type === "stakeholders")
							.flatMap((e: any) => e.stakeholders || [])
							.map((stakeholder: any, idx: number) => (
								<StakeholderCard
									key={idx}
									stakeholder={stakeholder}
									routes={routes}
									evidenceMap={evidenceMap}
									editable={editable}
									onUpdate={(updates) => handleEntityUpdate("stakeholders", idx, updates)}
								/>
							))}
					</CardContent>
				</Card>
			)}

			{/* Rich Entity Rendering - Next Steps */}
			{analysisData.entities?.some((e: any) => e.entity_type === "next_steps" && e.next_steps?.length > 0) && (
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="flex items-center gap-2 text-lg">
							<CheckCircle2 className="h-5 w-5" />
							Next Steps
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						{analysisData.entities
							.filter((e: any) => e.entity_type === "next_steps")
							.flatMap((e: any) => e.next_steps || [])
							.map((nextStep: any, idx: number) => (
								<NextStepCard
									key={idx}
									nextStep={nextStep}
									evidenceMap={evidenceMap}
									editable={editable}
									onUpdate={(updates) => handleEntityUpdate("next_steps", idx, updates)}
									routes={routes}
								/>
							))}
					</CardContent>
				</Card>
			)}

			{/* Rich Entity Rendering - Objections */}
			{analysisData.entities?.some((e: any) => e.entity_type === "objections" && e.objections?.length > 0) && (
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="flex items-center gap-2 text-lg">
							<MessageSquare className="h-5 w-5" />
							Objections & Concerns
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						{analysisData.entities
							.filter((e: any) => e.entity_type === "objections")
							.flatMap((e: any) => e.objections || [])
							.map((objection: any, idx: number) => (
								<ObjectionCard
									key={idx}
									objection={objection}
									evidenceMap={evidenceMap}
									editable={editable}
									onUpdate={(updates) => handleEntityUpdate("objections", idx, updates)}
								/>
							))}
					</CardContent>
				</Card>
			)}

			{/* Hygiene Warnings */}
			{analysisData.hygiene?.length > 0 && <HygieneWarnings hygiene={analysisData.hygiene} />}

			{/* Recommendations if enabled */}
			{(templateDef.recommendations_enabled || analysisData.recommendations?.length > 0) &&
				analysisData.recommendations?.length > 0 && (
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-lg">Recommendations</CardTitle>
						</CardHeader>
						<CardContent>
							<ul className="space-y-2">
								{analysisData.recommendations.map((rec: any, i: number) => (
									<li key={i} className="flex items-start gap-2">
										<Badge
											variant={
												rec.priority === "high" ? "destructive" : rec.priority === "medium" ? "default" : "secondary"
											}
											className="mt-0.5"
										>
											{rec.priority || "medium"}
										</Badge>
										<span className="text-sm">{rec.description}</span>
									</li>
								))}
							</ul>
						</CardContent>
					</Card>
				)}

			{/* Key insights if present */}
			{analysisData.key_insights?.length > 0 && (
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-lg">Key Insights</CardTitle>
					</CardHeader>
					<CardContent>
						<ul className="list-inside list-disc space-y-1">
							{analysisData.key_insights.map((insight: string, i: number) => (
								<li key={i} className="text-sm">
									{insight}
								</li>
							))}
						</ul>
					</CardContent>
				</Card>
			)}

			{/* Research learnings for project-research lens */}
			{analysisData.research_learnings?.length > 0 && (
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-lg">Research Learnings</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							{analysisData.research_learnings.map((learning: any, i: number) => (
								<div key={i} className="border-primary/30 border-l-2 pl-3">
									<p className="font-medium text-sm">{learning.learning_statement}</p>
									{learning.relevance_to_goals && (
										<p className="mt-1 text-muted-foreground text-xs">{learning.relevance_to_goals}</p>
									)}
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Goal completion score for project-research lens */}
			{analysisData.goal_completion_score !== undefined && (
				<div className="text-muted-foreground text-sm">
					Goal completion: {Math.round(analysisData.goal_completion_score * 100)}%
				</div>
			)}
		</div>
	)
}
