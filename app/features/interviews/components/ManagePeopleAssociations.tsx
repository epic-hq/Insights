import { Check, ChevronDown, Plus, UserPlus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFetcher } from "react-router-dom";
import { Button } from "~/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "~/components/ui/command";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";

export interface InterviewPerson {
	id: string;
	role: string | null;
	transcript_key: string | null;
	display_name: string | null;
	people: {
		id: string;
		name: string | null;
		person_type?: string | null;
	} | null;
}

export interface Person {
	id: string;
	name: string | null;
	person_type?: string | null;
}

/** A speaker detected in the transcript */
export interface TranscriptSpeaker {
	/** The transcript key (e.g., "participant-1", "A") */
	key: string;
	/** Display label (e.g., "Speaker B") */
	label: string;
}

interface ManagePeopleAssociationsProps {
	interviewId: string;
	participants: InterviewPerson[];
	availablePeople: Person[];
	/** Speakers detected in the transcript (from speaker_transcripts) */
	transcriptSpeakers?: TranscriptSpeaker[];
	onUpdate?: () => void;
}

export function ManagePeopleAssociations({
	interviewId,
	participants,
	availablePeople,
	transcriptSpeakers = [],
	onUpdate,
}: ManagePeopleAssociationsProps) {
	const fetcher = useFetcher();
	const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
	const [showAddPersonDialog, setShowAddPersonDialog] = useState(false);
	const [newPersonName, setNewPersonName] = useState("");
	const [selectedSpeakerKey, setSelectedSpeakerKey] = useState<string | null>(null);
	const [newPersonFirst, setNewPersonFirst] = useState("");
	const [newPersonLast, setNewPersonLast] = useState("");
	const [newPersonOrg, setNewPersonOrg] = useState("");
	const [newPersonTitle, setNewPersonTitle] = useState("");
	const [voiceStatus, setVoiceStatus] = useState<"idle" | "listening" | "unsupported">("idle");
	const recognitionRef = useRef<SpeechRecognition | null>(null);
	const [searchInput, setSearchInput] = useState("");
	const [addDialogMode, setAddDialogMode] = useState<"search" | "create">("search");
	const [addSearchInput, setAddSearchInput] = useState("");
	const [submitError, setSubmitError] = useState<string | null>(null);
	const isSubmitting = fetcher.state !== "idle";
	const voiceStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const shouldNotifyOnIdleRef = useRef(false);
	const onUpdateRef = useRef(onUpdate);
	const pendingAddDialogCloseRef = useRef(false);

	// Calculate which transcript speakers are not yet assigned to a participant
	const unassignedSpeakers = useMemo(() => {
		const assignedKeys = new Set(participants.map((p) => p.transcript_key).filter((k): k is string => k !== null));
		return transcriptSpeakers.filter((s) => !assignedKeys.has(s.key));
	}, [participants, transcriptSpeakers]);

	useEffect(() => {
		onUpdateRef.current = onUpdate;
	}, [onUpdate]);

	useEffect(() => {
		if (fetcher.state !== "idle") {
			shouldNotifyOnIdleRef.current = true;
			return;
		}
		if (shouldNotifyOnIdleRef.current && fetcher.data) {
			shouldNotifyOnIdleRef.current = false;
			const result = fetcher.data as { ok?: boolean; error?: string } | undefined;
			if (result?.ok === false) {
				setSubmitError(result.error || "Failed to update participant");
				pendingAddDialogCloseRef.current = false;
				return;
			}
			setSubmitError(null);
			onUpdateRef.current?.();
			if (pendingAddDialogCloseRef.current) {
				pendingAddDialogCloseRef.current = false;
				setShowAddPersonDialog(false);
				setAddDialogMode("search");
				setAddSearchInput("");
				setSelectedSpeakerKey(null);
				setNewPersonName("");
				setNewPersonFirst("");
				setNewPersonLast("");
				setNewPersonOrg("");
				setNewPersonTitle("");
			}
		}
	}, [fetcher.state, fetcher.data]);

	const linkPerson = (participantId: string, personId: string) => {
		setSubmitError(null);
		pendingAddDialogCloseRef.current = false;
		fetcher.submit(
			{
				participant_id: participantId,
				person_id: personId,
			},
			{ method: "post", action: "/api/link-interview-participant" }
		);
		setOpenPopoverId(null);
	};

	const unlinkPerson = (participantId: string) => {
		// Remove the participant-person link by deleting the participant row.
		// We use the page action so RLS/account scoping stays consistent.
		setSubmitError(null);
		pendingAddDialogCloseRef.current = false;
		fetcher.submit(
			{
				intent: "remove-participant",
				interviewPersonId: participantId,
			},
			{ method: "post" }
		);
		setOpenPopoverId(null);
	};

	const createAndLinkPerson = (participantId: string, name: string) => {
		setSubmitError(null);
		pendingAddDialogCloseRef.current = false;
		fetcher.submit(
			{
				participant_id: participantId,
				create_person: "true",
				person_name: name,
				interview_id: interviewId,
			},
			{ method: "post", action: "/api/link-interview-participant" }
		);
		setOpenPopoverId(null);
		setSearchInput("");
	};

	// Add an existing person as a new participant
	const addExistingParticipant = (personId: string) => {
		setSubmitError(null);
		pendingAddDialogCloseRef.current = true;
		fetcher.submit(
			{
				intent: "add-participant",
				personId,
				...(selectedSpeakerKey && { transcript_key: selectedSpeakerKey }),
			},
			{ method: "post" }
		);
	};

	// Add a brand new participant to the interview (not linking an existing speaker)
	const addNewParticipant = (name: string) => {
		const first = newPersonFirst.trim();
		const last = newPersonLast.trim();
		const org = newPersonOrg.trim();
		const title = newPersonTitle.trim();
		const fallbackName = name.trim();
		if (!first && !fallbackName) return;
		const submitName = first && last ? `${first} ${last}` : first || fallbackName;
		setSubmitError(null);
		pendingAddDialogCloseRef.current = true;
		fetcher.submit(
			{
				intent: "add-participant",
				personId: "", // Will create new person
				create_person: "true",
				person_name: submitName,
				person_firstname: first || undefined,
				person_lastname: last || undefined,
				person_company: org || undefined,
				person_title: title || undefined,
				...(selectedSpeakerKey && { transcript_key: selectedSpeakerKey }),
			},
			{ method: "post" }
		);
		setVoiceStatus("idle");
		stopVoiceFill();
	};

	// Format transcript key to a clean speaker label
	// Handles both AssemblyAI format ("A", "SPEAKER A") and BAML format ("participant-1", "interviewer-1")
	const numberToLetter = (num: number, zeroBased = false) => {
		const adjusted = zeroBased ? num + 1 : num; // 0-based: 0->A, 1->B; 1-based: 1->A, 2->B
		if (Number.isNaN(adjusted) || adjusted < 1) return null;
		if (adjusted <= 26) return String.fromCharCode(64 + adjusted);
		return null;
	};
	const nextAvailableLetter = (used: Set<string>) => {
		for (let code = 65; code <= 90; code++) {
			const letter = String.fromCharCode(code);
			if (!used.has(letter)) return letter;
		}
		return null;
	};
	const formatSpeakerLabel = (transcriptKey: string | null, _idx: number): string => {
		if (!transcriptKey) {
			// No transcript_key means this person is linked to the interview
			// but NOT to a specific speaker in the transcript
			return "Unlinked";
		}

		// Single letter like "A", "B" -> "Speaker A", "Speaker B"
		if (/^[A-Z]$/i.test(transcriptKey)) {
			return `Speaker ${transcriptKey.toUpperCase()}`;
		}
		// Already formatted like "SPEAKER A", "Speaker B" -> "Speaker A"
		if (/^SPEAKER\s+[A-Z]$/i.test(transcriptKey)) {
			return `Speaker ${transcriptKey.split(/\s+/)[1].toUpperCase()}`;
		}
		// "Speaker 1" / "speaker-2" -> "Speaker A/B"
		const speakerNumberMatch = transcriptKey.match(/^speaker[\s_-]?(\d+)$/i);
		if (speakerNumberMatch) {
			const num = Number.parseInt(speakerNumberMatch[1], 10);
			const letter = numberToLetter(num);
			return letter ? `Speaker ${letter}` : `Speaker ${num}`;
		}
		// BAML/fallback format: "participant-0" / "participant-1" -> Speaker A/B (0-based)
		if (/^(participant|interviewer|observer|moderator)-\d+$/i.test(transcriptKey)) {
			const [, numStr] = transcriptKey.split("-");
			const num = Number.parseInt(numStr, 10);
			const letter = numberToLetter(num, true); // 0-based numbering
			return letter ? `Speaker ${letter}` : `Speaker ${num + 1}`;
		}
		// Fallback - just use the key
		return transcriptKey;
	};

	const stopVoiceFill = () => {
		if (voiceStopTimer.current) {
			clearTimeout(voiceStopTimer.current);
			voiceStopTimer.current = null;
		}
		if (recognitionRef.current) {
			recognitionRef.current.stop();
			recognitionRef.current.onresult = null as any;
			recognitionRef.current.onerror = null as any;
			recognitionRef.current.onend = null as any;
			recognitionRef.current = null;
		}
		setVoiceStatus("idle");
	};

	const startVoiceFill = () => {
		if (typeof window === "undefined") {
			setVoiceStatus("unsupported");
			return;
		}
		const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
		if (!SpeechRec) {
			setVoiceStatus("unsupported");
			return;
		}

		const rec: SpeechRecognition = new SpeechRec();
		recognitionRef.current = rec;
		rec.lang = "en-US";
		rec.interimResults = false;
		rec.maxAlternatives = 1;
		rec.continuous = true;

		rec.onstart = () => setVoiceStatus("listening");
		rec.onerror = () => setVoiceStatus("idle");
		rec.onend = () => setVoiceStatus("idle");
		rec.onresult = (event) => {
			const transcript = event.results[0][0].transcript || "";
			// Heuristic parsing: "<first> <last> at <org> title <title>"
			const parts = transcript.trim();
			const atSplit = parts.split(/\bat\b/i);
			const nameAndTitle = atSplit[0]?.trim() || "";
			const org = atSplit[1]?.trim() || "";

			const nameTokens = nameAndTitle.split(/\s+/).filter(Boolean);
			const first = nameTokens[0] ?? "";
			const last = nameTokens[1] ?? "";
			const maybeTitle = nameTokens.slice(2).join(" ");

			setNewPersonFirst(first);
			setNewPersonLast(last);
			if (maybeTitle) setNewPersonTitle(maybeTitle);
			if (org) setNewPersonOrg(org);
			setNewPersonName(parts);
		};

		rec.start();
		voiceStopTimer.current = setTimeout(() => {
			stopVoiceFill();
		}, 6000);
	};

	useEffect(() => {
		return () => {
			stopVoiceFill();
		};
	}, []);

	// Avoid duplicate speaker labels by shifting to the next unused letter
	const usedSpeakerLetters = new Set<string>();

	return (
		<>
			<div className="space-y-3">
				{submitError && (
					<div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
						{submitError}
					</div>
				)}
				<div className="space-y-2">
					{participants.map((participant, idx) => {
						let speakerLabel = formatSpeakerLabel(participant.transcript_key, idx);
						const letterMatch = speakerLabel.match(/^Speaker\s+([A-Z])$/i);
						if (letterMatch) {
							const letter = letterMatch[1].toUpperCase();
							if (usedSpeakerLetters.has(letter)) {
								const alt = nextAvailableLetter(usedSpeakerLetters);
								if (alt) {
									speakerLabel = `Speaker ${alt}`;
									usedSpeakerLetters.add(alt);
								}
							} else {
								usedSpeakerLetters.add(letter);
							}
						}
						const linkedPerson = participant.people;

						const isUnlinked = speakerLabel === "Unlinked";

						return (
							<div
								key={participant.id}
								className={cn(
									"flex items-center gap-2 rounded-md border px-3 py-2",
									isUnlinked ? "border-muted-foreground/40 border-dashed bg-muted/10" : "bg-muted/30"
								)}
							>
								<div
									className={cn("min-w-[100px] text-sm", isUnlinked ? "text-muted-foreground italic" : "font-medium")}
								>
									{speakerLabel}
								</div>

								{linkedPerson ? <Check className="h-4 w-4 shrink-0 text-green-600" /> : <div className="h-4 w-4" />}

								<Popover
									open={openPopoverId === participant.id}
									onOpenChange={(open) => {
										setOpenPopoverId(open ? participant.id : null);
										if (!open) setSearchInput("");
									}}
								>
									<PopoverTrigger asChild>
										<Button
											variant="outline"
											size="sm"
											className={cn(
												"flex h-8 min-w-[200px] items-center justify-between text-sm",
												linkedPerson ? "" : "text-muted-foreground"
											)}
											disabled={isSubmitting}
										>
											<div className="flex items-center gap-2 truncate">
												<span className="text-muted-foreground text-xs">
													{linkedPerson ? "Linked to" : "Link person"}
												</span>
												<div className="flex items-center gap-2 truncate">
													<span className="truncate font-medium text-foreground">
														{linkedPerson ? linkedPerson.name || "Unnamed" : "Select person"}
													</span>
													{linkedPerson?.person_type === "internal" && (
														<span className="rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-[10px] text-blue-800 uppercase tracking-wide">
															Team
														</span>
													)}
												</div>
											</div>
											<ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0" />
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
															<div className="flex items-center gap-2">
																<span>{person.name || "Unnamed Person"}</span>
																{person.person_type === "internal" && (
																	<span className="rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-[10px] text-blue-800 uppercase tracking-wide">
																		Team
																	</span>
																)}
															</div>
														</CommandItem>
													))}
												</CommandGroup>
												<CommandSeparator />
												<CommandGroup>
													<CommandItem
														value={`create-new-${searchInput}`}
														onSelect={() => {
															if (searchInput.trim()) {
																const tokens = searchInput.trim().split(/\s+/);
																const firstGuess = tokens[0] ?? "";
																const lastGuess = tokens.length > 1 ? tokens.slice(1).join(" ") : "";
																setNewPersonFirst(firstGuess);
																setNewPersonLast(lastGuess);
																setNewPersonName(searchInput.trim());
																setShowAddPersonDialog(true);
															}
															setOpenPopoverId(null);
														}}
														className="text-primary"
													>
														<Plus className="mr-2 h-4 w-4" />
														{searchInput.trim() ? `Create "${searchInput.trim()}"` : "Create new person..."}
													</CommandItem>
												</CommandGroup>
											</CommandList>
										</Command>
									</PopoverContent>
								</Popover>

								{linkedPerson ? (
									<Button
										variant="ghost"
										size="icon"
										className="ml-auto h-7 w-7 text-muted-foreground hover:text-foreground"
										onClick={() => unlinkPerson(participant.id)}
										disabled={isSubmitting}
										aria-label="Remove linked person"
									>
										<X className="h-3.5 w-3.5" />
									</Button>
								) : null}
							</div>
						);
					})}
				</div>

				{/* Add new participant button */}
				<Button
					variant="outline"
					size="sm"
					className="w-full gap-2"
					onClick={() => setShowAddPersonDialog(true)}
					disabled={isSubmitting}
				>
					<UserPlus className="h-4 w-4" />
					Add Participant
				</Button>
			</div>

			{/* Add Participant Dialog - Search first, then create */}
			<Dialog
				open={showAddPersonDialog}
				onOpenChange={(open) => {
					setShowAddPersonDialog(open);
					if (!open) {
						setSubmitError(null);
						setAddDialogMode("search");
						setAddSearchInput("");
						setSelectedSpeakerKey(null);
						pendingAddDialogCloseRef.current = false;
					}
				}}
			>
				<DialogContent className="sm:max-w-[400px]">
					<DialogHeader>
						<DialogTitle>Add Participant</DialogTitle>
					</DialogHeader>

					{/* Speaker Selection - show if there are unassigned speakers */}
					{unassignedSpeakers.length > 0 && (
						<div className="space-y-2 border-b pb-4">
							<Label className="font-medium text-sm">Link to transcript speaker (optional)</Label>
							<div className="flex flex-wrap gap-2">
								<Button
									type="button"
									variant={selectedSpeakerKey === null ? "default" : "outline"}
									size="sm"
									onClick={() => setSelectedSpeakerKey(null)}
								>
									No speaker
								</Button>
								{unassignedSpeakers.map((speaker) => (
									<Button
										key={speaker.key}
										type="button"
										variant={selectedSpeakerKey === speaker.key ? "default" : "outline"}
										size="sm"
										onClick={() => setSelectedSpeakerKey(speaker.key)}
									>
										{speaker.label}
									</Button>
								))}
							</div>
							{selectedSpeakerKey && (
								<p className="text-muted-foreground text-xs">
									This person will be linked to{" "}
									{unassignedSpeakers.find((s) => s.key === selectedSpeakerKey)?.label || selectedSpeakerKey} in the
									transcript.
								</p>
							)}
						</div>
					)}

					{addDialogMode === "search" ? (
						<div className="space-y-4 py-4">
							<p className="text-muted-foreground text-sm">Search for an existing person or create a new one.</p>
							<Command className="rounded-lg border">
								<CommandInput placeholder="Search people..." value={addSearchInput} onValueChange={setAddSearchInput} />
								<CommandList className="max-h-[200px]">
									<CommandEmpty>
										<p className="py-2 text-center text-muted-foreground text-sm">No people found</p>
									</CommandEmpty>
									<CommandGroup>
										{availablePeople
											.filter((p) => {
												if (!addSearchInput.trim()) return true;
												return p.name?.toLowerCase().includes(addSearchInput.toLowerCase());
											})
											.map((person) => (
												<CommandItem
													key={person.id}
													value={person.name || person.id}
													onSelect={() => addExistingParticipant(person.id)}
												>
													<div className="flex items-center gap-2">
														<span>{person.name || "Unnamed Person"}</span>
														{person.person_type === "internal" && (
															<span className="rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-[10px] text-blue-800 uppercase tracking-wide">
																Team
															</span>
														)}
													</div>
												</CommandItem>
											))}
									</CommandGroup>
									<CommandSeparator />
									<CommandGroup>
										<CommandItem
											value={`create-new-${addSearchInput}`}
											onSelect={() => {
												if (addSearchInput.trim()) {
													const tokens = addSearchInput.trim().split(/\s+/);
													setNewPersonFirst(tokens[0] ?? "");
													setNewPersonLast(tokens.length > 1 ? tokens.slice(1).join(" ") : "");
													setNewPersonName(addSearchInput.trim());
												}
												setAddDialogMode("create");
											}}
											className="text-primary"
										>
											<Plus className="mr-2 h-4 w-4" />
											{addSearchInput.trim() ? `Create "${addSearchInput.trim()}"` : "Create new person..."}
										</CommandItem>
									</CommandGroup>
								</CommandList>
							</Command>
						</div>
					) : (
						<div className="space-y-4 py-4">
							<Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => setAddDialogMode("search")}>
								← Back to search
							</Button>
							<div className="grid grid-cols-2 gap-3">
								<div className="space-y-2">
									<Label htmlFor="new-person-first">First name</Label>
									<Input
										id="new-person-first"
										placeholder="First name"
										value={newPersonFirst}
										onChange={(e) => setNewPersonFirst(e.target.value)}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="new-person-last">Last name</Label>
									<Input
										id="new-person-last"
										placeholder="Last name"
										value={newPersonLast}
										onChange={(e) => setNewPersonLast(e.target.value)}
									/>
								</div>
							</div>
							<div className="space-y-2">
								<Label htmlFor="new-person-org">Organization</Label>
								<Input
									id="new-person-org"
									placeholder="Organization"
									value={newPersonOrg}
									onChange={(e) => setNewPersonOrg(e.target.value)}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="new-person-title">Title (optional)</Label>
								<Input
									id="new-person-title"
									placeholder="e.g., Product Manager"
									value={newPersonTitle}
									onChange={(e) => setNewPersonTitle(e.target.value)}
								/>
							</div>
							<div className="flex items-center gap-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={startVoiceFill}
									disabled={voiceStatus === "listening"}
								>
									{voiceStatus === "listening" ? "Listening..." : "Speak it in"}
								</Button>
								{voiceStatus === "unsupported" && (
									<span className="text-muted-foreground text-xs">Voice fill not supported in this browser</span>
								)}
							</div>
						</div>
					)}

					<DialogFooter>
						<Button variant="outline" onClick={() => setShowAddPersonDialog(false)}>
							Cancel
						</Button>
						{addDialogMode === "create" && (
							<Button
								onClick={() => addNewParticipant(newPersonName || `${newPersonFirst} ${newPersonLast}`)}
								disabled={(!newPersonFirst.trim() && !newPersonName.trim()) || isSubmitting}
							>
								Create & Add
							</Button>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
