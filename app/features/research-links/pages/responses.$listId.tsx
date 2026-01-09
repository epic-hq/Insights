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
	const origin = new URL(request.url).origin
	return {
		accountId,
		projectId,
		list,
		responses: responses ?? [],
		questions: questionsResult.success ? questionsResult.data : [],
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
	const { accountId, projectId, list, responses, questions, publicUrl } = useLoaderData<typeof loader>()
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
		if (instructions?.trim()) {
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
							{!analysisResult && !isAnalyzing && (
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
