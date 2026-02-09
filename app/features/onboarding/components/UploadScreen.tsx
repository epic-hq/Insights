import {
	AlertTriangle,
	CheckCircle,
	File,
	Link2,
	Mic,
	PenLine,
	Search,
	Sparkles,
	Upload,
	UserPlus,
	Users,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { QuickNoteDialog } from "~/components/notes/QuickNoteDialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useCurrentProject } from "~/contexts/current-project-context";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import { useRecordNow } from "~/hooks/useRecordNow";
import { createClient } from "~/lib/supabase/client";
import { cn } from "~/lib/utils";
import type { Person } from "~/types";

interface UploadScreenProps {
	onNext: (
		file: File,
		mediaType: string,
		projectId?: string,
		attachmentData?: {
			attachType: "todo" | "existing" | "new" | "general" | "skip";
			entityId?: string;
			fileExtension?: string;
			sourceType?: string;
		}
	) => void;
	onUploadFromUrl: (url: string, personId?: string) => Promise<void>;
	onBack: () => void;
	projectId?: string;
	accountId?: string;
	error?: string;
}

type UploadStep = "select" | "associate";
type ActionType = "upload" | "record";
type SelectablePerson =
	| (Person & { isMember?: false })
	| {
			id: string;
			name: string;
			company?: string | null;
			isMember: true;
			user_id: string;
			email?: string | null;
	  };

export default function UploadScreen({
	onNext,
	onUploadFromUrl,
	onBack,
	projectId,
	accountId,
	error,
}: UploadScreenProps) {
	// File/URL state
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [urlToUpload, setUrlToUpload] = useState("");
	const [uploadTab, setUploadTab] = useState<"file" | "url">("file");
	const [isDragOver, setIsDragOver] = useState(false);

	// Upload flow state
	const [uploadStep, setUploadStep] = useState<UploadStep>("select");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [urlError, setUrlError] = useState<string | null>(null);

	// Track which action triggered the association step
	const [pendingAction, setPendingAction] = useState<ActionType | null>(null);

	// Person association state - supports multiple people
	const [searchQuery, setSearchQuery] = useState("");
	const [people, setPeople] = useState<Person[]>([]);
	const [members, setMembers] = useState<Array<{ user_id: string; name: string; email: string | null }>>([]);
	const [isLoadingPeople, setIsLoadingPeople] = useState(false);
	const [selectedPeople, setSelectedPeople] = useState<SelectablePerson[]>([]);
	const [showCreatePerson, setShowCreatePerson] = useState(false);
	const [newPersonFirstName, setNewPersonFirstName] = useState("");
	const [newPersonLastName, setNewPersonLastName] = useState("");
	const [newPersonCompany, setNewPersonCompany] = useState("");
	const [matchingPeople, setMatchingPeople] = useState<Person[]>([]);
	const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
	const [duplicateError, setDuplicateError] = useState<string | null>(null);

	// Dialogs
	const [showQuickNoteDialog, setShowQuickNoteDialog] = useState(false);
	const [showUploadMethodDialog, setShowUploadMethodDialog] = useState(false);
	const [showNoQuestionsDialog, setShowNoQuestionsDialog] = useState(false);
	const [isCheckingQuestions, setIsCheckingQuestions] = useState(false);

	const fileInputRef = useRef<HTMLInputElement>(null);
	const supabase = createClient();
	const navigate = useNavigate();
	const { projectPath } = useCurrentProject();
	const routes = useProjectRoutes(projectPath || "");
	const { recordNow, isRecording } = useRecordNow();

	// Detect file type for setting source_type
	const getFileType = useCallback((file: File): string => {
		const extension = file.name.split(".").pop()?.toLowerCase();
		const mimeType = file.type.toLowerCase();

		if (mimeType.startsWith("text/") || ["txt", "md", "markdown"].includes(extension || "")) {
			return "transcript";
		}
		if (
			mimeType.includes("pdf") ||
			mimeType.includes("document") ||
			mimeType.includes("spreadsheet") ||
			["pdf", "doc", "docx", "csv", "xlsx"].includes(extension || "")
		) {
			return "document";
		}
		if (mimeType.startsWith("video/") || ["mp4", "mov", "avi", "mkv", "webm"].includes(extension || "")) {
			return "video_upload";
		}
		if (mimeType.startsWith("audio/") || ["mp3", "wav", "m4a", "ogg", "flac"].includes(extension || "")) {
			return "audio_upload";
		}
		return "document";
	}, []);

	// File handlers
	const handleFileSelect = (file: File) => {
		setSelectedFile(file);
		setPendingAction("upload");
		setUploadStep("associate");
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(true);
	};

	const handleDragLeave = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(false);
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(false);
		const files = e.dataTransfer.files;
		if (files.length > 0) {
			handleFileSelect(files[0]);
		}
	};

	const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (files && files.length > 0) {
			handleFileSelect(files[0]);
		}
	};

	const triggerFileInput = () => {
		fileInputRef.current?.click();
	};

	// URL handler
	const handleUrlContinue = () => {
		if (!urlToUpload.trim()) {
			setUrlError("Please enter a valid URL");
			return;
		}
		setUrlError(null);
		setPendingAction("upload");
		setUploadStep("associate");
	};

	// Record handler - check for questions first, then show person association
	const handleRecordClick = useCallback(async () => {
		if (!projectId) {
			// No project yet, proceed directly
			setPendingAction("record");
			setUploadStep("associate");
			return;
		}

		setIsCheckingQuestions(true);
		try {
			// Check if project has any selected interview prompts
			const { data: prompts, error } = await supabase
				.from("interview_prompts")
				.select("id")
				.eq("project_id", projectId)
				.eq("is_selected", true)
				.limit(1);

			if (error) {
				console.warn("[UploadScreen] Failed to check questions:", error);
				// Proceed anyway on error
				setPendingAction("record");
				setUploadStep("associate");
				return;
			}

			if (!prompts || prompts.length === 0) {
				// No questions configured, show dialog
				setShowNoQuestionsDialog(true);
				return;
			}

			// Questions exist, proceed to person association
			setPendingAction("record");
			setUploadStep("associate");
		} finally {
			setIsCheckingQuestions(false);
		}
	}, [projectId, supabase]);

	// Proceed to record without questions (user chose to continue)
	const handleRecordWithoutQuestions = useCallback(() => {
		setShowNoQuestionsDialog(false);
		setPendingAction("record");
		setUploadStep("associate");
	}, []);

	// Navigate to questions setup
	const handleSetupQuestions = useCallback(() => {
		setShowNoQuestionsDialog(false);
		if (routes.questions?.index) {
			navigate(routes.questions.index());
		} else if (projectPath) {
			navigate(`${projectPath}/questions`);
		}
	}, [navigate, routes, projectPath]);

	// Start recording with optional people (pass all via comma-separated personIds param)
	const handleStartRecording = useCallback(
		(personIds: string[]) => {
			// Pass all personIds via URL param - realtime.tsx parses comma-separated
			const urlParams = personIds.length > 0 ? `personIds=${personIds.join(",")}` : "";
			recordNow({ projectId, mode: "interview", urlParams });
		},
		[projectId, recordNow]
	);

	// Process action (upload or record) with optional people
	const handleProcessAction = useCallback(async () => {
		setIsSubmitting(true);

		try {
			// Collect all person IDs (existing selections + newly created)
			const personIds: string[] = [];

			// Ensure member selections have a person row
			if (accountId && projectId && selectedPeople.length > 0) {
				for (const sel of selectedPeople) {
					if ((sel as any).isMember) {
						const memberSel = sel as Extract<SelectablePerson, { isMember: true }>;
						// Ensure a person row exists for this team member: find, otherwise insert
						const [first, ...rest] = (memberSel.name || "").split(/\s+/).filter(Boolean);
						const last = rest.length ? rest.join(" ") : null;

						const { data: existingPerson, error: lookupErr } = await supabase
							.from("people")
							.select("id")
							.eq("account_id", accountId)
							.eq("user_id", memberSel.user_id)
							.maybeSingle();

						if (lookupErr) {
							console.error("[UploadScreen] Failed to lookup person for team member:", memberSel.name, lookupErr);
							toast.error(`Could not link ${memberSel.name}`);
							continue;
						}

						if (existingPerson?.id) {
							personIds.push(existingPerson.id);
							continue;
						}

						const insertPayload = {
							account_id: accountId,
							project_id: projectId,
							user_id: memberSel.user_id,
							person_type: "internal" as const,
							firstname: first || null,
							lastname: last,
							company: memberSel.company ?? null,
							primary_email: memberSel.email ?? null,
						};
						const { data: inserted, error: insertErr } = await supabase
							.from("people")
							.insert(insertPayload)
							.select("id")
							.single();

						if (insertErr || !inserted?.id) {
							console.error("[UploadScreen] Failed to insert person for team member:", memberSel.name, insertErr);
							toast.error(`Could not link ${memberSel.name}`);
						} else {
							personIds.push(inserted.id);
						}
					} else {
						personIds.push(sel.id);
					}
				}
			} else {
				personIds.push(...selectedPeople.map((p) => p.id));
			}

			// Create new person if needed (immediately, not deferred)
			if (showCreatePerson && newPersonFirstName.trim() && accountId) {
				const firstName = newPersonFirstName.trim();
				const lastName = newPersonLastName.trim() || null;
				const displayName = lastName ? `${firstName} ${lastName}` : firstName;
				const { data, error } = await supabase
					.from("people")
					.insert({
						firstname: firstName,
						lastname: lastName,
						account_id: accountId,
						project_id: projectId,
						company: newPersonCompany.trim() || null,
					})
					.select()
					.single();

				if (error) {
					console.error("[UploadScreen] Failed to create person:", error);
					toast.error("Failed to create person");
				} else if (data) {
					console.log("[UploadScreen] Created person:", data.id, displayName);
					personIds.push(data.id);
					toast.success(`Created "${displayName}"`);
				}
			} else if (showCreatePerson && newPersonFirstName.trim()) {
				console.error("[UploadScreen] Cannot create person: no accountId available");
				toast.error("Cannot create person: missing account context");
			}

			// Handle recording - pass all person IDs
			if (pendingAction === "record") {
				handleStartRecording(personIds);
				return;
			}

			// Handle file upload - for now, pass first person (API supports single)
			const firstPersonId = personIds[0];
			if (selectedFile) {
				const fileExtension = selectedFile.name.split(".").pop()?.toLowerCase() || "";
				const sourceType = getFileType(selectedFile);

				onNext(selectedFile, "interview", projectId, {
					attachType: firstPersonId ? "existing" : "skip",
					entityId: firstPersonId,
					fileExtension,
					sourceType,
				});
			} else if (urlToUpload.trim()) {
				await onUploadFromUrl(urlToUpload.trim(), firstPersonId);
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to process";
			setUrlError(message);
		} finally {
			setIsSubmitting(false);
		}
	}, [
		selectedFile,
		urlToUpload,
		selectedPeople,
		showCreatePerson,
		newPersonFirstName,
		newPersonLastName,
		newPersonCompany,
		projectId,
		accountId,
		supabase,
		getFileType,
		onNext,
		onUploadFromUrl,
		pendingAction,
		handleStartRecording,
	]);

	// Reset to initial state
	const handleBack = () => {
		setUploadStep("select");
		setSelectedFile(null);
		setUrlToUpload("");
		setSelectedPeople([]);
		setShowCreatePerson(false);
		setSearchQuery("");
		setNewPersonFirstName("");
		setNewPersonLastName("");
		setNewPersonCompany("");
		setPendingAction(null);
	};

	// Fetch people when entering association step
	useEffect(() => {
		console.log("[UploadScreen] useEffect triggered:", {
			uploadStep,
			isLoadingPeople,
			accountId,
			projectId,
			peopleLength: people.length,
		});
		if (uploadStep !== "associate" || isLoadingPeople) return;
		// Need either accountId or projectId to fetch people
		if (!accountId && !projectId) return;

		const load = async () => {
			setIsLoadingPeople(true);
			try {
				// Use accountId prop, or fetch from project if not available
				let effectiveAccountId = accountId;
				if (!effectiveAccountId && projectId) {
					const { data: proj } = await supabase.from("projects").select("account_id").eq("id", projectId).maybeSingle();
					effectiveAccountId = proj?.account_id ?? undefined;
				}

				if (!effectiveAccountId) {
					console.warn("[UploadScreen] No accountId available for fetching people");
					return;
				}

				console.log("[UploadScreen] Fetching people for accountId:", effectiveAccountId);
				const { data, error: fetchError } = await supabase
					.from("people")
					.select("id, name, company, person_type")
					.eq("account_id", effectiveAccountId)
					.order("name")
					.limit(50);

				console.log("[UploadScreen] People fetch result:", {
					count: data?.length ?? 0,
					error: fetchError,
					sample: data?.slice(0, 3),
				});

				if (data) setPeople(data as Person[]);

				const { data: memberRows } = await supabase.rpc("get_account_members", {
					account_id: effectiveAccountId,
				});
				if (Array.isArray(memberRows)) {
					setMembers(
						memberRows.map((m: any) => ({
							user_id: m.user_id,
							name: m.name || m.email || "Team member",
							email: m.email ?? null,
						}))
					);
				}
			} finally {
				setIsLoadingPeople(false);
			}
		};

		if (people.length === 0) {
			console.log("[UploadScreen] Calling load() because people.length === 0");
			load();
		} else {
			console.log("[UploadScreen] Skipping load() because people.length =", people.length);
		}
	}, [uploadStep, people.length, supabase, accountId, projectId, isLoadingPeople]);

	// Check for matching people when creating a new person (debounced)
	useEffect(() => {
		if (!showCreatePerson || !newPersonFirstName.trim()) {
			setMatchingPeople([]);
			setDuplicateError(null);
			return;
		}

		const checkMatches = async () => {
			setIsCheckingDuplicate(true);
			setDuplicateError(null);

			try {
				// Build the name to search for
				const searchName = `${newPersonFirstName.trim()} ${newPersonLastName.trim()}`.trim().toLowerCase();

				// Get effective accountId
				let effectiveAccountId = accountId;
				if (!effectiveAccountId && projectId) {
					const { data: proj } = await supabase.from("projects").select("account_id").eq("id", projectId).maybeSingle();
					effectiveAccountId = proj?.account_id ?? undefined;
				}

				if (!effectiveAccountId) return;

				// Search for people with similar names
				const { data } = await supabase
					.from("people")
					.select("id, name, company, person_type")
					.eq("account_id", effectiveAccountId)
					.ilike("name", `%${searchName}%`)
					.limit(5);

				if (data && data.length > 0) {
					setMatchingPeople(data as Person[]);

					// Check for exact duplicate (same name + company)
					const companyLower = (newPersonCompany.trim() || "").toLowerCase();
					const exactMatch = data.find(
						(p) => p.name?.toLowerCase() === searchName && (p.company || "").toLowerCase() === companyLower
					);

					if (exactMatch) {
						setDuplicateError(
							`"${exactMatch.name}"${exactMatch.company ? ` at ${exactMatch.company}` : ""} already exists`
						);
					}
				} else {
					setMatchingPeople([]);
				}
			} finally {
				setIsCheckingDuplicate(false);
			}
		};

		// Debounce the check
		const timer = setTimeout(checkMatches, 300);
		return () => clearTimeout(timer);
	}, [showCreatePerson, newPersonFirstName, newPersonLastName, newPersonCompany, accountId, projectId, supabase]);

	// Filter people based on search
	const filteredPeople = searchQuery.trim()
		? people.filter(
				(p) =>
					p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
					p.company?.toLowerCase().includes(searchQuery.toLowerCase())
			)
		: people.slice(0, 8);
	const filteredMembers =
		searchQuery.trim().length > 0
			? members.filter(
					(m) =>
						m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
						(m.email || "").toLowerCase().includes(searchQuery.toLowerCase())
				)
			: members.slice(0, 8);

	// Quick note handler
	const handleSaveNote = useCallback(
		async (note: {
			title: string;
			content: string;
			noteType: string;
			associations: Record<string, unknown>;
			tags: string[];
		}) => {
			if (!projectId) throw new Error("Project ID is required");

			const response = await fetch("/api/notes/create", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					projectId,
					title: note.title,
					content: note.content,
					noteType: note.noteType,
					associations: note.associations,
					tags: note.tags,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.details || errorData.error || "Failed to save note");
			}
		},
		[projectId]
	);

	const formatFileSize = (bytes: number): string => {
		if (bytes === 0) return "0 Bytes";
		const k = 1024;
		const sizes = ["Bytes", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
	};

	// ─────────────────────────────────────────────────────────────
	// RENDER: Association Step
	// ─────────────────────────────────────────────────────────────
	if (uploadStep === "associate") {
		const contentLabel = selectedFile ? selectedFile.name : urlToUpload;
		const isRecording = pendingAction === "record";

		return (
			<div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
				<div className="relative mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 py-8">
					{/* Header */}
					<div className="mb-6 w-full">
						<div className="flex flex-row justify-end">
							<button
								type="button"
								onClick={handleBack}
								className="mb-4 flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground"
							>
								<X className="h-4 w-4" />
								Cancel
							</button>
						</div>
						<h2 className="font-semibold text-slate-900 text-xl dark:text-white">Link to</h2>
						{/* {!isRecording && contentLabel && (
              <p className="mt-1 text-muted-foreground text-sm">
                {selectedFile ? "Uploading" : "Importing"}: {contentLabel}
              </p>
            )} */}
					</div>

					{/* Person Selection */}
					<div className="w-full space-y-4">
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
											const isSelected = selectedPeople.some((p) => p.id === person.id && !p.isMember);
											const isInternal = (person as any).person_type === "internal";
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
														<div className="flex items-center gap-2">
															<p className="truncate font-medium text-sm">{person.name}</p>
															{isInternal && (
																<span className="inline-flex items-center rounded-full bg-blue-100 px-2 font-semibold text-[10px] text-blue-800 uppercase tracking-wide">
																	Team
																</span>
															)}
														</div>
														{person.company && (
															<p className="truncate text-muted-foreground text-xs">{person.company}</p>
														)}
													</div>
													{isSelected && <CheckCircle className="h-5 w-5 flex-shrink-0 text-blue-500" />}
												</button>
											);
										})
									)}

									{filteredMembers.length > 0 && (
										<div className="mt-4 space-y-2">
											<p className="font-semibold text-muted-foreground text-xs uppercase">Internal teammates</p>
											{filteredMembers.map((member) => {
												const key = `member-${member.user_id}`;
												const isSelected = selectedPeople.some((p) => p.isMember && p.user_id === member.user_id);
												return (
													<button
														key={key}
														type="button"
														onClick={() =>
															setSelectedPeople((prev) =>
																isSelected
																	? prev.filter((p) => !(p.isMember && p.user_id === member.user_id))
																	: [
																			...prev,
																			{
																				id: key,
																				isMember: true,
																				user_id: member.user_id,
																				name: member.name,
																				email: member.email,
																			},
																		]
															)
														}
														className={cn(
															"flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all",
															isSelected
																? "border-blue-500 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/30"
																: "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
														)}
													>
														<div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-white">
															<Users className="h-5 w-5" />
														</div>
														<div className="min-w-0 flex-1">
															<div className="flex items-center gap-2">
																<p className="truncate font-medium text-sm">{member.name}</p>
																<span className="inline-flex items-center rounded-full bg-blue-100 px-2 font-semibold text-[10px] text-blue-800 uppercase tracking-wide">
																	Team
																</span>
															</div>
															{member.email && <p className="truncate text-muted-foreground text-xs">{member.email}</p>}
														</div>
														{isSelected && <CheckCircle className="h-5 w-5 flex-shrink-0 text-blue-500" />}
													</button>
												);
											})}
										</div>
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
											setMatchingPeople([]);
											setDuplicateError(null);
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

								{/* Duplicate error */}
								{duplicateError && <p className="text-red-500 text-sm">{duplicateError}</p>}

								{/* Matching people - user can select instead of creating */}
								{matchingPeople.length > 0 && !duplicateError && (
									<div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
										<p className="font-medium text-amber-800 text-xs dark:text-amber-200">
											Similar people found - select to link instead:
										</p>
										{matchingPeople.map((person) => (
											<button
												key={person.id}
												type="button"
												onClick={() => {
													setSelectedPeople((prev) => [...prev, person]);
													setShowCreatePerson(false);
													setNewPersonFirstName("");
													setNewPersonLastName("");
													setNewPersonCompany("");
													setMatchingPeople([]);
												}}
												className="flex w-full items-center gap-2 rounded border border-amber-300 bg-white p-2 text-left text-sm transition-colors hover:bg-amber-100 dark:border-amber-700 dark:bg-slate-900 dark:hover:bg-slate-800"
											>
												<Users className="h-4 w-4 text-amber-600" />
												<span>{person.name}</span>
												{person.company && <span className="text-muted-foreground">at {person.company}</span>}
											</button>
										))}
									</div>
								)}

								{isCheckingDuplicate && (
									<p className="text-muted-foreground text-xs">Checking for existing contacts...</p>
								)}
							</div>
						)}

						{/* Error */}
						{urlError && <p className="text-red-500 text-sm">{urlError}</p>}

						{/* Actions */}
						<div className="flex gap-3 pt-4">
							<Button
								variant="outline"
								className="flex-1"
								onClick={() => {
									setSelectedPeople([]);
									setShowCreatePerson(false);
									handleProcessAction();
								}}
								disabled={isSubmitting}
							>
								Skip
							</Button>
							<Button
								className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white"
								onClick={handleProcessAction}
								disabled={isSubmitting || (showCreatePerson && !newPersonFirstName.trim()) || !!duplicateError}
							>
								{isSubmitting ? (
									"Processing..."
								) : (
									<>
										<Sparkles className="mr-2 h-4 w-4" />
										{(() => {
											const hasPersonSelected =
												selectedPeople.length > 0 || (showCreatePerson && newPersonFirstName.trim());
											const personCount =
												selectedPeople.length + (showCreatePerson && newPersonFirstName.trim() ? 1 : 0);
											if (isRecording) {
												if (!hasPersonSelected) return "Start Recording";
												return personCount > 1 ? `Record & Link ${personCount}` : "Record & Link";
											}
											if (!hasPersonSelected) return "Upload";
											return personCount > 1 ? `Upload & Link ${personCount}` : "Upload & Link";
										})()}
									</>
								)}
							</Button>
						</div>
					</div>
				</div>
			</div>
		);
	}

	// ─────────────────────────────────────────────────────────────
	// RENDER: Main Selection Screen
	// ─────────────────────────────────────────────────────────────
	return (
		<div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
			{/* Hidden file input */}
			<input
				ref={fileInputRef}
				type="file"
				onChange={handleFileInputChange}
				accept="audio/*,video/*,.mp3,.mp4,.wav,.m4a,.mov,.avi,.txt,.md"
				className="hidden"
			/>

			{/* Main Content */}
			<div className="relative mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4 py-0 lg:py-8">
				{/* Error Alert */}
				{error && (
					<div className="mb-6 w-full rounded-xl border border-red-200 bg-red-50/80 p-4 dark:border-red-900/50 dark:bg-red-950/30">
						<p className="text-red-700 text-sm dark:text-red-300">{error}</p>
					</div>
				)}

				{/* Three Column Layout - Equal Weight */}
				<div className="grid w-full gap-4 sm:grid-cols-3">
					{/* Record Card */}
					<button
						type="button"
						onClick={handleRecordClick}
						disabled={isRecording || isCheckingQuestions}
						className={cn(
							"group flex flex-col items-center gap-4 rounded-2xl border border-slate-200/60 bg-white/80 p-6 shadow-lg backdrop-blur-sm transition-all duration-200",
							"hover:scale-[1.02] hover:border-red-300 hover:shadow-xl",
							"dark:border-slate-800/60 dark:bg-slate-900/80 dark:hover:border-red-700",
							(isRecording || isCheckingQuestions) && "cursor-not-allowed opacity-50"
						)}
					>
						<div
							className={cn(
								"flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/30 transition-transform group-hover:scale-110",
								isCheckingQuestions && "animate-pulse"
							)}
						>
							<Mic className="h-7 w-7 text-white" />
						</div>
						<div className="text-center">
							<h2 className="font-semibold text-base text-slate-900 dark:text-white">
								{isCheckingQuestions ? "Checking..." : "Record"}
							</h2>
							{/* <p className="mt-1 text-muted-foreground text-xs">Live recording</p> */}
						</div>
					</button>

					{/* Upload Card */}
					<button
						type="button"
						onClick={() => setShowUploadMethodDialog(true)}
						onDragOver={handleDragOver}
						onDragLeave={handleDragLeave}
						onDrop={handleDrop}
						className={cn(
							"group flex flex-col items-center gap-4 rounded-2xl border border-slate-200/60 bg-white/80 p-6 shadow-lg backdrop-blur-sm transition-all duration-200",
							"hover:scale-[1.02] hover:border-blue-300 hover:shadow-xl",
							"dark:border-slate-800/60 dark:bg-slate-900/80 dark:hover:border-blue-700",
							isDragOver && "border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/30"
						)}
					>
						<div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/30 shadow-lg transition-transform group-hover:scale-110">
							<Upload className="h-7 w-7 text-white" />
						</div>
						<div className="text-center">
							<h2 className="font-semibold text-base text-slate-900 dark:text-white">Upload</h2>
							<p className="mt-1 text-muted-foreground text-xs">Media File or URL</p>
						</div>
					</button>

					{/* Quick Note Card */}
					<button
						type="button"
						onClick={() => setShowQuickNoteDialog(true)}
						className={cn(
							"group flex flex-col items-center gap-4 rounded-2xl border border-slate-200/60 bg-white/80 p-6 shadow-lg backdrop-blur-sm transition-all duration-200",
							"hover:scale-[1.02] hover:border-amber-300 hover:shadow-xl",
							"dark:border-slate-800/60 dark:bg-slate-900/80 dark:hover:border-amber-700"
						)}
					>
						<div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/30 shadow-lg transition-transform group-hover:scale-110">
							<PenLine className="h-7 w-7 text-white" />
						</div>
						<div className="text-center">
							<h2 className="font-semibold text-base text-slate-900 dark:text-white">Note</h2>
							<p className="mt-1 text-muted-foreground text-xs">Quick capture</p>
						</div>
					</button>
				</div>
			</div>

			{/* Upload Method Dialog */}
			<Dialog open={showUploadMethodDialog} onOpenChange={setShowUploadMethodDialog}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Upload</DialogTitle>
						<DialogDescription>Choose how to add your content</DialogDescription>
					</DialogHeader>
					<Tabs value={uploadTab} onValueChange={(v) => setUploadTab(v as "file" | "url")} className="mt-2">
						<TabsList className="grid w-full grid-cols-2">
							<TabsTrigger value="file">
								<File className="mr-2 h-4 w-4" />
								File
							</TabsTrigger>
							<TabsTrigger value="url">
								<Link2 className="mr-2 h-4 w-4" />
								URL
							</TabsTrigger>
						</TabsList>

						<TabsContent value="file" className="mt-4">
							<div
								onClick={() => {
									setShowUploadMethodDialog(false);
									triggerFileInput();
								}}
								onDragOver={handleDragOver}
								onDragLeave={handleDragLeave}
								onDrop={(e) => {
									setShowUploadMethodDialog(false);
									handleDrop(e);
								}}
								className={cn(
									"flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all",
									isDragOver
										? "border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/30"
										: "border-slate-300 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:hover:border-slate-500 dark:hover:bg-slate-800"
								)}
							>
								<Upload className="mb-2 h-8 w-8 text-slate-400" />
								<p className="font-medium text-slate-700 text-sm dark:text-slate-300">Drop file or click to browse</p>
								<p className="mt-1 text-muted-foreground text-xs">Audio, video, or transcript</p>
							</div>
						</TabsContent>

						<TabsContent value="url" className="mt-4">
							<div className="space-y-3">
								<Input
									type="url"
									placeholder="https://..."
									value={urlToUpload}
									onChange={(e) => {
										setUrlToUpload(e.target.value);
										setUrlError(null);
									}}
									autoFocus
								/>
								{urlError && <p className="text-red-500 text-xs">{urlError}</p>}
								<Button
									onClick={() => {
										setShowUploadMethodDialog(false);
										handleUrlContinue();
									}}
									disabled={!urlToUpload.trim()}
									className="w-full"
								>
									Continue
								</Button>
							</div>
						</TabsContent>
					</Tabs>
				</DialogContent>
			</Dialog>

			{/* Quick Note Dialog */}
			<QuickNoteDialog
				open={showQuickNoteDialog}
				onOpenChange={setShowQuickNoteDialog}
				onSave={handleSaveNote}
				projectId={projectId}
			/>

			{/* No Questions Warning Dialog */}
			<Dialog open={showNoQuestionsDialog} onOpenChange={setShowNoQuestionsDialog}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<AlertTriangle className="h-5 w-5 text-amber-500" />
							No Interview Questions
						</DialogTitle>
						<DialogDescription>
							This project doesn't have interview questions set up yet. Questions help guide your conversation and
							ensure you capture key insights.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="flex-col gap-2 sm:flex-row">
						<Button variant="outline" onClick={handleRecordWithoutQuestions} className="w-full sm:w-auto">
							Record Anyway
						</Button>
						<Button onClick={handleSetupQuestions} className="w-full sm:w-auto">
							Set Up Questions
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
