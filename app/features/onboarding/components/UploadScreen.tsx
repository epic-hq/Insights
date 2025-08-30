import { CheckCircle, ChevronLeft, File, Mic, Upload, Video } from "lucide-react"
import { useRef, useState } from "react"
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

	const handleRecordNow = () => {
		alert("Coming soon")
	}

	const handleNext = () => {
		if (selectedFile) {
			onNext(selectedFile, mediaType, projectId)
		}
	}

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
		<div className="relative min-h-screen bg-black p-4 text-white sm:p-4 md:p-6 lg:p-8">
			{/* Hidden file input */}
			<input
				ref={fileInputRef}
				type="file"
				onChange={handleFileInputChange}
				accept="audio/*,video/*,.mp3,.mp4,.wav,.m4a,.mov,.avi,.txt,.md"
				className="hidden"
			/>

			{/* Stepper */}
			<div className="bg-black p-4 pb-8">
				<OnboardingStepper steps={onboardingSteps} currentStepId="upload" className="text-white" />
			</div>

			{/* Header */}
			<div className="border-gray-800 border-b bg-black p-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 text-white hover:bg-gray-800">
							<ChevronLeft className="h-4 w-4" />
						</Button>
					</div>
				</div>
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
					{/* <h2 className="font-bold text-2xl text-white">Add your first interview</h2> */}
					{/* <p className="text-gray-300 text-sm leading-relaxed">
							Upload an audio, video or transcript from a conversation or interview.
						</p>
					</div> */}

					{/* Primary Record Action */}
					<div className="text-center">
						<Button
							onClick={handleRecordNow}
							size="lg"
							className="h-20 w-20 rounded-full bg-red-600 p-0 text-white hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-black"
						>
							<Mic className="h-8 w-8" />
						</Button>
						<p className="mt-3 font-medium text-white">Record Now</p>
						<p className="text-gray-400 text-sm">Start recording your interview</p>
					</div>

					{/* Divider */}
					<div className="flex items-center gap-4">
						<div className="h-px flex-1 bg-gray-700" />
						<span className="text-gray-400 text-sm">or</span>
						<div className="h-px flex-1 bg-gray-700" />
					</div>

					{/* Upload Area */}
					<div
						className={`rounded-lg border-2 border-dashed p-6 transition-all duration-200 ${
							isDragOver
								? "border-blue-500 bg-blue-500/10"
								: selectedFile
									? "border-green-500 bg-green-500/5"
									: "border-gray-600 bg-gray-900/50"
						}`}
						onDragOver={handleDragOver}
						onDragLeave={handleDragLeave}
						onDrop={handleDrop}
					>
						{selectedFile ? (
							/* Selected File Display */
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-600 text-white">
									{getFileIcon(selectedFile)}
								</div>
								<div className="min-w-0 flex-1">
									<h3 className="truncate font-medium text-sm text-white">{selectedFile.name}</h3>
									<p className="text-gray-400 text-xs">{formatFileSize(selectedFile.size)}</p>
								</div>
								<CheckCircle className="h-5 w-5 flex-shrink-0 text-green-400" />
							</div>
						) : (
							/* Upload Prompt */
							<div className="text-center">
								<div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-800">
									<Upload className="h-6 w-6 text-gray-400" />
								</div>
								<p className="mb-3 text-gray-300 text-sm">Drop your file here or</p>
								<Button
									onClick={triggerFileInput}
									variant="outline"
									size="sm"
									className="border-gray-600 bg-transparent text-white hover:bg-gray-800"
								>
									<File className="mr-2 h-4 w-4" />
									Browse Files
								</Button>
							</div>
						)}
					</div>

					{/* Content Type Selection */}
					<div className="space-y-3">
						<label className="font-medium text-sm text-white">Type of content</label>
						<div className="grid grid-cols-2 gap-2">
							<Button
								variant={mediaType === "interview" ? "default" : "outline"}
								onClick={() => setMediaType("interview")}
								size="sm"
								className={`h-10 text-xs ${
									mediaType === "interview"
										? "bg-blue-600 text-white hover:bg-blue-700"
										: "border-gray-600 bg-transparent text-gray-300 hover:bg-gray-800 hover:text-white"
								}`}
							>
								User Interview
							</Button>
							<Button
								variant={mediaType === "focus-group" ? "default" : "outline"}
								onClick={() => setMediaType("focus-group")}
								size="sm"
								className={`h-10 text-xs ${
									mediaType === "focus-group"
										? "bg-blue-600 text-white hover:bg-blue-700"
										: "border-gray-600 bg-transparent text-gray-300 hover:bg-gray-800 hover:text-white"
								}`}
							>
								Focus Group
							</Button>
							<Button
								variant={mediaType === "customer-call" ? "default" : "outline"}
								onClick={() => setMediaType("customer-call")}
								size="sm"
								className={`h-10 text-xs ${
									mediaType === "customer-call"
										? "bg-blue-600 text-white hover:bg-blue-700"
										: "border-gray-600 bg-transparent text-gray-300 hover:bg-gray-800 hover:text-white"
								}`}
							>
								Customer Call
							</Button>
							<Button
								variant={mediaType === "user-testing" ? "default" : "outline"}
								onClick={() => setMediaType("user-testing")}
								size="sm"
								className={`h-10 text-xs ${
									mediaType === "user-testing"
										? "bg-blue-600 text-white hover:bg-blue-700"
										: "border-gray-600 bg-transparent text-gray-300 hover:bg-gray-800 hover:text-white"
								}`}
							>
								User Testing
							</Button>
						</div>
					</div>

					{/* File Requirements - Compact */}
					<div className="rounded-lg bg-gray-900/50 p-3">
						<p className="mb-2 font-medium text-gray-300 text-xs">
							Supported: MP3, MP4, WAV, M4A, MOV, AVI, TXT, MD (max 500MB)
						</p>
						<p className="text-gray-400 text-xs">💡 Clear audio works best</p>
					</div>
				</div>
			</div>

			{/* Bottom Action */}
			<div className="mx-auto mt-8 mb-20 max-w-xl border-gray-800 border-t bg-black p-4">
				<Button
					onClick={handleNext}
					disabled={!selectedFile}
					className="h-12 w-full bg-blue-600 font-medium text-white hover:bg-blue-700 disabled:bg-gray-800 disabled:text-gray-400"
				>
					{selectedFile ? "Start Analysis" : "Select a file to continue"}
				</Button>
				{selectedFile && (
					<p className="mt-2 text-center text-gray-400 text-xs">Ready to process: {selectedFile.name}</p>
				)}
			</div>
		</div>
	)
}
