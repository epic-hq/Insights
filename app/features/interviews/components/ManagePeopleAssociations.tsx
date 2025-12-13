import { Check, ChevronDown, Plus, UserPlus, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useFetcher } from "react-router-dom"
import { Button } from "~/components/ui/button"
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "~/components/ui/command"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "~/components/ui/dialog"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
import { cn } from "~/lib/utils"

export interface InterviewPerson {
	id: string
	role: string | null
	transcript_key: string | null
	display_name: string | null
	people: {
		id: string
		name: string | null
	} | null
}

export interface Person {
	id: string
	name: string | null
}

interface ManagePeopleAssociationsProps {
	interviewId: string
	participants: InterviewPerson[]
	availablePeople: Person[]
	onUpdate?: () => void
}

export function ManagePeopleAssociations({
	interviewId,
	participants,
	availablePeople,
	onUpdate,
}: ManagePeopleAssociationsProps) {
	const fetcher = useFetcher()
	const [openPopoverId, setOpenPopoverId] = useState<string | null>(null)
	const [showAddPersonDialog, setShowAddPersonDialog] = useState(false)
	const [newPersonName, setNewPersonName] = useState("")
	const [searchInput, setSearchInput] = useState("")

	useEffect(() => {
		if (fetcher.state === "idle" && fetcher.data && onUpdate) {
			onUpdate()
		}
	}, [fetcher.state, fetcher.data, onUpdate])

	const linkPerson = (participantId: string, personId: string) => {
		fetcher.submit(
			{
				participant_id: participantId,
				person_id: personId,
			},
			{ method: "post", action: "/api/link-interview-participant" }
		)
		setOpenPopoverId(null)
	}

	const unlinkPerson = (participantId: string) => {
		fetcher.submit(
			{
				participant_id: participantId,
				person_id: "",
			},
			{ method: "post", action: "/api/link-interview-participant" }
		)
	}

	const createAndLinkPerson = (participantId: string, name: string) => {
		fetcher.submit(
			{
				participant_id: participantId,
				create_person: "true",
				person_name: name,
				interview_id: interviewId,
			},
			{ method: "post", action: "/api/link-interview-participant" }
		)
		setOpenPopoverId(null)
		setSearchInput("")
	}

	// Add a brand new participant to the interview (not linking an existing speaker)
	const addNewParticipant = (name: string) => {
		if (!name.trim()) return
		fetcher.submit(
			{
				intent: "add-participant",
				personId: "", // Will create new person
				create_person: "true",
				person_name: name.trim(),
			},
			{ method: "post" }
		)
		setShowAddPersonDialog(false)
		setNewPersonName("")
	}

	// Add an existing person as a new participant
	const addExistingPersonAsParticipant = (personId: string) => {
		fetcher.submit(
			{
				intent: "add-participant",
				personId,
			},
			{ method: "post" }
		)
	}

	// Format transcript key to a clean speaker label
	// Handles both AssemblyAI format ("A", "SPEAKER A") and BAML format ("participant-1", "interviewer-1")
	const formatSpeakerLabel = (transcriptKey: string | null, idx: number): string => {
		if (!transcriptKey) return `Speaker ${idx + 1}`

		// Single letter like "A", "B" -> "Speaker A", "Speaker B"
		if (/^[A-Z]$/i.test(transcriptKey)) {
			return `Speaker ${transcriptKey.toUpperCase()}`
		}
		// Already formatted like "SPEAKER A", "Speaker B" -> "Speaker A"
		if (/^SPEAKER\s+[A-Z]$/i.test(transcriptKey)) {
			return `Speaker ${transcriptKey.split(/\s+/)[1].toUpperCase()}`
		}
		// BAML format: "participant-1" -> "Participant 1", "interviewer-1" -> "Interviewer 1"
		if (/^(participant|interviewer|observer|moderator)-\d+$/i.test(transcriptKey)) {
			const [role, num] = transcriptKey.split("-")
			return `${role.charAt(0).toUpperCase()}${role.slice(1)} ${num}`
		}
		// Fallback - just use the key
		return transcriptKey
	}

	return (
		<>
			<div className="space-y-3">
				<div className="space-y-2">
					{participants.map((participant, idx) => {
						const speakerLabel = formatSpeakerLabel(participant.transcript_key, idx)
						const linkedPerson = participant.people

						return (
							<div key={participant.id} className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
								<div className="min-w-[80px] font-medium text-sm">{speakerLabel}</div>

								{linkedPerson ? (
									<>
										<Check className="h-4 w-4 shrink-0 text-green-600" />
										<span className="text-muted-foreground text-sm">Linked to:</span>
										<span className="font-medium text-sm">{linkedPerson.name || "Unnamed"}</span>
										<Button
											variant="ghost"
											size="icon"
											className="ml-auto h-7 w-7"
											onClick={() => unlinkPerson(participant.id)}
											disabled={fetcher.state !== "idle"}
										>
											<X className="h-3.5 w-3.5" />
										</Button>
									</>
								) : (
									<span className="text-muted-foreground text-sm">Not linked</span>
								)}

								<Popover
									open={openPopoverId === participant.id}
									onOpenChange={(open) => {
										setOpenPopoverId(open ? participant.id : null)
										if (!open) setSearchInput("")
									}}
								>
									<PopoverTrigger asChild>
										<Button
											variant="outline"
											size="sm"
											className={cn("h-7 text-xs", linkedPerson ? "" : "ml-auto")}
											disabled={fetcher.state !== "idle"}
										>
											{linkedPerson ? "Change Person" : "Link Person"}
											<ChevronDown className="ml-1 h-3.5 w-3.5" />
										</Button>
									</PopoverTrigger>
									<PopoverContent className="w-[280px] p-0" align="end">
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
													{availablePeople.map((person) => (
														<CommandItem
															key={person.id}
															value={person.name || person.id}
															onSelect={() => linkPerson(participant.id, person.id)}
														>
															<Check
																className={cn(
																	"mr-2 h-4 w-4",
																	linkedPerson?.id === person.id ? "opacity-100" : "opacity-0"
																)}
															/>
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
																createAndLinkPerson(participant.id, searchInput.trim())
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
							</div>
						)
					})}
				</div>

				{/* Add new participant button */}
				<Button
					variant="outline"
					size="sm"
					className="w-full gap-2"
					onClick={() => setShowAddPersonDialog(true)}
					disabled={fetcher.state !== "idle"}
				>
					<UserPlus className="h-4 w-4" />
					Add Participant
				</Button>
			</div>

			{/* Add New Participant Dialog */}
			<Dialog open={showAddPersonDialog} onOpenChange={setShowAddPersonDialog}>
				<DialogContent className="sm:max-w-[400px]">
					<DialogHeader>
						<DialogTitle>Add Participant</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<p className="text-muted-foreground text-sm">
							Add a person who participated in this interview but wasn't detected as a speaker.
						</p>
						<div className="space-y-2">
							<Label>Select existing person</Label>
							<Command className="rounded-lg border">
								<CommandInput placeholder="Search people..." />
								<CommandList className="max-h-[150px]">
									<CommandEmpty>No people found</CommandEmpty>
									<CommandGroup>
										{availablePeople.map((person) => (
											<CommandItem
												key={person.id}
												value={person.name || person.id}
												onSelect={() => {
													addExistingPersonAsParticipant(person.id)
													setShowAddPersonDialog(false)
												}}
											>
												{person.name || "Unnamed Person"}
											</CommandItem>
										))}
									</CommandGroup>
								</CommandList>
							</Command>
						</div>

						<div className="relative">
							<div className="absolute inset-0 flex items-center">
								<span className="w-full border-t" />
							</div>
							<div className="relative flex justify-center text-xs uppercase">
								<span className="bg-background px-2 text-muted-foreground">Or create new</span>
							</div>
						</div>

						<div className="space-y-2">
							<Label htmlFor="new-person-name">New person name</Label>
							<Input
								id="new-person-name"
								placeholder="Enter name..."
								value={newPersonName}
								onChange={(e) => setNewPersonName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter" && newPersonName.trim()) {
										e.preventDefault()
										addNewParticipant(newPersonName)
									}
								}}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setShowAddPersonDialog(false)}>
							Cancel
						</Button>
						<Button
							onClick={() => addNewParticipant(newPersonName)}
							disabled={!newPersonName.trim() || fetcher.state !== "idle"}
						>
							Create & Add
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}
