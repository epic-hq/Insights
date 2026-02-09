import {
	CheckCircle,
	CheckSquare,
	ChevronLeft,
	Loader2,
	Mic,
	Search,
	Square,
	StickyNote,
	UserPlus,
	Users,
	X,
} from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { useSpeechToText } from "~/features/voice/hooks/use-speech-to-text";
import { createClient } from "~/lib/supabase/client";
import { cn } from "~/lib/utils";

export type NoteType = "note" | "task";

type DialogStep = "content" | "associate";

interface NoteAssociations {
	people?: string[];
	organizations?: string[];
	opportunities?: string[];
}

interface Person {
	id: string;
	name: string | null;
	company?: string | null;
	default_organization?: { name: string | null } | null;
}

interface QuickNoteDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSave: (data: {
		title: string;
		content: string;
		noteType: NoteType;
		associations: NoteAssociations;
		tags: string[];
	}) => Promise<void>;
	projectId?: string;
	defaultAssociations?: NoteAssociations;
	availablePeople?: Array<{ id: string; name: string }>;
	availableOrgs?: Array<{ id: string; name: string }>;
	availableOpportunities?: Array<{ id: string; name: string }>;
	defaultType?: NoteType;
}

export function QuickNoteDialog({
	open,
	onOpenChange,
	onSave,
	projectId,
	defaultAssociations = {},
	availablePeople = [],
	availableOrgs = [],
	availableOpportunities = [],
	defaultType = "note",
}: QuickNoteDialogProps) {
	const titleId = useId();
	const contentId = useId();
	const tagsId = useId();

	const [step, setStep] = useState<DialogStep>("content");
	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [noteType, setNoteType] = useState<NoteType>(defaultType);
	const [associations, setAssociations] = useState<NoteAssociations>(defaultAssociations);
	const [tags, setTags] = useState<string[]>([]);
	const [tagInput, setTagInput] = useState("");
	const [isSaving, setIsSaving] = useState(false);

	// People fetching for association step
	const [people, setPeople] = useState<Person[]>([]);
	const [selectedPeople, setSelectedPeople] = useState<Person[]>([]);
	const [isLoadingPeople, setIsLoadingPeople] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [showCreatePerson, setShowCreatePerson] = useState(false);
	const [newPersonFirstName, setNewPersonFirstName] = useState("");
	const [newPersonLastName, setNewPersonLastName] = useState("");
	const [newPersonCompany, setNewPersonCompany] = useState("");
	const supabase = createClient();

	// Fetch people when entering association step
	useEffect(() => {
		if (step === "associate" && projectId && !isLoadingPeople && people.length === 0) {
			setIsLoadingPeople(true);
			supabase
				.from("people")
				.select("id, name, company, default_organization:organizations!default_organization_id(name)")
				.eq("project_id", projectId)
				.order("name")
				.then(({ data }) => {
					if (data) setPeople(data as Person[]);
				})
				.finally(() => setIsLoadingPeople(false));
		}
	}, [step, projectId, isLoadingPeople, people.length, supabase]);

	// Reset state when dialog closes
	useEffect(() => {
		if (!open) {
			setStep("content");
			setSelectedPeople([]);
			setSearchQuery("");
			setShowCreatePerson(false);
			setNewPersonFirstName("");
			setNewPersonLastName("");
			setNewPersonCompany("");
		}
	}, [open]);

	// Speech-to-text for voice input
	const handleVoiceTranscription = useCallback((transcript: string) => {
		const trimmed = transcript.trim();
		if (trimmed) {
			setContent((prev) => (prev ? `${prev}\n\n${trimmed}` : trimmed));
		}
	}, []);

	const {
		startRecording,
		stopRecording,
		isRecording: isVoiceRecording,
		isTranscribing,
		error: voiceError,
		isSupported: isVoiceSupported,
	} = useSpeechToText({ onTranscription: handleVoiceTranscription });

	// Proceed to association step
	const handleNext = () => {
		// For tasks, title is required; for notes, content is required
		if (noteType === "task" && !title.trim()) return;
		if (noteType === "note" && !content.trim()) return;

		// If projectId provided, go to association step; otherwise save directly
		if (projectId) {
			setStep("associate");
		} else {
			handleSave();
		}
	};

	const handleSave = async () => {
		setIsSaving(true);
		try {
			const defaultTitle =
				noteType === "task" ? `Task - ${new Date().toLocaleDateString()}` : `Note - ${new Date().toLocaleDateString()}`;

			// Create new person if needed
			const personIds: string[] = selectedPeople.map((p) => p.id);
			if (showCreatePerson && newPersonFirstName.trim() && projectId) {
				const { data, error } = await supabase
					.from("people")
					.insert({
						name: `${newPersonFirstName.trim()} ${newPersonLastName.trim()}`.trim(),
						project_id: projectId,
						company: newPersonCompany.trim() || null,
					})
					.select()
					.single();

				if (!error && data) {
					personIds.push(data.id);
				}
			}

			await onSave({
				title: title || defaultTitle,
				content,
				noteType,
				associations: {
					...associations,
					people: personIds.length > 0 ? personIds : associations.people,
				},
				tags,
			});

			// Reset form
			setTitle("");
			setContent("");
			setNoteType(defaultType);
			setAssociations({});
			setTags([]);
			setTagInput("");
			setStep("content");
			setSelectedPeople([]);
			onOpenChange(false);
		} catch (error) {
			console.error("Failed to save note:", error);
		} finally {
			setIsSaving(false);
		}
	};

	// Filter people based on search
	const filteredPeople = searchQuery.trim()
		? people.filter(
				(p) => {
					const orgName = p.default_organization?.name;
					return (
						p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
						orgName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
						p.company?.toLowerCase().includes(searchQuery.toLowerCase())
					);
				}
			)
		: people.slice(0, 8);

	const addTag = () => {
		const tag = tagInput.trim().toLowerCase();
		if (tag && !tags.includes(tag)) {
			setTags([...tags, tag]);
			setTagInput("");
		}
	};

	const removeTag = (tag: string) => {
		setTags(tags.filter((t) => t !== tag));
	};

	const togglePerson = (personId: string) => {
		const current = associations.people || [];
		setAssociations({
			...associations,
			people: current.includes(personId) ? current.filter((id) => id !== personId) : [...current, personId],
		});
	};

	const toggleOrg = (orgId: string) => {
		const current = associations.organizations || [];
		setAssociations({
			...associations,
			organizations: current.includes(orgId) ? current.filter((id) => id !== orgId) : [...current, orgId],
		});
	};

	const toggleOpportunity = (oppId: string) => {
		const current = associations.opportunities || [];
		setAssociations({
			...associations,
			opportunities: current.includes(oppId) ? current.filter((id) => id !== oppId) : [...current, oppId],
		});
	};

	// Association step UI
	if (step === "associate") {
		return (
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => setStep("content")}
								className="text-muted-foreground hover:text-foreground"
							>
								<ChevronLeft className="h-5 w-5" />
							</button>
							<DialogTitle>Link to People</DialogTitle>
						</div>
						<DialogDescription>Associate this {noteType} with people (optional)</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						{!showCreatePerson ? (
							<>
								{/* Search */}
								<div className="relative">
									<Search className="absolute top-3 left-3 h-4 w-4 text-slate-400" />
									<Input
										placeholder="Search people..."
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
										className="pl-9"
									/>
								</div>

								{/* People List */}
								<div className="max-h-64 space-y-2 overflow-y-auto">
									{isLoadingPeople ? (
										<p className="py-4 text-center text-muted-foreground text-sm">Loading...</p>
									) : filteredPeople.length === 0 ? (
										<p className="py-4 text-center text-muted-foreground text-sm">
											{searchQuery ? "No people found" : "No people in this project yet"}
										</p>
									) : (
										filteredPeople.map((person) => {
											const isSelected = selectedPeople.some((p) => p.id === person.id);
											return (
												<button
													key={person.id}
													type="button"
													onClick={() =>
														setSelectedPeople((prev) =>
															isSelected ? prev.filter((p) => p.id !== person.id) : [...prev, person]
														)
													}
													className={cn(
														"flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all",
														isSelected
															? "border-blue-500 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/30"
															: "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
													)}
												>
													<div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-slate-400 to-slate-500 text-white">
														<Users className="h-5 w-5" />
													</div>
													<div className="min-w-0 flex-1">
														<p className="truncate font-medium text-sm">{person.name}</p>
														{(person.default_organization?.name || person.company) && (
															<p className="truncate text-muted-foreground text-xs">{person.default_organization?.name || person.company}</p>
														)}
													</div>
													{isSelected && <CheckCircle className="h-5 w-5 flex-shrink-0 text-blue-500" />}
												</button>
											);
										})
									)}
								</div>

								{/* Create New */}
								<button
									type="button"
									onClick={() => setShowCreatePerson(true)}
									className="flex w-full items-center gap-3 rounded-lg border border-slate-300 border-dashed p-3 text-left transition-colors hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:hover:border-slate-500 dark:hover:bg-slate-800"
								>
									<div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-slate-300 dark:border-slate-600">
										<UserPlus className="h-5 w-5 text-slate-400" />
									</div>
									<span className="font-medium text-muted-foreground text-sm">Add new person</span>
								</button>
							</>
						) : (
							/* Create Person Form */
							<div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
								<div className="flex items-center justify-between">
									<h3 className="font-medium text-sm">New Person</h3>
									<button
										type="button"
										onClick={() => {
											setShowCreatePerson(false);
											setNewPersonFirstName("");
											setNewPersonLastName("");
											setNewPersonCompany("");
										}}
										className="text-muted-foreground text-xs hover:text-foreground"
									>
										Cancel
									</button>
								</div>
								<div className="grid grid-cols-2 gap-3">
									<Input
										placeholder="First name"
										value={newPersonFirstName}
										onChange={(e) => setNewPersonFirstName(e.target.value)}
										autoFocus
									/>
									<Input
										placeholder="Last name"
										value={newPersonLastName}
										onChange={(e) => setNewPersonLastName(e.target.value)}
									/>
								</div>
								<Input
									placeholder="Company (optional)"
									value={newPersonCompany}
									onChange={(e) => setNewPersonCompany(e.target.value)}
								/>
							</div>
						)}
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setSelectedPeople([]);
								setShowCreatePerson(false);
								handleSave();
							}}
							disabled={isSaving}
						>
							Skip
						</Button>
						<Button onClick={handleSave} disabled={isSaving || (showCreatePerson && !newPersonFirstName.trim())}>
							{isSaving
								? "Saving..."
								: selectedPeople.length > 0 || (showCreatePerson && newPersonFirstName.trim())
									? `Save & Link ${selectedPeople.length + (showCreatePerson && newPersonFirstName.trim() ? 1 : 0)}`
									: noteType === "task"
										? "Create Task"
										: "Save Note"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}

	// Content step UI (default)
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="h-[100vh] max-h-[100vh] max-w-2xl overflow-y-auto sm:h-[75vh] sm:max-h-[75vh]">
				<DialogHeader>
					<DialogTitle>{noteType === "task" ? "Quick Task" : "Quick Note"}</DialogTitle>
					<DialogDescription className="hidden sm:block">
						{noteType === "task"
							? "Create a task to track work or follow-ups."
							: "Capture notes, observations, or ideas."}
					</DialogDescription>
				</DialogHeader>

				<div className="flex h-full flex-col space-y-4 py-4">
					{/* Type Toggle */}
					<div className="flex gap-2">
						<Button
							type="button"
							variant={noteType === "note" ? "default" : "outline"}
							size="sm"
							onClick={() => setNoteType("note")}
							className="flex-1 gap-2"
						>
							<StickyNote className="h-4 w-4" />
							Note
						</Button>
						<Button
							type="button"
							variant={noteType === "task" ? "default" : "outline"}
							size="sm"
							onClick={() => setNoteType("task")}
							className="flex-1 gap-2"
						>
							<CheckSquare className="h-4 w-4" />
							Task
						</Button>
					</div>

					{/* Title (optional for notes, required for tasks) */}
					<div className="space-y-2">
						<Label htmlFor={titleId}>{noteType === "task" ? "Task Title" : "Title (optional)"}</Label>
						<Input
							id={titleId}
							placeholder={noteType === "task" ? "What needs to be done?" : "Auto-generated if left blank"}
							value={title}
							onChange={(e) => setTitle(e.target.value)}
						/>
					</div>

					{/* Content */}
					<div className="flex-1 space-y-2">
						<div className="flex items-center justify-between">
							<Label htmlFor={contentId}>{noteType === "task" ? "Description (optional)" : "Content"}</Label>
							{isVoiceSupported && (
								<Button
									type="button"
									variant={isVoiceRecording ? "destructive" : "outline"}
									size="sm"
									onClick={isVoiceRecording ? stopRecording : startRecording}
									disabled={isTranscribing}
									className={cn("gap-2", isVoiceRecording && "animate-pulse")}
								>
									{isTranscribing ? (
										<>
											<Loader2 className="h-4 w-4 animate-spin" />
											Transcribing...
										</>
									) : isVoiceRecording ? (
										<>
											<Square className="h-3 w-3 fill-current" />
											Stop
										</>
									) : (
										<>
											<Mic className="h-4 w-4" />
											Voice
										</>
									)}
								</Button>
							)}
						</div>
						{voiceError && <p className="text-destructive text-xs">{voiceError}</p>}
						<Textarea
							id={contentId}
							placeholder={
								noteType === "task"
									? "Add details about what needs to be done..."
									: "Write your note here or use voice input..."
							}
							value={content}
							onChange={(e) => setContent(e.target.value)}
							className="h-full min-h-[6rem] resize-none font-mono text-sm sm:min-h-[10rem]"
						/>
					</div>

					{/* People Associations - only show if availablePeople provided (legacy support) */}
					{availablePeople.length > 0 && (
						<div className="space-y-2">
							<Label>Associated People</Label>
							<div className="flex flex-wrap gap-2">
								{availablePeople.map((person) => (
									<Badge
										key={person.id}
										variant={associations.people?.includes(person.id) ? "default" : "outline"}
										className="cursor-pointer"
										onClick={() => togglePerson(person.id)}
									>
										{person.name}
									</Badge>
								))}
							</div>
						</div>
					)}

					{/* Organization Associations */}
					{availableOrgs.length > 0 && (
						<div className="space-y-2">
							<Label>Associated Organizations</Label>
							<div className="flex flex-wrap gap-2">
								{availableOrgs.map((org) => (
									<Badge
										key={org.id}
										variant={associations.organizations?.includes(org.id) ? "default" : "outline"}
										className="cursor-pointer"
										onClick={() => toggleOrg(org.id)}
									>
										{org.name}
									</Badge>
								))}
							</div>
						</div>
					)}

					{/* Opportunity Associations */}
					{availableOpportunities.length > 0 && (
						<div className="space-y-2">
							<Label>Associated Opportunities</Label>
							<div className="flex flex-wrap gap-2">
								{availableOpportunities.map((opp) => (
									<Badge
										key={opp.id}
										variant={associations.opportunities?.includes(opp.id) ? "default" : "outline"}
										className="cursor-pointer"
										onClick={() => toggleOpportunity(opp.id)}
									>
										{opp.name}
									</Badge>
								))}
							</div>
						</div>
					)}

					{/* Tags */}
					<div className="hidden space-y-2 sm:block">
						<Label htmlFor={tagsId}>Tags</Label>
						<div className="flex gap-2">
							<Input
								id={tagsId}
								placeholder="Add tag..."
								value={tagInput}
								onChange={(e) => setTagInput(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										addTag();
									}
								}}
							/>
							<Button type="button" variant="outline" onClick={addTag}>
								Add
							</Button>
						</div>
						{tags.length > 0 && (
							<div className="mt-2 flex flex-wrap gap-2">
								{tags.map((tag) => (
									<Badge key={tag} variant="secondary" className="gap-1">
										{tag}
										<button type="button" onClick={() => removeTag(tag)} className="hover:text-destructive">
											<X className="h-3 w-3" />
										</button>
									</Badge>
								))}
							</div>
						)}
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
						Cancel
					</Button>
					<Button onClick={handleNext} disabled={isSaving || (noteType === "task" ? !title.trim() : !content.trim())}>
						{isSaving ? "Saving..." : projectId ? "Next" : noteType === "task" ? "Create Task" : "Save Note"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
