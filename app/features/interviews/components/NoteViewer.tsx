import { formatDistance } from "date-fns"
import consola from "consola"
import { Calendar, Check, ChevronDown, Loader2, Plus, Search, Trash2, Users } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useFetcher, useNavigate, useRevalidator } from "react-router"
import { PageContainer } from "~/components/layout/PageContainer"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import { BackButton } from "~/components/ui/back-button"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "~/components/ui/command"
import InlineEdit from "~/components/ui/inline-edit"
import { MediaTypeIcon } from "~/components/ui/MediaTypeIcon"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
import { createClient } from "~/lib/supabase/client"
import { cn } from "~/lib/utils"
import type { Database } from "~/types"

type InterviewRow = Database["public"]["Tables"]["interviews"]["Row"]

interface NoteViewerProps {
	interview: InterviewRow
	projectId: string
	className?: string
}

interface LinkedPerson {
	id: string
	interviewPersonId: number
	name: string | null
}

interface AvailablePerson {
	id: string
	name: string | null
}

export function NoteViewer({ interview, projectId, className }: NoteViewerProps) {
	const fetcher = useFetcher<{ success?: boolean; redirectTo?: string; error?: string }>()
	const linkFetcher = useFetcher()
	const navigate = useNavigate()
	const revalidator = useRevalidator()
	const supabase = createClient()
	const [showDeleteDialog, setShowDeleteDialog] = useState(false)
	const [isIndexing, setIsIndexing] = useState(false)

	// People linking state
	const [linkedPeople, setLinkedPeople] = useState<LinkedPerson[]>([])
	const [availablePeople, setAvailablePeople] = useState<AvailablePerson[]>([])
	const [isLoadingPeople, setIsLoadingPeople] = useState(true)
	const [showLinkPopover, setShowLinkPopover] = useState(false)
	const [searchInput, setSearchInput] = useState("")

	// Fetch linked people and available people for this note
	const fetchPeople = useCallback(async () => {
		setIsLoadingPeople(true)
		try {
			// Fetch linked people
			const { data: linkedData, error: linkedError } = await supabase
				.from("interview_people")
				.select("id, person_id, people(id, name)")
				.eq("interview_id", interview.id)

			if (linkedError) {
				consola.warn("Failed to fetch linked people:", linkedError)
			} else {
				const linked = (linkedData || []).map((row) => ({
					id: (row.people as { id: string })?.id || "",
					interviewPersonId: row.id,
					name: (row.people as { name: string | null })?.name || null,
				})).filter(p => p.id)
				setLinkedPeople(linked)
			}

			// Fetch all available people in project
			const { data: allPeople, error: peopleError } = await supabase
				.from("people")
				.select("id, name")
				.eq("project_id", projectId)
				.order("name", { ascending: true })

			if (peopleError) {
				consola.warn("Failed to fetch available people:", peopleError)
			} else {
				setAvailablePeople(allPeople || [])
			}
		} finally {
			setIsLoadingPeople(false)
		}
	}, [interview.id, projectId, supabase])

	useEffect(() => {
		fetchPeople()
	}, [fetchPeople])

	// Refresh people when link fetcher completes
	useEffect(() => {
		if (linkFetcher.state === "idle" && linkFetcher.data) {
			fetchPeople()
		}
	}, [linkFetcher.state, linkFetcher.data, fetchPeople])

	const handleLinkPerson = (personId: string) => {
		linkFetcher.submit(
			{
				intent: "add-participant",
				personId,
			},
			{ method: "post" }
		)
		setShowLinkPopover(false)
		setSearchInput("")
	}

	const handleUnlinkPerson = (interviewPersonId: number) => {
		linkFetcher.submit(
			{
				intent: "remove-participant",
				interviewPersonId: String(interviewPersonId),
			},
			{ method: "post" }
		)
	}

	const handleCreateAndLinkPerson = (name: string) => {
		if (!name.trim()) return
		linkFetcher.submit(
			{
				intent: "add-participant",
				create_person: "true",
				person_name: name.trim(),
			},
			{ method: "post" }
		)
		setShowLinkPopover(false)
		setSearchInput("")
	}

	// Filter out already linked people from available options
	const linkedPersonIds = new Set(linkedPeople.map(p => p.id))
	const unlinkedPeople = availablePeople.filter(p => !linkedPersonIds.has(p.id))

	// Handle delete response - navigate after successful delete
	useEffect(() => {
		if (fetcher.data?.success && fetcher.data?.redirectTo) {
			navigate(fetcher.data.redirectTo)
		} else if (fetcher.data?.error) {
			consola.error("Delete failed:", fetcher.data.error)
		}
	}, [fetcher.data, navigate])

	// Check indexing status from conversation_analysis
	const conversationAnalysis = interview.conversation_analysis as {
		indexed_at?: string
		evidence_count?: number
	} | null
	const isIndexed = !!conversationAnalysis?.indexed_at
	const evidenceCount = conversationAnalysis?.evidence_count ?? 0

	const handleIndexNote = async () => {
		setIsIndexing(true)
		try {
			const response = await fetch("/api/index-note", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ interviewId: interview.id }),
			})
			const result = await response.json()
			if (result.success) {
				consola.success("Note indexing started", result.runId)
				// Revalidate after a short delay to give the task time to start
				setTimeout(() => revalidator.revalidate(), 2000)
			} else {
				consola.error("Failed to index note:", result.error)
			}
		} catch (e) {
			consola.error("Index note failed", e)
		} finally {
			setIsIndexing(false)
		}
	}

	const handleSaveContent = (value: string) => {
		fetcher.submit(
			{
				entity: "interview",
				entityId: interview.id,
				accountId: interview.account_id,
				projectId: projectId,
				fieldName: "observations_and_notes",
				fieldValue: value,
			},
			{
				method: "POST",
				action: "/api/update-field",
			}
		)
	}

	const handleSaveTitle = (value: string) => {
		fetcher.submit(
			{
				entity: "interview",
				entityId: interview.id,
				accountId: interview.account_id,
				projectId: projectId,
				fieldName: "title",
				fieldValue: value,
			},
			{
				method: "POST",
				action: "/api/update-field",
			}
		)
	}

	const handleDelete = () => {
		fetcher.submit(
			{
				interviewId: interview.id,
				projectId: projectId,
			},
			{
				method: "DELETE",
				action: "/api/interviews/delete",
			}
		)
	}

	return (
		<PageContainer size="md" className={className}>
			<BackButton />

			{/* Header */}
			<div className="mt-6 mb-6">
				<div className="mb-4 flex items-start justify-between">
					<div className="flex items-center gap-3">
						<MediaTypeIcon
							mediaType={interview.media_type}
							sourceType={interview.source_type}
							showLabel={true}
							iconClassName="h-5 w-5"
							labelClassName="text-base font-semibold"
						/>
						{isIndexed && (
							<span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700 text-xs">
								{evidenceCount} evidence indexed
							</span>
						)}
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={handleIndexNote}
							disabled={isIndexing}
							title={isIndexed ? "Re-index this note for semantic search" : "Index this note for semantic search"}
						>
							{isIndexing ? (
								<>
									<Loader2 className="mr-1 h-4 w-4 animate-spin" />
									Indexing...
								</>
							) : (
								<>
									<Search className="mr-1 h-4 w-4" />
									{isIndexed ? "Re-index" : "Index Now"}
								</>
							)}
						</Button>
						<Button variant="ghost" size="sm" onClick={() => setShowDeleteDialog(true)}>
							<Trash2 className="h-4 w-4 text-destructive" />
						</Button>
					</div>
				</div>

				<InlineEdit
					value={interview.title || ""}
					onSubmit={handleSaveTitle}
					placeholder="Untitled Note"
					submitOnBlur={true}
					textClassName="font-bold text-3xl text-slate-900 dark:text-white"
					inputClassName="font-bold text-3xl"
				/>

				{/* Metadata */}
				<div className="flex flex-wrap items-center gap-4 text-slate-600 text-sm dark:text-slate-400">
					{interview.created_at && (
						<div className="flex items-center gap-1.5">
							<Calendar className="h-4 w-4" />
							<span>{formatDistance(new Date(interview.created_at), new Date(), { addSuffix: true })}</span>
						</div>
					)}
				</div>

				{/* Linked People */}
				<div className="mt-4 flex flex-wrap items-center gap-2">
					<div className="flex items-center gap-1.5 text-muted-foreground text-sm">
						<Users className="h-4 w-4" />
						<span>People:</span>
					</div>
					{isLoadingPeople ? (
						<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
					) : (
						<>
							{linkedPeople.map((person) => (
								<Badge
									key={person.id}
									variant="secondary"
									className="group flex items-center gap-1 pr-1"
								>
									{person.name || "Unnamed"}
									<button
										onClick={() => handleUnlinkPerson(person.interviewPersonId)}
										className="ml-1 rounded-full p-0.5 opacity-60 hover:bg-destructive/20 hover:opacity-100"
										title="Remove link"
									>
										<Trash2 className="h-3 w-3" />
									</button>
								</Badge>
							))}

							{/* Add Person Popover */}
							<Popover open={showLinkPopover} onOpenChange={setShowLinkPopover}>
								<PopoverTrigger asChild>
									<Button
										variant="outline"
										size="sm"
										className="h-6 gap-1 px-2 text-xs"
										disabled={linkFetcher.state !== "idle"}
									>
										<Plus className="h-3 w-3" />
										Add Person
									</Button>
								</PopoverTrigger>
								<PopoverContent className="w-[250px] p-0" align="start">
									<Command>
										<CommandInput
											placeholder="Search or create..."
											value={searchInput}
											onValueChange={setSearchInput}
										/>
										<CommandList>
											<CommandEmpty>
												<p className="py-2 text-center text-muted-foreground text-sm">No people found</p>
											</CommandEmpty>
											<CommandGroup>
												{unlinkedPeople.map((person) => (
													<CommandItem
														key={person.id}
														value={person.name || person.id}
														onSelect={() => handleLinkPerson(person.id)}
													>
														<Check className={cn("mr-2 h-4 w-4 opacity-0")} />
														{person.name || "Unnamed Person"}
													</CommandItem>
												))}
											</CommandGroup>
											<CommandSeparator />
											<CommandGroup>
												<CommandItem
													value={`create-new-${searchInput}`}
													onSelect={() => {
														if (searchInput.trim()) {
															handleCreateAndLinkPerson(searchInput.trim())
														}
													}}
													className="text-primary"
												>
													<Plus className="mr-2 h-4 w-4" />
													{searchInput.trim()
														? `Create "${searchInput.trim()}"`
														: "Create new person..."}
												</CommandItem>
											</CommandGroup>
										</CommandList>
									</Command>
								</PopoverContent>
							</Popover>
						</>
					)}
				</div>
			</div>

			{/* Audio Player */}
			{interview.media_url &&
				(interview.media_type === "voice_memo" ||
					interview.file_extension === "mp3" ||
					interview.file_extension === "wav" ||
					interview.file_extension === "m4a") && (
					<div className="mb-6">
						<audio controls className="w-full">
							<source src={interview.media_url} type={`audio/${interview.file_extension || "mp3"}`} />
							Your browser does not support the audio element.
						</audio>
					</div>
				)}

			{/* Note Content */}
			<div className="prose max-w-none text-foreground">
				<InlineEdit
					value={interview.observations_and_notes || ""}
					onSubmit={handleSaveContent}
					multiline={true}
					markdown={true}
					submitOnBlur={true}
					placeholder="Click to add note content..."
					textClassName="prose text-foreground"
					inputClassName="min-h-[500px] font-mono text-sm"
				/>
			</div>

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Note</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete this note? This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</PageContainer>
	)
}
