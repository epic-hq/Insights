import { CheckCircle, File, Link2, Mic, PenLine, Search, Sparkles, Upload, UserPlus, Users, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { QuickNoteDialog } from "~/components/notes/QuickNoteDialog"
import { Button } from "~/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog"
import { Input } from "~/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { useRecordNow } from "~/hooks/useRecordNow"
import { createClient } from "~/lib/supabase/client"
import { cn } from "~/lib/utils"
import type { Person } from "~/types"

interface UploadScreenProps {
	onNext: (
		file: File,
		mediaType: string,
		projectId?: string,
		attachmentData?: {
			attachType: "todo" | "existing" | "new" | "general" | "skip"
			entityId?: string
			fileExtension?: string
			sourceType?: string
		}
	) => void
	onUploadFromUrl: (url: string, personId?: string) => Promise<void>
	onBack: () => void
	projectId?: string
	error?: string
}

type UploadStep = "select" | "associate"
type ActionType = "upload" | "record"

export default function UploadScreen({ onNext, onUploadFromUrl, onBack, projectId, error }: UploadScreenProps) {
	// File/URL state
	const [selectedFile, setSelectedFile] = useState<File | null>(null)
	const [urlToUpload, setUrlToUpload] = useState("")
	const [uploadTab, setUploadTab] = useState<"file" | "url">("file")
	const [isDragOver, setIsDragOver] = useState(false)

	// Upload flow state
	const [uploadStep, setUploadStep] = useState<UploadStep>("select")
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [urlError, setUrlError] = useState<string | null>(null)

	// Track which action triggered the association step
	const [pendingAction, setPendingAction] = useState<ActionType | null>(null)

	// Person association state - supports multiple people
	const [searchQuery, setSearchQuery] = useState("")
	const [people, setPeople] = useState<Person[]>([])
	const [isLoadingPeople, setIsLoadingPeople] = useState(false)
	const [selectedPeople, setSelectedPeople] = useState<Person[]>([])
	const [showCreatePerson, setShowCreatePerson] = useState(false)
	const [newPersonFirstName, setNewPersonFirstName] = useState("")
	const [newPersonLastName, setNewPersonLastName] = useState("")
	const [newPersonCompany, setNewPersonCompany] = useState("")
	const [accountId, setAccountId] = useState<string | null>(null)

	// Dialogs
	const [showQuickNoteDialog, setShowQuickNoteDialog] = useState(false)
	const [showUploadMethodDialog, setShowUploadMethodDialog] = useState(false)

	const fileInputRef = useRef<HTMLInputElement>(null)
	const supabase = createClient()
	const { recordNow, isRecording } = useRecordNow()

	// Detect file type for setting source_type
	const getFileType = useCallback((file: File): string => {
		const extension = file.name.split(".").pop()?.toLowerCase()
		const mimeType = file.type.toLowerCase()

		if (mimeType.startsWith("text/") || ["txt", "md", "markdown"].includes(extension || "")) {
			return "transcript"
		}
		if (
			mimeType.includes("pdf") ||
			mimeType.includes("document") ||
			mimeType.includes("spreadsheet") ||
			["pdf", "doc", "docx", "csv", "xlsx"].includes(extension || "")
		) {
			return "document"
		}
		if (mimeType.startsWith("video/") || ["mp4", "mov", "avi", "mkv", "webm"].includes(extension || "")) {
			return "video_upload"
		}
		if (mimeType.startsWith("audio/") || ["mp3", "wav", "m4a", "ogg", "flac"].includes(extension || "")) {
			return "audio_upload"
		}
		return "document"
	}, [])

	// File handlers
	const handleFileSelect = (file: File) => {
		setSelectedFile(file)
		setPendingAction("upload")
		setUploadStep("associate")
	}

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault()
		setIsDragOver(true)
	}

	const handleDragLeave = (e: React.DragEvent) => {
		e.preventDefault()
		setIsDragOver(false)
	}

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault()
		setIsDragOver(false)
		const files = e.dataTransfer.files
		if (files.length > 0) {
			handleFileSelect(files[0])
		}
	}

	const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files
		if (files && files.length > 0) {
			handleFileSelect(files[0])
		}
	}

	const triggerFileInput = () => {
		fileInputRef.current?.click()
	}

	// URL handler
	const handleUrlContinue = () => {
		if (!urlToUpload.trim()) {
			setUrlError("Please enter a valid URL")
			return
		}
		setUrlError(null)
		setPendingAction("upload")
		setUploadStep("associate")
	}

	// Record handler - show person association first
	const handleRecordClick = useCallback(() => {
		setPendingAction("record")
		setUploadStep("associate")
	}, [])

	// Start recording with optional people (pass all via comma-separated personIds param)
	const handleStartRecording = useCallback(
		(personIds: string[]) => {
			// Pass all personIds via URL param - realtime.tsx parses comma-separated
			const urlParams = personIds.length > 0 ? `personIds=${personIds.join(",")}` : ""
			recordNow({ projectId, mode: "interview", urlParams })
		},
		[projectId, recordNow]
	)

	// Process action (upload or record) with optional people
	const handleProcessAction = useCallback(async () => {
		setIsSubmitting(true)

		try {
			// Collect all person IDs (existing selections + newly created)
			const personIds: string[] = selectedPeople.map((p) => p.id)

			// Create new person if needed
			if (showCreatePerson && newPersonFirstName.trim()) {
				const { data, error } = await supabase
					.from("people")
					.insert({
						name: `${newPersonFirstName.trim()} ${newPersonLastName.trim()}`.trim(),
						project_id: projectId,
						company: newPersonCompany.trim() || null,
					})
					.select()
					.single()

				if (!error && data) {
					personIds.push(data.id)
				}
			}

			// Handle recording - pass all person IDs
			if (pendingAction === "record") {
				handleStartRecording(personIds)
				return
			}

			// Handle file upload - for now, pass first person (API supports single)
			const firstPersonId = personIds[0]
			if (selectedFile) {
				const fileExtension = selectedFile.name.split(".").pop()?.toLowerCase() || ""
				const sourceType = getFileType(selectedFile)

				onNext(selectedFile, "interview", projectId, {
					attachType: firstPersonId ? "existing" : "skip",
					entityId: firstPersonId,
					fileExtension,
					sourceType,
				})
			} else if (urlToUpload.trim()) {
				await onUploadFromUrl(urlToUpload.trim(), firstPersonId)
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to process"
			setUrlError(message)
		} finally {
			setIsSubmitting(false)
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
		supabase,
		getFileType,
		onNext,
		onUploadFromUrl,
		pendingAction,
		handleStartRecording,
	])

	// Reset to initial state
	const handleBack = () => {
		setUploadStep("select")
		setSelectedFile(null)
		setUrlToUpload("")
		setSelectedPeople([])
		setShowCreatePerson(false)
		setSearchQuery("")
		setNewPersonFirstName("")
		setNewPersonLastName("")
		setNewPersonCompany("")
		setPendingAction(null)
	}

	// Fetch people when entering association step
	useEffect(() => {
		if (uploadStep !== "associate" || !projectId || isLoadingPeople) return

		const load = async () => {
			setIsLoadingPeople(true)
			try {
				let accId = accountId
				if (!accId) {
					const { data: proj } = await supabase
						.from("projects")
						.select("account_id")
						.eq("id", projectId)
						.maybeSingle()
					accId = proj?.account_id ?? null
					if (accId) setAccountId(accId)
				}

				if (!accId) return

				const { data } = await supabase
					.from("people")
					.select("id, name, company, person_type")
					.eq("account_id", accId)
					.order("name")
					.limit(50)

				if (data) setPeople(data as Person[])
			} finally {
				setIsLoadingPeople(false)
			}
		}

		if (people.length === 0) load()
	}, [uploadStep, projectId, people.length, supabase, accountId, isLoadingPeople])

	// Filter people based on search
	const filteredPeople = searchQuery.trim()
		? people.filter(
				(p) =>
					p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
					p.company?.toLowerCase().includes(searchQuery.toLowerCase())
			)
		: people.slice(0, 8)

	// Quick note handler
	const handleSaveNote = useCallback(
		async (note: {
			title: string
			content: string
			noteType: string
			associations: Record<string, unknown>
			tags: string[]
		}) => {
			if (!projectId) throw new Error("Project ID is required")

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
			})

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}))
				throw new Error(errorData.details || errorData.error || "Failed to save note")
			}
		},
		[projectId]
	)

	const formatFileSize = (bytes: number): string => {
		if (bytes === 0) return "0 Bytes"
		const k = 1024
		const sizes = ["Bytes", "KB", "MB", "GB"]
		const i = Math.floor(Math.log(bytes) / Math.log(k))
		return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
	}

	// ─────────────────────────────────────────────────────────────
	// RENDER: Association Step
	// ─────────────────────────────────────────────────────────────
	if (uploadStep === "associate") {
		const contentLabel = selectedFile ? selectedFile.name : urlToUpload
		const isRecording = pendingAction === "record"

		return (
			<div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
				<div className="relative mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 py-8">
					{/* Header */}
					<div className="mb-6 w-full">
						<button
							type="button"
							onClick={handleBack}
							className="mb-4 flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground"
						>
							<X className="h-4 w-4" />
							Cancel
						</button>
						<h2 className="font-semibold text-slate-900 text-xl dark:text-white">Who is this conversation with?</h2>
						{!isRecording && contentLabel && (
							<p className="mt-1 text-muted-foreground text-sm">
								{selectedFile ? "Uploading" : "Importing"}: {contentLabel}
							</p>
						)}
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
											const isSelected = selectedPeople.some((p) => p.id === person.id)
											const isInternal = (person as any).person_type === "internal"
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
																<span className="inline-flex items-center rounded-full bg-blue-100 px-2 text-[10px] font-semibold uppercase tracking-wide text-blue-800">
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
											)
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
											setShowCreatePerson(false)
											setNewPersonFirstName("")
											setNewPersonLastName("")
											setNewPersonCompany("")
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

						{/* Error */}
						{urlError && <p className="text-red-500 text-sm">{urlError}</p>}

						{/* Actions */}
						<div className="flex gap-3 pt-4">
							<Button
								variant="outline"
								className="flex-1"
								onClick={() => {
									setSelectedPeople([])
									setShowCreatePerson(false)
									handleProcessAction()
								}}
								disabled={isSubmitting}
							>
								Skip
							</Button>
							<Button
								className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white"
								onClick={handleProcessAction}
								disabled={isSubmitting || (showCreatePerson && !newPersonFirstName.trim())}
							>
								{isSubmitting ? (
									"Processing..."
								) : (
									<>
										<Sparkles className="mr-2 h-4 w-4" />
										{(() => {
											const hasPersonSelected =
												selectedPeople.length > 0 || (showCreatePerson && newPersonFirstName.trim())
											const personCount =
												selectedPeople.length + (showCreatePerson && newPersonFirstName.trim() ? 1 : 0)
											if (isRecording) {
												if (!hasPersonSelected) return "Start Recording"
												return personCount > 1 ? `Record & Link ${personCount}` : "Record & Link"
											}
											if (!hasPersonSelected) return "Upload"
											return personCount > 1 ? `Upload & Link ${personCount}` : "Upload & Link"
										})()}
									</>
								)}
							</Button>
						</div>
					</div>
				</div>
			</div>
		)
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
			<div className="relative mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4 py-8">
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
						disabled={isRecording}
						className={cn(
							"group flex flex-col items-center gap-4 rounded-2xl border border-slate-200/60 bg-white/80 p-6 shadow-lg backdrop-blur-sm transition-all duration-200",
							"hover:scale-[1.02] hover:border-red-300 hover:shadow-xl",
							"dark:border-slate-800/60 dark:bg-slate-900/80 dark:hover:border-red-700",
							isRecording && "cursor-not-allowed opacity-50"
						)}
					>
						<div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/30 transition-transform group-hover:scale-110">
							<Mic className="h-7 w-7 text-white" />
						</div>
						<div className="text-center">
							<h2 className="font-semibold text-base text-slate-900 dark:text-white">Record</h2>
							<p className="mt-1 text-muted-foreground text-xs">Live recording</p>
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
									setShowUploadMethodDialog(false)
									triggerFileInput()
								}}
								onDragOver={handleDragOver}
								onDragLeave={handleDragLeave}
								onDrop={(e) => {
									setShowUploadMethodDialog(false)
									handleDrop(e)
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
										setUrlToUpload(e.target.value)
										setUrlError(null)
									}}
									autoFocus
								/>
								{urlError && <p className="text-red-500 text-xs">{urlError}</p>}
								<Button
									onClick={() => {
										setShowUploadMethodDialog(false)
										handleUrlContinue()
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
		</div>
	)
}
