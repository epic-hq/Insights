import consola from "consola"
import { AnimatePresence, motion } from "framer-motion"
import { BookOpen, CheckCircle, FileIcon, Lightbulb, Loader, Shield, Target, Upload, Users } from "lucide-react"
import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Separator } from "~/components/ui/separator"
import { Textarea } from "~/components/ui/textarea"
import { useAuth } from "~/contexts/AuthContext"

interface FileWithPreview {
	id: string
	name: string
	size: number
	type: string
	file: File
}

interface OnboardingCardData {
	id: number
	title: string
	description: string
	icon: React.ReactNode
	content: React.ReactNode
	progress?: number
}

const UserOnboardingWidget = () => {
	const [currentStep, setCurrentStep] = useState<"upload" | "processing">("upload")
	const [files, setFiles] = useState<FileWithPreview[]>([])
	const [isDragging, setIsDragging] = useState(false)
	const [customInstructions, setCustomInstructions] = useState("Understand personas, goals and challenges.")
	const [currentCard, setCurrentCard] = useState(0)
	const [isPlaying] = useState(true)
	const [processingProgress, setProcessingProgress] = useState(0)
	const [_isUploading, setIsUploading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [processingMessage, setProcessingMessage] = useState<string>("")
	const fileInputRef = useRef<HTMLInputElement>(null)
	const navigate = useNavigate()
	const { accountId, projectId } = useAuth()
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	const onboardingCards: OnboardingCardData[] = [
		{
			id: 1,
			title: "Processing Your Interview",
			description: "We're analyzing your interview using advanced AI to extract meaningful insights.",
			icon: <Loader className="h-8 w-8 animate-spin text-primary" />,
			content: (
				<div className="space-y-2">
					<p className="text-muted-foreground text-sm">{processingMessage}</p>
				</div>
			),
			progress: processingProgress,
		},
		{
			id: 2,
			title: "What Happens Next",
			description: "Our AI will identify key themes, sentiments, and actionable insights from your interview.",
			icon: <Target className="h-8 w-8 text-primary" />,
			content: (
				<div className="space-y-3">
					<div className="flex items-center gap-3">
						<div className="h-2 w-2 rounded-full bg-primary" />
						<span className="text-sm">Extract key themes and topics</span>
					</div>
					<div className="flex items-center gap-3">
						<div className="h-2 w-2 rounded-full bg-primary" />
						<span className="text-sm">Analyze sentiment and emotions</span>
					</div>
					<div className="flex items-center gap-3">
						<div className="h-2 w-2 rounded-full bg-primary" />
						<span className="text-sm">Generate actionable insights</span>
					</div>
				</div>
			),
		},
		{
			id: 3,
			title: "Tips for Best Results",
			description: "Get the most out of your analysis with these recommendations.",
			icon: <Lightbulb className="h-8 w-8 text-primary" />,
			content: (
				<div className="space-y-3">
					<div className="rounded-lg bg-secondary p-3">
						<p className="font-medium text-sm">Audio Quality</p>
						<p className="text-muted-foreground text-xs">Clear audio with minimal background noise works best</p>
					</div>
					<div className="rounded-lg bg-secondary p-3">
						<p className="font-medium text-sm">Interview Length</p>
						<p className="text-muted-foreground text-xs">15-60 minute interviews provide optimal insights</p>
					</div>
				</div>
			),
		},
		{
			id: 4,
			title: "Explore Features",
			description: "Discover powerful tools to analyze and share your insights.",
			icon: <Users className="h-8 w-8 text-primary" />,
			content: (
				<div className="grid grid-cols-2 gap-3">
					<div className="rounded-lg bg-secondary p-3 text-center">
						<div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
							<Target className="h-4 w-4 text-primary" />
						</div>
						<p className="font-medium text-xs">Insights Dashboard</p>
					</div>
					<div className="rounded-lg bg-secondary p-3 text-center">
						<div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
							<Users className="h-4 w-4 text-primary" />
						</div>
						<p className="font-medium text-xs">Team Sharing</p>
					</div>
				</div>
			),
		},
		{
			id: 5,
			title: "Your Privacy Matters",
			description: "Your data is encrypted and secure. We never share your content with third parties.",
			icon: <Shield className="h-8 w-8 text-primary" />,
			content: (
				<div className="space-y-3">
					<div className="flex items-center gap-3">
						<CheckCircle className="h-5 w-5 text-green-500" />
						<span className="text-sm">End-to-end encryption</span>
					</div>
					<div className="flex items-center gap-3">
						<CheckCircle className="h-5 w-5 text-green-500" />
						<span className="text-sm">GDPR compliant</span>
					</div>
					<div className="flex items-center gap-3">
						<CheckCircle className="h-5 w-5 text-green-500" />
						<span className="text-sm">Automatic data deletion options</span>
					</div>
				</div>
			),
		},
		{
			id: 6,
			title: "Get the Most Out of Insights",
			description: "Learn how to interpret and act on your interview insights.",
			icon: <BookOpen className="h-8 w-8 text-primary" />,
			content: (
				<div className="space-y-3">
					<Button variant="outline" size="sm" className="w-full">
						View Documentation
					</Button>
					<Button variant="outline" size="sm" className="w-full">
						Join Community
					</Button>
					<Button variant="outline" size="sm" className="w-full">
						Watch Tutorial Videos
					</Button>
				</div>
			),
		},
	]

	const formatFileSize = (bytes: number): string => {
		if (!bytes) return "0 Bytes"
		const k = 1024
		const sizes = ["Bytes", "KB", "MB", "GB"]
		const i = Math.floor(Math.log(bytes) / Math.log(k))
		return `${(bytes / k ** i).toFixed(2)} ${sizes[i]}`
	}

	const handleFiles = useCallback(
		async (fileList: FileList) => {
			const newFiles = Array.from(fileList).map((file) => ({
				id: `${Date.now()}-${Math.random()}`,
				name: file.name,
				size: file.size,
				type: file.type,
				file,
			}))
			setFiles(newFiles)
			setError(null)
			if (newFiles.length === 0) return

			const file = newFiles[0].file
			if (!accountId || !projectId) {
				setError("Missing account or project information.")
				setProcessingMessage("Missing account or project information.")
				return
			}

			const formData = new FormData()
			formData.append("file", file)
			formData.append("accountId", accountId)
			formData.append("projectId", projectId)
			formData.append("userCustomInstructions", customInstructions)

			try {
				setIsUploading(true)
				setCurrentStep("processing")
				setProcessingProgress(0)
				setProcessingMessage("Uploading file...")

				const xhr = new XMLHttpRequest()
				xhr.open("POST", "/api/upload-file", true)

				xhr.upload.onprogress = (event) => {
					if (event.lengthComputable) {
						const percent = Math.round((event.loaded / event.total) * 80)
						setProcessingProgress(percent)
						setProcessingMessage(`Uploading file... (${percent}%)`)
					}
				}

				xhr.onreadystatechange = () => {
					if (xhr.readyState === XMLHttpRequest.DONE) {
						setIsUploading(false)
						if (xhr.status >= 200 && xhr.status < 300) {
							setProcessingProgress(90)
							setProcessingMessage("Processing interview with AI...")
							let result: any
							try {
								result = JSON.parse(xhr.responseText)
							} catch {
								setError("Upload succeeded but response was invalid.")
								return
							}
							consola.log("result: ", result)
							const interviewId =
								result?.id ||
								result?.interviewId ||
								(result?.data && (result.data.id || result.data.interviewId)) ||
								result?.interview_id ||
								result?.interviewID
							if (interviewId) {
								let pollCount = 0
								const pollStatus = async () => {
									try {
										const resp = await fetch(`/api/interview-status?id=${interviewId}`)
										if (!resp.ok) throw new Error("Failed to fetch status")
										const status = await resp.json()
										if (typeof status.progress === "number") {
											setProcessingProgress(Math.min(100, status.progress))
											setProcessingMessage(`Processing interview... (${status.progress}%)`)
										}
										if (status.is_processed) {
											setProcessingProgress(100)
											setProcessingMessage("Processing complete!")
											setTimeout(() => navigate(routes.interviews.detail(interviewId)), 500)
											return
										}
										if (pollCount++ < 30) setTimeout(pollStatus, 2000)
										else {
											setError("Processing timed out. Please check later.")
										}
									} catch {
										setError("Failed to check processing status.")
									}
								}
								pollStatus()
							} else {
								setError("Upload succeeded but no interview ID returned.")
							}
						} else {
							let errMsg = "Upload failed"
							try {
								errMsg = JSON.parse(xhr.responseText).error || errMsg
							} catch {}
							setError(errMsg)
							setCurrentStep("upload")
							setProcessingProgress(0)
						}
					}
				}

				xhr.onerror = () => {
					setIsUploading(false)
					setError("Network error during upload.")
					setCurrentStep("upload")
					setProcessingProgress(0)
				}

				xhr.send(formData)
			} catch {
				setIsUploading(false)
				setError("Unexpected error during upload.")
				setCurrentStep("upload")
				setProcessingProgress(0)
			}
		},
		[customInstructions, navigate, projectId, accountId]
	)

	const onDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault()
			setIsDragging(false)
			handleFiles(e.dataTransfer.files)
		},
		[handleFiles]
	)

	const onDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault()
		setIsDragging(true)
	}, [])

	const onDragLeave = useCallback(() => setIsDragging(false), [])

	const onFileSelect = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => e.target.files && handleFiles(e.target.files),
		[handleFiles]
	)

	useEffect(() => {
		if (currentStep === "processing" && isPlaying) {
			const iv = setInterval(() => setCurrentCard((prev) => (prev + 1) % onboardingCards.length), 5000)
			return () => clearInterval(iv)
		}
	}, [currentStep, isPlaying, onboardingCards.length])

	if (currentStep === "processing") {
		const card = onboardingCards[currentCard]
		return (
			<div className="mx-auto flex w-full max-w-2xl justify-center p-6">
				<div
					className="relative"
					style={{
						maxWidth: 480,
						minWidth: 360,
						height: 440,
						margin: "0 auto",
					}}
				>
					<AnimatePresence initial={false} mode="wait">
						<motion.div
							key={card.id}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.3 }}
							className="absolute inset-0"
						>
							<Card className="h-full w-full overflow-hidden">
								<CardHeader className="space-y-4 text-center">
									<div className="flex justify-center">{card.icon}</div>
									<CardTitle className="text-2xl">{card.title}</CardTitle>
									<p className="text-muted-foreground">{card.description}</p>
								</CardHeader>
								<CardContent className="space-y-6">
									{card.content}
									{error && <div className="rounded-md bg-red-50 p-4 text-red-700 text-sm">{error}</div>}
								</CardContent>
								{/* Progress Bar */}
								<div className="px-4 pb-4">
									<div className="h-2 w-full rounded-full bg-secondary">
										<motion.div
											className="h-2 rounded-full bg-primary"
											initial={{ width: 0 }}
											animate={{ width: `${processingProgress}%` }}
											transition={{ duration: 0.5 }}
										/>
									</div>
								</div>
							</Card>
						</motion.div>
					</AnimatePresence>
				</div>
			</div>
		)
	}

	return (
		<div className="mx-auto w-full max-w-2xl p-6">
			<Card>
				<CardHeader>
					<CardTitle className="text-2xl">Upload Your First Interview</CardTitle>
					<p className="text-muted-foreground">
						Get started by uploading an interview, conversation, or focus group recording
					</p>
				</CardHeader>
				<CardContent className="space-y-6">
					<motion.div
						onDragOver={onDragOver}
						onDragLeave={onDragLeave}
						onDrop={onDrop}
						onClick={() => fileInputRef.current?.click()}
						animate={{
							borderColor: isDragging ? "hsl(var(--primary))" : "hsl(var(--border))",
							scale: isDragging ? 1.02 : 1,
						}}
						className={`relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors hover:bg-accent/50 ${isDragging ? "border-primary bg-primary/5" : "border-border"}`}
					>
						<div className="flex flex-col items-center gap-4">
							<motion.div
								animate={{ y: isDragging ? [-5, 0, -5] : 0 }}
								transition={{ duration: 1.5, repeat: isDragging ? Number.POSITIVE_INFINITY : 0, ease: "easeInOut" }}
							>
								<Upload className={`h-12 w-12 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
							</motion.div>
							<div>
								<h3 className="font-semibold text-lg">{isDragging ? "Drop files here" : "Upload your interview"}</h3>
								<p className="text-muted-foreground">
									{isDragging ? "Release to upload" : "Drag & drop files here, or click to browse"}
								</p>
								<p className="mt-1 text-muted-foreground text-sm">Supports audio, video, and document files</p>
							</div>
						</div>
						<input
							ref={fileInputRef}
							type="file"
							multiple
							hidden
							onChange={onFileSelect}
							accept="audio/*,video/*,.pdf,.doc,.docx,.txt"
						/>
					</motion.div>

					<AnimatePresence>
						{files.map((file) => (
							<motion.div
								key={file.id}
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -20 }}
								className="flex items-center gap-4 rounded-lg bg-secondary p-4"
							>
								<FileIcon className="h-8 w-8 text-primary" />
								<div className="flex-1">
									<p className="font-medium">{file.name}</p>
									<p className="text-muted-foreground text-sm">{formatFileSize(file.size)}</p>
								</div>
								<CheckCircle className="h-5 w-5 text-green-500" />
							</motion.div>
						))}
					</AnimatePresence>

					<Separator />

					<div className="space-y-3">
						<Label htmlFor="goal">Analysis goal (optional)</Label>
						<Input value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)} />
					</div>

					{customInstructions === "other" && (
						<div className="space-y-3">
							<Label htmlFor="custom-instructions">Custom instructions</Label>
							<Textarea
								id="custom-instructions"
								placeholder="Describe what you'd like to learn from this analysis..."
								value={customInstructions}
								onChange={(e) => setCustomInstructions(e.target.value)}
							/>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	)
}

export default UserOnboardingWidget
