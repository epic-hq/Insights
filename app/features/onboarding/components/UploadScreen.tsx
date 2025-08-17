import { Camera, CheckCircle, ChevronLeft, File, Mic, Upload, Video } from "lucide-react"
import { useRef, useState } from "react"
import { Button } from "~/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"

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

	return (
		<div className="relative min-h-screen bg-black text-white">
			{/* Hidden file input */}
			<input
				ref={fileInputRef}
				type="file"
				onChange={handleFileInputChange}
				accept="audio/*,video/*,.mp3,.mp4,.wav,.m4a,.mov,.avi"
				className="hidden"
			/>

			{/* Header */}
			<div className="border-gray-800 border-b bg-black p-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 text-white hover:bg-gray-800">
							<ChevronLeft className="h-4 w-4" />
						</Button>
						<div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 font-medium text-sm text-white">
							3
						</div>
						<h1 className="font-semibold text-lg text-white">Upload your interview</h1>
					</div>
					<div className="text-gray-400 text-sm">Step 3 of 3</div>
				</div>
			</div>

			{/* Main Content */}
			<div className="p-4">
				<div className="space-y-6">
					{/* Instructions */}
					<div className="space-y-2">
						<div className="flex items-center gap-2 text-purple-400">
							<Upload className="h-5 w-5" />
							<span className="font-medium text-sm">Media Upload</span>
						</div>
						<h2 className="font-bold text-2xl text-white">Add your first interview</h2>
						<p className="text-gray-300 text-sm leading-relaxed">
							Upload an audio or video file of your interview. We support most common formats including MP3, MP4, WAV,
							and MOV.
						</p>
					</div>

					{/* Media Type Selection */}
					<div className="space-y-3">
						<label className="font-medium text-sm text-white">Type of content</label>
						<Select value={mediaType} onValueChange={setMediaType}>
							<SelectTrigger className="h-12 border-gray-700 bg-gray-900 text-white">
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="border-gray-700 bg-gray-900 text-white">
								<SelectItem value="interview">User Interview</SelectItem>
								<SelectItem value="focus-group">Focus Group</SelectItem>
								<SelectItem value="customer-call">Customer Call</SelectItem>
								<SelectItem value="user-testing">User Testing Session</SelectItem>
								<SelectItem value="other">Other</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{/* Upload Area */}
					<div
						className={`rounded-lg border-2 border-dashed p-8 transition-all duration-200 ${
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
							<div className="flex items-center gap-4">
								<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-600 text-white">
									{getFileIcon(selectedFile)}
								</div>
								<div className="min-w-0 flex-1">
									<h3 className="truncate font-medium text-sm text-white">{selectedFile.name}</h3>
									<p className="text-gray-400 text-xs">{formatFileSize(selectedFile.size)}</p>
								</div>
								<CheckCircle className="h-6 w-6 flex-shrink-0 text-green-400" />
							</div>
						) : (
							/* Upload Prompt */
							<div className="text-center">
								<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-800">
									<Upload className="h-8 w-8 text-gray-400" />
								</div>
								<h3 className="mb-2 font-medium text-white">Drop your file here</h3>
								<p className="mb-4 text-gray-400 text-sm">or</p>
								<Button
									onClick={triggerFileInput}
									variant="outline"
									className="border-gray-600 bg-transparent text-white hover:bg-gray-800"
								>
									Choose from device
								</Button>
							</div>
						)}
					</div>

					{/* Quick Actions */}
					<div className="grid grid-cols-2 gap-3">
						<Button
							variant="outline"
							onClick={triggerFileInput}
							className="h-12 border-gray-600 bg-transparent text-white hover:bg-gray-800"
						>
							<File className="mr-2 h-4 w-4" />
							Browse Files
						</Button>
						<Button
							variant="outline"
							onClick={() => {
								// In a real app, this would trigger camera/microphone
								triggerFileInput()
							}}
							className="h-12 border-gray-600 bg-transparent text-white hover:bg-gray-800"
						>
							<Camera className="mr-2 h-4 w-4" />
							Record Now
						</Button>
					</div>

					{/* File Requirements */}
					<div className="rounded-lg bg-gray-900 p-4">
						<div className="flex items-start gap-3">
							<div className="mt-1 h-2 w-2 rounded-full bg-blue-400" />
							<div>
								<p className="font-medium text-sm text-white">File requirements</p>
								<ul className="mt-1 space-y-1 text-gray-300 text-xs">
									<li>• Supported formats: MP3, MP4, WAV, M4A, MOV, AVI</li>
									<li>• Maximum file size: 500MB</li>
									<li>• For best results: Clear audio, minimal background noise</li>
								</ul>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Bottom Action */}
			<div className="mt-8 mb-20 border-gray-800 border-t bg-black p-4">
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
