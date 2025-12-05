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

	return (
		<div className="space-y-3">
			<h4 className="font-medium text-sm">Interview Participants</h4>
			<div className="space-y-2">
				{participants.map((participant, idx) => {
					const speakerLabel = participant.transcript_key
						? `Speaker ${participant.transcript_key}`
						: participant.display_name || `Participant ${idx + 1}`

					const linkedPerson = participant.people

					return (
						<div key={participant.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
							<div className="flex flex-1 items-center gap-3">
								<div className="min-w-[120px] font-medium text-sm">{speakerLabel}</div>
								{linkedPerson ? (
									<div className="flex items-center gap-2">
										<Check className="h-4 w-4 text-green-600" />
										<span className="text-muted-foreground text-sm">Linked to:</span>
										<span className="font-medium text-sm">{linkedPerson.name || "Unnamed Person"}</span>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => unlinkPerson(participant.id)}
											disabled={fetcher.state !== "idle"}
										>
											<X className="h-4 w-4" />
										</Button>
									</div>
								) : (
									<span className="text-muted-foreground text-sm">Not linked to anyone</span>
								)}
							</div>

							<Popover
								open={openPopoverId === participant.id}
								onOpenChange={(open) => setOpenPopoverId(open ? participant.id : null)}
							>
								<PopoverTrigger asChild>
									<Button variant="outline" size="sm" disabled={fetcher.state !== "idle"}>
										{linkedPerson ? "Change Person" : "Link Person"}
										<ChevronDown className="ml-2 h-4 w-4" />
									</Button>
								</PopoverTrigger>
								<PopoverContent className="w-[300px] p-0" align="end">
									<Command>
										<CommandInput placeholder="Search people or create new..." />
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
