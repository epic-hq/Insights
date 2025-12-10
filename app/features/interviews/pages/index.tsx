import type { PostgrestError } from "@supabase/supabase-js"
import consola from "consola"
import { formatDistance } from "date-fns"
import { FileText, Grid, List, MessageSquare, MessageSquareText, MessagesSquare, Upload } from "lucide-react"
import { useState } from "react"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { Link, useFetcher, useLoaderData } from "react-router"
import { PrettySegmentPie } from "~/components/charts/PieSemgents"
import { PageContainer } from "~/components/layout/PageContainer"
import { QuickNoteDialog } from "~/components/notes/QuickNoteDialog"
import { Button } from "~/components/ui/button"
import { MediaTypeIcon } from "~/components/ui/MediaTypeIcon"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"
import { useCurrentProject } from "~/contexts/current-project-context"
import InterviewCard from "~/features/interviews/components/InterviewCard"
import NoteCard from "~/features/interviews/components/NoteCard"
import { getInterviews } from "~/features/interviews/db"
import InlinePersonaBadge from "~/features/personas/components/InlinePersonaBadge"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"
import type { Interview } from "~/types"

export const meta: MetaFunction = () => {
	return [{ title: "Interviews | Insights" }, { name: "description", content: "Research interviews and transcripts" }]
}

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	// Both from URL params - consistent, explicit, RESTful
	const accountId = params.accountId
	const projectId = params.projectId

	if (!accountId || !projectId) {
		throw new Response("Account ID and Project ID are required", { status: 400 })
	}

	const { data: rows, error }: { data: Interview[] | null; error: PostgrestError | null } = await getInterviews({
		supabase,
		accountId,
		projectId,
	})

	if (error) {
		consola.error("Interviews query error:", error)
		throw new Response(`Error fetching interviews: ${error.message}`, { status: 500 })
	}

	// consola.log(`Found ${rows?.length || 0} interviews`)

	// Build persona/segment distribution from interview participants
	const personaCountMap = new Map<string, number>()

		; (rows || []).forEach((interview) => {
			const primaryParticipant = interview.interview_people?.[0]
			const segment = primaryParticipant?.people?.segment || "Unknown"
			personaCountMap.set(segment, (personaCountMap.get(segment) || 0) + 1)
		})

	const segmentData = Array.from(personaCountMap.entries()).map(([name, value]) => ({
		name,
		value,
		color: "#d1d5db", // TODO: map personas to colors when available
	}))

	// Transform interviews for UI (includes notes now)
	const interviews = (rows || []).map((interview) => {
		// Get primary participant from interview_people junction
		const primaryParticipant = interview.interview_people?.[0]
		const participant = primaryParticipant?.people

		return {
			...interview,
			participant: participant?.name || interview.title || "Unknown",
			role: primaryParticipant?.role || "participant",
			persona: participant?.segment || "No segment",
			date: interview.interview_date || interview.created_at || "",
			duration: interview.duration_sec ? `${Math.round((interview.duration_sec / 60) * 10) / 10} min` : "Unknown",
			evidenceCount: interview.evidence_count || 0,
		}
	})

	return { interviews, segmentData }
}

export default function InterviewsIndex({ showPie = false }: { showPie?: boolean }) {
	const { interviews, segmentData } = useLoaderData<typeof loader>()
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath)
	const [viewMode, setViewMode] = useState<"cards" | "table">("cards")
	const [sourceFilter, setSourceFilter] = useState<"all" | "conversations" | "notes" | "files">("all")
	const [noteDialogOpen, setNoteDialogOpen] = useState(false)
	const _fetcher = useFetcher()

	// Sort interviews chronologically (includes notes now)
	const allItems = [...interviews].sort((a, b) => {
		// Sort by created_at descending (most recent first)
		const dateA = new Date(a.created_at).getTime()
		const dateB = new Date(b.created_at).getTime()
		return dateB - dateA
	})

	// Filter items by source type category
	const filteredInterviews = allItems.filter((item) => {
		if (sourceFilter === "all") return true

		// Notes filter - includes both quick notes and voice memos
		if (sourceFilter === "notes") {
			return item.source_type === "note" || item.media_type === "voice_memo"
		}

		// Conversations: all interviews (including generic interview type) but exclude voice memos, notes, and documents
		if (sourceFilter === "conversations") {
			return (
				item.source_type !== "note" &&
				item.media_type === "interview" &&
				item.source_type !== "document" &&
				item.media_type !== "document" &&
				item.media_type !== "voice_memo"
			)
		}

		// Files: documents (PDFs, spreadsheets, etc.)
		if (sourceFilter === "files") {
			return (
				item.source_type !== "note" &&
				item.media_type !== "voice_memo" &&
				(item.source_type === "document" || item.media_type === "document")
			)
		}

		return true
	})

	const handleSaveNote = async (note: {
		title: string
		content: string
		noteType: string
		associations: Record<string, unknown>
		tags: string[]
	}) => {
		// Extract project ID from path - format is /a/{accountId}/{projectId}
		const pathParts = projectPath?.split("/").filter(Boolean) || []
		const extractedProjectId = pathParts[2] // Index 2 is projectId (0: 'a', 1: accountId, 2: projectId)

		if (!extractedProjectId) {
			console.error("No project ID found in path:", projectPath)
			throw new Error("Project ID is required")
		}

		// Submit as JSON
		const response = await fetch("/api/notes/create", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				projectId: extractedProjectId,
				title: note.title,
				content: note.content,
				noteType: note.noteType,
				associations: note.associations,
				tags: note.tags,
			}),
		})

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}))
			console.error("Failed to save note:", errorData)
			throw new Error(errorData.details || errorData.error || "Failed to save note")
		}
	}

	return (
		<div className="relative min-h-screen bg-background">
			{/* Clean Header - Metro Style */}
			<div className="border-border border-b bg-card px-6 py-8">
				<PageContainer size="lg" padded={false} className="max-w-6xl">
					<div className="flex flex-col gap-6">
						<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
							<div className="space-y-3">
								<h1 className="flex items-center gap-2 font-semibold text-3xl text-foreground">
									<MessagesSquare />
									Recordings
								</h1>
								<p className="text-muted-foreground">
									Conversations, recordings, and documents
									<span className="ml-2 text-sm">({filteredInterviews.length})</span>
								</p>
							</div>

							{/* Actions */}
							<div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
								<ToggleGroup
									type="single"
									value={viewMode}
									onValueChange={(v) => v && setViewMode(v)}
									size="sm"
									className="justify-end sm:w-auto"
								>
									<ToggleGroupItem value="cards" aria-label="Cards" className="sm:px-3">
										<Grid className="h-4 w-4" />
									</ToggleGroupItem>
									<ToggleGroupItem value="table" aria-label="Table" className="sm:px-3">
										<List className="h-4 w-4" />
									</ToggleGroupItem>
								</ToggleGroup>
								<Button asChild variant="outline" className="w-full text-sm sm:w-auto" title="Generate & edit effective prompts for your conversations">
									<Link to={routes.questions.index()}>
										<MessageSquareText className="h-4 w-4" />
										Prompts
									</Link>
								</Button>
								<Button
									asChild
									variant="default"
									className="w-full whitespace-normal break-words text-sm sm:w-auto sm:whitespace-nowrap"
								>
									<Link to={routes.interviews.upload()}>
										<Upload className="h-4 w-4" />
										Upload / Record Media
									</Link>
								</Button>
							</div>
						</div>

						{/* Source Filter - Integrated in Header */}
						<div className="flex items-center justify-start">
							<ToggleGroup
								type="single"
								value={sourceFilter}
								onValueChange={(v) => v && setSourceFilter(v as any)}
								size="sm"
								className="w-full sm:w-auto"
							>
								<ToggleGroupItem value="all" className="flex-1 sm:flex-initial">
									All
								</ToggleGroupItem>
								<ToggleGroupItem value="conversations" className="flex-1 sm:flex-initial">
									<MessageSquare className="mr-1.5 h-3.5 w-3.5" />
									Conversations
								</ToggleGroupItem>
								<ToggleGroupItem value="notes" className="flex-1 sm:flex-initial">
									<FileText className="mr-1.5 h-3.5 w-3.5" />
									Notes
								</ToggleGroupItem>
								<ToggleGroupItem value="files" className="flex-1 sm:flex-initial">
									<Upload className="mr-1.5 h-3.5 w-3.5" />
									Files
								</ToggleGroupItem>
							</ToggleGroup>
						</div>
					</div>
				</PageContainer>
			</div>

			{/* Segment Chart Section - Fixed */}
			{showPie && segmentData.length > 0 && (
				<div className="border-gray-200 border-b bg-white px-6 py-6 dark:border-gray-800 dark:bg-gray-950">
					<PageContainer size="lg" padded={false} className="max-w-6xl">
						<div className="flex justify-center">
							<PrettySegmentPie data={segmentData} />
						</div>
					</PageContainer>
				</div>
			)}

			{/* Main Content */}
			<PageContainer size="lg" padded={false} className="max-w-6xl px-6 py-12">
				{filteredInterviews.length === 0 ? (
					<div className="py-16 text-center">
						<div className="mx-auto max-w-md">
							<div className="mb-6 flex justify-center">
								<div className="rounded-full bg-gray-100 p-6 dark:bg-gray-800">
									<Upload className="h-12 w-12 text-gray-400 dark:text-gray-500" />
								</div>
							</div>
							<h3 className="mb-3 font-semibold text-gray-900 text-xl dark:text-white">No interviews yet</h3>
							<p className="mb-8 text-gray-600 dark:text-gray-400">
								Upload your first interview recording or transcript to start gathering insights from your research.
							</p>
							<Button asChild className="gap-2">
								<Link to={routes.interviews.upload()}>
									<Upload className="h-4 w-4" />
									Add Your First Interview
								</Link>
							</Button>
						</div>
					</div>
				) : viewMode === "cards" ? (
					<div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
						{filteredInterviews.map((item) =>
							item.source_type === "note" ? (
								<NoteCard key={item.id} note={item as any} />
							) : (
								<InterviewCard key={item.id} interview={item} />
							)
						)}
					</div>
				) : (
					<div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900">
						<div className="overflow-x-auto">
							<table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
								<thead>
									<tr>
										<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
											Participant
										</th>
										<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
											Type
										</th>
										<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
											Persona
										</th>
										<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
											Evidence
										</th>
										<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
											Duration
										</th>
										<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
											Status
										</th>
										<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
											Date
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-200 dark:divide-gray-700">
									{filteredInterviews.map((interview) => (
										<tr key={interview.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
											<td className="px-4 py-3">
												<Link to={routes.interviews.detail(interview.id)} className="hover:text-blue-600">
													<div className="font-medium text-base text-foreground">
														{interview.interview_people?.[0]?.people?.name || interview.participant}
													</div>
													<div className="text-foreground/60 text-sm">
														{interview.interview_people?.[0]?.people?.segment || "Participant"}
													</div>
												</Link>
											</td>
											<td className="px-4 py-3">
												<Link
													to={routes.interviews.detail(interview.id)}
													className="inline-flex items-center gap-2 text-foreground/70 text-sm hover:text-blue-600"
												>
													<MediaTypeIcon
														mediaType={interview.media_type}
														sourceType={interview.source_type}
														iconClassName="h-4 w-4"
														labelClassName="text-xs font-medium"
													/>
												</Link>
											</td>
											<td className="whitespace-nowrap px-4 py-3">
												{interview.interview_people?.[0]?.people?.people_personas?.[0]?.personas ? (
													<InlinePersonaBadge
														persona={interview.interview_people[0].people.people_personas[0].personas}
													/>
												) : (
													<span className="text-gray-500 text-sm">No Persona</span>
												)}
											</td>
											<td className="whitespace-nowrap px-4 py-3">
												<span className="font-medium text-purple-600">{interview.evidenceCount}</span>
											</td>
											<td className="whitespace-nowrap px-4 py-3 text-gray-900 text-sm dark:text-white">
												{interview.duration}
											</td>
											<td className="whitespace-nowrap px-4 py-3">
												<span
													className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium text-xs ${interview.status === "ready"
															? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
															: interview.status === "transcribed"
																? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
																: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
														}`}
												>
													{interview.status.charAt(0).toUpperCase() + interview.status.slice(1)}
												</span>
											</td>
											<td className="whitespace-nowrap px-4 py-3 text-gray-500 text-sm dark:text-gray-400">
												{formatDistance(new Date(interview.created_at), new Date(), { addSuffix: true })}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				)}
			</PageContainer>

			{/* Quick Note Dialog */}
			<QuickNoteDialog
				open={noteDialogOpen}
				onOpenChange={setNoteDialogOpen}
				onSave={handleSaveNote}
				// TODO: Load available people, orgs, and opportunities from loader
				availablePeople={[]}
				availableOrgs={[]}
				availableOpportunities={[]}
			/>
		</div>
	)
}
