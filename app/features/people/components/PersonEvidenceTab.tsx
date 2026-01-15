/**
 * PersonEvidenceTab - All source material linked to a person
 *
 * Consolidates all evidence/conversations in a filterable list:
 * - Filter by source type (Interviews, Notes, Surveys, Chats, Assets)
 * - Sort by date
 * - Imported Data section for survey_response facets
 */

import { ClipboardList, FileIcon, FolderOpen, MessageCircle, StickyNote, Video } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"

/** Source type filter values */
type SourceFilter = "all" | "interviews" | "notes" | "surveys" | "chats" | "assets"

/** Sort options */
type SortOption = "recent" | "oldest"

interface InterviewLink {
	id: string | number
	interviews: {
		id: string
		title: string | null
		source_type: string | null
		media_type: string | null
		created_at: string | null
	} | null
}

interface RelatedAsset {
	id: string
	title: string
	asset_type: string
	created_at: string
	description: string | null
	relationship_type: string | null
}

interface SurveyResponse {
	interviewId: string
	interviewTitle: string
	responses: Array<{
		id: string
		question: string
		answer: string
		createdAt: string
	}>
}

interface ResearchLinkQuestion {
	id: string
	prompt: string
	type: string
	options?: string[]
	likertScale?: number
	likertLabels?: { low: string; high: string }
}

interface ResearchLinkResponse {
	id: string
	email: string
	responses: Record<string, unknown> | null
	completed: boolean
	created_at: string
	updated_at: string
	research_links: {
		id: string
		name: string
		slug: string
		questions: ResearchLinkQuestion[] | null
	} | null
}

interface PersonEvidenceTabProps {
	/** All interview/source links from interview_people */
	allInterviewLinks: InterviewLink[]
	/** Assets linked via junction table */
	relatedAssets: RelatedAsset[]
	/** Grouped survey Q&A responses from evidence_facet */
	surveyResponses: SurveyResponse[]
	/** Research link responses from ask links */
	researchLinkResponses: ResearchLinkResponse[]
	/** Route helpers */
	routes: {
		interviews: { detail: (id: string) => string }
		assets: { detail: (id: string) => string }
	}
}

/** Normalize a source to its filter category */
function getSourceCategory(
	sourceType: string | null,
	mediaType: string | null
): Exclude<SourceFilter, "all" | "assets"> {
	if (sourceType === "note" || mediaType === "voice_memo") {
		return "notes"
	}
	if (sourceType === "survey_response") {
		return "surveys"
	}
	if (sourceType === "public_chat") {
		return "chats"
	}
	return "interviews"
}

/** Get icon component for a source type */
function getSourceIcon(category: Exclude<SourceFilter, "all">) {
	switch (category) {
		case "interviews":
			return Video
		case "notes":
			return StickyNote
		case "surveys":
			return ClipboardList
		case "chats":
			return MessageCircle
		case "assets":
			return FileIcon
	}
}

/** Get display label for a source category */
function getSourceLabel(category: Exclude<SourceFilter, "all">) {
	switch (category) {
		case "interviews":
			return "Interview"
		case "notes":
			return "Note"
		case "surveys":
			return "Survey"
		case "chats":
			return "Chat"
		case "assets":
			return "Asset"
	}
}

/** Unified evidence item for the list */
interface EvidenceItem {
	id: string
	title: string
	category: Exclude<SourceFilter, "all">
	date: Date | null
	linkTo: string
	subtitle?: string
}

export function PersonEvidenceTab({
	allInterviewLinks,
	relatedAssets,
	surveyResponses,
	researchLinkResponses,
	routes,
}: PersonEvidenceTabProps) {
	const [filter, setFilter] = useState<SourceFilter>("all")
	const [sort, setSort] = useState<SortOption>("recent")

	// Transform all sources into a unified list
	const allEvidence = useMemo(() => {
		const items: EvidenceItem[] = []

		// Add interview links (includes notes, surveys, chats based on source_type)
		for (const link of allInterviewLinks) {
			if (!link.interviews?.id) continue
			const interview = link.interviews
			const category = getSourceCategory(interview.source_type, interview.media_type)

			items.push({
				id: String(link.id),
				title: interview.title || `${getSourceLabel(category)} ${interview.id.slice(0, 8)}`,
				category,
				date: interview.created_at ? new Date(interview.created_at) : null,
				linkTo: routes.interviews.detail(interview.id),
			})
		}

		// Add assets
		for (const asset of relatedAssets) {
			items.push({
				id: `asset-${asset.id}`,
				title: asset.title,
				category: "assets",
				date: new Date(asset.created_at),
				linkTo: routes.assets.detail(asset.id),
				subtitle: asset.asset_type,
			})
		}

		return items
	}, [allInterviewLinks, relatedAssets, routes])

	// Count by category for filter badges
	const counts = useMemo(() => {
		const result: Record<SourceFilter, number> = {
			all: allEvidence.length,
			interviews: 0,
			notes: 0,
			surveys: 0,
			chats: 0,
			assets: 0,
		}

		for (const item of allEvidence) {
			result[item.category]++
		}

		return result
	}, [allEvidence])

	// Filter and sort
	const filteredEvidence = useMemo(() => {
		let items = allEvidence

		if (filter !== "all") {
			items = items.filter((item) => item.category === filter)
		}

		// Sort by date
		items = [...items].sort((a, b) => {
			const dateA = a.date?.getTime() ?? 0
			const dateB = b.date?.getTime() ?? 0
			return sort === "recent" ? dateB - dateA : dateA - dateB
		})

		return items
	}, [allEvidence, filter, sort])

	// Check if we have any imported data to show
	const hasImportedData = surveyResponses.length > 0
	const hasAskLinkResponses = researchLinkResponses.length > 0

	// Empty state
	if (allEvidence.length === 0 && !hasImportedData && !hasAskLinkResponses) {
		return (
			<div className="flex flex-col items-center justify-center py-12 text-center">
				<FolderOpen className="mb-4 h-12 w-12 text-muted-foreground/50" />
				<h3 className="mb-2 font-medium text-lg">No evidence yet</h3>
				<p className="max-w-md text-muted-foreground text-sm">
					Link conversations, notes, or assets to this person to see them here.
				</p>
			</div>
		)
	}

	return (
		<div className="space-y-6">
			{/* Filter Bar */}
			{allEvidence.length > 0 && (
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<ToggleGroup
						type="single"
						value={filter}
						onValueChange={(value) => value && setFilter(value as SourceFilter)}
						variant="outline"
						size="sm"
					>
						<ToggleGroupItem value="all" className="gap-1.5 px-3">
							All
							<Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
								{counts.all}
							</Badge>
						</ToggleGroupItem>
						{counts.interviews > 0 && (
							<ToggleGroupItem value="interviews" className="gap-1.5 px-3">
								<Video className="h-3.5 w-3.5" />
								Interviews
								<Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
									{counts.interviews}
								</Badge>
							</ToggleGroupItem>
						)}
						{counts.notes > 0 && (
							<ToggleGroupItem value="notes" className="gap-1.5 px-3">
								<StickyNote className="h-3.5 w-3.5" />
								Notes
								<Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
									{counts.notes}
								</Badge>
							</ToggleGroupItem>
						)}
						{counts.surveys > 0 && (
							<ToggleGroupItem value="surveys" className="gap-1.5 px-3">
								<ClipboardList className="h-3.5 w-3.5" />
								Surveys
								<Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
									{counts.surveys}
								</Badge>
							</ToggleGroupItem>
						)}
						{counts.chats > 0 && (
							<ToggleGroupItem value="chats" className="gap-1.5 px-3">
								<MessageCircle className="h-3.5 w-3.5" />
								Chats
								<Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
									{counts.chats}
								</Badge>
							</ToggleGroupItem>
						)}
						{counts.assets > 0 && (
							<ToggleGroupItem value="assets" className="gap-1.5 px-3">
								<FileIcon className="h-3.5 w-3.5" />
								Assets
								<Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
									{counts.assets}
								</Badge>
							</ToggleGroupItem>
						)}
					</ToggleGroup>

					<Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
						<SelectTrigger className="w-[140px]">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="recent">Most Recent</SelectItem>
							<SelectItem value="oldest">Oldest First</SelectItem>
						</SelectContent>
					</Select>
				</div>
			)}

			{/* Evidence List */}
			{filteredEvidence.length > 0 && (
				<div className="space-y-2">
					{filteredEvidence.map((item) => {
						const Icon = getSourceIcon(item.category)
						return (
							<Link
								key={item.id}
								to={item.linkTo}
								className="flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-muted/50"
							>
								<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
									<Icon className="h-5 w-5 text-muted-foreground" />
								</div>
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<h3 className="truncate font-medium text-foreground">{item.title}</h3>
										<Badge variant="outline" className="shrink-0 text-xs">
											{getSourceLabel(item.category)}
										</Badge>
									</div>
									{item.subtitle && <p className="mt-0.5 text-muted-foreground text-sm capitalize">{item.subtitle}</p>}
								</div>
								<div className="shrink-0 text-muted-foreground text-sm">
									{item.date?.toLocaleDateString(undefined, {
										month: "short",
										day: "numeric",
									})}
								</div>
							</Link>
						)
					})}
				</div>
			)}

			{/* Empty state for current filter */}
			{filteredEvidence.length === 0 && allEvidence.length > 0 && (
				<div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
					<p className="text-muted-foreground text-sm">No {filter === "all" ? "evidence" : filter} found.</p>
				</div>
			)}

			{/* Imported Data Section */}
			{hasImportedData && (
				<div className="space-y-3">
					<h3 className="flex items-center gap-2 font-medium text-base">
						<ClipboardList className="h-4 w-4" />
						Imported Data
					</h3>
					{surveyResponses.map((survey) => (
						<Card key={survey.interviewId}>
							<CardHeader className="pb-2">
								<Link
									to={routes.interviews.detail(survey.interviewId)}
									className="font-medium text-sm transition-colors hover:text-primary"
								>
									{survey.interviewTitle}
								</Link>
							</CardHeader>
							<CardContent className="space-y-3">
								{survey.responses.map((response) => (
									<div key={response.id} className="space-y-1">
										<p className="text-muted-foreground text-sm">{response.question}</p>
										<p className="text-foreground text-sm">{response.answer}</p>
									</div>
								))}
							</CardContent>
						</Card>
					))}
				</div>
			)}

			{/* Ask Link Responses Section */}
			{hasAskLinkResponses && (
				<div className="space-y-3">
					<h3 className="flex items-center gap-2 font-medium text-base">
						<MessageCircle className="h-4 w-4" />
						Survey Responses
					</h3>
					{researchLinkResponses.map((response) => {
						const responsesData = response.responses as Record<string, unknown> | null
						const questions = response.research_links?.questions ?? []

						// Get answered questions in order
						const answeredQuestions = questions.filter(
							(q) =>
								responsesData?.[q.id] !== undefined && responsesData?.[q.id] !== null && responsesData?.[q.id] !== ""
						)

						return (
							<Card key={response.id}>
								<CardHeader className="pb-2">
									<div className="flex items-center justify-between">
										<CardTitle className="text-sm">{response.research_links?.name || "Ask Link"}</CardTitle>
										<div className="flex items-center gap-2">
											<Badge variant={response.completed ? "default" : "secondary"}>
												{response.completed ? "Completed" : "In Progress"}
											</Badge>
											<span className="text-muted-foreground text-xs">
												{new Date(response.created_at).toLocaleDateString(undefined, {
													month: "short",
													day: "numeric",
													year: "numeric",
												})}
											</span>
										</div>
									</div>
								</CardHeader>
								<CardContent className="space-y-3">
									{answeredQuestions.length > 0 ? (
										answeredQuestions.map((question) => {
											const answer = responsesData?.[question.id]
											const formattedAnswer =
												typeof answer === "string"
													? answer
													: Array.isArray(answer)
														? answer.join(", ")
														: typeof answer === "number"
															? question.type === "likert"
																? `${answer}/${question.likertScale || 5}`
																: String(answer)
															: JSON.stringify(answer)

											return (
												<div key={question.id} className="space-y-1">
													<p className="text-muted-foreground text-sm">{question.prompt}</p>
													<p className="text-foreground text-sm">{formattedAnswer}</p>
												</div>
											)
										})
									) : (
										<p className="text-muted-foreground text-sm">No responses recorded</p>
									)}
								</CardContent>
							</Card>
						)
					})}
				</div>
			)}
		</div>
	)
}
