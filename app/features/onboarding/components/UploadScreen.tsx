import { ArrowLeft, CheckCircle, File, ListTodo, Mic, Search, Sparkles, Upload, UserPlus, Users, Video } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "~/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog"
import { Input } from "~/components/ui/input"
import { useRecordNow } from "~/hooks/useRecordNow"
import { createClient } from "~/lib/supabase/client"
import { cn } from "~/lib/utils"
import type { Person, Organization } from "~/types"

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
	onBack: () => void
	projectId?: string
	error?: string
}

type AttachmentStep = "select" | "search-existing" | "create-new"

export default function UploadScreen({ onNext, onBack, projectId, error }: UploadScreenProps) {
	const [selectedFile, setSelectedFile] = useState<File | null>(null)
	const [recordMode, setRecordMode] = useState<"voice_memo" | "conversation">("voice_memo")
	const [isDragOver, setIsDragOver] = useState(false)
	const [showAttachmentDialog, setShowAttachmentDialog] = useState(false)
	const [attachmentStep, setAttachmentStep] = useState<AttachmentStep>("select")
	const [searchQuery, setSearchQuery] = useState("")
	const [newPersonFirstName, setNewPersonFirstName] = useState("")
	const [newPersonLastName, setNewPersonLastName] = useState("")
	const [newPersonCompany, setNewPersonCompany] = useState("")
	const [people, setPeople] = useState<Person[]>([])
	const [organizations, setOrganizations] = useState<Organization[]>([])
	const [isLoadingSearch, setIsLoadingSearch] = useState(false)
	const fileInputRef = useRef<HTMLInputElement>(null)
	const supabase = createClient()

	const handleFileSelect = (file: File) => {
		setSelectedFile(file)
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

	const { recordNow, isRecording } = useRecordNow()

	// Detect file type for setting source_type
	const getFileType = useCallback((file: File): string => {
		const extension = file.name.split(".").pop()?.toLowerCase()
		const mimeType = file.type.toLowerCase()

		// Text/document files
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
		// Video files
		if (mimeType.startsWith("video/") || ["mp4", "mov", "avi", "mkv", "webm"].includes(extension || "")) {
			return "video_upload"
		}
		// Audio files
		if (mimeType.startsWith("audio/") || ["mp3", "wav", "m4a", "ogg", "flac"].includes(extension || "")) {
			return "audio_upload"
		}
		// Default
		return "document"
	}, [])

	const handleRecordNow = useCallback(() => {
		// If voice memo mode, show attachment dialog first
		if (recordMode === "voice_memo") {
			setShowAttachmentDialog(true)
			setAttachmentStep("select")
			setSearchQuery("")
		} else {
			// For conversation mode, start recording directly
			recordNow({ projectId, mode: "interview" })
		}
	}, [projectId, recordNow, recordMode])

	const handleAttachmentSelect = useCallback(
		async (attachmentType: "todo" | "existing" | "new" | "general" | "skip", entityId?: string) => {
			let finalEntityId = entityId

			// If creating new person, insert into database first
			if (attachmentType === "new" && newPersonFirstName.trim()) {
				try {
					const { data, error } = await supabase
						.from("people")
						.insert({
							name: `${newPersonFirstName.trim()} ${newPersonLastName.trim()}`.trim(),
							project_id: projectId,
							company: newPersonCompany.trim() || null,
						})
						.select()
						.single()

					if (error) throw error
					if (data) finalEntityId = data.id
				} catch (error) {
					console.error("Error creating person:", error)
					// Continue anyway - we can link later
				}
			}

			setShowAttachmentDialog(false)
			setAttachmentStep("select")
			setSearchQuery("")
			setNewPersonFirstName("")
			setNewPersonLastName("")
			setNewPersonCompany("")

			// If we have a selected file, proceed with file upload
			if (selectedFile) {
				// Prepare attachment info for the upload API
				const fileExtension = selectedFile.name.split(".").pop()?.toLowerCase() || ""
				const sourceType = getFileType(selectedFile)

				// Call onNext with the file and attachment data
				onNext(selectedFile, "interview", projectId, {
					attachType: attachmentType,
					entityId: finalEntityId,
					fileExtension,
					sourceType,
				})
				return
			}

			// Otherwise, start voice recording with attachment info via URL params
			const params = new URLSearchParams()
			params.set("attachType", attachmentType)
			if (finalEntityId) params.set("entityId", finalEntityId)

			recordNow({ projectId, urlParams: params.toString(), mode: "notes" })
		},
		[
			projectId,
			recordNow,
			supabase,
			newPersonFirstName,
			newPersonLastName,
			newPersonCompany,
			selectedFile,
			getFileType,
			onNext,
		]
	)

	const handleShowSearch = useCallback(() => {
		setAttachmentStep("search-existing")
	}, [])

	const handleShowCreateForm = useCallback(() => {
		setAttachmentStep("create-new")
		setNewPersonFirstName("")
		setNewPersonLastName("")
		setNewPersonCompany("")
	}, [])

	const handleBackToSelect = useCallback(() => {
		setAttachmentStep("select")
		setSearchQuery("")
		setNewPersonFirstName("")
		setNewPersonLastName("")
		setNewPersonCompany("")
	}, [])

	// Fetch people and organizations when search dialog opens
	useEffect(() => {
		if (attachmentStep === "search-existing" && projectId && !isLoadingSearch && people.length === 0) {
			setIsLoadingSearch(true)
			Promise.all([
				supabase.from("people").select("*").eq("project_id", projectId).order("name"),
				supabase.from("organizations").select("*").eq("project_id", projectId).order("name"),
			])
				.then(([peopleRes, orgsRes]) => {
					if (peopleRes.data) setPeople(peopleRes.data as Person[])
					if (orgsRes.data) setOrganizations(orgsRes.data as Organization[])
				})
				.finally(() => setIsLoadingSearch(false))
		}
	}, [attachmentStep, projectId, isLoadingSearch, people.length, supabase])

	// Filter results based on search query
	const filteredResults = useCallback(() => {
		const query = searchQuery.toLowerCase().trim()
		if (!query) return [...people, ...organizations].slice(0, 10)

		const matches = [
			...people.filter(
				(p) =>
					p.name?.toLowerCase().includes(query) ||
					p.title?.toLowerCase().includes(query) ||
					p.company?.toLowerCase().includes(query)
			),
			...organizations.filter((o) => o.name?.toLowerCase().includes(query)),
		]
		return matches.slice(0, 10)
	}, [searchQuery, people, organizations])

	const handleNext = useCallback(() => {
		if (selectedFile) {
			// Show attachment dialog for file uploads
			setShowAttachmentDialog(true)
			setAttachmentStep("select")
			setSearchQuery("")
		}
	}, [selectedFile])

	const recordModeOptions: { value: "voice_memo" | "conversation"; label: string; helper: string }[] = [
		{ value: "voice_memo", label: "Voice Memo", helper: "Updates, Notes, Todos, etc." },
		{ value: "conversation", label: "Live Conversation", helper: "Calls, meetings, interviews" },
	]

	const formatFileSize = (bytes: number): string => {
		if (bytes === 0) return "0 Bytes"
		const k = 1024
		const sizes = ["Bytes", "KB", "MB", "GB"]
		const i = Math.floor(Math.log(bytes) / Math.log(k))
		return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
	}

	const getFileIcon = (file: File) => {
		if (file.type.startsWith("video/")) return <Video className="h-6 w-6" />
		if (file.type.startsWith("audio/")) return <Mic className="h-6 w-6" />
		return <File className="h-6 w-6" />
	}

	return (
		<div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
			{/* Subtle animated background gradient */}
			<div className="pointer-events-none absolute inset-0 opacity-30">
				<div className="-left-40 absolute top-0 h-96 w-96 animate-blob rounded-full bg-purple-300 opacity-70 mix-blend-multiply blur-3xl filter dark:bg-purple-900/20" />
				<div className="animation-delay-2000 -right-40 absolute top-0 h-96 w-96 animate-blob rounded-full bg-blue-300 opacity-70 mix-blend-multiply blur-3xl filter dark:bg-blue-900/20" />
				<div className="animation-delay-4000 -bottom-40 absolute left-1/2 h-96 w-96 animate-blob rounded-full bg-pink-300 opacity-70 mix-blend-multiply blur-3xl filter dark:bg-pink-900/20" />
			</div>

			{/* Hidden file input */}
			<input
				ref={fileInputRef}
				type="file"
				onChange={handleFileInputChange}
				accept="audio/*,video/*,.mp3,.mp4,.wav,.m4a,.mov,.avi,.txt,.md"
				className="hidden"
			/>

			{/* Main Content */}
			<div className="relative mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
				{/* Header */}
				<div className="mb-12 text-center">
					<h1 className="mb-3 font-bold text-4xl text-slate-900 tracking-tight dark:text-white">
						Add Conversations and Notes
					</h1>
				</div>

				{/* Error Alert */}
				{error && (
					<div className="fade-in slide-in-from-top-2 mb-8 w-full animate-in duration-300">
						<div className="rounded-2xl border border-red-200 bg-red-50/80 p-5 backdrop-blur-sm dark:border-red-900/50 dark:bg-red-950/30">
							<div className="flex gap-4">
								<div className="flex-shrink-0">
									<div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
										<svg className="h-5 w-5 text-red-600 dark:text-red-400" viewBox="0 0 20 20" fill="currentColor">
											<path
												fillRule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
												clipRule="evenodd"
											/>
										</svg>
									</div>
								</div>
								<div className="flex-1">
									<h3 className="font-semibold text-red-900 text-sm dark:text-red-200">Upload Failed</h3>
									<p className="mt-1 text-red-700 text-sm dark:text-red-300">{error}</p>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Main Options */}
				<div className="w-full space-y-4">
					{/* Record Card */}
					<div
						onClick={handleRecordNow}
						className={cn(
							"group w-full rounded-3xl border border-slate-200/60 bg-white/80 p-10 shadow-slate-900/5 shadow-xl backdrop-blur-sm transition-all duration-300 hover:shadow-2xl hover:shadow-slate-900/10 dark:border-slate-800/60 dark:bg-slate-900/80",
							"hover:scale-[1.01] cursor-pointer",
							isRecording && "cursor-not-allowed opacity-50"
						)}
					>
						<div className="flex items-center gap-6">
							<div
								className={cn(
									"flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full transition-all duration-300",
									"bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/30",
									"group-hover:scale-105 group-hover:shadow-red-500/40 group-hover:shadow-xl",
									isRecording && "animate-pulse"
								)}
							>
								<Mic className="h-9 w-9 text-white" />
							</div>
							<div className="flex-1 text-left">
								<h3 className="mb-2 font-semibold text-slate-900 text-xl dark:text-white">Record Now</h3>
								<div className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 p-1 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
									{recordModeOptions.map((option) => (
										<button
											key={option.value}
											type="button"
											onClick={(e) => {
												e.stopPropagation()
												setRecordMode(option.value)
											}}
											className={cn(
												"relative rounded-full px-4 py-1.5 font-medium transition",
												recordMode === option.value
													? "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-sm"
													: "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
											)}
										>
											<div className="flex flex-col leading-tight">
												<span>{option.label}</span>
												<span className="font-normal text-xs opacity-80">{option.helper}</span>
											</div>
										</button>
									))}
								</div>
							</div>
						</div>
					</div>

					{/* Divider */}
					<div className="relative flex items-center py-2">
						<div className="flex-grow border-slate-300 border-t dark:border-slate-700" />
						<span className="mx-4 flex-shrink font-medium text-slate-500 text-sm dark:text-slate-400">or</span>
						<div className="flex-grow border-slate-300 border-t dark:border-slate-700" />
					</div>

					{/* Upload Card */}
					<div
						onClick={selectedFile ? undefined : triggerFileInput}
						className={cn(
							"group cursor-pointer rounded-3xl border-2 border-dashed p-10 transition-all duration-300",
							"bg-white/80 shadow-slate-900/5 shadow-xl backdrop-blur-sm",
							"dark:bg-slate-900/80",
							isDragOver
								? "border-blue-400 bg-blue-50/50 shadow-blue-500/20 dark:border-blue-600 dark:bg-blue-950/30"
								: selectedFile
									? "border-green-400 bg-green-50/50 dark:border-green-600 dark:bg-green-950/30"
									: "border-slate-300 hover:scale-[1.01] hover:border-slate-400 hover:shadow-2xl hover:shadow-slate-900/10 dark:border-slate-700 dark:hover:border-slate-600"
						)}
						onDragOver={handleDragOver}
						onDragLeave={handleDragLeave}
						onDrop={handleDrop}
					>
						{selectedFile ? (
							/* Selected File Display */
							<div className="fade-in slide-in-from-bottom-2 flex animate-in items-center gap-6 duration-300">
								<div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-green-500/30 shadow-lg">
									{getFileIcon(selectedFile)}
								</div>
								<div className="min-w-0 flex-1">
									<h3 className="truncate font-semibold text-slate-900 text-xl dark:text-white">{selectedFile.name}</h3>
									<p className="text-slate-600 dark:text-slate-400">{formatFileSize(selectedFile.size)}</p>
								</div>
								<CheckCircle className="h-10 w-10 flex-shrink-0 text-green-500" />
							</div>
						) : (
							/* Upload Prompt */
							<div className="flex items-center gap-6">
								<div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl border-2 border-slate-200 bg-slate-50 transition-all duration-300 group-hover:border-blue-300 group-hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:group-hover:border-blue-700 dark:group-hover:bg-blue-950/30">
									<Upload className="h-9 w-9 text-slate-400 transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400" />
								</div>
								<div className="flex-1 text-left">
									<h3 className="mb-1 font-semibold text-slate-900 text-xl dark:text-white">Upload File</h3>
									<p className="text-slate-600 dark:text-slate-400">Audio, video, or transcript, document, URL or virtually any background material. Drag n drop.</p>
								</div>
							</div>
						)}
					</div>

					{/* Action Button */}
					{selectedFile && (
						<Button
							onClick={handleNext}
							size="lg"
							className="fade-in slide-in-from-bottom-2 h-14 w-full animate-in rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 font-semibold text-base text-white shadow-blue-500/30 shadow-lg transition-all duration-300 duration-300 hover:scale-[1.02] hover:shadow-blue-500/40 hover:shadow-xl"
						>
							<Sparkles className="mr-2 h-5 w-5" />
							Upload & Process
						</Button>
					)}
				</div>
			</div>

			{/* Attachment Selection Dialog for Voice Memos */}
			<Dialog open={showAttachmentDialog} onOpenChange={setShowAttachmentDialog}>
				<DialogContent className="sm:max-w-md">
					{attachmentStep === "select" ? (
						<>
							<DialogHeader>
								<DialogTitle>Attach note to...</DialogTitle>
								<DialogDescription>Choose who or what this voice memo should be attached to</DialogDescription>
							</DialogHeader>

							<div className="grid gap-3 py-4">
						{/* Todo Option */}
						<button
							onClick={() => handleAttachmentSelect("todo")}
							className="group flex items-center gap-4 rounded-xl border-2 border-slate-200 bg-white p-4 text-left transition-all hover:border-blue-500 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-500 dark:hover:bg-blue-950"
						>
							<div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white">
								<ListTodo className="h-6 w-6" />
							</div>
							<div className="flex-1">
								<h3 className="font-semibold text-slate-900 dark:text-white">Todo</h3>
								<p className="text-slate-600 text-sm dark:text-slate-400">Create a new task or reminder</p>
							</div>
						</button>

						{/* Existing Contact/Org Option */}
						<button
							onClick={handleShowSearch}
							className="group flex items-center gap-4 rounded-xl border-2 border-slate-200 bg-white p-4 text-left transition-all hover:border-green-500 hover:bg-green-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-green-500 dark:hover:bg-green-950"
						>
							<div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-green-600 text-white">
								<Users className="h-6 w-6" />
							</div>
							<div className="flex-1">
								<h3 className="font-semibold text-slate-900 dark:text-white">Existing Contact/Org</h3>
								<p className="text-slate-600 text-sm dark:text-slate-400">Search and attach to someone in your project</p>
							</div>
						</button>

						{/* New Contact/Org Option */}
						<button
							onClick={handleShowCreateForm}
							className="group flex items-center gap-4 rounded-xl border-2 border-slate-200 bg-white p-4 text-left transition-all hover:border-purple-500 hover:bg-purple-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-purple-500 dark:hover:bg-purple-950"
						>
							<div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-purple-600 text-white">
								<UserPlus className="h-6 w-6" />
							</div>
							<div className="flex-1">
								<h3 className="font-semibold text-slate-900 dark:text-white">New Contact/Org</h3>
								<p className="text-slate-600 text-sm dark:text-slate-400">Create and attach to new person or company</p>
							</div>
						</button>

						{/* General Note Option */}
						<button
							onClick={() => handleAttachmentSelect("general")}
							className="group flex items-center gap-4 rounded-xl border-2 border-slate-200 bg-white p-4 text-left transition-all hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-500 dark:hover:bg-slate-800"
						>
							<div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-slate-500 to-slate-600 text-white">
								<File className="h-6 w-6" />
							</div>
							<div className="flex-1">
								<h3 className="font-semibold text-slate-900 dark:text-white">General Note</h3>
								<p className="text-slate-600 text-sm dark:text-slate-400">Not attached to anyone or anything specific</p>
							</div>
						</button>
					</div>

					{/* Skip for now button */}
					<div className="border-slate-300 border-t pt-3 dark:border-slate-700">
						<Button
							variant="ghost"
							className="w-full text-muted-foreground"
							onClick={() => handleAttachmentSelect("skip")}
						>
							Skip for now - I'll link it later
						</Button>
							</div>
						</>
					) : attachmentStep === "search-existing" ? (
						<>
							<DialogHeader>
								<div className="flex items-center gap-2">
									<Button variant="ghost" size="icon" onClick={handleBackToSelect} className="h-8 w-8">
										<ArrowLeft className="h-4 w-4" />
									</Button>
									<div className="flex-1">
										<DialogTitle>Search Contact/Organization</DialogTitle>
										<DialogDescription>Find who to attach this note to</DialogDescription>
									</div>
								</div>
							</DialogHeader>

							<div className="space-y-4 py-4">
								{/* Search Input */}
								<div className="relative">
									<Search className="absolute top-3 left-3 h-4 w-4 text-slate-400" />
									<Input
										placeholder="Search people or organizations..."
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
										className="pl-9"
										autoFocus
									/>
								</div>

								{/* Search Results */}
								<div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 p-2 dark:border-slate-700 dark:bg-slate-900/50">
									{isLoadingSearch ? (
										<p className="py-8 text-center text-muted-foreground text-sm">Loading...</p>
									) : filteredResults().length === 0 ? (
										<p className="py-8 text-center text-muted-foreground text-sm">
											{searchQuery ? "No results found" : "Start typing to search..."}
										</p>
									) : (
										filteredResults().map((item) => {
											const isPerson = "title" in item
											return (
												<button
													key={item.id}
													onClick={() => handleAttachmentSelect("existing", item.id)}
													className="flex w-full items-center gap-3 rounded-lg border border-transparent p-3 text-left transition-colors hover:border-slate-300 hover:bg-white dark:hover:border-slate-600 dark:hover:bg-slate-800"
												>
													<div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-green-600 text-white">
														{isPerson ? (
															<Users className="h-5 w-5" />
														) : (
															<Users className="h-5 w-5" />
														)}
													</div>
													<div className="flex-1 min-w-0">
														<h4 className="truncate font-semibold text-sm">{item.name}</h4>
														{isPerson && (item as Person).title && (
															<p className="truncate text-muted-foreground text-xs">
																{(item as Person).title}
																{(item as Person).company && ` • ${(item as Person).company}`}
															</p>
														)}
													</div>
												</button>
											)
										})
									)}
								</div>

								{/* Create New Button */}
								<Button
									variant="outline"
									className="w-full"
									onClick={handleShowCreateForm}
								>
									<UserPlus className="mr-2 h-4 w-4" />
									Can't find them? Create new contact/org
								</Button>
							</div>
						</>
					) : attachmentStep === "create-new" ? (
						<>
							<DialogHeader>
								<div className="flex items-center gap-2">
									<Button variant="ghost" size="icon" onClick={handleBackToSelect} className="h-8 w-8">
										<ArrowLeft className="h-4 w-4" />
									</Button>
									<div className="flex-1">
										<DialogTitle>New Contact/Organization</DialogTitle>
										<DialogDescription>Quick details to get started</DialogDescription>
									</div>
								</div>
							</DialogHeader>

							<div className="space-y-4 py-4">
								{/* First Name */}
								<div className="space-y-2">
									<label htmlFor="firstName" className="font-medium text-sm">
										First Name
									</label>
									<Input
										id="firstName"
										placeholder="Enter first name"
										value={newPersonFirstName}
										onChange={(e) => setNewPersonFirstName(e.target.value)}
										autoFocus
									/>
								</div>

								{/* Last Name */}
								<div className="space-y-2">
									<label htmlFor="lastName" className="font-medium text-sm">
										Last Name
									</label>
									<Input
										id="lastName"
										placeholder="Enter last name"
										value={newPersonLastName}
										onChange={(e) => setNewPersonLastName(e.target.value)}
									/>
								</div>

								{/* Company */}
								<div className="space-y-2">
									<label htmlFor="company" className="font-medium text-sm">
										Company
									</label>
									<Input
										id="company"
										placeholder="Enter company name"
										value={newPersonCompany}
										onChange={(e) => setNewPersonCompany(e.target.value)}
									/>
								</div>

								{/* Start Recording Button */}
								<Button
									className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
									onClick={() => handleAttachmentSelect("new")}
									disabled={!newPersonFirstName.trim()}
								>
									<Mic className="mr-2 h-4 w-4" />
									Start Recording
								</Button>
							</div>
						</>
					) : null}
				</DialogContent>
			</Dialog>
		</div>
	)
}
