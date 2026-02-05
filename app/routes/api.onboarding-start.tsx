import type { UUID } from "node:crypto"
import { tasks } from "@trigger.dev/sdk"
import consola from "consola"
import { format } from "date-fns"
import type { LangfuseSpanClient, LangfuseTraceClient } from "langfuse"
import type { ActionFunctionArgs } from "react-router"
import { deriveProjectNameDescription } from "~/features/onboarding/server/signup-derived-project"
import { ensureInterviewInterviewerLink } from "~/features/people/services/internalPeople.server"
import { createProject } from "~/features/projects/db"
import { createPlannedAnswersForInterview } from "~/lib/database/project-answers.server"
import { getLangfuseClient } from "~/lib/langfuse.server"
import { createSupabaseAdminClient, getAuthenticatedUser, getServerClient } from "~/lib/supabase/client.server"
import type { InterviewInsert } from "~/types"
import { storeAudioFile } from "~/utils/storeAudioFile.server"
import { safeSanitizeTranscriptPayload } from "~/utils/transcript/sanitizeTranscriptData.server"

// Accept both legacy (icp/role/goal) and new snake_case onboarding payloads
type LegacyOnboardingData = {
	icp: string
	role: string
	goal: string
	customGoal?: string
	questions: string[]
	mediaType: string
}

type NewOnboardingData = {
	target_orgs: string[]
	target_roles: string[]
	research_goal: string
	research_goal_details?: string
	assumptions?: string[]
	unknowns?: string[]
	custom_instructions?: string
	questions: string[]
	mediaType: string
}

type OnboardingData = LegacyOnboardingData | NewOnboardingData

type TraceEndPayload = Parameters<LangfuseTraceClient["end"]>[0]

export async function action({ request }: ActionFunctionArgs) {
	const startTime = Date.now()
	consola.info("🎬 [ONBOARDING] Request received", {
		timestamp: new Date().toISOString(),
	})

	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	const langfuse = getLangfuseClient()
	let trace: LangfuseTraceClient | undefined
	let traceEndPayload: TraceEndPayload | undefined
	let triggerRunInfo: { runId: string; publicToken: string | null } | null = null

	try {
		consola.info("🔐 [ONBOARDING] Authenticating user...")
		// Get authenticated user and their team account
		const { user } = await getAuthenticatedUser(request)
		if (!user) {
			return Response.json({ error: "User not authenticated" }, { status: 401 })
		}

		const { client: supabase } = getServerClient(request)
		// Single admin client for RLS-bypassing operations in this action
		const supabaseAdmin = createSupabaseAdminClient()

		// Get team account and user settings from database
		// Fetch all fields needed for internal person resolution
		const { data: userSettings } = await supabase
			.from("user_settings")
			.select("last_used_account_id, first_name, last_name, email, image_url, title, role, company_name, industry")
			.eq("user_id", user.sub)
			.single()

		let teamAccountId = userSettings?.last_used_account_id

		// Fallback: get first available team account if no preference set
		if (!teamAccountId) {
			const { data: accounts } = await supabase.rpc("get_user_accounts")
			const teamAccount = accounts?.find((acc: any) => !acc.personal_account) || accounts?.[0]
			teamAccountId = teamAccount?.account_id
		}

		if (!teamAccountId) {
			return Response.json({ error: "No team account found" }, { status: 500 })
		}

		consola.info("📦 [ONBOARDING] Parsing form data...")
		const formData = await request.formData()
		const file = formData.get("file") as File | null
		const onboardingDataStr = formData.get("onboardingData") as string
		const projectId = formData.get("projectId") as UUID
		const personId = formData.get("personId") as string | null
		const _attachType = formData.get("attachType") as string | null
		const entityId = formData.get("entityId") as string | null
		const fileExtension = formData.get("fileExtension") as string | null
		const sourceType = formData.get("sourceType") as string | null
		// Direct R2 upload support: r2Key is the R2 object key if file was uploaded directly to R2
		const r2Key = formData.get("r2Key") as string | null
		const originalFilename = formData.get("originalFilename") as string | null
		const originalFileSize = formData.get("originalFileSize") as string | null
		const originalContentType = formData.get("originalContentType") as string | null

		consola.info("✅ [ONBOARDING] Form data parsed", {
			hasFile: !!file,
			hasR2Key: !!r2Key,
			fileName: file?.name || originalFilename,
			fileSize: file
				? `${(file.size / 1024 / 1024).toFixed(2)}MB`
				: originalFileSize
					? `${(Number(originalFileSize) / 1024 / 1024).toFixed(2)}MB`
					: null,
			fileType: file?.type || originalContentType,
			elapsedMs: Date.now() - startTime,
		})

		trace = (langfuse as any).trace?.({
			name: "api.onboarding-start",
			userId: user.sub,
			metadata: {
				accountId: teamAccountId,
				providedProjectId: projectId ?? null,
			},
			input: {
				file: file ? { name: file.name, size: file.size, type: file.type } : null,
				onboardingDataProvided: Boolean(onboardingDataStr),
				projectId: projectId ?? null,
			},
		})

		// Detailed logging for debugging
		consola.log("=== ONBOARDING START DEBUG ===")
		consola.log("user.sub:", user.sub)
		consola.log("teamAccountId:", teamAccountId)
		consola.log("file:", file ? `${file.name} (${file.size} bytes)` : "null")
		consola.log("onboardingDataStr:", onboardingDataStr)
		consola.log("projectId:", projectId)
		consola.log("formData keys:", Array.from(formData.keys()))

		// Require either file OR r2Key (direct upload path)
		if (!file && !r2Key) {
			consola.error("Missing file or r2Key")
			traceEndPayload = {
				level: "ERROR",
				statusMessage: "Missing file or r2Key",
			}
			return Response.json({ error: "Missing file or r2Key" }, { status: 400 })
		}
		if (!onboardingDataStr) {
			consola.error("Missing onboardingData")
			traceEndPayload = {
				level: "ERROR",
				statusMessage: "Missing onboardingData",
			}
			return Response.json({ error: "Missing onboardingData" }, { status: 400 })
		}

		// For direct R2 uploads, we need file metadata
		const effectiveFilename = file?.name || originalFilename || "unknown"
		const effectiveFileSize = file?.size || Number(originalFileSize) || 0
		const effectiveContentType = file?.type || originalContentType || "application/octet-stream"

		const onboardingData: OnboardingData = JSON.parse(onboardingDataStr)
		trace?.update?.({
			metadata: {
				mediaType: onboardingData.mediaType,
				questionCount: Array.isArray(onboardingData.questions) ? onboardingData.questions.length : 0,
			},
		})

		consola.log("Starting onboarding for account:", teamAccountId, "project:", projectId)

		// Normalize fields across legacy and new shapes
		const primaryOrg =
			("target_orgs" in onboardingData && onboardingData.target_orgs?.[0]) ||
			("icp" in onboardingData ? onboardingData.icp : "")
		const primaryRole =
			("target_roles" in onboardingData && onboardingData.target_roles?.[0]) ||
			("role" in onboardingData ? onboardingData.role : "")
		const researchGoal =
			("research_goal" in onboardingData && onboardingData.research_goal) ||
			("goal" in onboardingData ? onboardingData.goal : "")
		const researchGoalDetails =
			"research_goal_details" in onboardingData ? (onboardingData.research_goal_details ?? "") : ""
		const _customInstructionsInput =
			"custom_instructions" in onboardingData ? onboardingData.custom_instructions : undefined
		const questionsInput = onboardingData.questions || []
		const mediaTypeInput = onboardingData.mediaType

		// 1. Use existing project or create new one if projectId not provided
		let finalProjectId = projectId

		if (!projectId) {
			let projectSpan: LangfuseSpanClient | undefined
			projectSpan = trace?.span?.({
				name: "project.ensure",
				metadata: {
					accountId: teamAccountId,
				},
			})
			// Prefer signup-data derived values
			let baseProjectName = researchGoal || `${primaryRole} at ${primaryOrg} Research`
			let projectDescription = `Research project for ${primaryRole} at ${primaryOrg}. Goal: ${researchGoal}`
			try {
				const derived = await deriveProjectNameDescription({
					supabase,
					userId: user.sub,
				})
				baseProjectName = derived.name || baseProjectName
				projectDescription = derived.description || projectDescription
			} catch {}

			// Find available project name by checking for slug conflicts
			let projectName = baseProjectName
			let attempt = 1
			let project = null
			let projectError = null

			while (!project && attempt <= 10) {
				const { data: createData, error: createError } = await createProject({
					supabase,
					data: {
						name: projectName,
						description: projectDescription,
						status: "active",
						account_id: teamAccountId,
					},
				})

				if (createError?.code === "23505") {
					// Slug conflict, try with number suffix
					attempt++
					projectName = `${baseProjectName} ${attempt}`
					continue
				}

				project = createData
				projectError = createError
				break
			}

			if (projectError || !project) {
				consola.error("Project creation failed:", projectError)
				projectSpan?.end?.({
					level: "ERROR",
					statusMessage: projectError?.message ?? "Failed to create project",
				})
				traceEndPayload = {
					level: "ERROR",
					statusMessage: "Failed to create project",
				}
				return Response.json({ error: "Failed to create project" }, { status: 500 })
			}

			finalProjectId = project.id as UUID
			consola.log("Created new project:", project.id)
			projectSpan?.end?.({
				output: { projectId: finalProjectId },
			})
			trace?.update?.({ metadata: { projectId: finalProjectId } })

			// Create project sections for onboarding data (snake_case friendly)
			const projectSections = [
				{
					project_id: finalProjectId,
					kind: "target_orgs",
					content_md: Array.isArray((onboardingData as any).target_orgs)
						? ((onboardingData as any).target_orgs as string[]).join(", ")
						: primaryOrg,
					meta: {
						target_orgs: (onboardingData as any).target_orgs || (primaryOrg ? [primaryOrg] : []),
					},
				},
				{
					project_id: finalProjectId,
					kind: "target_roles",
					content_md: Array.isArray((onboardingData as any).target_roles)
						? ((onboardingData as any).target_roles as string[]).join(", ")
						: primaryRole,
					meta: {
						target_roles: (onboardingData as any).target_roles || (primaryRole ? [primaryRole] : []),
					},
				},
				{
					project_id: finalProjectId,
					kind: "research_goal",
					content_md: researchGoal,
					meta: {
						research_goal: researchGoal,
						research_goal_details: researchGoalDetails,
					},
				},
				{
					project_id: finalProjectId,
					kind: "questions",
					content_md: questionsInput.map((q, i) => `${i + 1}. ${q}`).join("\n\n"),
					meta: { questionCount: questionsInput.length },
				},
			]

			const { error: sectionsError } = await supabase.from("project_sections").insert(projectSections)

			if (sectionsError) {
				consola.error("Failed to create project sections:", sectionsError)
				// Continue anyway - project is created, sections are bonus
			} else {
				consola.log("Created project sections for onboarding data")
				trace?.event?.({
					name: "project.sections.created",
					metadata: {
						projectId: finalProjectId,
						sectionCount: projectSections.length,
					},
				})
			}
		} else {
			trace?.update?.({ metadata: { projectId } })
		}

		// 2. Create interview record with initial status
		const customInstructions = `This interview is part of research about ${primaryRole} at ${primaryOrg}.

Key research questions to focus on:
${questionsInput.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Please extract insights that specifically address these research questions and help understand ${primaryRole} at ${primaryOrg} better.`

		// Resolve linked person from personId (URL param) or entityId (form data from new contact dialog)
		let linkedPerson: {
			id: string
			name: string | null
			project_id: string | null
			company?: string | null
		} | null = null
		const personIdToResolve = personId || entityId
		if (personIdToResolve) {
			const { data: person, error: personError } = await supabase
				.from("people")
				.select("id, name, project_id, company")
				.eq("id", personIdToResolve)
				.maybeSingle()

			if (personError || !person) {
				consola.error("Failed to resolve person for recording", {
					personIdToResolve,
					personError,
				})
				// Don't fail - just continue without linking
				consola.warn("Continuing without person link")
			} else {
				// Normalize person to the current project when missing/mismatched
				if (person.project_id !== projectId) {
					const targetProjectId = projectId ?? person.project_id ?? finalProjectId
					const { error: updateErr } = await supabase
						.from("people")
						.update({ project_id: targetProjectId })
						.eq("id", person.id)
					if (updateErr) {
						consola.warn("Failed to align person.project_id to project", {
							personId: person.id,
							from: person.project_id,
							to: targetProjectId,
							updateErr,
						})
					} else {
						person.project_id = targetProjectId
					}
				}
				linkedPerson = person
				consola.info("Resolved linked person:", {
					id: person.id,
					name: person.name,
					company: person.company,
				})
			}
		}

		const interviewDate = new Date()
		const dateLabel = format(interviewDate, "MMM d, yyyy")
		const titleFromPerson = linkedPerson?.name ? `${linkedPerson.name} • ${dateLabel}` : undefined

		// Determine appropriate media_type based on source_type and context
		// Documents, transcripts should not be "interview" or "voice_memo" by default
		let finalMediaType = mediaTypeInput
		if (sourceType === "document") {
			finalMediaType = "document"
		} else if (sourceType === "transcript" && mediaTypeInput === "interview") {
			// Text files uploaded as interviews keep "interview", but standalone text notes should be "voice_memo"
			finalMediaType = mediaTypeInput === "voice_memo" ? "voice_memo" : "interview"
		}

		const interviewData: InterviewInsert = {
			account_id: teamAccountId,
			project_id: finalProjectId,
			title: titleFromPerson ?? effectiveFilename,
			interview_date: format(interviewDate, "yyyy-MM-dd"),
			participant_pseudonym: linkedPerson?.name ?? "Participant 1",
			segment: null,
			media_url: r2Key || null, // Set immediately if direct R2 upload, otherwise set by upload worker
			media_type: finalMediaType, // Determined based on source type and context
			transcript: null, // Will be set by transcription
			transcript_formatted: null,
			duration_sec: null,
			status: "uploaded", // Starting status for pipeline
			source_type: sourceType || undefined, // Store source type (audio_upload, video_upload, document, transcript)
			file_extension: fileExtension || undefined, // Store file extension
			person_id: linkedPerson?.id || undefined, // Link to person if provided
		} as InterviewInsert

		const interviewSpan = trace?.span?.({
			name: "interview.create",
			metadata: {
				projectId: finalProjectId,
				accountId: teamAccountId,
			},
			input: {
				fileName: effectiveFilename,
				mediaType: mediaTypeInput,
				directR2Upload: !!r2Key,
			},
		})

		const { data: interview, error: interviewError } = await supabase
			.from("interviews")
			.insert(interviewData)
			.select()
			.single()

		if (interviewError || !interview) {
			consola.error("Interview creation failed:", interviewError)
			interviewSpan?.end?.({
				level: "ERROR",
				statusMessage: interviewError?.message ?? "Failed to create interview",
			})
			traceEndPayload = {
				level: "ERROR",
				statusMessage: "Failed to create interview",
			}
			return Response.json({ error: "Failed to create interview" }, { status: 500 })
		}
		interviewSpan?.end?.({
			output: {
				interviewId: interview.id,
			},
		})
		trace?.update?.({
			metadata: {
				interviewId: interview.id,
			},
		})

		await createPlannedAnswersForInterview(supabase, {
			projectId: finalProjectId,
			interviewId: interview.id,
		})

		// Create interview_people junction record for linked person
		// Note: transcript_key will be set later during BAML extraction when we know which speaker this person is
		if (linkedPerson) {
			consola.info("🔗 [ONBOARDING] Creating initial interview_people link", {
				interviewId: interview.id,
				personId: linkedPerson.id,
				personName: linkedPerson.name,
			})
			await supabase.from("interview_people").upsert(
				{
					interview_id: interview.id,
					person_id: linkedPerson.id,
					project_id: finalProjectId,
					role: "participant",
					display_name: linkedPerson.name || null,
					// Note: transcript_key is intentionally null here - it will be matched to a speaker during BAML extraction
				},
				{ onConflict: "interview_id,person_id" }
			)
		}

		if (user?.sub) {
			await ensureInterviewInterviewerLink({
				supabase,
				accountId: teamAccountId,
				projectId: finalProjectId,
				interviewId: interview.id,
				userId: user.sub,
				userSettings: userSettings || null,
				userMetadata: null, // Not available in API routes without middleware
			})
		}

		consola.log("Created interview:", interview.id)

		// 3. Determine processing path based on sourceType and mediaType
		const isTextFile =
			effectiveContentType.startsWith("text/") ||
			effectiveFilename.endsWith(".txt") ||
			effectiveFilename.endsWith(".md") ||
			effectiveFilename.endsWith(".markdown")

		const isAudioVideo =
			effectiveContentType.startsWith("audio/") ||
			effectiveContentType.startsWith("video/") ||
			sourceType === "audio_upload" ||
			sourceType === "video_upload"

		// Path 1: Documents (PDFs, spreadsheets, etc.) - just save, no processing
		if (sourceType === "document" && !isTextFile) {
			consola.info("📄 [ONBOARDING] Document file detected - saving without processing", {
				fileName: file.name,
				sourceType,
			})

			// Store the file in R2 for future access
			const fileBuffer = await file.arrayBuffer()
			const fileBlob = new Blob([fileBuffer], { type: file.type })

			const storageResult = await storeAudioFile({
				projectId: finalProjectId,
				interviewId: interview.id,
				source: fileBlob,
				originalFilename: file.name,
				contentType: file.type,
				langfuseParent: trace,
			})

			if (!storageResult.error && storageResult.mediaUrl) {
				await supabase
					.from("interviews")
					.update({
						media_url: storageResult.mediaUrl,
						status: "uploaded",
					})
					.eq("id", interview.id)
			}

			traceEndPayload = {
				level: "DEFAULT",
				statusMessage: "Document uploaded successfully",
			}
			return Response.json({
				success: true,
				interviewId: interview.id,
				projectId: finalProjectId,
				status: "uploaded",
				message: "Document saved for future processing",
			})
		}

		// Path 2: Text files for voice memos - save to transcript only, no analysis
		if (isTextFile && mediaTypeInput === "voice_memo") {
			consola.info("📝 [ONBOARDING] Voice memo text file - saving to transcript without analysis", {
				fileName: file.name,
			})

			const textContent = await file.text()
			if (!textContent || textContent.trim().length === 0) {
				traceEndPayload = {
					level: "ERROR",
					statusMessage: "Text file is empty",
				}
				return Response.json({ error: "Text file is empty" }, { status: 400 })
			}

			await supabase
				.from("interviews")
				.update({
					transcript: textContent.trim(),
					status: "ready",
				})
				.eq("id", interview.id)

			traceEndPayload = {
				level: "DEFAULT",
				statusMessage: "Voice memo saved successfully",
			}
			return Response.json({
				success: true,
				interviewId: interview.id,
				projectId: finalProjectId,
				status: "ready",
			})
		}

		// Path 3: Text files for interviews - save and run full analysis
		if (isTextFile) {
			// Handle text files immediately - no upload needed
			const textContent = await file.text()
			const textSpan = trace?.span?.({
				name: "ingest.text",
				metadata: {
					interviewId: interview.id,
					projectId: finalProjectId,
				},
				input: {
					fileName: file.name,
					size: file.size,
				},
			})

			if (!textContent || textContent.trim().length === 0) {
				textSpan?.end?.({
					level: "ERROR",
					statusMessage: "Text file is empty",
				})
				traceEndPayload = {
					level: "ERROR",
					statusMessage: "Text file is empty",
				}
				return Response.json({ error: "Text file is empty" }, { status: 400 })
			}

			const transcriptData = safeSanitizeTranscriptPayload({
				full_transcript: textContent.trim(),
				confidence: 1.0,
				audio_duration: null,
				processing_duration: 0,
				file_type: "text",
				original_filename: file.name,
			})

			try {
				const handle = await tasks.trigger("interview.v2.orchestrator", {
					analysisJobId: interview.id,
					metadata,
					transcriptData,
					mediaUrl: "",
					existingInterviewId: interview.id,
					userCustomInstructions: customInstructions,
					resumeFrom: "evidence",
					skipSteps: ["upload"],
				})
				triggerRunInfo = { runId: handle.id, publicToken: null }
				textSpan?.end?.({
					output: {
						interviewId: interview.id,
						transcriptLength: textContent.trim().length,
					},
				})
			} catch (analysisError) {
				const message = analysisError instanceof Error ? analysisError.message : "Failed to queue analysis"
				consola.error("Failed to queue analysis job:", analysisError)
				textSpan?.end?.({
					level: "ERROR",
					statusMessage: message,
				})
				traceEndPayload = { level: "ERROR", statusMessage: message }
				return Response.json({ error: "Failed to queue analysis" }, { status: 500 })
			}
		}

		// Path 4: Audio/video files for voice memos - transcribe only, no analysis
		if (isAudioVideo && mediaTypeInput === "voice_memo") {
			consola.info("🎤 [ONBOARDING] Voice memo audio/video - transcribe only without analysis", {
				fileName: file.name,
				sourceType,
			})

			const audioSpan = trace?.span?.({
				name: "ingest.voice-memo",
				metadata: {
					interviewId: interview.id,
					projectId: finalProjectId,
				},
				input: {
					fileName: file.name,
					size: file.size,
					type: file.type,
				},
			})

			// Store audio file in R2
			const fileBuffer = await file.arrayBuffer()
			const fileBlob = new Blob([fileBuffer], { type: file.type })

			const storageResult = await storeAudioFile({
				projectId: finalProjectId,
				interviewId: interview.id,
				source: fileBlob,
				originalFilename: file.name,
				contentType: file.type,
				langfuseParent: audioSpan ?? trace,
			})

			if (storageResult.error || !storageResult.mediaUrl || !storageResult.presignedUrl) {
				audioSpan?.end?.({
					level: "ERROR",
					statusMessage: storageResult.error ?? "Failed to store audio file",
				})
				traceEndPayload = {
					level: "ERROR",
					statusMessage: `Failed to store audio file: ${storageResult.error}`,
				}
				return Response.json({ error: `Failed to store audio file: ${storageResult.error}` }, { status: 500 })
			}

			// Update interview with R2 key
			await supabase
				.from("interviews")
				.update({
					media_url: storageResult.mediaUrl,
					status: "uploaded",
				})
				.eq("id", interview.id)

			// Submit to AssemblyAI for transcription (no analysis after)
			const apiKey = process.env.ASSEMBLYAI_API_KEY
			if (!apiKey) {
				audioSpan?.end?.({
					level: "ERROR",
					statusMessage: "ASSEMBLYAI_API_KEY not configured",
				})
				traceEndPayload = {
					level: "ERROR",
					statusMessage: "Transcription service not configured",
				}
				return Response.json({ error: "Transcription service not configured" }, { status: 500 })
			}

			const baseUrl = process.env.PUBLIC_TUNNEL_URL
				? `https://${process.env.PUBLIC_TUNNEL_URL}`
				: new URL(request.url).origin
			const webhookUrl = `${baseUrl}/api/assemblyai-webhook?voiceMemoOnly=true`

			const transcriptResponse = await fetch("https://api.assemblyai.com/v2/transcript", {
				method: "POST",
				headers: {
					authorization: apiKey,
					"content-type": "application/json",
				},
				body: JSON.stringify({
					audio_url: storageResult.presignedUrl,
					webhook_url: webhookUrl,
					speech_model: "slam-1",
					speaker_labels: true,
					format_text: true,
					punctuate: true,
					sentiment_analysis: false,
				}),
			})

			if (!transcriptResponse.ok) {
				const _errorText = await transcriptResponse.text()
				audioSpan?.end?.({
					level: "ERROR",
					statusMessage: `AssemblyAI failed: ${transcriptResponse.status}`,
				})
				traceEndPayload = {
					level: "ERROR",
					statusMessage: "Transcription failed",
				}
				return Response.json({ error: "Transcription failed" }, { status: 500 })
			}

			const transcriptData = await transcriptResponse.json()
			consola.info("✅ [ONBOARDING] Voice memo transcription queued", {
				transcriptId: transcriptData.id,
				interviewId: interview.id,
			})

			audioSpan?.end?.({
				output: {
					transcriptId: transcriptData.id,
					mediaUrl: storageResult.mediaUrl,
				},
			})

			traceEndPayload = {
				level: "DEFAULT",
				statusMessage: "Voice memo transcription queued",
			}
			return Response.json({
				success: true,
				interviewId: interview.id,
				projectId: finalProjectId,
				status: "transcribing",
				message: "Voice memo is being transcribed",
			})
		}

		// Path 5: Audio/video files for interviews - full processing with transcription and analysis
		if (isAudioVideo) {
			// Handle audio/video files - store file first (if not direct upload), then trigger AssemblyAI transcription
			const audioSpan = trace?.span?.({
				name: "ingest.audio",
				metadata: {
					interviewId: interview.id,
					projectId: finalProjectId,
				},
				input: {
					fileName: effectiveFilename,
					size: effectiveFileSize,
					type: effectiveContentType,
					directR2Upload: !!r2Key,
				},
			})

			let finalR2Key: string
			let presignedUrl: string

			// Check if file was already uploaded directly to R2
			if (r2Key) {
				// Direct R2 upload path - file is already in R2
				consola.info("⚡ [ONBOARDING] Using direct R2 upload - skipping server upload", {
					r2Key,
					elapsedMs: Date.now() - startTime,
				})
				finalR2Key = r2Key

				// Generate presigned URL for AssemblyAI to access the file
				const { createR2PresignedReadUrl } = await import("~/utils/r2.server")
				const presignedResult = createR2PresignedReadUrl(r2Key, 3600) // 1 hour
				if (!presignedResult) {
					audioSpan?.end?.({
						level: "ERROR",
						statusMessage: "Failed to generate presigned URL for R2 object",
					})
					traceEndPayload = {
						level: "ERROR",
						statusMessage: "Failed to generate presigned URL",
					}
					return Response.json({ error: "Failed to generate presigned URL for uploaded file" }, { status: 500 })
				}
				presignedUrl = presignedResult

				audioSpan?.event?.({
					name: "r2.direct-upload-used",
					metadata: { r2Key, presignedUrlGenerated: true },
				})
			} else if (file) {
				// Legacy upload path - file needs to be uploaded to R2 via server
				consola.info("💾 [ONBOARDING] Converting file to buffer...", {
					fileName: effectiveFilename,
					fileSize: `${(effectiveFileSize / 1024 / 1024).toFixed(2)}MB`,
					elapsedMs: Date.now() - startTime,
				})
				const fileBuffer = await file.arrayBuffer()
				const fileBlob = new Blob([fileBuffer], { type: file.type })

				consola.info("✅ [ONBOARDING] Buffer conversion complete", {
					bufferSize: `${(fileBuffer.byteLength / 1024 / 1024).toFixed(2)}MB`,
					elapsedMs: Date.now() - startTime,
				})

				consola.info("☁️ [ONBOARDING] Starting R2 upload...", {
					fileName: effectiveFilename,
					fileSize: `${(effectiveFileSize / 1024 / 1024).toFixed(2)}MB`,
					elapsedMs: Date.now() - startTime,
				})

				// Upload to R2 first (with multipart + retry for large files)
				const storageResult = await storeAudioFile({
					projectId: finalProjectId,
					interviewId: interview.id,
					source: fileBlob,
					originalFilename: file.name,
					contentType: file.type,
					langfuseParent: audioSpan ?? trace,
				})

				const storageError = storageResult.error

				if (storageError || !storageResult.mediaUrl || !storageResult.presignedUrl) {
					consola.error("❌ [ONBOARDING] R2 upload failed:", storageError, {
						elapsedMs: Date.now() - startTime,
					})
					audioSpan?.end?.({
						level: "ERROR",
						statusMessage: storageError ?? "Failed to store audio file",
					})
					traceEndPayload = {
						level: "ERROR",
						statusMessage: `Failed to store audio file: ${storageError}`,
					}
					return Response.json({ error: `Failed to store audio file: ${storageError}` }, { status: 500 })
				}

				finalR2Key = storageResult.mediaUrl
				presignedUrl = storageResult.presignedUrl

				consola.info("✅ [ONBOARDING] R2 upload complete", {
					r2Key: finalR2Key,
					elapsedMs: Date.now() - startTime,
				})

				// Update interview with R2 key (not presigned URL)
				await supabase.from("interviews").update({ media_url: finalR2Key }).eq("id", interview.id)
			} else {
				// This shouldn't happen due to earlier validation, but handle it
				audioSpan?.end?.({
					level: "ERROR",
					statusMessage: "No file or r2Key provided",
				})
				traceEndPayload = {
					level: "ERROR",
					statusMessage: "No file or r2Key provided",
				}
				return Response.json({ error: "No file or r2Key provided" }, { status: 500 })
			}

			audioSpan?.end?.({
				output: {
					r2Key: finalR2Key,
					presignedUrl: presignedUrl.substring(0, 50) + "...",
				},
			})
			trace?.update?.({
				metadata: {
					r2Key: finalR2Key,
				},
			})

			// Submit to Assembly AI for async transcription with webhook
			const assemblySpan = trace?.span?.({
				name: "assemblyai.submit",
				metadata: {
					interviewId: interview.id,
				},
			})

			try {
				const apiKey = process.env.ASSEMBLYAI_API_KEY
				if (!apiKey) {
					throw new Error("ASSEMBLYAI_API_KEY not configured")
				}

				// Use PUBLIC_TUNNEL_URL for local dev, otherwise infer from request
				const baseUrl = process.env.PUBLIC_TUNNEL_URL
					? `https://${process.env.PUBLIC_TUNNEL_URL}`
					: new URL(request.url).origin

				const webhookUrl = `${baseUrl}/api/assemblyai-webhook`

				consola.info("🎙️ [ONBOARDING] Submitting to Assembly AI...", {
					webhookUrl,
					presignedUrl: `${presignedUrl.substring(0, 100)}...`,
					elapsedMs: Date.now() - startTime,
				})

				const transcriptResponse = await fetch("https://api.assemblyai.com/v2/transcript", {
					method: "POST",
					headers: {
						authorization: apiKey,
						"content-type": "application/json",
					},
					body: JSON.stringify({
						audio_url: presignedUrl,
						webhook_url: webhookUrl,
						speech_model: "slam-1",
						speaker_labels: true,
						format_text: true,
						punctuate: true,
						sentiment_analysis: false,
					}),
				})

				if (!transcriptResponse.ok) {
					const errorText = await transcriptResponse.text()
					consola.error("❌ [ONBOARDING] Assembly AI submission failed:", {
						status: transcriptResponse.status,
						error: errorText,
						elapsedMs: Date.now() - startTime,
					})
					throw new Error(`AssemblyAI request failed: ${transcriptResponse.status} ${errorText}`)
				}

				const transcriptData = await transcriptResponse.json()
				consola.info("✅ [ONBOARDING] Assembly AI job created", {
					transcriptId: transcriptData.id,
					status: transcriptData.status,
					elapsedMs: Date.now() - startTime,
				})

				// Update interview with conversation_analysis metadata
				// (upload_jobs and analysis_jobs tables consolidated into interviews.conversation_analysis)
				const { error: updateError } = await supabaseAdmin
					.from("interviews")
					.update({
						status: "processing" as const,
						conversation_analysis: {
							current_step: "transcription",
							transcript_data: {
								status: "pending_transcription",
								assemblyai_id: transcriptData.id,
								file_name: effectiveFilename,
								file_type: effectiveContentType,
								external_url: presignedUrl,
							},
							custom_instructions: customInstructions,
							status_detail: "Transcribing with Assembly AI",
						},
					})
					.eq("id", interview.id)

				if (updateError) {
					throw new Error(`Failed to update interview: ${updateError.message}`)
				}

				assemblySpan?.end?.({
					output: {
						assemblyaiId: transcriptData.id,
						interviewId: interview.id,
					},
				})

				// Return interview info for frontend tracking
				triggerRunInfo = {
					runId: interview.id, // Use interview ID for tracking
					publicToken: null, // Will be set when orchestrator starts
				}

				consola.success("Transcription job queued, webhook will trigger processing when complete")
			} catch (analysisError) {
				const message = analysisError instanceof Error ? analysisError.message : "Failed to submit for transcription"
				consola.error("Assembly AI submission failed:", analysisError)
				assemblySpan?.end?.({
					level: "ERROR",
					statusMessage: message,
				})
				audioSpan?.event?.({
					name: "assemblyai.error",
					metadata: {
						interviewId: interview.id,
						message,
					},
				})
				traceEndPayload = { level: "ERROR", statusMessage: message }
				return Response.json({ error: "Failed to submit for transcription" }, { status: 500 })
			}
		}

		// Mark onboarding completed when first interview is uploaded
		await supabaseAdmin.from("user_settings").upsert(
			{
				user_id: user.sub,
				onboarding_completed: true,
				onboarding_steps: {
					first_interview_uploaded: true,
					first_interview_date: new Date().toISOString(),
					first_interview_id: interview.id,
				},
			},
			{
				onConflict: "user_id",
			}
		)

		traceEndPayload = {
			output: {
				interviewId: interview.id,
				projectId: finalProjectId,
				mediaType: mediaTypeInput,
				fileSize: file.size,
			},
			metadata: {
				accountId: teamAccountId,
			},
		}

		return Response.json({
			success: true,
			interview: {
				id: interview.id,
				project_id: finalProjectId,
				account_id: teamAccountId,
				title: interview.title,
				status: interview.status,
			},
			project: {
				id: finalProjectId,
				account_id: teamAccountId,
			},
			triggerRun: triggerRunInfo
				? {
						id: triggerRunInfo.runId,
						publicToken: triggerRunInfo.publicToken,
					}
				: null,
		})
	} catch (error) {
		consola.error("Onboarding start failed:", error)
		const message = error instanceof Error ? error.message : "Processing failed"
		traceEndPayload = { level: "ERROR", statusMessage: message }
		return Response.json({ error: message }, { status: 500 })
	} finally {
		trace?.end?.(traceEndPayload)
	}
}
