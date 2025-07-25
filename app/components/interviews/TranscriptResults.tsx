import consola from "consola"
import { Check, Copy, Tag, User } from "lucide-react"
import { useState } from "react"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"

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
}

export function TranscriptResults({ data }: TranscriptResultsProps) {
	const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({})

	const formatTime = (seconds: number) => {
		const minutes = Math.floor(seconds / 60)
		const remainingSeconds = Math.floor(seconds % 60)
		return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
	}

	const getSpeakerColor = (speaker: string) => {
		switch (speaker.toUpperCase()) {
			case "A":
				return {
					badge: "bg-blue-100 text-blue-800 border-blue-200",
					border: "border-blue-500",
				}
			case "B":
				return {
					badge: "bg-green-100 text-green-800 border-green-200",
					border: "border-green-500",
				}
			case "C":
				return {
					badge: "bg-yellow-100 text-yellow-800 border-yellow-200",
					border: "border-yellow-500",
				}
			case "D":
				return {
					badge: "bg-red-100 text-red-800 border-red-200",
					border: "border-red-500",
				}
			default:
				return {
					badge: "bg-gray-100 text-gray-800 border-gray-200",
					border: "border-gray-500",
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
		result += data?.iab_categories_result?.results
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

	return (
		<div className="space-y-6">
			{/* Main Content Tabs */}
			<Tabs defaultValue="speakers" className="w-full">
				<TabsList className="grid w-full grid-cols-2">
					<TabsTrigger value="speakers">Transcript</TabsTrigger>
					<TabsTrigger value="topics">Topics</TabsTrigger>
				</TabsList>

				<TabsContent value="speakers" className="space-y-4">
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<CardTitle className="flex items-center gap-2">
									<User className="h-5 w-5" />
									Speaker Breakdown
								</CardTitle>
								<Button
									variant="outline"
									size="sm"
									onClick={() => copyToClipboard(formatSpeakerAnalysis(), "speakers")}
									className="flex items-center gap-2"
								>
									{copiedStates.speakers ? (
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
							<div className="space-y-4">
								{(data?.utterances || []).map((utterance, index) => {
									const colors = getSpeakerColor(utterance.speaker)
									return (
										<div key={index} className={`${colors.border} border-l-4 py-3 pl-4`}>
											<div className="mb-2 flex items-start justify-between">
												<Badge className={`${colors.badge} mb-2`}>Speaker {utterance.speaker}</Badge>
												<div className="text-right text-gray-400 text-xs">
													<div>
														{formatTime(utterance.start)} - {formatTime(utterance.end)}
													</div>
												</div>
											</div>
											<p className="text-gray-800 leading-relaxed">{utterance.text}</p>
										</div>
									)
								})}
							</div>
						</CardContent>
					</Card>
				</TabsContent>

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
													<div className="h-2 w-24 rounded-full bg-gray-200">
														<div className="h-2 rounded-full bg-blue-600" style={{ width: `${relevance * 100}%` }} />
													</div>
													<span className="text-gray-600 text-sm">{(relevance * 100).toFixed(0)}%</span>
												</div>
											</div>
										))}
									</div>
								</div>

								{(data?.iab_categories_result?.results || []).map((result, index) => (
									<div key={index} className="rounded-lg border p-4">
										<p className="mb-3 text-gray-800">{result.text}</p>
										<div className="flex flex-wrap gap-2">
											{result.labels.slice(0, 5).map((label, labelIndex) => (
												<Badge key={labelIndex} variant="secondary">
													{label.label.split(">").pop()} ({(label.relevance * 100).toFixed(0)}%)
												</Badge>
											))}
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	)
}
