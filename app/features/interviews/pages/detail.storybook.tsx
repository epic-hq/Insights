/**
 * Simplified Interview Detail component for Storybook
 * This is a visual-only version without server dependencies or functionality
 * Use this for UI/layout/spacing/design work
 *
 * The real component is in detail.tsx - changes to CSS/layout there will affect production
 */

import {
	BotMessageSquare,
	Briefcase,
	Edit2,
	Loader2,
	MessageCircleQuestionIcon,
	MoreVertical,
	SparkleIcon,
} from "lucide-react"
import { Link } from "react-router-dom"
import { BackButton } from "~/components/ui/back-button"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu"
import InlineEdit from "~/components/ui/inline-edit"
import { MediaPlayer } from "~/components/ui/MediaPlayer"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "~/components/ui/sheet"
import { Textarea } from "~/components/ui/textarea"
import { PlayByPlayTimeline } from "~/features/evidence/components/ChronologicalEvidenceList"
// import { SalesLensesSection } from "~/features/lenses/components/ConversationLenses" // Disabled: complex component with specific data requirements
import { MiniPersonCard } from "~/features/people/components/EnhancedPersonCard"
import { cn } from "~/lib/utils"
import { InterviewQuestionsAccordion } from "../components/InterviewQuestionsAccordion"
import { LazyTranscriptResults } from "../components/LazyTranscriptResults"

// Mock data types
interface MockInterviewData {
	interview: any
	insights: any[]
	peopleOptions: any[]
	salesLens: any
	analysisJobs: any[]
	evidence?: any[]
	empathyMap?: any
	conversationAnalysis?: any
}

export default function InterviewDetailStorybook({ data }: { data: MockInterviewData }) {
	const { interview, insights = [], peopleOptions = [], salesLens, analysisJobs = [], conversationAnalysis } = data

	const analysisJob = analysisJobs[0] || null
	const isProcessing = analysisJob?.status === "in_progress" || analysisJob?.status === "pending"
	const hasAnalysis = !!conversationAnalysis

	const formatReadable = (dateString: string) => {
		const d = new Date(dateString)
		return d.toLocaleDateString("en-US", {
			month: "short",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			hour12: true,
		})
	}

	const formatDuration = (seconds: number) => {
		const mins = Math.floor(seconds / 60)
		const secs = seconds % 60
		return `${mins}:${secs.toString().padStart(2, "0")}`
	}

	return (
		<div className="flex h-screen flex-col bg-background">
			{/* Header */}
			<div className="border-b">
				<div className="flex items-center justify-between px-6 py-4">
					<div className="flex items-center gap-4">
						<BackButton />
						<div>
							<div className="flex items-center gap-2">
								<InlineEdit value={interview.title} onSave={() => {}} className="font-semibold text-2xl" />
								<Badge variant="secondary">{interview.status}</Badge>
							</div>
							{interview.description && <p className="mt-1 text-muted-foreground text-sm">{interview.description}</p>}
						</div>
					</div>
					<div className="flex items-center gap-2">
						<Button variant="outline" size="sm">
							<Edit2 className="mr-2 h-4 w-4" />
							Edit
						</Button>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon">
									<MoreVertical className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem>Delete Interview</DropdownMenuItem>
								<DropdownMenuItem>Export Data</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>

				{/* Processing Banner */}
				{isProcessing && (
					<div className="border-t bg-primary/10 px-6 py-3">
						<div className="flex items-center gap-3">
							<Loader2 className="h-4 w-4 animate-spin text-primary" />
							<div className="flex-1">
								<p className="font-medium text-primary text-sm">Analysis in progress</p>
								<p className="text-muted-foreground text-xs">{analysisJob.status_detail}</p>
							</div>
							<div className="text-primary text-sm">{analysisJob.progress || 0}%</div>
						</div>
					</div>
				)}
			</div>

			{/* Main Content */}
			<div className="flex flex-1 overflow-hidden">
				{/* Left Sidebar - Media & Transcript */}
				<div className="flex w-1/3 flex-col border-r">
					{/* Media Player */}
					{interview.media_url && (
						<div className="border-b p-4">
							<MediaPlayer mediaUrl={interview.media_url} />
							{interview.duration_seconds && (
								<p className="mt-2 text-muted-foreground text-xs">
									Duration: {formatDuration(interview.duration_seconds)}
								</p>
							)}
						</div>
					)}

					{/* Participants */}
					{interview.participants && interview.participants.length > 0 && (
						<div className="border-b p-4">
							<h3 className="mb-3 font-semibold text-sm">Participants</h3>
							<div className="space-y-2">
								{interview.participants.map((participant: any) => (
									<div key={participant.id} className="flex items-center gap-2">
										<Badge variant="outline" className="text-xs">
											{participant.role}
										</Badge>
										<span className="text-sm">{participant.display_name}</span>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Transcript */}
					<div className="flex-1 overflow-auto p-4">
						<h3 className="mb-3 font-semibold text-sm">Transcript</h3>
						{interview.hasTranscript ? (
							<LazyTranscriptResults interviewId={interview.id} />
						) : (
							<p className="text-muted-foreground text-sm">No transcript available</p>
						)}
					</div>
				</div>

				{/* Main Content Area */}
				<div className="flex-1 overflow-auto">
					<div className="space-y-6 p-6">
						{/* Conversation Analysis */}
						{hasAnalysis && conversationAnalysis && (
							<section>
								<div className="mb-4 flex items-center justify-between">
									<h2 className="font-semibold text-lg">Analysis</h2>
									{conversationAnalysis.updatedAt && (
										<span className="text-muted-foreground text-xs">
											Updated {formatReadable(conversationAnalysis.updatedAt)}
										</span>
									)}
								</div>

								{/* Overview */}
								{conversationAnalysis.overview && (
									<div className="mb-4 rounded-lg bg-muted/50 p-4">
										<h3 className="mb-2 font-medium text-sm">Overview</h3>
										<p className="text-muted-foreground text-sm">{conversationAnalysis.overview}</p>
									</div>
								)}

								{/* Key Takeaways */}
								{conversationAnalysis.key_takeaways && conversationAnalysis.key_takeaways.length > 0 && (
									<div className="mb-4">
										<h3 className="mb-3 font-medium text-sm">Key Takeaways</h3>
										<div className="space-y-3">
											{conversationAnalysis.key_takeaways.map((takeaway: any, idx: number) => (
												<div key={idx} className="rounded-lg border p-4">
													<div className="flex items-start gap-3">
														<Badge
															variant={
																takeaway.priority === "high"
																	? "default"
																	: takeaway.priority === "medium"
																		? "secondary"
																		: "outline"
															}
															className="mt-0.5"
														>
															{takeaway.priority}
														</Badge>
														<div className="flex-1">
															<p className="font-medium text-sm">{takeaway.summary}</p>
															{takeaway.evidence_snippets && takeaway.evidence_snippets.length > 0 && (
																<div className="mt-2 space-y-1">
																	{takeaway.evidence_snippets.map((snippet: string, sidx: number) => (
																		<p key={sidx} className="border-l-2 pl-3 text-muted-foreground text-xs italic">
																			"{snippet}"
																		</p>
																	))}
																</div>
															)}
														</div>
													</div>
												</div>
											))}
										</div>
									</div>
								)}

								{/* Open Questions */}
								{conversationAnalysis.open_questions && conversationAnalysis.open_questions.length > 0 && (
									<div className="mb-4">
										<h3 className="mb-3 flex items-center gap-2 font-medium text-sm">
											<MessageCircleQuestionIcon className="h-4 w-4" />
											Open Questions
										</h3>
										<ul className="space-y-2">
											{conversationAnalysis.open_questions.map((question: string, idx: number) => (
												<li key={idx} className="flex items-start gap-2 text-muted-foreground text-sm">
													<span className="mt-1 text-primary">•</span>
													<span>{question}</span>
												</li>
											))}
										</ul>
									</div>
								)}

								{/* Recommended Next Steps */}
								{conversationAnalysis.recommended_next_steps &&
									conversationAnalysis.recommended_next_steps.length > 0 && (
										<div>
											<h3 className="mb-3 font-medium text-sm">Recommended Next Steps</h3>
											<div className="space-y-3">
												{conversationAnalysis.recommended_next_steps.map((step: any, idx: number) => (
													<div key={idx} className="rounded-lg border p-4">
														<div className="flex items-start gap-3">
															<SparkleIcon className="mt-1 h-4 w-4 text-primary" />
															<div className="flex-1">
																<p className="font-medium text-sm">{step.focus_area}</p>
																<p className="mt-1 text-muted-foreground text-sm">{step.action}</p>
																{step.rationale && (
																	<p className="mt-2 text-muted-foreground text-xs italic">
																		Rationale: {step.rationale}
																	</p>
																)}
															</div>
														</div>
													</div>
												))}
											</div>
										</div>
									)}
							</section>
						)}

						{/* Sales Lens */}
						{salesLens && (
							<section>
								<h2 className="mb-4 flex items-center gap-2 font-semibold text-lg">
									<Briefcase className="h-5 w-5" />
									Sales Insights (BANT)
								</h2>
								<div className="grid grid-cols-2 gap-4">
									{salesLens.bant && (
										<>
											<div className="rounded-lg border p-4">
												<h3 className="mb-2 font-medium text-sm">Budget</h3>
												<div className="mb-2 flex items-center gap-2">
													<Badge variant="outline">Score: {salesLens.bant.budget.score}/10</Badge>
												</div>
												<p className="text-muted-foreground text-sm">{salesLens.bant.budget.summary}</p>
											</div>
											<div className="rounded-lg border p-4">
												<h3 className="mb-2 font-medium text-sm">Authority</h3>
												<div className="mb-2 flex items-center gap-2">
													<Badge variant="outline">Score: {salesLens.bant.authority.score}/10</Badge>
												</div>
												<p className="text-muted-foreground text-sm">{salesLens.bant.authority.summary}</p>
											</div>
											<div className="rounded-lg border p-4">
												<h3 className="mb-2 font-medium text-sm">Need</h3>
												<div className="mb-2 flex items-center gap-2">
													<Badge variant="outline">Score: {salesLens.bant.need.score}/10</Badge>
												</div>
												<p className="text-muted-foreground text-sm">{salesLens.bant.need.summary}</p>
											</div>
											<div className="rounded-lg border p-4">
												<h3 className="mb-2 font-medium text-sm">Timeline</h3>
												<div className="mb-2 flex items-center gap-2">
													<Badge variant="outline">Score: {salesLens.bant.timeline.score}/10</Badge>
												</div>
												<p className="text-muted-foreground text-sm">{salesLens.bant.timeline.summary}</p>
											</div>
										</>
									)}
								</div>
								{salesLens.overallScore && (
									<div className="mt-4 rounded-lg border bg-primary/5 p-4">
										<div className="flex items-center justify-between">
											<h3 className="font-medium text-sm">Overall Score</h3>
											<Badge className="text-lg">{salesLens.overallScore}/100</Badge>
										</div>
										<p className="mt-2 text-muted-foreground text-sm">
											Buying Stage: <span className="font-medium">{salesLens.buyingStage}</span>
										</p>
									</div>
								)}
							</section>
						)}

						{/* Insights */}
						{insights && insights.length > 0 && (
							<section>
								<h2 className="mb-4 font-semibold text-lg">Linked Insights</h2>
								<div className="space-y-2">
									{insights.map((insight: any) => (
										<div key={insight.id} className="rounded-lg border p-4">
											<p className="text-sm">{insight.statement}</p>
											{insight.theme_names && insight.theme_names.length > 0 && (
												<div className="mt-2 flex gap-2">
													{insight.theme_names.map((theme: string) => (
														<Badge key={theme} variant="outline" className="text-xs">
															{theme}
														</Badge>
													))}
												</div>
											)}
										</div>
									))}
								</div>
							</section>
						)}

						{/* No Analysis State */}
						{!hasAnalysis && !isProcessing && (
							<div className="flex flex-col items-center justify-center py-12 text-center">
								<BotMessageSquare className="mb-4 h-12 w-12 text-muted-foreground" />
								<h3 className="mb-2 font-semibold text-lg">No Analysis Yet</h3>
								<p className="mb-4 text-muted-foreground text-sm">
									Run analysis to generate insights and takeaways from this interview
								</p>
								<Button>
									<SparkleIcon className="mr-2 h-4 w-4" />
									Run Analysis
								</Button>
							</div>
						)}
					</div>
				</div>

				{/* Right Sidebar - AI Chat (if needed) */}
				<Sheet>
					<SheetTrigger asChild>
						<Button variant="ghost" size="icon" className="absolute top-20 right-4">
							<BotMessageSquare className="h-5 w-5" />
						</Button>
					</SheetTrigger>
					<SheetContent side="right" className="w-96">
						<SheetHeader>
							<SheetTitle>AI Assistant</SheetTitle>
							<SheetDescription>Ask questions about this interview</SheetDescription>
						</SheetHeader>
						<div className="mt-4">
							<p className="text-muted-foreground text-sm">AI chat disabled in Storybook</p>
						</div>
					</SheetContent>
				</Sheet>
			</div>
		</div>
	)
}
