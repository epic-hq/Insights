import type { UUID } from "node:crypto"
import consola from "consola"
import { format } from "date-fns"
import type { ActionFunctionArgs } from "react-router"
import { deriveProjectNameDescription } from "~/features/onboarding/server/signup-derived-project"
import { createProject } from "~/features/projects/db"
import { createPlannedAnswersForInterview } from "~/lib/database/project-answers.server"
import { createSupabaseAdminClient, getAuthenticatedUser, getServerClient } from "~/lib/supabase/client.server"
import { PRODUCTION_HOST } from "~/paths"
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

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

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
			return Response.json({ error: "Missing file" }, { status: 400 })
		}
		if (!onboardingDataStr) {
			consola.error("Missing onboardingData")
			return Response.json({ error: "Missing onboardingData" }, { status: 400 })
		}

		const onboardingData: OnboardingData = JSON.parse(onboardingDataStr)

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
				return Response.json({ error: "Failed to create project" }, { status: 500 })
			}

			finalProjectId = project.id as UUID
			consola.log("Created new project:", project.id)

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
			}
		}

		// 2. Create interview record with initial status
		const customInstructions = `This interview is part of research about ${primaryRole} at ${primaryOrg}.

Key research questions to focus on:
${questionsInput.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Please extract insights that specifically address these research questions and help understand ${primaryRole} at ${primaryOrg} better.`

		const interviewData: InterviewInsert = {
			account_id: user.sub, // Personal ownership for RLS compatibility
			project_id: finalProjectId,
			title: file.name,
			interview_date: format(new Date(), "yyyy-MM-dd"),
			participant_pseudonym: "Participant 1",
			segment: null,
			media_url: null, // Will be set by upload worker
			media_type: mediaTypeInput, // Store the selected media type
			transcript: null, // Will be set by transcription
			transcript_formatted: null,
			duration_sec: null,
			status: "uploaded", // Starting status for pipeline
		} as InterviewInsert

		const { data: interview, error: interviewError } = await supabase
			.from("interviews")
			.insert(interviewData)
			.select()
			.single()

		if (interviewError || !interview) {
			consola.error("Interview creation failed:", interviewError)
			return Response.json({ error: "Failed to create interview" }, { status: 500 })
		}

		await createPlannedAnswersForInterview(supabase, {
			projectId: finalProjectId,
			interviewId: interview.id,
		})

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

			if (!textContent || textContent.trim().length === 0) {
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

			// Skip upload queue, go directly to analysis - use admin client to bypass RLS
			const { error: analysisJobError } = await supabaseAdmin.from("analysis_jobs").insert({
				interview_id: interview.id,
				transcript_data: transcriptData,
				custom_instructions: customInstructions,
				status: "pending",
			})

			if (analysisJobError) {
				consola.error("Failed to create analysis job:", analysisJobError)
				return Response.json({ error: "Failed to queue analysis" }, { status: 500 })
			}

			// Update interview status - text files skip transcription and go straight to ready
			await supabase
				.from("interviews")
				.update({
					status: "ready",
					transcript: textContent.trim(),
					transcript_formatted: transcriptData,
				})
				.eq("id", interview.id)
		} else {
			// Handle audio/video files - store file first, then upload to AssemblyAI with webhook
			const apiKey = process.env.ASSEMBLYAI_API_KEY
			if (!apiKey) {
				return Response.json({ error: "AssemblyAI API key not configured" }, { status: 500 })
			}

			// Store audio file in Cloudflare R2 first using shared utility
			consola.log("Storing audio file in Cloudflare R2...")
			const { mediaUrl: storedMediaUrl, error: storageError } = await storeAudioFile({
				projectId: finalProjectId,
				interviewId: interview.id,
				source: file,
				originalFilename: file.name,
				contentType: file.type,
			})

			if (storageError || !storedMediaUrl) {
				consola.error("Audio storage failed:", storageError)
				return Response.json({ error: `Failed to store audio file: ${storageError}` }, { status: 500 })
			}

			consola.log("Audio file stored successfully:", storedMediaUrl)

			// Update interview with media URL
			await supabase.from("interviews").update({ media_url: storedMediaUrl }).eq("id", interview.id)

			// Upload to AssemblyAI
			const uploadResp = await fetch("https://api.assemblyai.com/v2/upload", {
				method: "POST",
				headers: { Authorization: apiKey },
				body: file.stream(),
				duplex: "half",
			} as RequestInit)

			if (!uploadResp.ok) {
				const errorText = await uploadResp.text()
				consola.error("AssemblyAI upload failed:", uploadResp.status, errorText)
				return Response.json({ error: "File upload failed" }, { status: 500 })
			}

			const { upload_url } = (await uploadResp.json()) as { upload_url: string }
			consola.log("File uploaded to AssemblyAI:", upload_url)

			// Start transcription with webhook
			// In production: use PRODUCTION_HOST
			// In development: prefer PUBLIC_TUNNEL_URL (e.g., ngrok) so AssemblyAI can reach your machine
			const host =
				process.env.NODE_ENV === "production"
					? PRODUCTION_HOST
					: (() => {
							const tunnel = process.env.PUBLIC_TUNNEL_URL
							if (!tunnel) return PRODUCTION_HOST
							return tunnel.startsWith("http") ? tunnel : `https://${tunnel}`
						})()
			const webhookUrl = `${host}/api/assemblyai-webhook`

			consola.log("AssemblyAI Webhook: Starting transcription with webhook URL:", webhookUrl)

			const transcriptResp = await fetch("https://api.assemblyai.com/v2/transcript", {
				method: "POST",
				headers: {
					Authorization: apiKey,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					audio_url: upload_url,
					webhook_url: webhookUrl,
					// Add the same parameters as working version
					speaker_labels: true,
					iab_categories: true,
					format_text: true,
					punctuate: true,
					// auto_chapters: true,
					sentiment_analysis: false,
					auto_highlights: true,
					summarization: true,
					summary_model: "informative",
					summary_type: "bullets",
				}),
			})

			if (!transcriptResp.ok) {
				const errorText = await transcriptResp.text()
				consola.error("AssemblyAI transcription failed:", transcriptResp.status, errorText)
				return Response.json({ error: "Transcription request failed" }, { status: 500 })
			}

			const { id: assemblyai_id } = (await transcriptResp.json()) as { id: string }

			// Create upload job record for tracking - use admin client to bypass RLS
			const { error: uploadJobError } = await supabaseAdmin.from("upload_jobs").insert({
				interview_id: interview.id,
				file_name: file.name,
				file_type: file.type,
				external_url: upload_url,
				assemblyai_id: assemblyai_id,
				status: "in_progress",
				status_detail: "Transcription in progress",
				custom_instructions: customInstructions,
			})

			if (uploadJobError) {
				consola.error("Failed to create upload job:", uploadJobError)
				// Continue anyway - webhook will handle completion
			}

			consola.log("Transcription started with ID:", assemblyai_id)
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

		return Response.json({
			success: true,
			interview: {
				id: interview.id,
				project_id: finalProjectId,
				title: interview.title,
				status: interview.status,
			},
			project: {
				id: finalProjectId,
			},
		})
	} catch (error) {
		consola.error("Onboarding start failed:", error)
		return Response.json({ error: error instanceof Error ? error.message : "Processing failed" }, { status: 500 })
	}
}
