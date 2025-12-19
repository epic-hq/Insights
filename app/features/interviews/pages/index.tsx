import type { PostgrestError } from "@supabase/supabase-js"
import consola from "consola"
import { formatDistance } from "date-fns"
import {
	FileSpreadsheet,
	FileText,
	Grid,
	HelpCircle,
	List,
	MessageSquare,
	MessageSquareText,
	MessagesSquare,
	Search,
	Table,
	Upload,
} from "lucide-react"
import { useEffect, useState } from "react"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { Link, useFetcher, useLoaderData, useSearchParams } from "react-router"
import { PrettySegmentPie } from "~/components/charts/PieSemgents"
import { PageContainer } from "~/components/layout/PageContainer"
import { QuickNoteDialog } from "~/components/notes/QuickNoteDialog"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { MediaTypeIcon } from "~/components/ui/MediaTypeIcon"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"
import { useCurrentProject } from "~/contexts/current-project-context"
import InterviewCard from "~/features/interviews/components/InterviewCard"
import NoteCard from "~/features/interviews/components/NoteCard"
import { getInterviews } from "~/features/interviews/db"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"
import type { InterviewWithPeople } from "~/types"

function TableMediaPreview({
	media_url,
	thumbnail_url,
	file_extension,
	media_type,
	source_type,
}: {
	media_url?: string | null
	thumbnail_url?: string | null
	file_extension?: string | null
	media_type?: string | null
	source_type?: string | null
}) {
	const audio_extensions = ["mp3", "wav", "m4a", "ogg", "flac", "aac"]
	const image_extensions = ["jpg", "jpeg", "png", "gif", "webp", "bmp"]

	const ext = file_extension?.toLowerCase() || ""
	const is_audio_only = media_type === "voice_memo" || source_type?.includes("audio") || audio_extensions.includes(ext)
	const is_image = image_extensions.includes(ext)

	const preview_source = thumbnail_url || (is_image ? media_url : null)
	const [signedUrl, setSignedUrl] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false
		setSignedUrl(null)
		if (!preview_source) return

		const is_http_url = preview_source.startsWith("http://") || preview_source.startsWith("https://")
		if (is_http_url) {
			setSignedUrl(preview_source)
			return
		}

		const run = async () => {
			try {
				const response = await fetch("/api/media/signed-url", {
					method: "POST",
					credentials: "include",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ mediaUrl: preview_source, intent: "playback" }),
				})

				if (!response.ok) return
				const data = (await response.json()) as { signedUrl?: string }
				if (!cancelled && data.signedUrl) {
					setSignedUrl(data.signedUrl)
				}
			} catch {
				// best-effort thumbnail signing
			}
		}

		void run()
		return () => {
			cancelled = true
		}
	}, [preview_source])

	if (preview_source) {
		return signedUrl ? (
			<img src={signedUrl} alt="" className="h-9 w-14 shrink-0 rounded-md object-cover" loading="lazy" />
		) : (
			<div className="h-9 w-14 shrink-0 rounded-md bg-muted/40" />
		)
	}

	if (is_audio_only) {
		return (
			<div className="flex h-9 w-14 shrink-0 items-center justify-center rounded-md bg-muted">
				<MediaTypeIcon
					mediaType={media_type}
					sourceType={source_type}
					iconClassName="h-4 w-4"
					labelClassName="text-xs"
					showLabel={false}
				/>
			</div>
		)
	}

	return <div className="h-9 w-14 shrink-0 rounded-md bg-muted/40" />
}

export const meta: MetaFunction = () => {
	return [{ title: "Content | Insights" }, { name: "description", content: "Conversations, notes, and files" }]
}

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	// Both from URL params - consistent, explicit, RESTful
	const accountId = params.accountId
	const projectId = params.projectId

	if (!accountId || !projectId) {
		throw new Response("Account ID and Project ID are required", {
			status: 400,
		})
	}

	const [interviewsResult, assetsResult] = await Promise.all([
		getInterviews({ supabase, accountId, projectId }),
		supabase
			.from("project_assets")
			.select("id, title, asset_type, row_count, column_count, status, source_type, created_at, updated_at")
			.eq("project_id", projectId)
			.order("created_at", { ascending: false }),
	])

	const { data: rows, error } = interviewsResult as {
		data: InterviewWithPeople[] | null
		error: PostgrestError | null
	}
	const { data: assets, error: assetsError } = assetsResult

	if (error) {
		consola.error("Interviews query error:", error)
		throw new Response(`Error fetching interviews: ${error.message}`, {
			status: 500,
		})
	}

	if (assetsError) {
		consola.warn("Assets query error:", assetsError)
	}

	consola.info("Content loader:", {
		projectId,
		assetsCount: assets?.length ?? 0,
		interviewsCount: rows?.length ?? 0,
	})

	// consola.log(`Found ${rows?.length || 0} interviews`)

	// Build persona/segment distribution from interview participants
	const personaCountMap = new Map<string, number>()

	;(rows || []).forEach((interview) => {
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

	// Transform assets for unified display
	const projectAssets = (assets || []).map((asset) => ({
		id: asset.id,
		title: asset.title || "Untitled",
		asset_type: asset.asset_type,
		row_count: asset.row_count,
		column_count: asset.column_count,
		status: asset.status,
		source_type: asset.source_type,
		created_at: asset.created_at,
		updated_at: asset.updated_at,
	}))

	return { interviews, segmentData, projectAssets }
}

export default function InterviewsIndex({ showPie = false }: { showPie?: boolean }) {
	const { interviews, segmentData, projectAssets } = useLoaderData<typeof loader>()
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath)
	const [searchParams, setSearchParams] = useSearchParams()
	const [viewMode, setViewMode] = useState<"cards" | "table">("cards")
	const [sourceFilter, setSourceFilter] = useState<"all" | "conversations" | "notes" | "files">("all")
	const [fileSearchQuery, setFileSearchQuery] = useState("")
	const [noteDialogOpen, setNoteDialogOpen] = useState(false)
	const _fetcher = useFetcher()

	type InterviewListItem = (typeof interviews)[number]

	const get_interview_participants_summary = (interview: InterviewListItem) => {
		const interview_people = interview.interview_people ?? []
		const sorted_people = [...interview_people].sort((a, b) => {
			if (a.role === "participant") return -1
			if (b.role === "participant") return 1
			return 0
		})

		const participant_names = Array.from(
			new Set(sorted_people.map((p) => p.people?.name?.trim()).filter((name): name is string => Boolean(name)))
		)
		const display_participant_names = participant_names.length > 0 ? participant_names : [interview.participant]
		const displayed_participant_names = display_participant_names.slice(0, 3)
		const remaining_participant_count = Math.max(
			0,
			display_participant_names.length - displayed_participant_names.length
		)
		const names_label =
			remaining_participant_count > 0
				? `${displayed_participant_names.join(", ")} +${remaining_participant_count}`
				: displayed_participant_names.join(", ")

		const participant_segments = Array.from(
			new Set(
				sorted_people.map((p) => p.people?.segment?.trim()).filter((segment): segment is string => Boolean(segment))
			)
		)
		const display_segments = participant_segments.length > 0 ? participant_segments : ["Participant"]
		const displayed_segments = display_segments.slice(0, 2)
		const remaining_segment_count = Math.max(0, display_segments.length - displayed_segments.length)
		const segments_label =
			remaining_segment_count > 0
				? `${displayed_segments.join(", ")} +${remaining_segment_count}`
				: displayed_segments.join(", ")

		return { names_label, segments_label }
	}

	// Read tab from URL on mount (for redirects from asset delete, etc.)
	useEffect(() => {
		const tab = searchParams.get("tab")
		if (tab === "files" || tab === "conversations" || tab === "notes") {
			setSourceFilter(tab)
			// Clear the param after reading
			searchParams.delete("tab")
			setSearchParams(searchParams, { replace: true })
		}
	}, [searchParams, setSearchParams])

	// Sort interviews chronologically (includes notes now)
	const allItems = [...interviews].sort((a, b) => {
		// Sort by created_at descending (most recent first)
		const dateA = new Date(a.created_at).getTime()
		const dateB = new Date(b.created_at).getTime()
		return dateB - dateA
	})

	// Calculate counts for each tab
	const conversationsCount = allItems.filter(
		(item) =>
			item.source_type !== "note" &&
			item.media_type === "interview" &&
			item.source_type !== "document" &&
			item.media_type !== "document" &&
			item.media_type !== "voice_memo"
	).length
	const notesCount = allItems.filter((item) => item.source_type === "note" || item.media_type === "voice_memo").length
	const filesCount = projectAssets.length

	// Filter assets by search query (client-side filtering using title)
	const filteredAssets = fileSearchQuery
		? projectAssets.filter((asset) => asset.title.toLowerCase().includes(fileSearchQuery.toLowerCase()))
		: projectAssets

	// Filter items by source type category (for interviews/notes)
	const filteredInterviews = allItems.filter((item) => {
		if (sourceFilter === "files") return false // Files come from projectAssets
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
							<div className="space-y-1">
								<h1 className="flex items-center gap-2 font-semibold text-3xl text-foreground">
									<MessagesSquare />
									Content
								</h1>
							</div>

							{/* Actions */}
							<div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
								<ToggleGroup
									type="single"
									value={viewMode}
									onValueChange={(v) => {
										if (v === "cards" || v === "table") {
											setViewMode(v)
										}
									}}
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
								<Button
									asChild
									variant="outline"
									className="w-full text-sm sm:w-auto"
									title="Generate & edit effective prompts for your conversations"
								>
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
								onValueChange={(v) => {
									if (v === "all" || v === "conversations" || v === "notes" || v === "files") {
										setSourceFilter(v)
									}
								}}
								size="sm"
								className="w-full sm:w-auto"
							>
								<ToggleGroupItem value="all" className="flex-1 sm:flex-initial">
									All
								</ToggleGroupItem>
								<ToggleGroupItem value="conversations" className="flex-1 gap-1.5 sm:flex-initial">
									<MessageSquare className="h-3.5 w-3.5" />
									Conversations
									{conversationsCount > 0 && (
										<span className="rounded-full bg-muted px-1.5 py-0.5 font-medium text-muted-foreground text-xs">
											{conversationsCount}
										</span>
									)}
								</ToggleGroupItem>
								<ToggleGroupItem value="notes" className="flex-1 gap-1.5 sm:flex-initial">
									<FileText className="h-3.5 w-3.5" />
									Notes
									{notesCount > 0 && (
										<span className="rounded-full bg-muted px-1.5 py-0.5 font-medium text-muted-foreground text-xs">
											{notesCount}
										</span>
									)}
								</ToggleGroupItem>
								<ToggleGroupItem value="files" className="flex-1 gap-1.5 sm:flex-initial">
									<Upload className="h-3.5 w-3.5" />
									Files
									{filesCount > 0 && (
										<span className="rounded-full bg-muted px-1.5 py-0.5 font-medium text-muted-foreground text-xs">
											{filesCount}
										</span>
									)}
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
				{/* Files Tab - Show project_assets */}
				{sourceFilter === "files" ? (
					<>
						{/* Search bar for files */}
						{projectAssets.length > 0 && (
							<div className="mb-6 flex items-center justify-between gap-4">
								<div className="relative max-w-sm flex-1">
									<Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
									<Input
										placeholder="Search files..."
										value={fileSearchQuery}
										onChange={(e) => setFileSearchQuery(e.target.value)}
										className="pl-9"
									/>
								</div>
								{/* Usage instructions header */}
								<Popover>
									<PopoverTrigger asChild>
										<div className="ml-auto flex cursor-help items-center gap-2">
											<span className="font-medium text-foreground">How to use Files</span>
											<HelpCircle className="h-4 w-4 text-muted-foreground" />
										</div>
									</PopoverTrigger>
									<PopoverContent className="w-120 bg-accent text-foreground" align="end" sideOffset={8}>
										<p className="mb-3">
											Files store spreadsheets, tables, and documents you've shared with the AI assistant. You can:
										</p>
										<ul className="space-y-1">
											<li>
												• <strong>Ask questions</strong> — "What trends do you see in my customer list?"
											</li>
											<li>
												• <strong>Import contacts</strong> — "Import these as People" to add them to your CRM
											</li>
											<li>
												• <strong>Cross-reference</strong> — "Compare this data with our interview findings"
											</li>
											<li>
												• <strong>Edit inline</strong> — Click any file to view and edit the data directly
											</li>
										</ul>
									</PopoverContent>
								</Popover>

								<span className="text-muted-foreground text-sm">
									{filteredAssets.length} of {projectAssets.length} files
								</span>
							</div>
						)}
						{projectAssets.length === 0 ? (
							<div className="py-16 text-center">
								<div className="mx-auto max-w-md">
									<div className="mb-6 flex justify-center">
										<div className="rounded-full bg-gray-100 p-6 dark:bg-gray-800">
											<FileSpreadsheet className="h-12 w-12 text-gray-400 dark:text-gray-500" />
										</div>
									</div>
									<h3 className="mb-3 font-semibold text-gray-900 text-xl dark:text-white">No files yet</h3>
									<p className="mb-8 text-gray-600 dark:text-gray-400">
										Paste spreadsheet data into the chat or upload files to see them here.
									</p>
								</div>
							</div>
						) : filteredAssets.length === 0 ? (
							<div className="py-8 text-center">
								<p className="text-muted-foreground">No files match "{fileSearchQuery}"</p>
							</div>
						) : (
							<div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
								{filteredAssets.map((asset) => (
									<Link
										key={asset.id}
										to={routes.assets.detail(asset.id)}
										className="flex items-start gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
									>
										<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
											{asset.asset_type === "table" ? (
												<Table className="h-5 w-5 text-primary" />
											) : (
												<FileText className="h-5 w-5 text-primary" />
											)}
										</div>
										<div className="min-w-0 flex-1">
											<h3 className="truncate font-medium text-foreground">{asset.title}</h3>
											<div className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
												<span className="capitalize">{asset.asset_type}</span>
												{asset.row_count && asset.column_count && (
													<>
														<span>•</span>
														<span>
															{asset.row_count} rows × {asset.column_count} cols
														</span>
													</>
												)}
												<span>•</span>
												<span>{formatDistance(new Date(asset.created_at), new Date(), { addSuffix: true })}</span>
											</div>
											{asset.status && asset.status !== "ready" && (
												<span className="mt-2 inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 font-medium text-xs text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
													{asset.status}
												</span>
											)}
										</div>
									</Link>
								))}
							</div>
						)}
					</>
				) : filteredInterviews.length === 0 ? (
					<div className="py-16 text-center">
						<div className="mx-auto max-w-md">
							<div className="mb-6 flex justify-center">
								<div className="rounded-full bg-gray-100 p-6 dark:bg-gray-800">
									<Upload className="h-12 w-12 text-gray-400 dark:text-gray-500" />
								</div>
							</div>
							<h3 className="mb-3 font-semibold text-gray-900 text-xl dark:text-white">No content yet</h3>
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
					<div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
						{filteredInterviews.map((item) =>
							item.source_type === "note" ? (
								<NoteCard key={item.id} note={item} />
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
									{filteredInterviews.map((interview) => {
										const { names_label, segments_label } = get_interview_participants_summary(interview)
										return (
											<tr key={interview.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
												<td className="px-4 py-3">
													<Link to={routes.interviews.detail(interview.id)} className="hover:text-blue-600">
														<div className="flex items-center gap-3">
															<TableMediaPreview
																media_url={interview.media_url}
																thumbnail_url={interview.thumbnail_url}
																file_extension={interview.file_extension}
																media_type={interview.media_type}
																source_type={interview.source_type}
															/>
															<div>
																<div className="font-medium text-base text-foreground">{names_label}</div>
																<div className="text-foreground/60 text-sm">{segments_label}</div>
															</div>
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
													<span className="font-medium text-purple-600">{interview.evidenceCount}</span>
												</td>
												<td className="whitespace-nowrap px-4 py-3 text-gray-900 text-sm dark:text-white">
													{interview.duration}
												</td>
												<td className="whitespace-nowrap px-4 py-3">
													<span
														className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium text-xs ${
															interview.status === "ready"
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
										)
									})}
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
