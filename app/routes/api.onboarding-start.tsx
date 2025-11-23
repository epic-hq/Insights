import type { UUID } from "node:crypto"
import consola from "consola"
import { format } from "date-fns"
import type { LangfuseSpanClient, LangfuseTraceClient } from "langfuse"
import type { ActionFunctionArgs } from "react-router"
import { deriveProjectNameDescription } from "~/features/onboarding/server/signup-derived-project"
import { createProject } from "~/features/projects/db"
import { createPlannedAnswersForInterview } from "~/lib/database/project-answers.server"
import { getLangfuseClient } from "~/lib/langfuse.server"
import { createSupabaseAdminClient, getAuthenticatedUser, getServerClient } from "~/lib/supabase/client.server"
import { PRODUCTION_HOST } from "~/paths"
import type { InterviewInsert } from "~/types"
import { createAndProcessAnalysisJob } from "~/utils/processInterviewAnalysis.server"
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
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	const langfuse = getLangfuseClient()
	let trace: LangfuseTraceClient | undefined
	let traceEndPayload: TraceEndPayload | undefined
	let triggerRunInfo: { runId: string; publicToken: string | null } | null = null

	try {
		// Get authenticated user and their team account
		const user = await getAuthenticatedUser(request)
		if (!user) {
			return Response.json({ error: "User not authenticated" }, { status: 401 })
		}

		const { client: supabase } = getServerClient(request)
		// Single admin client for RLS-bypassing operations in this action
		const supabaseAdmin = createSupabaseAdminClient()

		// Get team account from user context (set by middleware)
		// For API routes, we should get this from user context or use RPC to get current account
		const { data: userSettings } = await supabase
			.from("user_settings")
			.select("last_used_account_id")
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

		const formData = await request.formData()
		const file = formData.get("file") as File | null
		const onboardingDataStr = formData.get("onboardingData") as string
		const projectId = formData.get("projectId") as UUID
		const personId = formData.get("personId") as string | null

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

		if (!file) {
			consola.error("Missing file")
			traceEndPayload = { level: "ERROR", statusMessage: "Missing file" }
			return Response.json({ error: "Missing file" }, { status: 400 })
		}
		if (!onboardingDataStr) {
			consola.error("Missing onboardingData")
			traceEndPayload = { level: "ERROR", statusMessage: "Missing onboardingData" }
			return Response.json({ error: "Missing onboardingData" }, { status: 400 })
		}

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
				const derived = await deriveProjectNameDescription({ supabase, userId: user.sub })
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
					meta: { target_orgs: (onboardingData as any).target_orgs || (primaryOrg ? [primaryOrg] : []) },
				},
				{
					project_id: finalProjectId,
					kind: "target_roles",
					content_md: Array.isArray((onboardingData as any).target_roles)
						? ((onboardingData as any).target_roles as string[]).join(", ")
						: primaryRole,
					meta: { target_roles: (onboardingData as any).target_roles || (primaryRole ? [primaryRole] : []) },
				},
				{
					project_id: finalProjectId,
					kind: "research_goal",
					content_md: researchGoal,
					meta: { research_goal: researchGoal, research_goal_details: researchGoalDetails },
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

		let linkedPerson: { id: string; name: string | null; project_id: string | null } | null = null
		if (personId) {
			const { data: person, error: personError } = await supabase
				.from("people")
				.select("id, name, project_id")
				.eq("id", personId)
				.maybeSingle()

			if (personError || !person) {
				consola.error("Failed to resolve person for recording", personError)
				return Response.json({ error: "Unable to link person to interview" }, { status: 400 })
			}

			if (person.project_id && projectId && person.project_id !== projectId) {
				consola.warn("Person project mismatch", { personProject: person.project_id, requestedProject: projectId })
			}

			linkedPerson = person
		}

		const interviewDate = new Date()
		const dateLabel = format(interviewDate, "MMM d, yyyy")
		const titleFromPerson = linkedPerson?.name ? `${linkedPerson.name} • ${dateLabel}` : undefined

		const interviewData: InterviewInsert = {
			account_id: teamAccountId,
			project_id: finalProjectId,
			title: titleFromPerson ?? file.name,
			interview_date: format(interviewDate, "yyyy-MM-dd"),
			participant_pseudonym: linkedPerson?.name ?? "Participant 1",
			segment: null,
			media_url: null, // Will be set by upload worker
			media_type: mediaTypeInput, // Store the selected media type
			transcript: null, // Will be set by transcription
			transcript_formatted: null,
			duration_sec: null,
			status: "uploaded", // Starting status for pipeline
		} as InterviewInsert

		const interviewSpan = trace?.span?.({
			name: "interview.create",
			metadata: {
				projectId: finalProjectId,
				accountId: teamAccountId,
			},
			input: {
				fileName: file.name,
				mediaType: mediaTypeInput,
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

		if (linkedPerson) {
			await supabase
				.from("interview_people")
				.upsert({ interview_id: interview.id, person_id: linkedPerson.id }, { onConflict: "interview_id,person_id" })
		}

		consola.log("Created interview:", interview.id)

		// 3. Check if file is text or needs AssemblyAI processing
		const isTextFile =
			file.type.startsWith("text/") ||
			file.name.endsWith(".txt") ||
			file.name.endsWith(".md") ||
			file.name.endsWith(".markdown")

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
				traceEndPayload = { level: "ERROR", statusMessage: "Text file is empty" }
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
				const runInfo = await createAndProcessAnalysisJob({
					interviewId: interview.id,
					transcriptData,
					customInstructions,
					adminClient: supabaseAdmin,
					mediaUrl: "",
					initiatingUserId: user.sub,
					langfuseParent: textSpan ?? trace,
				})
				if (runInfo && "runId" in runInfo) {
					triggerRunInfo = runInfo
				}
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
		} else {
			// Handle audio/video files - store file first, then trigger Trigger.dev task for transcription
			const audioSpan = trace?.span?.({
				name: "ingest.audio",
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
			// Store audio file in Cloudflare R2 first using shared utility
			const fileBuffer = await file.arrayBuffer()
			const fileBlob = new Blob([fileBuffer], { type: file.type })
			const _assemblyPayload = Buffer.from(fileBuffer)

			consola.log("Uploading audio to R2...")

			// Upload to R2 first (with multipart + retry for large files)
			const storageResult = await storeAudioFile({
				projectId: finalProjectId,
				interviewId: interview.id,
				source: fileBlob,
				originalFilename: file.name,
				contentType: file.type,
				langfuseParent: audioSpan ?? trace,
			})

			const r2Key = storageResult.mediaUrl
			const presignedUrl = storageResult.presignedUrl
			const storageError = storageResult.error

			if (storageError || !r2Key || !presignedUrl) {
				consola.error("R2 upload failed:", storageError)
				audioSpan?.end?.({
					level: "ERROR",
					statusMessage: storageError ?? "Failed to store audio file",
				})
				traceEndPayload = { level: "ERROR", statusMessage: `Failed to store audio file: ${storageError}` }
				return Response.json({ error: `Failed to store audio file: ${storageError}` }, { status: 500 })
			}

			consola.log("Audio file stored successfully in R2. Key:", r2Key)
			audioSpan?.end?.({
				output: {
					r2Key,
					presignedUrl,
				},
			})
			trace?.update?.({
				metadata: {
					r2Key,
				},
			})

			// Update interview with R2 key (not presigned URL)
			await supabase.from("interviews").update({ media_url: r2Key }).eq("id", interview.id)

			// Submit to Assembly AI for async transcription with webhook
			const assemblySpan = audioSpan?.span?.({
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

				consola.info("Submitting to Assembly AI:", { webhookUrl, presignedUrl })

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
					throw new Error(`AssemblyAI request failed: ${transcriptResponse.status} ${errorText}`)
				}

				const transcriptData = await transcriptResponse.json()
				consola.info("Assembly AI job created:", { id: transcriptData.id, status: transcriptData.status })

				// Create upload_job to track transcription
				const { data: uploadJob, error: uploadJobError } = await supabaseAdmin
					.from("upload_jobs")
					.insert({
						interview_id: interview.id,
						file_name: file.name,
						file_type: file.type,
						external_url: presignedUrl,
						assemblyai_id: transcriptData.id,
						custom_instructions: customInstructions,
						status: "in_progress" as const,
						status_detail: "Transcribing with Assembly AI",
						created_by: user.sub,
					})
					.select()
					.single()

				if (uploadJobError || !uploadJob) {
					throw new Error(`Failed to create upload job: ${uploadJobError?.message}`)
				}

				assemblySpan?.end?.({
					output: {
						assemblyaiId: transcriptData.id,
						uploadJobId: uploadJob.id,
					},
				})

				// Create pending analysis_job so frontend has a runId to track
				// Webhook will trigger the orchestrator when transcription completes
				const { data: analysisJob, error: analysisJobError } = await supabaseAdmin
					.from("analysis_jobs")
					.insert({
						interview_id: interview.id,
						transcript_data: { status: "pending_transcription" },
						custom_instructions: customInstructions,
						status: "pending" as const,
						status_detail: "Waiting for transcription to complete",
						current_step: "transcription",
					})
					.select()
					.single()

				if (analysisJobError || !analysisJob) {
					throw new Error(`Failed to create analysis job: ${analysisJobError?.message}`)
				}

				// Return job info for frontend tracking
				triggerRunInfo = {
					runId: analysisJob.id,
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
