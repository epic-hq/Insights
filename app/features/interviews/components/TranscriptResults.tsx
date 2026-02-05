import consola from "consola"
import { Check, Copy, Pencil, Tag, User } from "lucide-react"
import { useState } from "react"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"

const MAX_TOPIC_RESULTS = 120

interface TranscriptData {
	id: string
	text: string
	words: Array<{
		text: string
		start: number
		end: number
		confidence: number
		speaker: string
	}>
	utterances: Array<{
		speaker: string
		text: string
		confidence: number
		start: number
		end: number
	}>
	sentiment_analysis_results: Array<{
		sentiment: string
		speaker: string
		text: string
		start: number
		end: number
		confidence: number
	}>
	iab_categories_result: {
		status: string
		results: Array<{
			text: string
			labels: Array<{
				relevance: number
				label: string
			}>
		}>
		summary: Record<string, number>
	}
	language_code: string
	confidence: number
	audio_duration: number
	name?: string
	persona?: string
	notes?: string
}

interface TranscriptResultsProps {
	data: TranscriptData
	rawTranscript?: string // Fallback raw transcript when formatted data is not available
	participants?: Array<{
		id: number
		role: string | null
		transcript_key: string | null
		display_name: string | null
		people?: { id?: string; name?: string | null; segment?: string | null }
	}>
	onSpeakerClick?: (speakerKey: string) => void
}

export function TranscriptResults({ data, rawTranscript, participants = [], onSpeakerClick }: TranscriptResultsProps) {
	const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({})

	// Create speaker name mapping from participants
	// Priority: 1) transcript_key match, 2) role-based inference (A=interviewer, B=participant)
	const getSpeakerName = (speakerKey: string): string => {
		const normalizedKey = speakerKey.toUpperCase()

		// First, try explicit transcript_key match
		const participantByKey = participants.find((p) => {
			if (!p.transcript_key) return false
			const tk = p.transcript_key.toUpperCase()

			// Exact match
			if (tk === normalizedKey) return true

			// "SPEAKER A" matches "A"
			if (tk === `SPEAKER ${normalizedKey}`) return true

			// "A" matches "SPEAKER A"
			if (`SPEAKER ${tk}` === normalizedKey) return true

			return false
		})

		if (participantByKey) {
			return participantByKey.people?.name || participantByKey.display_name || `Speaker ${normalizedKey}`
		}

		// Fallback: role-based inference when transcript_key not set
		// Convention: Speaker A = interviewer (speaks first), Speaker B = participant
		if (normalizedKey === "A") {
			const interviewer = participants.find((p) => p.role === "interviewer")
			if (interviewer?.people?.name) return interviewer.people.name
			if (interviewer?.display_name) return interviewer.display_name
		} else if (normalizedKey === "B") {
			const participant = participants.find((p) => p.role === "participant")
			if (participant?.people?.name) return participant.people.name
			if (participant?.display_name) return participant.display_name
		}

		// If still no match, try any participant with a name for speaker B (common case)
		if (normalizedKey === "B" || normalizedKey === "SPEAKER B") {
			const anyWithName = participants.find((p) => p.people?.name && p.role !== "interviewer")
			if (anyWithName?.people?.name) return anyWithName.people.name
		}

		return `Speaker ${normalizedKey}`
	}

	const formatTime = (seconds: number) => {
		const minutes = Math.floor(seconds / 60)
		const remainingSeconds = Math.floor(seconds % 60)
		return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
	}

	const getSpeakerColor = (speaker: string) => {
		switch (speaker.toUpperCase()) {
			case "A":
				return {
					badge:
						"bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800",
					border: "border-blue-500 dark:border-blue-400",
				}
			case "B":
				return {
					badge:
						"bg-green-100 text-green-900 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800",
					border: "border-green-500 dark:border-green-400",
				}
			case "C":
				return {
					badge:
						"bg-yellow-100 text-yellow-900 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800",
					border: "border-yellow-500 dark:border-yellow-400",
				}
			case "D":
				return {
					badge: "bg-red-100 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
					border: "border-red-500 dark:border-red-400",
				}
			default:
				return {
					badge: "bg-muted text-muted-foreground border-border",
					border: "border-muted-foreground",
				}
		}
	}

	const copyToClipboard = async (text: string, key: string) => {
		try {
			await navigator.clipboard.writeText(text)
			setCopiedStates((prev) => ({ ...prev, [key]: true }))
			setTimeout(() => {
				setCopiedStates((prev) => ({ ...prev, [key]: false }))
			}, 2000)
		} catch (err) {
			consola.error("Failed to copy text: ", err)
		}
	}

	const formatSpeakerAnalysis = () => {
		return (data?.utterances || ([] as any[]))
			.map((utterance: any) => {
				return `Speaker ${utterance.speaker} [${formatTime(utterance.start)} - ${formatTime(utterance.end)}]: ${utterance.text}`
			})
			.join("\n")
	}

	const formatTopicDetection = () => {
		const topCategories = Object.entries(data?.iab_categories_result?.summary || {})
			.sort(([, a], [, b]) => b - a)
			.slice(0, 10)

		let result = "Top Categories:\n"
		result += topCategories
			.map(([category, relevance]) => `${category.replace(/>/g, " > ")}: ${(relevance * 100).toFixed(0)}%`)
			.join("\n")

		result += "\n\nDetailed Results:\n"
		result += (data?.iab_categories_result?.results || [])
			.slice(0, MAX_TOPIC_RESULTS)
			.map((item) => {
				const labels = item.labels
					.slice(0, 5)
					.map((label) => `${label.label.split(">").pop()} (${(label.relevance * 100).toFixed(0)}%)`)
					.join(", ")
				return `"${item.text}"\nCategories: ${labels}`
			})
			.join("\n\n")

		return result
	}

	const topCategories = Object.entries(data?.iab_categories_result?.summary || {})
		.sort(([, a], [, b]) => b - a)
		.slice(0, 10)
	const topicResults = (data?.iab_categories_result?.results || []).slice(0, MAX_TOPIC_RESULTS)
	const totalTopicResults = data?.iab_categories_result?.results?.length || 0
	const truncatedTopics = totalTopicResults > topicResults.length

	// Check if we have formatted data or need to fall back to raw transcript
	const hasFormattedData = data?.utterances && data.utterances.length > 0
	const hasTopicData = data?.iab_categories_result && Object.keys(data.iab_categories_result.summary || {}).length > 0
	const hasRawTranscript = rawTranscript && rawTranscript.trim().length > 0

	// If no formatted data and no raw transcript, show empty state
	if (!hasFormattedData && !hasTopicData && !hasRawTranscript) {
		return (
			<Card>
				<CardContent className="py-8 text-center">
					<p className="text-muted-foreground">No transcript data available</p>
				</CardContent>
			</Card>
		)
	}

	return (
		<div className="space-y-6">
			{/* Main Content Tabs */}
			<Tabs defaultValue="speakers" className="w-full">
				<TabsList className={`grid w-full ${hasTopicData ? "grid-cols-2" : "grid-cols-1"}`}>
					<TabsTrigger value="speakers">Transcript</TabsTrigger>
					{hasTopicData && <TabsTrigger value="topics">Topics</TabsTrigger>}
				</TabsList>

				<TabsContent value="speakers" className="space-y-4">
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<CardTitle className="flex items-center gap-2">
									<User className="h-5 w-5" />
									{hasFormattedData ? "Speaker Breakdown" : "Transcript"}
								</CardTitle>
								<Button
									variant="outline"
									size="sm"
									onClick={() =>
										copyToClipboard(hasFormattedData ? formatSpeakerAnalysis() : rawTranscript || "", "transcript")
									}
									className="flex items-center gap-2"
								>
									{copiedStates.transcript ? (
										<>
											<Check className="h-4 w-4" />
											Copied!
										</>
									) : (
										<>
											<Copy className="h-4 w-4" />
											Copy Transcript
										</>
									)}
								</Button>
							</div>
						</CardHeader>
						<CardContent>
							{hasFormattedData ? (
								<TooltipProvider>
									<div className="space-y-4">
										{(data?.utterances || []).map((utterance, index) => {
											const colors = getSpeakerColor(utterance.speaker)
											const speakerName = getSpeakerName(utterance.speaker)
											return (
												<div key={index} className={`${colors.border} border-l-4 py-3 pl-4`}>
													<div className="mb-2 flex items-start justify-between">
														<div className="mb-2 flex items-center gap-1">
															<Badge className={`${colors.badge}`}>{speakerName}</Badge>
															{onSpeakerClick && (
																<Tooltip>
																	<TooltipTrigger asChild>
																		<button
																			type="button"
																			onClick={() => onSpeakerClick(utterance.speaker)}
																			className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
																			aria-label="Edit speaker"
																		>
																			<Pencil className="h-3 w-3" />
																		</button>
																	</TooltipTrigger>
																	<TooltipContent>
																		<p>Edit speaker assignment</p>
																	</TooltipContent>
																</Tooltip>
															)}
														</div>
														<div className="text-right text-foreground text-xs">
															<div>
																{formatTime(utterance.start)} - {formatTime(utterance.end)}
															</div>
														</div>
													</div>
													<p className="text-foreground leading-relaxed">{utterance.text}</p>
												</div>
											)
										})}
									</div>
								</TooltipProvider>
							) : (
								<div className="space-y-4">
									<div className="rounded-lg bg-muted p-4">
										<p className="whitespace-pre-wrap text-foreground leading-relaxed">{rawTranscript}</p>
									</div>
									<div className="text-center text-muted-foreground text-sm">
										<p>Raw transcript content - no speaker breakdown available</p>
									</div>
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				{hasTopicData && (
					<TabsContent value="topics" className="space-y-4">
						<Card>
							<CardHeader>
								<div className="flex items-center justify-between">
									<CardTitle className="flex items-center gap-2">
										<Tag className="h-5 w-5" />
										Topic Classification
									</CardTitle>
									<Button
										variant="outline"
										size="sm"
										onClick={() => copyToClipboard(formatTopicDetection(), "topics")}
										className="flex items-center gap-2"
									>
										{copiedStates.topics ? (
											<>
												<Check className="h-4 w-4" />
												Copied!
											</>
										) : (
											<>
												<Copy className="h-4 w-4" />
												Copy Analysis
											</>
										)}
									</Button>
								</div>
							</CardHeader>
							<CardContent>
								<div className="space-y-6">
									<div>
										<h3 className="mb-3 font-semibold">Top Categories</h3>
										<div className="space-y-2">
											{topCategories.map(([category, relevance]) => (
												<div key={category} className="flex items-center justify-between">
													<span className="text-sm">{category.replace(/>/g, " > ")}</span>
													<div className="flex items-center gap-2">
														<div className="h-2 w-24 rounded-full bg-background">
															<div className="h-2 rounded-full bg-blue-600" style={{ width: `${relevance * 100}%` }} />
														</div>
														<span className="text-foreground/50 text-sm">{(relevance * 100).toFixed(0)}%</span>
													</div>
												</div>
											))}
										</div>
									</div>

									{topicResults.map((result, index) => (
										<div key={index} className="rounded-lg border p-4">
											<p className="mb-3 text-foreground">{result.text}</p>
											<div className="flex flex-wrap gap-2">
												{result.labels.slice(0, 5).map((label, labelIndex) => (
													<Badge key={labelIndex} variant="secondary">
														{label.label.split(">").pop()} ({(label.relevance * 100).toFixed(0)}%)
													</Badge>
												))}
											</div>
										</div>
									))}
									{truncatedTopics && (
										<p className="text-muted-foreground text-xs">
											Showing first {topicResults.length.toLocaleString()} of {totalTopicResults.toLocaleString()} topic
											matches.
										</p>
									)}
								</div>
							</CardContent>
						</Card>
					</TabsContent>
				)}
			</Tabs>
		</div>
	)
}
