import { X } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { Button } from "~/components/ui/button"
import { useDeviceDetection } from "~/hooks/useDeviceDetection"
import { type UploadProgress, uploadToR2WithProgress } from "~/utils/r2-upload.client"
import ProcessingScreen from "./ProcessingScreen"
import ProjectGoalsScreen from "./ProjectGoalsScreen"
import ProjectStatusScreen from "./ProjectStatusScreen"
import QuestionsScreen from "./QuestionsScreen"
import UploadScreen from "./UploadScreen"

type OnboardingStep = "welcome" | "questions" | "upload" | "processing" | "complete"

export interface OnboardingData {
	target_orgs: string[]
	target_roles: string[]
	research_goal: string
	research_goal_details: string
	decision_questions: string[]
	assumptions: string[]
	unknowns: string[]
	custom_instructions?: string
	questions: string[]
	file?: File
	mediaType?: string
	interviewId?: string
	projectId?: string
	uploadLabel?: string
	uploadedUrl?: string
	triggerRunId?: string
	triggerAccessToken?: string | null
	error?: string
	personId?: string
}

type UploadResponse<T> =
	| {
			ok: true
			status: number
			data: T
	  }
	| {
			ok: false
			status: number
			error: string
	  }

function postFormDataWithProgress<T>({
	url,
	formData,
	onProgress,
	onStatusChange,
}: {
	url: string
	formData: FormData
	onProgress?: (progress: number) => void
	onStatusChange?: (status: string) => void
}): Promise<UploadResponse<T>> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest()
		xhr.open("POST", url)
		xhr.responseType = "json"
		// 10 minute timeout for large files
		xhr.timeout = 600000

		// Track upload start to confirm XHR is actually sending
		xhr.upload.onloadstart = () => {
			console.log("[Upload] Upload started")
			onStatusChange?.("uploading")
		}

		xhr.upload.onprogress = (event) => {
			if (!event.lengthComputable) {
				console.log("[Upload] Progress event (not computable)")
				return
			}
			const percent = Math.round((event.loaded / event.total) * 100)
			console.log(`[Upload] Progress: ${percent}% (${event.loaded}/${event.total})`)
			onProgress?.(percent)
		}

		xhr.upload.onload = () => {
			console.log("[Upload] Upload complete, waiting for server response...")
			onStatusChange?.("processing")
		}

		xhr.upload.onerror = (event) => {
			console.error("[Upload] Upload error:", event)
			onStatusChange?.("error")
		}

		xhr.onload = () => {
			const status = xhr.status
			console.log(`[Upload] Server response: ${status}`)
			const responseBody =
				xhr.response ??
				(() => {
					try {
						return xhr.responseText ? JSON.parse(xhr.responseText) : null
					} catch {
						return null
					}
				})()

			if (status >= 200 && status < 300) {
				resolve({ ok: true, status, data: responseBody as T })
				return
			}

			const errorMessage =
				(responseBody && typeof responseBody === "object" && "error" in responseBody
					? String((responseBody as { error?: string }).error)
					: xhr.statusText) || "Upload failed"
			resolve({ ok: false, status, error: errorMessage })
		}

		xhr.onerror = (event) => {
			console.error("[Upload] XHR error:", event, "readyState:", xhr.readyState, "status:", xhr.status)
			reject(new Error(`Upload failed: Network error (readyState: ${xhr.readyState})`))
		}

		xhr.ontimeout = () => {
			console.error("[Upload] XHR timeout after 10 minutes")
			reject(new Error("Upload timed out after 10 minutes. Try a smaller file or check your connection."))
		}

		xhr.onabort = () => {
			console.log("[Upload] XHR aborted")
			reject(new Error("Upload was cancelled"))
		}

		// Log before sending to confirm we reach this point
		console.log("[Upload] Starting XHR send to:", url)
		xhr.send(formData)
	})
}

interface OnboardingFlowProps {
	onComplete: (data: OnboardingData) => void
	onAddMoreInterviews: () => void
	onViewResults: () => void
	onRefresh?: () => void
	projectId?: string
	accountId?: string
	existingProject?: {
		name: string
		target_orgs: string[]
		target_roles: string[]
		research_goal: string
		research_goal_details: string
		decision_questions: string[]
		assumptions: string[]
		unknowns: string[]
		custom_instructions?: string
		questions: string[]
	}
}

export default function OnboardingFlow({
	onComplete,
	onAddMoreInterviews,
	onViewResults,
	onRefresh,
	projectId,
	accountId,
	existingProject,
}: OnboardingFlowProps) {
	const [searchParams] = useSearchParams()
	const navigate = useNavigate()
	const { isMobile } = useDeviceDetection()
	const isOnboarding = searchParams.get("onboarding") === "true"
	const preselectedPersonId = searchParams.get("personId") ?? undefined

	// Show mobile header when accessing upload from existing project (not full onboarding)
	const showMobileHeader = isMobile && existingProject && !isOnboarding

	// Start at upload step if we have existing project context
	const [currentStep, setCurrentStep] = useState<OnboardingStep>(existingProject ? "upload" : "welcome")
	// TODO: use form library to parse form data, and loader to fetch data
	const [data, setData] = useState<OnboardingData>({
		target_orgs: existingProject?.target_orgs || [],
		target_roles: existingProject?.target_roles || [],
		research_goal: existingProject?.research_goal || "",
		research_goal_details: existingProject?.research_goal_details || "",
		decision_questions: existingProject?.decision_questions || [],
		assumptions: existingProject?.assumptions || [],
		unknowns: existingProject?.unknowns || [],
		custom_instructions: existingProject?.custom_instructions,
		questions: existingProject?.questions || [],
		projectId,
		triggerAccessToken: null,
		personId: preselectedPersonId,
	})
	const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)
	const [isUploading, setIsUploading] = useState(false)

	const handleWelcomeNext = useCallback(
		async (welcomeData: {
			target_orgs: string[]
			target_roles: string[]
			research_goal: string
			research_goal_details: string
			decision_questions: string[]
			assumptions: string[]
			unknowns: string[]
			custom_instructions?: string
			projectId?: string
		}) => {
			// Update data with welcome data and projectId if provided
			setData((prev) => ({
				...prev,
				...welcomeData,
				projectId: welcomeData.projectId || prev.projectId || projectId,
			}))

			setCurrentStep("questions")
		},
		[projectId]
	)

	const handleQuestionsNext = useCallback((questions: string[]) => {
		setData((prev) => ({ ...prev, questions }))
		setCurrentStep("upload")
	}, [])

	const handleUploadNext = useCallback(
		async (
			file: File,
			mediaType: string,
			uploadProjectId?: string,
			attachmentData?: {
				attachType: "todo" | "existing" | "new" | "general" | "skip"
				entityId?: string
				fileExtension?: string
				sourceType?: string
			}
		) => {
			const updatedData = {
				...data,
				file,
				mediaType,
				triggerRunId: undefined,
				triggerAccessToken: null,
				uploadLabel: file.name,
				uploadedUrl: undefined,
			}
			setData(updatedData)
			setCurrentStep("processing")
			setIsUploading(true)
			setUploadProgress({
				bytesSent: 0,
				totalBytes: file.size,
				percent: 0,
				phase: "uploading",
			})

			try {
				// Determine if we should use direct R2 upload
				// Only use for audio/video files that need transcription
				const isAudioVideo =
					file.type.startsWith("audio/") ||
					file.type.startsWith("video/") ||
					attachmentData?.sourceType === "audio_upload" ||
					attachmentData?.sourceType === "video_upload"

				let r2Key: string | null = null

				// Use direct R2 upload for audio/video files (with fallback to server upload)
				if (isAudioVideo && uploadProjectId) {
					try {
						console.log("[Upload] Attempting direct R2 upload for", file.name)

						// Step 1: Get presigned upload URL from server
						const presignedResponse = await fetch("/api/upload/presigned-url", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								projectId: uploadProjectId,
								filename: file.name,
								contentType: file.type || "application/octet-stream",
								fileSize: file.size,
							}),
						})

						if (!presignedResponse.ok) {
							const errorData = await presignedResponse.json().catch(() => ({}))
							throw new Error(errorData.error || "Failed to get upload URL")
						}

						const presignedData = await presignedResponse.json()
						console.log("[Upload] Got presigned URL:", presignedData.type)

						// Step 2: Upload directly to R2
						if (presignedData.type === "multipart") {
							// Large file - use multipart upload
							console.log("[Upload] Starting multipart upload with", presignedData.totalParts, "parts")
							await uploadToR2WithProgress({
								file,
								singlePartUrl: "", // Not used for multipart
								contentType: file.type || "application/octet-stream",
								multipartThresholdBytes: 0, // Force multipart
								partSizeBytes: presignedData.partSize,
								multipartHandlers: {
									createMultipartUpload: async () => ({
										uploadId: presignedData.uploadId,
										partUrls: presignedData.partUrls, // Already Record<number, string> from server
									}),
									completeMultipartUpload: async ({ parts }) => {
										const completeResponse = await fetch("/api/upload/presigned-url?action=complete", {
											method: "POST",
											headers: { "Content-Type": "application/json" },
											body: JSON.stringify({
												key: presignedData.key,
												uploadId: presignedData.uploadId,
												parts: parts.map((p) => ({
													partNumber: p.partNumber,
													etag: p.etag,
												})),
											}),
										})
										if (!completeResponse.ok) {
											throw new Error("Failed to complete multipart upload")
										}
									},
								},
								onProgress: (progress: UploadProgress) => {
									console.log(`[Upload] Progress: ${progress.percent}% (phase: ${progress.phase})`)
									setUploadProgress(progress)
								},
							})
							r2Key = presignedData.key
						} else {
							// Small file - single PUT upload
							console.log("[Upload] Starting single PUT upload")
							await uploadToR2WithProgress({
								file,
								singlePartUrl: presignedData.uploadUrl,
								contentType: file.type || "application/octet-stream",
								onProgress: (progress: UploadProgress) => {
									console.log(`[Upload] Progress: ${progress.percent}% (phase: ${progress.phase})`)
									setUploadProgress(progress)
								},
							})
							r2Key = presignedData.key
						}

						console.log("[Upload] Direct R2 upload complete:", r2Key)
					} catch (r2Error) {
						// Direct R2 upload failed (likely CORS or network issue)
						// Fall back to server-proxied upload
						console.warn("[Upload] Direct R2 upload failed, falling back to server upload:", r2Error)
						r2Key = null // Ensure we use server upload path
						setUploadProgress({
							bytesSent: 0,
							totalBytes: file.size,
							percent: 0,
							phase: "uploading",
						}) // Reset progress for server upload
					}
				}

				// Step 3: Call onboarding-start API (with r2Key if direct upload was used)
				const formData = new FormData()
				if (r2Key) {
					// Direct upload path - send r2Key instead of file
					formData.append("r2Key", r2Key)
					formData.append("originalFilename", file.name)
					formData.append("originalFileSize", String(file.size))
					formData.append("originalContentType", file.type)
				} else {
					// Legacy path - send file through server
					formData.append("file", file)
				}
				formData.append(
					"onboardingData",
					JSON.stringify({
						target_orgs: data.target_orgs,
						target_roles: data.target_roles,
						research_goal: data.research_goal,
						research_goal_details: data.research_goal_details,
						decision_questions: data.decision_questions,
						assumptions: data.assumptions,
						unknowns: data.unknowns,
						custom_instructions: data.custom_instructions,
						questions: data.questions,
						mediaType,
					})
				)
				// accountId will be retrieved from authenticated user by API
				if (uploadProjectId) {
					formData.append("projectId", uploadProjectId)
				}
				if (data.personId) {
					formData.append("personId", data.personId)
				}

				// Add attachment data to form
				if (attachmentData) {
					formData.append("attachType", attachmentData.attachType)
					if (attachmentData.entityId) {
						formData.append("entityId", attachmentData.entityId)
					}
					if (attachmentData.fileExtension) {
						formData.append("fileExtension", attachmentData.fileExtension)
					}
					if (attachmentData.sourceType) {
						formData.append("sourceType", attachmentData.sourceType)
					}
				}

				// Call the onboarding-start API
				// For direct R2 uploads, this just triggers processing (no file upload)
				// For legacy flow, this uploads through server
				const response = r2Key
					? await fetch("/api/onboarding-start", {
							method: "POST",
							body: formData,
						}).then(async (res) => ({
							ok: res.ok,
							status: res.status,
							data: await res.json(),
							error: res.ok ? undefined : (await res.json().catch(() => ({}))).error,
						}))
					: await postFormDataWithProgress<Record<string, any>>({
							url: "/api/onboarding-start",
							formData,
							onProgress: (percent) =>
								setUploadProgress({
									bytesSent: 0,
									totalBytes: 100,
									percent,
									phase: "uploading",
								}),
						})

				if (!response.ok) {
					throw new Error((response as any).error || "Upload failed")
				}

				const result = (response as any).data
				setIsUploading(false)
				setUploadProgress(null)

				// Redirect to interview page immediately after upload completes
				// Processing will continue in the background via Trigger.dev
				if (result.interview?.id && result.project?.id) {
					// Use accountId from props, or extract from API response if available
					const finalAccountId = accountId || result.interview?.account_id || result.project?.account_id
					console.log("OnboardingFlow redirect:", {
						accountId,
						finalAccountId,
						projectId: result.project.id,
						interviewId: result.interview.id,
					})

					if (!finalAccountId) {
						console.error("No accountId available for redirect!")
						// Don't redirect if we don't have an accountId
						return
					}

					const interviewUrl = `/a/${finalAccountId}/${result.project.id}/interviews/${result.interview.id}`
					console.log("Redirecting to:", interviewUrl)
					window.location.href = interviewUrl
					return
				}

				// Fallback: Store interview ID and project ID for progress tracking (legacy flow)
				if (result.interview?.id) {
					setData((prev) => ({ ...prev, interviewId: result.interview.id }))
				}
				if (result.project?.id) {
					setData((prev) => ({ ...prev, projectId: result.project.id }))
				}
				if (result.triggerRun?.id) {
					setData((prev) => ({
						...prev,
						triggerRunId: result.triggerRun.id,
						triggerAccessToken: result.triggerRun.publicToken ?? null,
					}))

					if (!result.triggerRun.publicToken) {
						try {
							const tokenResponse = await fetch("/api/trigger-run-token", {
								method: "POST",
								headers: {
									"Content-Type": "application/json",
								},
								body: JSON.stringify({ runId: result.triggerRun.id }),
							})

							if (tokenResponse.ok) {
								const tokenData = (await tokenResponse.json()) as {
									token?: string
								}
								if (tokenData.token) {
									setData((prev) => ({
										...prev,
										triggerAccessToken: tokenData.token ?? null,
									}))
								}
							}
						} catch (tokenError) {
							console.error("Failed to fetch Trigger.dev token", tokenError)
						}
					}
				}
			} catch (error) {
				// Handle error - show error message and return to upload screen
				const errorMessage = error instanceof Error ? error.message : "Upload failed"
				setIsUploading(false)
				setUploadProgress(null)
				setData((prev) => ({ ...prev, error: errorMessage }))
				setCurrentStep("upload") // Return to upload screen so user can retry
			}
		},
		[data, accountId]
	)

	const handleProcessingComplete = useCallback(() => {
		setCurrentStep("complete")
		onComplete(data)
	}, [data, onComplete])

	const handleBack = useCallback(() => {
		switch (currentStep) {
			case "questions":
				setCurrentStep("welcome")
				break
			case "upload":
				setCurrentStep("questions")
				break
			default:
				break
		}
	}, [currentStep])

	// Generate project name from target orgs and roles
	const getProjectName = useCallback(() => {
		if (data.target_orgs.length === 0) return "New Project"
		if (data.target_roles.length > 0) {
			return `${data.target_roles[0]} at ${data.target_orgs[0]} Research`
		}
		return `${data.target_orgs[0]} Research`
	}, [data.target_orgs, data.target_roles])

	// Handle exit from onboarding
	const handleExit = useCallback(() => {
		if (isOnboarding) {
			// Exit onboarding and go to home - remove onboarding param
			navigate("/home")
		} else {
			// Regular navigation behavior
			navigate(-1)
		}
	}, [isOnboarding, navigate])

	// Use the most current projectId - either from data (newly created) or props (existing)
	const currentProjectId = useMemo(() => data.projectId || projectId, [data.projectId, projectId])

	const handleUploadFromUrl = useCallback(
		async (url: string, personId?: string) => {
			if (!currentProjectId) {
				setData((prev) => ({
					...prev,
					error: "A project is required to import from a URL.",
				}))
				throw new Error("A project is required to import from a URL.")
			}

			setData((prev) => ({
				...prev,
				file: undefined,
				mediaType: "interview",
				uploadLabel: url,
				uploadedUrl: url,
				triggerRunId: undefined,
				triggerAccessToken: null,
				interviewId: undefined,
				error: undefined,
			}))
			setCurrentStep("processing")

			try {
				const formData = new FormData()
				formData.append("projectId", currentProjectId)
				formData.append("url", url)
				if (personId) {
					formData.append("personId", personId)
				}

				const response = await fetch("/api/upload-from-url", {
					method: "POST",
					body: formData,
				})

				if (!response.ok) {
					const errorData = await response.json().catch(() => ({}))
					throw new Error(errorData.error || "Upload failed")
				}

				const result = await response.json()

				setData((prev) => ({
					...prev,
					interviewId: result.interviewId ?? prev.interviewId,
					projectId: prev.projectId || currentProjectId,
					uploadLabel: url,
					uploadedUrl: url,
					triggerRunId: result.triggerRunId ?? prev.triggerRunId,
					triggerAccessToken: result.publicRunToken ?? prev.triggerAccessToken,
				}))

				if (result.interviewId && accountId) {
					const interviewUrl = `/a/${accountId}/${currentProjectId}/interviews/${result.interviewId}`
					window.location.href = interviewUrl
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : "Upload failed"
				setData((prev) => ({ ...prev, error: errorMessage }))
				setCurrentStep("upload")
				throw new Error(errorMessage)
			}
		},
		[accountId, currentProjectId]
	)

	// Render navigation controls for onboarding mode
	const renderOnboardingHeader = useCallback(() => {
		if (!isOnboarding) return null

		return (
			<div className="flex items-center justify-between border-b p-4">
				<div className="flex items-center gap-4">
					<Button variant="ghost" size="sm" onClick={handleExit}>
						← Exit Onboarding
					</Button>
					<div className="text-muted-foreground text-sm">
						Step {currentStep === "welcome" ? 1 : currentStep === "questions" ? 2 : currentStep === "upload" ? 3 : 4} of
						4
					</div>
				</div>
			</div>
		)
	}, [isOnboarding, handleExit, currentStep])

	const stepContent = useMemo(() => {
		switch (currentStep) {
			case "welcome":
				return <ProjectGoalsScreen onNext={handleWelcomeNext} projectId={currentProjectId} />

			case "questions":
				return (
					<QuestionsScreen
						target_orgs={data.target_orgs}
						target_roles={data.target_roles}
						research_goal={data.research_goal}
						research_goal_details={data.research_goal_details}
						decision_questions={data.decision_questions}
						assumptions={data.assumptions}
						unknowns={data.unknowns}
						custom_instructions={data.custom_instructions}
						onNext={handleQuestionsNext}
						onBack={handleBack}
					/>
				)

			case "upload":
				return (
					<UploadScreen
						onNext={handleUploadNext}
						onUploadFromUrl={handleUploadFromUrl}
						onBack={handleBack}
						projectId={currentProjectId}
						accountId={accountId}
						error={data.error}
					/>
				)

			case "processing":
				return (
					<ProcessingScreen
						fileName={data.uploadLabel || data.file?.name || "Unknown file"}
						onComplete={handleProcessingComplete}
						interviewId={data.interviewId}
						triggerRunId={data.triggerRunId}
						triggerAccessToken={data.triggerAccessToken ?? undefined}
						uploadProgress={uploadProgress ?? undefined}
						isUploading={isUploading}
					/>
				)

			case "complete":
				return <ProjectStatusScreen projectName={getProjectName()} projectId={data.projectId} accountId={accountId} />

			default:
				return <ProjectGoalsScreen onNext={handleWelcomeNext} projectId={currentProjectId} />
		}
	}, [
		currentStep,
		handleWelcomeNext,
		currentProjectId,
		data,
		handleQuestionsNext,
		handleBack,
		handleUploadNext,
		handleProcessingComplete,
		getProjectName,
		accountId,
	])

	return (
		<div className="min-h-screen bg-background">
			{/* Mobile close button - for upload from existing project */}
			{showMobileHeader && (
				<div className="sticky top-0 z-10 flex items-center justify-end border-b bg-background px-4 py-3">
					<Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
						<X className="h-5 w-5" />
						<span className="sr-only">Close</span>
					</Button>
				</div>
			)}
			{renderOnboardingHeader()}
			{stepContent}
		</div>
	)
}
