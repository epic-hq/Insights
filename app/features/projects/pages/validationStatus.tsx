import { AlertCircle, ChevronRight, Eye, Flame, LayoutList, LineChart, Rocket, Settings, Target, TrendingUp } from "lucide-react"
import { useState } from "react"
import type { LoaderFunctionArgs } from "react-router"
import { Link, useLoaderData } from "react-router"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Progress } from "~/components/ui/progress"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"

type ValidationGateSlug = "pain_exists" | "awareness" | "quantified" | "acting"
type ValidationStage = "None" | "Pain Exists" | "Awareness" | "Quantified Impact" | "Taking Action"
type ValidationDetailKey = "painExists" | "awareness" | "quantified" | "acting"

const VALIDATION_GATE_ORDER: ValidationGateSlug[] = ["pain_exists", "awareness", "quantified", "acting"]

const slugToDetailKey: Record<ValidationGateSlug, ValidationDetailKey> = {
	pain_exists: "painExists",
	awareness: "awareness",
	quantified: "quantified",
	acting: "acting",
}

const validationGateLabels: Record<ValidationGateSlug, ValidationStage> = {
	pain_exists: "Pain Exists",
	awareness: "Awareness",
	quantified: "Quantified Impact",
	acting: "Taking Action",
}

interface ValidationGateDetail {
	summary: string
	confidence: number | null
	updatedAt: string | null
}

interface ValidationParticipant {
	id: string
	name: string
	company: string
	outcome: 1 | 2 | 3 | 4 | 5
	stage: ValidationStage
	keyInsight: string
	validationDetails: Partial<Record<ValidationDetailKey, ValidationGateDetail>>
}

const outcomeConfig = {
	1: {
		label: "No Signal",
		description: "No interviews linked to validation gates yet.",
		color: "bg-gray-100 text-gray-700 border-gray-200",
		icon: AlertCircle,
	},
	2: {
		label: "Pain Exists",
		description: "Evidence shows the pain is real for this participant.",
		color: "bg-orange-50 text-orange-700 border-orange-200",
		icon: Flame,
	},
	3: {
		label: "Awareness",
		description: "Participants recognise and talk about the pain.",
		color: "bg-yellow-50 text-yellow-700 border-yellow-200",
		icon: Eye,
	},
	4: {
		label: "Quantified",
		description: "Participants have sized the time or money cost.",
		color: "bg-blue-50 text-blue-700 border-blue-200",
		icon: LineChart,
	},
	5: {
		label: "Taking Action",
		description: "Participants are paying, building, or actively solving today.",
		color: "bg-emerald-50 text-emerald-700 border-emerald-200",
		icon: Rocket,
	},
} as const

const stageDescriptions: Record<ValidationStage, string> = {
	None: "No validation interviews processed yet.",
	"Pain Exists": "Evidence that this problem is happening in real workflows.",
	Awareness: "Participants recognise the pain without prompting.",
	"Quantified Impact": "Participants can describe the size of the pain in time or money.",
	"Taking Action": "Participants are spending time or money to address it right now.",
}

const gateIconMap: Record<ValidationDetailKey, typeof Flame> = {
	painExists: Flame,
	awareness: Eye,
	quantified: LineChart,
	acting: Rocket,
}

/**
 * Loader: Fetch people with their interview answers and compute validation outcomes
 * Uses project_answers table to derive validation status from actual interview data
 */
export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const accountId = params.accountId
	const projectId = params.projectId

	if (!accountId || !projectId) {
		throw new Response("Account ID and Project ID are required", { status: 400 })
	}

	const [
		{ data: projectSections },
		{ data: people, error: peopleError },
		{ data: projectAnswers, error: answersError },
		{ data: interviewPeopleRows, error: interviewPeopleError },
		{ data: questionAnalysisRows, error: questionAnalysisError },
	] =
		await Promise.all([
			supabase
				.from("project_sections")
				.select("*")
				.eq("project_id", projectId)
				.order("position", { ascending: true, nullsFirst: false })
				.order("created_at", { ascending: false }),
			supabase
				.from("people")
				.select(`
					id,
					name,
					company,
					contact_info,
					interview_people (
						interviews (
							id,
							title,
							created_at
						)
					)
				`)
				.eq("project_id", projectId)
				.order("created_at", { ascending: false }),
			supabase
				.from("project_answers")
				.select(
					"id, respondent_person_id, research_question_id, question_text, answer_text, analysis_summary, analysis_rationale, analysis_next_steps, confidence, interview_id, updated_at, status"
				)
				.eq("project_id", projectId)
				.eq("status", "answered"),
			supabase
				.from("interview_people")
				.select("interview_id, person_id")
				.eq("project_id", projectId),
			supabase
				.from("project_question_analysis")
				.select("question_id, question_type, summary, confidence, next_steps, goal_achievement_summary, created_at")
				.eq("project_id", projectId)
				.order("created_at", { ascending: false }),
		])

	if (peopleError) console.error("Error loading people:", peopleError)
	if (answersError) console.error("Error loading project answers:", answersError)
	if (interviewPeopleError) console.error("Error loading interview_people:", interviewPeopleError)
	if (questionAnalysisError) console.error("Error loading project_question_analysis:", questionAnalysisError)

	const questionSection = projectSections?.find((section) => section.kind === "questions")
	const questionSectionMeta = (questionSection?.meta as Record<string, any> | null) ?? null
	const researchMode = (questionSectionMeta?.settings?.research_mode as string | undefined) ?? "exploratory"
	const validationGateMeta = questionSectionMeta?.validation_gate_map as
		| Record<
			string,
			{
				research_question_id?: string
				research_question_text?: string
			}
		>
		| undefined

	const gateOutcomeMap: Record<ValidationGateSlug, 2 | 3 | 4 | 5> = {
		pain_exists: 2,
		awareness: 3,
		quantified: 4,
		acting: 5,
	}

	const stageByOutcome: Record<number, ValidationStage> = {
		1: "None",
		2: "Pain Exists",
		3: "Awareness",
		4: "Quantified Impact",
		5: "Taking Action",
	}

	const peopleMap = new Map(
		(people ?? []).map((person) => [person.id, { name: person.name || "Unknown", company: person.company || "", contactInfo: person.contact_info as Record<string, unknown> | null }])
	)

	const participantsAccumulator = new Map<
		string,
		{
			id: string
			name: string
			company: string
			validationDetails: Partial<Record<ValidationDetailKey, ValidationGateDetail>>
		}
	>()

	const ensureParticipant = (personId: string): {
		id: string
		name: string
		company: string
		validationDetails: Partial<Record<ValidationDetailKey, ValidationGateDetail>>
	} => {
		if (!participantsAccumulator.has(personId)) {
			const personRecord = peopleMap.get(personId)
			participantsAccumulator.set(personId, {
				id: personId,
				name: personRecord?.name || "Unknown Participant",
				company: personRecord?.company || "",
				validationDetails: {},
			})
		}
		return participantsAccumulator.get(personId)!
	}

	for (const person of people ?? []) {
		ensureParticipant(person.id)
	}

	const gateDefinitions = VALIDATION_GATE_ORDER.map((slug) => {
		const meta = validationGateMeta?.[slug]
		return meta?.research_question_id
			? {
				slug,
				research_question_id: meta.research_question_id,
				label: validationGateLabels[slug],
				text: meta.research_question_text ?? "",
			}
			: null
	}).filter(Boolean) as Array<{ slug: ValidationGateSlug; research_question_id: string; label: ValidationStage; text: string }>

	const gateByQuestionId = new Map<string, ValidationGateSlug>()
	for (const gate of gateDefinitions) {
		gateByQuestionId.set(gate.research_question_id, gate.slug)
	}

	const interviewPersonMap = new Map<string, string>()
	for (const row of interviewPeopleRows ?? []) {
		if (!interviewPersonMap.has(row.interview_id)) {
			interviewPersonMap.set(row.interview_id, row.person_id)
		}
	}

	if (researchMode === "validation" && gateByQuestionId.size > 0) {
		for (const answer of projectAnswers ?? []) {
			const slug = gateByQuestionId.get(answer.research_question_id ?? "")
			if (!slug) continue
			const detailKey = slugToDetailKey[slug]
			const personId =
				answer.respondent_person_id ||
				(answer.interview_id ? interviewPersonMap.get(answer.interview_id) ?? null : null)
			if (!personId) continue
			const participant = ensureParticipant(personId)
			const summaryCandidate =
				[answer.analysis_summary, answer.answer_text, answer.analysis_rationale, answer.analysis_next_steps]
					.map((value) => (typeof value === "string" ? value.trim() : ""))
					.find((value) => value.length > 0) ||
					""
			if (!summaryCandidate) continue
			participant.validationDetails[detailKey] = {
				summary: summaryCandidate,
				confidence: typeof answer.confidence === "number" ? answer.confidence : null,
				updatedAt: answer.updated_at ?? null,
			}
		}
	}

	const legacyParticipants = () => {
		const participants: ValidationParticipant[] = []
		for (const person of people ?? []) {
			const contactInfo = person.contact_info as Record<string, unknown> | null
			const personAnswers = (projectAnswers || []).filter((a) => a.respondent_person_id === person.id)

			if (contactInfo?.validation_outcome) {
				const manualOutcome = Number(contactInfo.validation_outcome) as 1 | 2 | 3 | 4 | 5
				const manualDetailsRaw = (contactInfo.validation_details as Record<string, string> | undefined) ?? {}
				const manualDetails: Partial<Record<ValidationDetailKey, ValidationGateDetail>> = {}
				for (const key of Object.keys(manualDetailsRaw)) {
					if (key in slugToDetailKey) {
						const detailKey = key as ValidationDetailKey
						manualDetails[detailKey] = {
							summary: manualDetailsRaw[key] ?? "",
							confidence: null,
							updatedAt: null,
						}
					}
				}
				participants.push({
					id: person.id,
					name: person.name || "Unknown",
					company: person.company || "",
					outcome: manualOutcome,
					stage: stageByOutcome[manualOutcome],
					keyInsight: (contactInfo.key_insight as string) || "",
					validationDetails: manualDetails,
				})
				continue
			}

			if (personAnswers.length === 0) {
				participants.push({
					id: person.id,
					name: person.name || "Unknown",
					company: person.company || "",
					outcome: 1,
					stage: stageByOutcome[1],
					keyInsight: "No interview data available",
					validationDetails: {},
				})
				continue
			}

			const answerTexts = personAnswers.map((a) => (a.answer_text || "").toLowerCase()).join(" ")
			const summaries = personAnswers.map((a) => (a.analysis_summary || "").toLowerCase()).join(" ")
			const allText = `${answerTexts} ${summaries}`
			const avgConfidence = personAnswers.reduce((sum, a) => sum + (a.confidence || 0), 0) / personAnswers.length

			const hasPainMention = /pain|problem|frustrat|challeng|difficult|struggle/i.test(allText)
			const hasAwareness = /aware|know|understand|talk about|complain/i.test(allText)
			const hasQuantification = /\$|cost|hour|time|save|spend|budget|price|percent|%|mins|minutes|hours/i.test(allText)
			const hasAction = /pay|bought|purchas|subscri|tool|solution|using|current|hired|built/i.test(allText)

			const extractText = (regex: RegExp): string => {
				const match = personAnswers.find((a) => regex.test(a.answer_text || ""))
				if (match?.answer_text) return match.answer_text
				const summaryMatch = personAnswers.find((a) => regex.test(a.analysis_summary || ""))
				if (summaryMatch?.analysis_summary) return summaryMatch.analysis_summary
				return ""
			}

			const validationDetails: Partial<Record<ValidationDetailKey, ValidationGateDetail>> = {}
			if (hasPainMention) {
				validationDetails.painExists = {
					summary: extractText(/pain|problem|frustrat|challeng|difficult|struggle/i) || "Pain mentioned in interviews.",
					confidence: avgConfidence || null,
					updatedAt: null,
				}
			}
			if (hasAwareness) {
				validationDetails.awareness = {
					summary: extractText(/aware|know|understand|talk/i) || "Participant described the problem in their own words.",
					confidence: avgConfidence || null,
					updatedAt: null,
				}
			}
			if (hasQuantification) {
				validationDetails.quantified = {
					summary: extractText(/\$|cost|hour|time|save|spend|budget|price|percent|%|mins|minutes|hours/i) || "Participant put numbers behind the pain.",
					confidence: avgConfidence || null,
					updatedAt: null,
				}
			}
			if (hasAction) {
				validationDetails.acting = {
					summary: extractText(/pay|bought|purchas|subscri|tool|solution|using|current|hired|built/i) || "Participant is actively trying to solve this today.",
					confidence: avgConfidence || null,
					updatedAt: null,
				}
			}

			let outcome: 1 | 2 | 3 | 4 | 5 = 1
			if (hasAction && hasQuantification && hasPainMention && avgConfidence > 0.7) outcome = 5
			else if (hasQuantification && hasPainMention && avgConfidence > 0.6) outcome = 4
			else if (hasPainMention && avgConfidence > 0.5) outcome = 3
			else if (avgConfidence > 0.3) outcome = 2

			const highestDetail = VALIDATION_GATE_ORDER.reduce<ValidationGateSlug | null>((acc, slug) => {
				const detail = validationDetails[slugToDetailKey[slug]]
				return detail && detail.summary ? slug : acc
			}, null)

			const keyInsight = highestDetail
				? validationDetails[slugToDetailKey[highestDetail]]?.summary ?? ""
				: outcome > 1
					? "Interview hints at pain but lacks clear quotes."
					: "No interview data available"

			participants.push({
				id: person.id,
				name: person.name || "Unknown",
				company: person.company || "",
				outcome,
				stage: stageByOutcome[outcome],
				keyInsight,
				validationDetails,
			})
		}
		return participants
	}

	let participants: ValidationParticipant[] = []

	if (researchMode === "validation" && gateByQuestionId.size > 0) {
		participants = Array.from(participantsAccumulator.values()).map((participant) => {
			let highestGate: ValidationGateSlug | null = null
			for (const slug of VALIDATION_GATE_ORDER) {
				const detail = participant.validationDetails[slugToDetailKey[slug]]
				if (detail && detail.summary) {
					highestGate = slug
				}
			}

			const outcome = highestGate ? gateOutcomeMap[highestGate] : 1
			const stage = stageByOutcome[outcome]
			const keyInsight = highestGate
				? participant.validationDetails[slugToDetailKey[highestGate]]?.summary || ""
				: "No validation evidence captured yet."

			return {
				id: participant.id,
				name: participant.name,
				company: participant.company,
				outcome,
				stage,
				keyInsight,
				validationDetails: participant.validationDetails,
			}
		})
	} else {
		participants = legacyParticipants()
	}

	const participantsById = new Map(participants.map((p) => [p.id, p]))

	const gateSummaries = new Map<
		ValidationGateSlug,
		{
			summary: string
			nextSteps: string | null
			confidence: number | null
			goalSummary: string | null
			updatedAt: string | null
		}
	>()

	if (questionAnalysisRows && questionAnalysisRows.length > 0 && gateDefinitions.length > 0) {
		const latestByQuestion = new Map<string, typeof questionAnalysisRows[number]>()
		for (const row of questionAnalysisRows) {
			if (row.question_type !== "research") continue
			if (latestByQuestion.has(row.question_id)) continue
			latestByQuestion.set(row.question_id, row)
		}

		for (const { slug, research_question_id } of gateDefinitions) {
			const match = latestByQuestion.get(research_question_id)
			if (!match) continue
			gateSummaries.set(slug, {
				summary: match.summary ?? "",
				nextSteps: match.next_steps ?? null,
				confidence: typeof match.confidence === "number" ? match.confidence : null,
				goalSummary: match.goal_achievement_summary ?? null,
				updatedAt: match.created_at ?? null,
			})
		}
	}

	for (const [personId, personRecord] of peopleMap.entries()) {
		const contactInfo = personRecord.contactInfo
		if (contactInfo?.validation_outcome) {
			const outcome = Number(contactInfo.validation_outcome) as 1 | 2 | 3 | 4 | 5
			const detailsRaw = (contactInfo.validation_details as Record<string, string> | undefined) ?? {}
			const overrides: Partial<Record<ValidationDetailKey, ValidationGateDetail>> = {}
			for (const [key, value] of Object.entries(detailsRaw)) {
				if (key in slugToDetailKey) {
					const detailKey = key as ValidationDetailKey
					overrides[detailKey] = { summary: value ?? "", confidence: null, updatedAt: null }
				}
			}
			participantsById.set(personId, {
				id: personId,
				name: personRecord.name,
				company: personRecord.company,
				outcome,
				stage: stageByOutcome[outcome],
				keyInsight: (contactInfo.key_insight as string) || participantsById.get(personId)?.keyInsight || "",
				validationDetails: overrides,
			})
		}
	}

	participants = Array.from(participantsById.values()).sort((a, b) => {
		if (b.outcome !== a.outcome) return b.outcome - a.outcome
		return a.name.localeCompare(b.name)
	})

	const gateTotals = VALIDATION_GATE_ORDER.reduce((acc, slug) => {
		acc[slug] = participants.filter((participant) => {
			const detailKey = slugToDetailKey[slug]
			return Boolean(participant.validationDetails[detailKey]?.summary)
		}).length
		return acc
	}, Object.create(null) as Record<ValidationGateSlug, number>)

	const participantsWithEvidence = participants.filter((p) => p.outcome > 1).length
	const totalInterviews = people?.length ?? participants.length
	const progressPercentage = totalInterviews > 0 ? Math.round((participantsWithEvidence / totalInterviews) * 100) : 0

	return {
		participants,
		projectSections: projectSections || [],
		accountId,
		projectId,
		hasRealData: participantsWithEvidence > 0,
		researchMode,
		gateTotals,
		gateDefinitions,
		gateSummaries: Array.from(gateSummaries.entries()).map(([slug, data]) => ({
			slug,
			label: validationGateLabels[slug],
			...data,
		})),
		progress: {
			completed: participantsWithEvidence,
			total: totalInterviews,
			percentage: progressPercentage,
		},
	}
}

export function AnalyzeStageValidation() {
	const loaderData = useLoaderData<typeof loader>()
	const { participants = [], projectSections = [], gateTotals, progress, researchMode, gateSummaries = [] } = loaderData || {}
	const currentProjectContext = useCurrentProject()
	const routes = useProjectRoutes(currentProjectContext?.projectPath)
	const [selectedOutcome, setSelectedOutcome] = useState<number>(5)

	const getGoalSections = () =>
		projectSections?.filter((section) => section.kind === "goal" || section.kind === "research_goal")

	const researchGoalText = (() => {
		const gs = getGoalSections()
		if (!gs || gs.length === 0) return ""
		const section = gs[0]
		const meta = (section.meta || {}) as Record<string, unknown>
		return (meta.research_goal as string) || (meta.customGoal as string) || section.content_md || ""
	})()

	const totalInterviews = progress?.total || participants?.length || 0
	const completedInterviews = progress?.completed || 0
	const progressPercentage = progress?.percentage || 0

	const outcomeCounts = (participants || []).reduce(
		(acc, participant) => {
			acc[participant.outcome] = (acc[participant.outcome] || 0) + 1
			return acc
		},
		{} as Record<number, number>
	)

	const getParticipantsByOutcome = (outcome: number) => (participants || []).filter((p) => p.outcome === outcome)

	const qualifiedProspects = getParticipantsByOutcome(5)
	const takingActionCount = gateTotals?.acting ?? 0
	const quantifiedCount = gateTotals?.quantified ?? 0
	const awarenessCount = gateTotals?.awareness ?? 0
	const painCount = gateTotals?.pain_exists ?? 0

	const gateSummaryBySlug = new Map(gateSummaries.map((item) => [item.slug, item]))
	const gateHighlights = VALIDATION_GATE_ORDER.map((slug) => {
		const data = gateSummaryBySlug.get(slug)
		if (!data || !data.summary?.trim()) return null
		return `${validationGateLabels[slug]}: ${data.summary.trim()}`
	}).filter((value): value is string => Boolean(value))

	const opportunitySummary = (() => {
		if (gateHighlights.length > 0) {
			return gateHighlights.join("\n\n")
		}
		if (takingActionCount > 0) {
			return `${takingActionCount} participant${takingActionCount === 1 ? "" : "s"} are already taking action. ${quantifiedCount} have quantified the cost and ${awarenessCount} can articulate the pain in their own words.`
		}
		if (quantifiedCount > 0) {
			return `${quantifiedCount} participant${quantifiedCount === 1 ? "" : "s"} have quantified the impact. Encourage follow-ups to uncover whether they are ready to act.`
		}
		if (awarenessCount > 0 || painCount > 0) {
			return `${awarenessCount || painCount} participant${(awarenessCount || painCount) === 1 ? "" : "s"} recognise the problem. Collect more evidence to size the cost and uncover buying behaviour.`
		}
		return "No validation interviews have been processed yet. Once evidence comes in, this summary will highlight where prospects sit in the funnel."
	})()

	const hasGateSummaries = gateSummaries.some((item) => item.summary?.trim())

	const renderParticipantCard = (participant: ValidationParticipant) => {
		const stageInfo = outcomeConfig[participant.outcome]
		const detailEntries = researchMode === "validation"
			? VALIDATION_GATE_ORDER.map((slug) => {
				const detailKey = slugToDetailKey[slug]
				return {
					slug,
					detailKey,
					label: validationGateLabels[slug],
					data: participant.validationDetails[detailKey],
				}
			})
			: []

		return (
			<Link to={routes.people.detail(participant.id)} key={participant.id}>
				<Card className="group h-full cursor-pointer overflow-hidden border shadow-sm transition-all hover:border-gray-400 hover:shadow-lg dark:border-gray-700 dark:hover:border-gray-500">
					<div
						className={`h-1 ${participant.outcome === 5 ? "bg-emerald-500 dark:bg-emerald-600" : "bg-gray-300 dark:bg-gray-600"}`}
					/>

					<CardContent className="p-6">
						<div className="mb-6 flex items-start gap-4">
							<div className="min-w-0 flex-1">
								<h3 className="mb-1 font-bold text-foreground text-xl transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400">
									{participant.name}
								</h3>
								<p className="mb-3 font-medium text-muted-foreground text-sm">{participant.company}</p>

								<div className="flex flex-wrap items-center gap-2">
									<Badge
										variant="outline"
										className={`font-semibold text-xs ${stageInfo.color} border-current`}
									>
										{stageInfo.label}
									</Badge>
									<Badge
										variant="outline"
										className="border-blue-200 bg-blue-50 font-medium text-blue-700 text-xs dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
										title={stageDescriptions[participant.stage]}
									>
										{participant.stage}
									</Badge>
								</div>
							</div>

							<ChevronRight className="mt-2 h-6 w-6 flex-shrink-0 text-gray-300 transition-all group-hover:translate-x-1 group-hover:text-blue-600 dark:text-gray-600 dark:group-hover:text-blue-400" />
						</div>

						{researchMode === "validation" ? (
							<div className="space-y-3 border-gray-200 border-t pt-4 dark:border-gray-700">
								<div className="grid gap-3">
									{detailEntries.map(({ slug, detailKey, label, data }) => {
										const Icon = gateIconMap[detailKey]
										return (
											<div
												key={`${participant.id}-${slug}`}
												className="flex gap-3 rounded-lg border border-gray-200 bg-gray-50/50 p-3.5 dark:border-gray-700 dark:bg-gray-800/30"
											>
												<div className="flex-shrink-0">
													<div className="rounded-md bg-gray-100 p-2 dark:bg-gray-700">
														<Icon className="h-4 w-4 text-gray-700 dark:text-gray-300" />
													</div>
												</div>
												<div className="min-w-0 flex-1">
													<div className="mb-1.5 font-semibold text-gray-900 text-xs uppercase tracking-wide dark:text-gray-100">
														{label}
													</div>
													<p className="text-gray-700 text-sm leading-relaxed dark:text-gray-300">
														{data?.summary || "No evidence captured yet."}
													</p>
													{typeof data?.confidence === "number" && (
														<p className="mt-1 text-xs text-muted-foreground">
															Confidence: {Math.round(data.confidence * 100)}%
														</p>
													)}
												</div>
											</div>
										)
									})}
								</div>
							</div>
						) : (
							<div className="border-gray-100 border-t-2 pt-4 dark:border-gray-700">
								<div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
									<p className="font-medium text-muted-foreground text-sm leading-relaxed">{participant.keyInsight}</p>
								</div>
							</div>
						)}
					</CardContent>
				</Card>
			</Link>
		)
	}

	return (
		<div className="space-y-6">
			{/* Goal Card - Enhanced Styling */}
			<Card className="relative overflow-hidden border-2 shadow-sm transition-shadow hover:shadow-md">
				<div className="absolute top-4 right-4 flex gap-2">
					<Button
						variant="outline"
						size="sm"
						className="border-gray-300 dark:border-gray-600"
						asChild
					>
						<Link to={routes?.projects.setup() || "#"}>
							<Settings className="mr-2 h-4 w-4" />
							Edit
						</Link>
					</Button>
					<Button
						variant="outline"
						size="sm"
						className="border-gray-300 dark:border-gray-600"
						asChild
					>
						<Link to={routes?.questions.index() || "#"}>
							<LayoutList className="mr-2 h-4 w-4" />
							Plan
						</Link>
					</Button>
				</div>

				<CardContent className="p-6">
					<div className="mb-6 flex items-start gap-3">
						<div className="rounded-lg bg-blue-100 p-2.5 dark:bg-blue-900/30">
							<Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
						</div>
						<div className="flex-1">
							<h2 className="mb-2 font-semibold text-foreground text-xl">Goal</h2>
							<p className="text-foreground text-md leading-relaxed">
								{researchGoalText || "No research goal set. Click Edit to add your project goal."}
							</p>
						</div>
					</div>

					<div className="space-y-2 md:max-w-md">
						<div className="flex items-center justify-between text-sm">
							<span className="font-medium text-foreground">Interview Progress {progressPercentage}%</span>
							<span className="text-muted-foreground">
								{completedInterviews} of {totalInterviews}
							</span>
						</div>
						<Progress value={progressPercentage} className="h-2" />
					</div>
				</CardContent>
			</Card>

			<div>
				<h2 className="mb-4 font-semibold text-2xl text-foreground">Validation Status</h2>

				{hasGateSummaries && (
					<div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
						{VALIDATION_GATE_ORDER.map((slug) => {
							const detailKey = slugToDetailKey[slug]
							const gateData = gateSummaryBySlug.get(slug)
							if (!gateData || !gateData.summary?.trim()) return null
							const Icon = gateIconMap[detailKey]

							return (
								<Card key={`gate-summary-${slug}`} className="border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900/50">
									<CardContent className="flex h-full flex-col gap-3 p-5">
										<div className="flex items-center gap-3">
											<div className="rounded-md bg-gray-100 p-2 dark:bg-gray-800">
												<Icon className="h-4 w-4 text-gray-700 dark:text-gray-200" />
											</div>
											<div>
												<p className="font-semibold text-gray-800 text-sm uppercase tracking-wide dark:text-gray-100">
													{validationGateLabels[slug]}
												</p>
												{typeof gateData.confidence === "number" && (
													<p className="text-xs text-muted-foreground">
														Confidence {Math.round(gateData.confidence * 100)}%
													</p>
												)}
											</div>
										</div>

										<p className="flex-1 text-sm leading-relaxed text-gray-700 whitespace-pre-line dark:text-gray-200">
											{gateData.summary}
										</p>

										{gateData.nextSteps && (
											<div>
												<p className="font-semibold text-xs uppercase tracking-wide text-gray-600 dark:text-gray-300">Next steps</p>
												<p className="mt-1 whitespace-pre-line text-sm text-gray-700 dark:text-gray-200">
													{gateData.nextSteps}
												</p>
											</div>
										)}

										{gateData.goalSummary && (
											<div>
												<p className="font-semibold text-xs uppercase tracking-wide text-gray-600 dark:text-gray-300">Goal Check-in</p>
												<p className="mt-1 whitespace-pre-line text-sm text-gray-700 dark:text-gray-200">
													{gateData.goalSummary}
												</p>
											</div>
										)}
									</CardContent>
								</Card>
							)
							})}
						</div>
				)}

				<div className="mb-6 flex flex-wrap gap-2">
					{[5, 4, 3, 2, 1].map((outcome) => {
						const config = outcomeConfig[outcome as keyof typeof outcomeConfig]
						const count = outcomeCounts?.[outcome] || 0
						const isSelected = selectedOutcome === outcome

						return (
							<button
								key={outcome}
								onClick={() => setSelectedOutcome(outcome)}
								className={`flex items-center gap-2 rounded-full border-2 px-4 py-2 font-medium text-sm transition-all ${isSelected
									? `${config.color} shadow-md`
									: "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600"
									} `}
							>
								<span>{config.label}</span>
								<Badge variant="secondary" className={`text-xs ${isSelected ? "bg-white/50 dark:bg-black/20" : ""}`}>
									{count}
								</Badge>
							</button>
						)
					})}
				</div>

				<div className="max-w-7xl">
					{selectedOutcome === 5 && (
						<div className="space-y-6">
							<Card className="border-2 border-emerald-200 bg-emerald-50/30 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/20">
								<CardContent className="p-5">
									<div className="flex items-start gap-3">
										<div className="rounded-lg bg-emerald-100 p-2.5 dark:bg-emerald-900/30">
											<TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
										</div>
										<div className="flex-1">
											<h3 className="mb-2 font-semibold text-foreground">Opportunity Summary</h3>
											<p className="text-foreground text-md leading-relaxed whitespace-pre-line">{opportunitySummary}</p>
										</div>
									</div>
								</CardContent>
							</Card>

							<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
								{qualifiedProspects?.map((participant) => renderParticipantCard(participant))}
							</div>
						</div>
					)}

					{selectedOutcome !== 5 && (
						<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
							{getParticipantsByOutcome(selectedOutcome)?.map((participant) => renderParticipantCard(participant))}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
