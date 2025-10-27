import { useEffect, useMemo, useState } from "react"
import type { LoaderFunctionArgs } from "react-router"
import { useLoaderData } from "react-router"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Textarea } from "~/components/ui/textarea"
import { listConversationAnalyses } from "~/lib/conversation-analyses/db.server"
import type { ConversationAnalysisRecord } from "~/lib/conversation-analyses/schema"
import { conversationAnalysisRecordSchema } from "~/lib/conversation-analyses/schema"
import { userContext } from "~/server/user-context"

interface LoaderData {
	analyses: ConversationAnalysisRecord[]
}

export async function loader({ context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	if (!ctx?.supabase || !ctx?.account_id) {
		throw new Response("Unauthorized", { status: 401 })
	}

	const analyses = await listConversationAnalyses({ db: ctx.supabase, accountId: ctx.account_id, limit: 10 })
	return { analyses } satisfies LoaderData
}

export default function ConversationAnalyzerRoute() {
	const { analyses: initialAnalyses } = useLoaderData<typeof loader>()
	const [analyses, setAnalyses] = useState(initialAnalyses)
	const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null)
	const [activeAnalysis, setActiveAnalysis] = useState<ConversationAnalysisRecord | null>(
		initialAnalyses.find((analysis) => analysis.status === "completed") ?? null
	)
	const [isUploading, setIsUploading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (!activeAnalysisId) return

		const controller = new AbortController()
		const interval = setInterval(async () => {
			try {
				const response = await fetch(`/api/conversation-analyses/${activeAnalysisId}`, {
					signal: controller.signal,
				})
				if (!response.ok) return

				const payload = await response.json()
				const parsed = conversationAnalysisRecordSchema.parse(payload.analysis)

				setAnalyses((current) => {
					const next = current.filter((item) => item.id !== parsed.id)
					return [parsed, ...next]
				})

				if (parsed.status === "completed") {
					setActiveAnalysis(parsed)
					setActiveAnalysisId(null)
				} else if (parsed.status === "processing") {
					setActiveAnalysis(parsed)
				}

				if (parsed.status === "failed") {
					setError(parsed.error_message ?? "Analysis failed")
					setActiveAnalysisId(null)
				}
			} catch (pollError) {
				console.error("Polling conversation analysis failed", pollError)
			}
		}, 4000)

		return () => {
			controller.abort()
			clearInterval(interval)
		}
	}, [activeAnalysisId])

	const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
		event.preventDefault()
		setIsUploading(true)
		setError(null)

		const formData = new FormData(event.currentTarget)

		try {
			const response = await fetch("/api/conversation-analyses", {
				method: "POST",
				body: formData,
			})

			if (!response.ok) {
				const payload = await response.json().catch(() => ({ error: "Failed to start analysis" }))
				setError(payload.error || "Failed to start analysis")
				return
			}

			const payload = await response.json()
			const detailResponse = await fetch(`/api/conversation-analyses/${payload.analysisId}`)
			if (detailResponse.ok) {
				const detail = await detailResponse.json()
				const parsed = conversationAnalysisRecordSchema.parse(detail.analysis)
				setAnalyses((current) => {
					const others = current.filter((item) => item.id !== parsed.id)
					return [parsed, ...others]
				})
				setActiveAnalysis(parsed)
			} else {
				setActiveAnalysis(null)
			}
			setActiveAnalysisId(payload.analysisId)
			;(event.currentTarget as HTMLFormElement).reset()
		} catch (submitError) {
			console.error("Failed to trigger conversation analysis", submitError)
			setError(submitError instanceof Error ? submitError.message : "Failed to start analysis")
		} finally {
			setIsUploading(false)
		}
	}

	const inFlightAnalysis = useMemo(
		() => analyses.find((item) => item.id === activeAnalysisId),
		[analyses, activeAnalysisId]
	)

	return (
		<div className="mx-auto w-full max-w-5xl space-y-8 px-6 py-8">
			<header className="space-y-2">
				<h1 className="font-semibold text-3xl">Conversation Analyzer</h1>
				<p className="text-muted-foreground">
					Upload a recording to identify the questions asked, each participant's goals, and clear next steps for your
					revenue workflow.
				</p>
			</header>

			<Card>
				<CardHeader>
					<CardTitle>Analyze a new conversation</CardTitle>
					<CardDescription>
						Upload a recording (audio or video) and optionally add meeting context to improve the analysis.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form className="space-y-4" onSubmit={handleSubmit}>
						<div className="space-y-2">
							<Label htmlFor="file">Conversation recording</Label>
							<Input id="file" name="file" type="file" accept="audio/*,video/*" required />
						</div>
						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="meetingTitle">Meeting title</Label>
								<Input id="meetingTitle" name="meetingTitle" placeholder="Quarterly planning sync" />
							</div>
							<div className="space-y-2">
								<Label htmlFor="attendees">Attendees</Label>
								<Input
									id="attendees"
									name="attendees"
									placeholder="Jane Smith, Alex Johnson"
									aria-describedby="attendees-help"
								/>
								<p id="attendees-help" className="text-muted-foreground text-xs">
									Separate names with commas or new lines.
								</p>
							</div>
						</div>
						<div className="space-y-2">
							<Label htmlFor="notes">Notes for the analyst</Label>
							<Textarea
								id="notes"
								name="notes"
								placeholder="Focus on integration readiness and budget conversation."
								rows={4}
							/>
						</div>
						{error && <p className="text-destructive text-sm">{error}</p>}
						<Button type="submit" disabled={isUploading}>
							{isUploading ? "Uploading…" : "Start analysis"}
						</Button>
					</form>
				</CardContent>
			</Card>

			<div className="grid gap-6 md:grid-cols-[2fr,1fr]">
				<Card className="order-2 md:order-1">
					<CardHeader>
						<CardTitle>Analysis detail</CardTitle>
						<CardDescription>
							{activeAnalysis
								? "Review the automatically extracted questions, goals, and follow-ups."
								: "Select a completed analysis to view its insights."}
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						{inFlightAnalysis && (
							<Badge variant="outline" className="border-dashed">
								Processing… we’ll refresh the results shortly.
							</Badge>
						)}

						{activeAnalysis ? (
							<div className="space-y-6">
								<section>
									<h2 className="font-semibold text-lg">Executive summary</h2>
									<p className="whitespace-pre-line text-muted-foreground">
										{activeAnalysis.summary ?? "Summary will appear once processing is complete."}
									</p>
								</section>
								<section className="space-y-3">
									<h3 className="font-semibold text-base">Questions asked</h3>
									<div className="space-y-2">
										{(Array.isArray(activeAnalysis.detected_questions) ? activeAnalysis.detected_questions : [])?.map(
											(question: any, index: number) => (
												<div key={index} className="rounded-md border p-3">
													<p className="font-medium">{question.question}</p>
													<p className="text-muted-foreground text-sm">
														{question.asked_by ? `Asked by ${question.asked_by}. ` : ""}
														{question.intent ?? ""}
													</p>
													{question.evidence_snippet && (
														<p className="text-muted-foreground text-xs">“{question.evidence_snippet}”</p>
													)}
												</div>
											)
										)}
									</div>
								</section>
								<section className="space-y-3">
									<h3 className="font-semibold text-base">Participant goals</h3>
									<div className="space-y-2">
										{(Array.isArray(activeAnalysis.participant_goals) ? activeAnalysis.participant_goals : [])?.map(
											(goal: any, index: number) => (
												<div key={index} className="rounded-md border p-3">
													<p className="font-medium">{goal.speaker ?? "Unknown participant"}</p>
													<p className="text-muted-foreground text-sm">{goal.goal}</p>
													{goal.evidence_snippet && (
														<p className="text-muted-foreground text-xs">“{goal.evidence_snippet}”</p>
													)}
												</div>
											)
										)}
									</div>
								</section>
								<section className="space-y-3">
									<h3 className="font-semibold text-base">Key takeaways</h3>
									<div className="space-y-2">
										{(Array.isArray(activeAnalysis.key_takeaways) ? activeAnalysis.key_takeaways : [])?.map(
											(takeaway: any, index: number) => (
												<div key={index} className="rounded-md border p-3">
													<Badge variant="secondary" className="mb-2 capitalize">
														{takeaway.priority ?? "medium"}
													</Badge>
													<p>{takeaway.summary}</p>
													{Array.isArray(takeaway.evidence_snippets) && takeaway.evidence_snippets.length > 0 && (
														<ul className="mt-2 space-y-1 text-muted-foreground text-xs">
															{takeaway.evidence_snippets.map((snippet: string, snippetIndex: number) => (
																<li key={snippetIndex}>“{snippet}”</li>
															))}
														</ul>
													)}
												</div>
											)
										)}
									</div>
								</section>
								<section className="space-y-3">
									<h3 className="font-semibold text-base">Recommended next steps</h3>
									<div className="space-y-2">
										{(Array.isArray(activeAnalysis.recommendations) ? activeAnalysis.recommendations : [])?.map(
											(step: any, index: number) => (
												<div key={index} className="rounded-md border p-3">
													<p className="font-medium">{step.focus_area}</p>
													<p className="text-muted-foreground text-sm">{step.action}</p>
													<p className="text-muted-foreground text-xs">{step.rationale}</p>
												</div>
											)
										)}
									</div>
								</section>
								{Array.isArray(activeAnalysis.open_questions) && activeAnalysis.open_questions.length > 0 && (
									<section className="space-y-2">
										<h3 className="font-semibold text-base">Open questions</h3>
										<ul className="list-disc space-y-1 pl-5 text-sm">
											{activeAnalysis.open_questions.map((item: string, index: number) => (
												<li key={index}>{item}</li>
											))}
										</ul>
									</section>
								)}
							</div>
						) : (
							<p className="text-muted-foreground">No analysis selected yet.</p>
						)}
					</CardContent>
				</Card>
				<Card className="order-1 md:order-2">
					<CardHeader>
						<CardTitle>Recent analyses</CardTitle>
						<CardDescription>Select a row to view details.</CardDescription>
					</CardHeader>
					<CardContent className="space-y-2">
						{analyses.length === 0 ? (
							<p className="text-muted-foreground text-sm">No recordings analyzed yet.</p>
						) : (
							<ul className="space-y-2">
								{analyses.map((analysis) => (
									<li key={analysis.id}>
										<button
											type="button"
											onClick={() => {
												setActiveAnalysis(analysis)
												setActiveAnalysisId(analysis.status === "completed" ? null : analysis.id)
											}}
											className="w-full rounded-md border px-3 py-2 text-left hover:bg-muted"
										>
											<div className="flex items-center justify-between text-sm">
												<span className="font-medium">{new Date(analysis.created_at).toLocaleString()}</span>
												<Badge
													variant={
														analysis.status === "completed"
															? "default"
															: analysis.status === "failed"
																? "destructive"
																: "secondary"
													}
												>
													{analysis.status}
												</Badge>
											</div>
											{analysis.summary && (
												<p className="line-clamp-2 text-muted-foreground text-xs">{analysis.summary}</p>
											)}
										</button>
									</li>
								))}
							</ul>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
