import consola from "consola"
import { CheckCircle, ChevronLeft, File, Mic, Upload, Video } from "lucide-react"
import { useCallback, useMemo, useRef, useState } from "react"
import { useNavigate, useRouteLoaderData } from "react-router"
import { Button } from "~/components/ui/button"
import { OnboardingStepper } from "./OnboardingStepper"

interface UploadScreenProps {
	onNext: (file: File, mediaType: string, projectId?: string) => void
	onBack: () => void
	projectId?: string
}

export default function UploadScreen({ onNext, onBack, projectId }: UploadScreenProps) {
	const [selectedFile, setSelectedFile] = useState<File | null>(null)
	const [mediaType, setMediaType] = useState("interview")
	const [isDragOver, setIsDragOver] = useState(false)
	const fileInputRef = useRef<HTMLInputElement>(null)

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

	const navigate = useNavigate()
	const routeData = useRouteLoaderData("routes/_ProtectedLayout") as { auth: { accountId: string } } | null
	const auth = useMemo(() => routeData?.auth || { accountId: "" }, [routeData])
	const [recordingStart, setRecordingStart] = useState(false)

	const handleRecordNow = useCallback(async () => {
		try {
			setRecordingStart(true)
			// If we have a projectId, create an interview in that project; else create project+interview
			if (projectId) {
				const res = await fetch(`/a/${auth.accountId}/${projectId}/api/interviews/realtime-start`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({}),
				})
				const data = await res.json()
				if (!res.ok) throw new Error(data?.error || "Failed to start interview")
				navigate(`/a/${auth.accountId}/${projectId}/interviews/${data.interviewId}/realtime`)
				return
			}

			const res = await fetch(`/a/${auth.accountId}/api/interviews/record-now`, { method: "POST" })
			const data = await res.json()
			if (!res.ok) throw new Error(data?.error || "Failed to start quick recording")
			const { projectId: newProjectId, interviewId } = data
			if (newProjectId && interviewId) {
				navigate(`/a/${auth.accountId}/${newProjectId}/interviews/${interviewId}/realtime`)
				return
			}
			throw new Error("Invalid response from Record Now API")
		} catch (e: any) {
			// Fallback: go to create project if we couldn't start
			consola.error("Record Now error:", e?.message || e)
			navigate(`/a/${auth.accountId}/projects/new?from=record`)
		} finally {
			setRecordingStart(false)
		}
	}, [auth.accountId, navigate, projectId])

	const handleNext = useCallback(() => {
		if (selectedFile) {
			onNext(selectedFile, mediaType, projectId)
		}
	}, [selectedFile, mediaType, projectId, onNext])

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

	const onboardingSteps = [
		{ id: "goals", title: "Project Goals", description: "Define objectives" },
		{ id: "questions", title: "Questions", description: "Generate questions" },
		{ id: "upload", title: "Upload", description: "Add interviews" },
	]

	return (
		<div className="relative min-h-screen bg-background p-4 text-foreground sm:p-4 md:p-6 lg:p-8">
			{/* Hidden file input */}
			<input
				ref={fileInputRef}
				type="file"
				onChange={handleFileInputChange}
				accept="audio/*,video/*,.mp3,.mp4,.wav,.m4a,.mov,.avi,.txt,.md"
				className="hidden"
			/>

			{/* Stepper */}
			<div className="bg-background p-4 pb-8">
				<OnboardingStepper steps={onboardingSteps} currentStepId="upload" className="text-foreground" />
			</div>



			{/* Main Content */}
			<div className="mx-auto max-w-xl">
				<div className="space-y-6">
					{/* Instructions */}
					{/* <div className="space-y-2">
						<div className="flex items-center gap-2 text-purple-400">
							<Upload className="h-5 w-5" />
							<span className="font-medium text-sm">Media Upload</span>
						</div> */}
					{/* <h2 className="font-bold text-2xl text-foreground">Add your first interview</h2> */}
					{/* <p className="text-gray-300 text-sm leading-relaxed">
							Upload an audio, video or transcript from a conversation or interview.
						</p>
					</div> */}

					{/* Primary Record Action */}
					<div className="text-center">
						<Button
							onClick={handleRecordNow}
							size="lg"
							disabled={recordingStart}
							className="m-0 h-15 w-15 rounded-full bg-red-600 p-0 text-foreground hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-black"
						>
							<Mic className="h-20 w-20" />
						</Button>
						<p className="mt-3 font-medium text-foreground">Record Now</p>
					</div>

					{/* Divider */}
					<div className="flex items-center gap-4">
						<div className="h-px flex-1 bg-border" />
						<span className="text-muted-foreground text-sm">or</span>
						<div className="h-px flex-1 bg-border" />
					</div>

					{/* Upload Area */}
					<div
						className={`rounded-lg border-2 border-dashed p-6 transition-all duration-200 ${isDragOver
							? "border-blue-500 bg-blue-500/10"
							: selectedFile
								? "border-green-500 bg-green-500/10"
								: "border-muted bg-muted/50 hover:bg-muted/80"
							}`}
						onDragOver={handleDragOver}
						onDragLeave={handleDragLeave}
						onDrop={handleDrop}
					>
						{selectedFile ? (
							/* Selected File Display */
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-600 text-foreground">
									{getFileIcon(selectedFile)}
								</div>
								<div className="min-w-0 flex-1">
									<h3 className="truncate font-medium text-foreground text-sm">{selectedFile.name}</h3>
									<p className="text-muted-foreground text-xs">{formatFileSize(selectedFile.size)}</p>
								</div>
								<CheckCircle className="h-5 w-5 flex-shrink-0 text-green-400" />
							</div>
						) : (
							/* Upload Prompt */
							<div className="text-center">
								<div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted">
									<Upload className="h-6 w-6 text-muted-foreground" />
								</div>
								<p className="mb-3 text-foreground text-sm">Drop your Video, Audio, or Text/MD file (45MB Limit)</p>
								<Button
									onClick={triggerFileInput}
									variant="outline"
									size="sm"
									className="border-border bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground"
								>
									<File className="mr-2 h-4 w-4" />
									Browse Files
								</Button>
							</div>
						)}
					</div>

					{/* Content Type Selection */}
					<div className="space-y-3">
						<label className="font-medium text-foreground text-sm">Context</label>
						<div className="grid grid-cols-2 gap-2">
							<Button
								variant={mediaType === "interview" ? "default" : "outline"}
								onClick={() => setMediaType("interview")}
								size="sm"
								className={`h-10 text-xs ${mediaType === "interview"
									? "bg-primary text-primary-foreground hover:bg-primary/90"
									: "border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
									}`}
							>
								User Interview
							</Button>
							<Button
								variant={mediaType === "focus-group" ? "default" : "outline"}
								onClick={() => setMediaType("focus-group")}
								size="sm"
								className={`h-10 text-xs ${mediaType === "focus-group"
									? "bg-primary text-primary-foreground hover:bg-primary/90"
									: "border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
									}`}
							>
								Focus Group
							</Button>
							<Button
								variant={mediaType === "customer-call" ? "default" : "outline"}
								onClick={() => setMediaType("customer-call")}
								size="sm"
								className={`h-10 text-xs ${mediaType === "customer-call"
									? "bg-primary text-primary-foreground hover:bg-primary/90"
									: "border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
									}`}
							>
								Customer Call
							</Button>
							<Button
								variant={mediaType === "user-testing" ? "default" : "outline"}
								onClick={() => setMediaType("user-testing")}
								size="sm"
								className={`h-10 text-xs ${mediaType === "user-testing"
									? "bg-primary text-primary-foreground hover:bg-primary/90"
									: "border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
									}`}
							>
								User Testing
							</Button>
							<Button
								variant={mediaType === "document" ? "default" : "outline"}
								onClick={() => setMediaType("document")}
								size="sm"
								className={`h-10 text-xs ${mediaType === "document"
									? "bg-primary text-primary-foreground hover:bg-primary/90"
									: "border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
									}`}
							>
								Background Document
							</Button>
						</div>
					</div>
				</div>
			</div>

			{/* Bottom Action */}
			<div className="mx-auto mt-8 mb-20 max-w-xl border-border border-t bg-background p-4">
				<Button
					onClick={handleNext}
					disabled={!selectedFile}
					className="h-12 w-full bg-primary font-medium text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
				>
					{selectedFile ? "Start Analysis" : "Select a file to continue"}
				</Button>
				{selectedFile && (
					<p className="mt-2 text-center text-muted-foreground text-xs">Ready to process: {selectedFile.name}</p>
				)}
			</div>

			{/* Header */}
			<div className="border-border bg-background p-2">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<Button variant="ghost" onClick={onBack} className="h-8 w-8 text-foreground">
							<ChevronLeft className="h-4 w-4" />
							Back
						</Button>
					</div>
				</div>
			</div>

		</div>
	)
}
