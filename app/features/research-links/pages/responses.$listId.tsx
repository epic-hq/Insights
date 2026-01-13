import { Download, ExternalLink, ListTodo, Loader2, MessageSquare, Sparkles, Users } from "lucide-react"
import { useState } from "react"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { Link, useFetcher, useLoaderData } from "react-router-dom"
import { PageContainer } from "~/components/layout/PageContainer"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { getServerClient } from "~/lib/supabase/client.server"
import { createRouteDefinitions } from "~/utils/route-definitions"
import { ResearchLinkResponsesDataTable } from "../components/ResearchLinkResponsesDataTable"
import { getResearchLinkWithResponses } from "../db"
import type { ResearchLinkQuestion } from "../schemas"
import { ResearchLinkQuestionSchema } from "../schemas"
import { buildResponsesCsv, extractAnswer } from "../utils"

export const meta: MetaFunction = () => {
	return [
		{ title: "Ask link responses" },
		{
			name: "description",
			content: "Review and export responses from your Ask link.",
		},
	]
}

/** Statistics for a single question */
interface QuestionStats {
	questionId: string
	questionText: string
	questionType: string
	/** Inferred type used for display (handles "auto" → actual type) */
	effectiveType: "likert" | "single_select" | "multi_select" | "text"
	responseCount: number
	totalResponses: number
	/** For numeric/likert questions */
	numeric?: {
		average: number
		min: number
		max: number
		scale: number // The max scale value (e.g., 5 for 1-5)
		distribution: Record<number, number> // value -> count
	}
	/** For single/multi select questions */
	choices?: {
		options: Array<{
			value: string
			count: number
			percentage: number
		}>
	}
	/** For text questions - show sample responses */
	text?: {
		sampleResponses: string[]
		totalAnswered: number
	}
}

/**
 * Infer the effective type from question config and actual responses.
 * Handles "auto" type by looking at response data.
 */
function inferEffectiveType(
	question: ResearchLinkQuestion,
	answers: unknown[]
): "likert" | "single_select" | "multi_select" | "text" {
	// Explicit types map directly
	if (question.type === "likert") return "likert"
	if (question.type === "single_select" || question.type === "image_select") return "single_select"
	if (question.type === "multi_select") return "multi_select"
	if (question.type === "short_text" || question.type === "long_text") return "text"

	// For "auto" type, infer from question config and response data
	// If question has options defined, it's a select
	if (question.options && question.options.length > 0) {
		const hasArrayResponses = answers.some((a) => Array.isArray(a))
		return hasArrayResponses ? "multi_select" : "single_select"
	}

	// If question has likert config, it's likert
	if (question.likertScale) return "likert"

	// Check if all non-empty responses are numeric
	const nonEmptyAnswers = answers.filter((a) => a !== undefined && a !== null && a !== "")
	if (nonEmptyAnswers.length > 0) {
		const allNumeric = nonEmptyAnswers.every((a) => {
			if (typeof a === "number") return true
			if (typeof a === "string") {
				const num = Number.parseFloat(a)
				return !Number.isNaN(num) && num >= 1 && num <= 10
			}
			return false
		})
		if (allNumeric) return "likert"
	}

	// Default to text
	return "text"
}

function computeQuestionStats(
	questions: ResearchLinkQuestion[],
	responses: Array<{ responses: Record<string, unknown> | null }>
): QuestionStats[] {
	const totalResponses = responses.length

	return questions.map((question) => {
		const questionId = question.id
		const allAnswers = responses.map((r) => r.responses?.[questionId])
		const nonEmptyAnswers = allAnswers.filter((a) => a !== undefined && a !== null && a !== "")

		const effectiveType = inferEffectiveType(question, nonEmptyAnswers)

		const base: QuestionStats = {
			questionId,
			questionText: question.prompt,
			questionType: question.type,
			effectiveType,
			responseCount: nonEmptyAnswers.length,
			totalResponses,
		}

		if (effectiveType === "likert") {
			const numericAnswers = nonEmptyAnswers
				.map((a) => (typeof a === "number" ? a : typeof a === "string" ? Number.parseFloat(a) : Number.NaN))
				.filter((n) => !Number.isNaN(n))

			if (numericAnswers.length > 0) {
				const sum = numericAnswers.reduce((acc, n) => acc + n, 0)
				const distribution: Record<number, number> = {}
				for (const n of numericAnswers) {
					distribution[n] = (distribution[n] || 0) + 1
				}
				const scale = question.likertScale || Math.max(...numericAnswers)
				base.numeric = {
					average: sum / numericAnswers.length,
					min: Math.min(...numericAnswers),
					max: Math.max(...numericAnswers),
					scale,
					distribution,
				}
			}
		} else if (effectiveType === "single_select" || effectiveType === "multi_select") {
			const optionCounts: Record<string, number> = {}

			for (const answer of nonEmptyAnswers) {
				const selections = Array.isArray(answer) ? answer : [answer]
				for (const sel of selections) {
					if (typeof sel === "string" && sel.trim()) {
						optionCounts[sel] = (optionCounts[sel] || 0) + 1
					}
				}
			}

			// Calculate percentage based on respondents (not total selections)
			const respondentCount = nonEmptyAnswers.length
			const options = Object.entries(optionCounts)
				.map(([value, count]) => ({
					value,
					count,
					percentage: respondentCount > 0 ? Math.round((count / respondentCount) * 100) : 0,
				}))
				.sort((a, b) => b.count - a.count)

			base.choices = { options }
		} else {
			// Text questions - collect sample responses
			const textAnswers = nonEmptyAnswers.filter((a): a is string => typeof a === "string" && a.trim().length > 0)

			// Get up to 5 sample responses, prioritizing variety (different lengths)
			const sortedByLength = [...textAnswers].sort((a, b) => b.length - a.length)
			const samples: string[] = []
			// Take longest, shortest, and some from middle
			if (sortedByLength.length > 0) samples.push(sortedByLength[0])
			if (sortedByLength.length > 1) samples.push(sortedByLength[sortedByLength.length - 1])
			if (sortedByLength.length > 2) samples.push(sortedByLength[Math.floor(sortedByLength.length / 2)])
			// Add more if we have them
			for (const text of sortedByLength) {
				if (samples.length >= 5) break
				if (!samples.includes(text)) samples.push(text)
			}

			base.text = {
				sampleResponses: samples,
				totalAnswered: textAnswers.length,
			}
		}

		return base
	})
}

export async function loader({ params, request }: LoaderFunctionArgs) {
	const { accountId, projectId, listId } = params
	if (!accountId || !projectId || !listId) {
		throw new Response("Missing route parameters", { status: 400 })
	}
	const { client: supabase } = getServerClient(request)
	const { list, listError, responses, responsesError } = await getResearchLinkWithResponses({
		supabase,
		accountId,
		listId,
	})
	if (listError) {
		throw new Response(listError.message, { status: 500 })
	}
	if (responsesError) {
		throw new Response(responsesError.message, { status: 500 })
	}
	if (!list) {
		throw new Response("Ask link not found", { status: 404 })
	}
	const questionsResult = ResearchLinkQuestionSchema.array().safeParse(list.questions)
	const questions = questionsResult.success ? questionsResult.data : []
	const origin = new URL(request.url).origin

	// Compute per-question statistics
	const questionStats = computeQuestionStats(
		questions,
		(responses ?? []).map((r) => ({
			responses: r.responses as Record<string, unknown> | null,
		}))
	)

	return {
		accountId,
		projectId,
		list,
		responses: responses ?? [],
		questions,
		questionStats,
		publicUrl: `${origin}/ask/${list.slug}`,
	}
}

// Type for analysis results (matches BAML QuickResponseSummary)
interface AnalysisResult {
	summary: string
	quality_responses_count: number
	total_responses_count: number
	top_insights: string[]
	sentiment_overview: string
	suggested_actions: string[]
	/** Plain English warning when data quality is poor (>50% junk responses) */
	data_quality_warning?: string
}

export default function ResearchLinkResponsesPage() {
	const { accountId, projectId, list, responses, questions, questionStats, publicUrl } = useLoaderData<typeof loader>()
	const routes = createRouteDefinitions(`/a/${accountId}/${projectId}`)
	const basePath = `/a/${accountId}/${projectId}`

	const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
	const [customInstructions, setCustomInstructions] = useState("")
	const [showCustomInstructions, setShowCustomInstructions] = useState(false)
	const analyzeFetcher = useFetcher<{ mode: string; result: AnalysisResult } | { error: string }>()

	const isAnalyzing = analyzeFetcher.state !== "idle"

	// Handle analysis result
	if (analyzeFetcher.data && !("error" in analyzeFetcher.data) && analyzeFetcher.data.result !== analysisResult) {
		setAnalysisResult(analyzeFetcher.data.result)
	}

	const handleAnalyze = (instructions?: string) => {
		const payload: Record<string, string> = { listId: list.id, mode: "quick" }
		if (instructions && instructions.trim()) {
			payload.customInstructions = instructions.trim()
		}
		analyzeFetcher.submit(payload, {
			method: "POST",
			action: routes.ask.index() + "/api/analyze-responses",
		})
		setShowCustomInstructions(false)
	}

	// Analytics
	const totalResponses = responses.length

	const handleExport = () => {
		const csv = buildResponsesCsv(questions, responses)
		const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
		const url = URL.createObjectURL(blob)
		const link = document.createElement("a")
		link.href = url
		link.download = `${list.slug || "research-link"}-responses.csv`
		document.body.appendChild(link)
		link.click()
		document.body.removeChild(link)
		URL.revokeObjectURL(url)
	}

	return (
		<PageContainer className="space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="space-y-2">
					<div className="flex items-center gap-2">
						<h1 className="font-semibold text-3xl">Ask link responses</h1>
						<Badge variant={list.is_live ? "default" : "secondary"}>{list.is_live ? "Live" : "Draft"}</Badge>
					</div>
					<p className="max-w-2xl text-muted-foreground text-sm">
						Review captured emails and context, then export to share with your team or seed outreach.
					</p>
					<a
						href={publicUrl}
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center gap-2 text-primary text-sm hover:underline"
					>
						<ExternalLink className="h-4 w-4" />
						{publicUrl}
					</a>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button asChild variant="outline">
						<Link to={routes.ask.edit(list.id)}>Edit link</Link>
					</Button>
					<Button onClick={handleExport} disabled={responses.length === 0}>
						<Download className="mr-2 h-4 w-4" /> Export CSV
					</Button>
				</div>
			</div>

			{responses.length === 0 ? (
				<Card className="border-dashed bg-muted/30">
					<CardHeader>
						<CardTitle>No responses yet</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4 text-muted-foreground text-sm">
						<p>Share your Ask link to start collecting responses.</p>
						<div className="flex items-center gap-2 text-xs">
							<ListTodo className="h-4 w-4" /> {publicUrl}
						</div>
					</CardContent>
				</Card>
			) : (
				<>
					{/* Stats Row - Just total responses */}
					<div className="flex items-center gap-2">
						<Users className="h-5 w-5 text-muted-foreground" />
						<span className="font-semibold text-lg">{totalResponses}</span>
						<span className="text-muted-foreground text-sm">{totalResponses === 1 ? "response" : "responses"}</span>
						<span className="text-muted-foreground text-sm">· {questions.length} questions</span>
					</div>

					{/* AI Analysis Block (inline) */}
					<Card>
						<CardHeader className="pb-3">
							<div className="flex items-center justify-between">
								<CardTitle className="flex items-center gap-2 text-base">
									<Sparkles className="h-4 w-4" />
									AI Analysis
								</CardTitle>
								{!analysisResult && (
									<Button variant="outline" size="sm" onClick={handleAnalyze} disabled={isAnalyzing}>
										{isAnalyzing ? (
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										) : (
											<Sparkles className="mr-2 h-4 w-4" />
										)}
										Generate
									</Button>
								)}
							</div>
						</CardHeader>
						<CardContent>
							{isAnalyzing && !analysisResult && (
								<div className="flex items-center gap-2 text-muted-foreground text-sm">
									<Loader2 className="h-4 w-4 animate-spin" />
									Analyzing responses...
								</div>
							)}
							{analyzeFetcher.data && "error" in analyzeFetcher.data && !isAnalyzing && (
								<div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
									<strong>Error:</strong> {analyzeFetcher.data.error}
								</div>
							)}
							{!analysisResult && !isAnalyzing && !(analyzeFetcher.data && "error" in analyzeFetcher.data) && (
								<p className="text-muted-foreground text-sm">Click Generate to get AI insights from your responses.</p>
							)}
							{analysisResult && (
								<div className="space-y-4">
									{/* Data quality warning - shown prominently if present */}
									{analysisResult.data_quality_warning && (
										<div className="rounded-md bg-amber-500/10 p-3 text-amber-700 text-sm dark:text-amber-400">
											<strong>⚠️ Data quality:</strong> {analysisResult.data_quality_warning}
										</div>
									)}

									<p className="text-sm">{analysisResult.summary}</p>

									{/* Only show insights/actions if we have them */}
									{(analysisResult.top_insights.length > 0 || analysisResult.suggested_actions.length > 0) && (
										<div className="grid gap-4 md:grid-cols-2">
											{analysisResult.top_insights.length > 0 && (
												<div>
													<h4 className="mb-2 font-medium text-sm">Top Insights</h4>
													<ul className="space-y-1 text-muted-foreground text-sm">
														{analysisResult.top_insights.map((insight, idx) => (
															<li key={idx} className="flex gap-2">
																<span className="text-primary">•</span>
																{insight}
															</li>
														))}
													</ul>
												</div>
											)}
											{analysisResult.suggested_actions.length > 0 && (
												<div>
													<h4 className="mb-2 font-medium text-sm">Suggested Actions</h4>
													<ul className="space-y-1 text-muted-foreground text-sm">
														{analysisResult.suggested_actions.map((action, idx) => (
															<li key={idx} className="flex gap-2">
																<span className="text-primary">•</span>
																{action}
															</li>
														))}
													</ul>
												</div>
											)}
										</div>
									)}

									<div className="flex flex-col gap-3 border-t pt-3">
										<div className="flex items-center justify-between">
											<span className="text-muted-foreground text-xs">
												Sentiment: {analysisResult.sentiment_overview}
											</span>
											<div className="flex items-center gap-2">
												<Button
													variant="ghost"
													size="sm"
													onClick={() => setShowCustomInstructions(!showCustomInstructions)}
													className="text-xs"
												>
													{showCustomInstructions ? "Cancel" : "Custom prompt"}
												</Button>
												<Button variant="ghost" size="sm" onClick={() => handleAnalyze()} disabled={isAnalyzing}>
													{isAnalyzing ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
													Regenerate
												</Button>
											</div>
										</div>

										{/* Custom instructions input */}
										{showCustomInstructions && (
											<div className="space-y-2">
												<textarea
													value={customInstructions}
													onChange={(e) => setCustomInstructions(e.target.value)}
													placeholder="E.g., 'Focus on pricing feedback' or 'Compare responses by company size'"
													className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
													rows={2}
												/>
												<div className="flex justify-end gap-2">
													<Button
														variant="outline"
														size="sm"
														onClick={() => {
															setShowCustomInstructions(false)
															setCustomInstructions("")
														}}
													>
														Cancel
													</Button>
													<Button size="sm" onClick={() => handleAnalyze(customInstructions)} disabled={isAnalyzing}>
														{isAnalyzing ? (
															<Loader2 className="mr-2 h-3 w-3 animate-spin" />
														) : (
															<Sparkles className="mr-2 h-3 w-3" />
														)}
														Analyze with instructions
													</Button>
												</div>
											</div>
										)}
									</div>
								</div>
							)}
						</CardContent>
					</Card>

					{/* Per-Question Statistics */}
					{questionStats.length > 0 && (
						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="text-base">Response Breakdown</CardTitle>
							</CardHeader>
							<CardContent className="space-y-6">
								{questionStats.map((stat, idx) => (
									<div key={stat.questionId} className="space-y-3 border-b pb-6 last:border-b-0 last:pb-0">
										<div className="flex items-start justify-between gap-2">
											<h4 className="font-medium text-sm">
												{idx + 1}. {stat.questionText}
											</h4>
											<Badge variant="outline" className="shrink-0 text-xs">
												{stat.responseCount}/{stat.totalResponses} answered
											</Badge>
										</div>

										{/* Likert/Numeric stats - show average + distribution bars */}
										{stat.effectiveType === "likert" && stat.numeric && (
											<div className="space-y-3">
												<div className="flex items-baseline gap-3">
													<span className="font-semibold text-3xl">{stat.numeric.average.toFixed(1)}</span>
													<span className="text-muted-foreground text-sm">/ {stat.numeric.scale} average</span>
													<div className="ml-auto flex h-2 w-24 overflow-hidden rounded-full bg-muted">
														<div
															className="h-full bg-primary"
															style={{
																width: `${(stat.numeric.average / stat.numeric.scale) * 100}%`,
															}}
														/>
													</div>
												</div>
												<div className="space-y-1">
													{Array.from({ length: stat.numeric.scale }, (_, i) => stat.numeric!.scale - i).map(
														(value) => {
															const count = stat.numeric!.distribution[value] || 0
															const pct = stat.responseCount > 0 ? Math.round((count / stat.responseCount) * 100) : 0
															return (
																<div key={value} className="flex items-center gap-2 text-sm">
																	<span className="w-4 text-right font-medium">{value}</span>
																	<div className="h-4 flex-1 overflow-hidden rounded bg-muted">
																		<div className="h-full bg-primary/70 transition-all" style={{ width: `${pct}%` }} />
																	</div>
																	<span className="w-16 text-right text-muted-foreground text-xs">
																		{pct}% ({count})
																	</span>
																</div>
															)
														}
													)}
												</div>
											</div>
										)}

										{/* Select stats - show percentage bars */}
										{(stat.effectiveType === "single_select" || stat.effectiveType === "multi_select") &&
											stat.choices &&
											stat.choices.options.length > 0 && (
												<div className="space-y-1.5">
													{stat.choices.options.map((option) => (
														<div key={option.value} className="flex items-center gap-2">
															<div className="h-5 flex-1 overflow-hidden rounded bg-muted">
																<div
																	className="flex h-full items-center bg-primary/70 px-2 text-primary-foreground text-xs"
																	style={{
																		width: `${Math.max(option.percentage, 8)}%`,
																	}}
																>
																	{option.percentage >= 15 && <span className="truncate">{option.value}</span>}
																</div>
															</div>
															<span className="w-12 text-right font-semibold text-sm">{option.percentage}%</span>
															{option.percentage < 15 && (
																<span className="min-w-[100px] truncate text-muted-foreground text-sm">
																	{option.value}
																</span>
															)}
															<span className="text-muted-foreground text-xs">({option.count})</span>
														</div>
													))}
												</div>
											)}

										{/* Text responses - show actual sample responses */}
										{stat.effectiveType === "text" && stat.text && (
											<div className="space-y-2">
												{stat.text.sampleResponses.length > 0 ? (
													<div className="space-y-2">
														{stat.text.sampleResponses.map((response, i) => (
															<div
																key={i}
																className="rounded-lg border-muted-foreground/30 border-l-2 bg-muted/30 py-2 pr-2 pl-3"
															>
																<p className="line-clamp-3 text-sm">"{response}"</p>
															</div>
														))}
														{stat.text.totalAnswered > stat.text.sampleResponses.length && (
															<p className="text-muted-foreground text-xs">
																+ {stat.text.totalAnswered - stat.text.sampleResponses.length} more responses
															</p>
														)}
													</div>
												) : (
													<p className="text-muted-foreground text-sm">No responses yet</p>
												)}
											</div>
										)}
									</div>
								))}
							</CardContent>
						</Card>
					)}

					{/* Data Table */}
					<ResearchLinkResponsesDataTable
						questions={questions}
						responses={responses}
						basePath={basePath}
						listId={list.id}
					/>
				</>
			)}
		</PageContainer>
	)
}
