import { Check, ChevronDown, Plus, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useFetcher } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "~/components/ui/command"
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
		<div className="space-y-2">
			<h4 className="font-medium text-sm">Interview Participants</h4>
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
								onOpenChange={(open) => setOpenPopoverId(open ? participant.id : null)}
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
										<CommandInput placeholder="Search or create..." />
										<CommandList>
											<CommandEmpty>
												<Button
													variant="ghost"
													className="w-full justify-start"
													onClick={() => {
														const input = document.querySelector<HTMLInputElement>("[cmdk-input]")
														const name = input?.value || ""
														if (name.trim()) {
															createAndLinkPerson(participant.id, name.trim())
														}
													}}
												>
													<Plus className="mr-2 h-4 w-4" />
													Create new person
												</Button>
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
										</CommandList>
									</Command>
								</PopoverContent>
							</Popover>
						</div>
					)
				})}
			</div>
		</div>
	)
}
