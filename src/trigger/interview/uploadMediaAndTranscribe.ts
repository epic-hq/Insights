/**
 * @deprecated Use v2 modular workflow instead (src/trigger/interview/v2/orchestrator.ts)
 * This v1 monolithic task is kept for backward compatibility only and is no longer triggered by new code.
 */

import { metadata, task } from "@trigger.dev/sdk"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import {
	type UploadMediaAndTranscribePayload,
	uploadMediaAndTranscribeCore,
	workflowRetryConfig,
} from "~/utils/processInterview.server"
import { transcribeAudioFromUrl } from "~/utils/assemblyai.server"

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error)
}

export const uploadMediaAndTranscribeTask = task({
	id: "interview.upload-media-and-transcribe",
	retry: workflowRetryConfig,
	run: async (payload: UploadMediaAndTranscribePayload) => {
		console.log("=== UPLOAD MEDIA AND TRANSCRIBE TASK START ===")
		console.log("Payload received:", JSON.stringify(payload, null, 2))

		const {
			analysisJobId,
			metadata: payloadMetadata,
			transcriptData,
			mediaUrl,
			existingInterviewId,
			userCustomInstructions,
		} = payload

		console.log("📊 Extracted parameters:")
		console.log("- analysisJobId:", analysisJobId)
		console.log("- existingInterviewId:", existingInterviewId)
		console.log("- mediaUrl:", mediaUrl)
		console.log("- mediaUrl type:", typeof mediaUrl)
		console.log("- mediaUrl length:", mediaUrl?.length)
		console.log("- mediaUrl starts with http:", mediaUrl?.startsWith("http"))
		console.log("- mediaUrl starts with https:", mediaUrl?.startsWith("https"))
		console.log("- transcriptData:", JSON.stringify(transcriptData, null, 2))

		const client = createSupabaseAdminClient()
		let interviewId = payload.existingInterviewId ?? null

		try {
			metadata.set("stageLabel", "Processing media")
			metadata.set("progressPercent", 10)
			if (payload.analysisJobId) {
				metadata.set("analysisJobId", payload.analysisJobId)
			}
			if (payloadMetadata.accountId) {
				metadata.set("accountId", payloadMetadata.accountId)
			}
			if (payloadMetadata.projectId) {
				metadata.set("projectId", payloadMetadata.projectId)
			}

			if (payload.analysisJobId) {
				await client
					.from("analysis_jobs")
					.update({
						status: "in_progress",
						status_detail: "Processing media",
						progress: 10,
					})
					.eq("id", payload.analysisJobId as string)
			}

			// Check if we have transcript data or need to transcribe
			let transcriptData = payload.transcriptData
			let needsTranscription = false

			// For retries (existingInterviewId present), always transcribe if we have media
			const isRetry = payload.existingInterviewId && payload.analysisJobId
			if (isRetry && payload.mediaUrl) {
				console.log("🔄 This is a retry - forcing transcription")
				needsTranscription = true
			} else if (payload.mediaUrl) {
				// For initial uploads, check if we already have meaningful transcript data
				const hasMeaningfulTranscript =
					transcriptData &&
					transcriptData.full_transcript &&
					transcriptData.full_transcript.trim().length > 0

				if (!hasMeaningfulTranscript) {
					console.log("📝 No meaningful transcript data found - will transcribe")
					needsTranscription = true
				} else {
					console.log("📋 Already have transcript data - skipping transcription")
				}
			}

			if (needsTranscription && payload.mediaUrl) {
				metadata.set("stageLabel", "Transcribing audio")
				metadata.set("progressPercent", 20)

				try {
					// Generate fresh presigned URL from R2 key for AssemblyAI
					console.log("🎵 Starting transcription process...")
					console.log("- Original mediaUrl:", payload.mediaUrl)
					const { createR2PresignedUrl, validateR2PresignedUrl, extractR2KeyFromUrl } = await import("~/utils/r2.server")
					let transcriptionUrl = payload.mediaUrl

					// Check if mediaUrl is already a presigned URL
					if (payload.mediaUrl.startsWith("http://") || payload.mediaUrl.startsWith("https://")) {
						console.log("- Provided URL appears to be presigned, validating...")

						// Validate the existing presigned URL
						const isValid = await validateR2PresignedUrl(payload.mediaUrl)
						if (!isValid) {
							console.log("- ❌ Presigned URL is invalid/expired, attempting to regenerate...")

							// Try to extract the R2 key from the URL to regenerate
							const r2Key = extractR2KeyFromUrl(payload.mediaUrl)
							if (r2Key) {
								console.log("- Extracted R2 key, generating fresh presigned URL...")
								const freshPresigned = createR2PresignedUrl({
									key: r2Key,
									expiresInSeconds: 24 * 60 * 60, // 24 hours for transcription
								})

								if (freshPresigned) {
									transcriptionUrl = freshPresigned.url
									console.log("- ✅ Generated fresh presigned URL for transcription:", transcriptionUrl.slice(0, 100) + "...")
								} else {
									console.error("- ❌ Failed to generate fresh presigned URL!")
									throw new Error("Failed to generate fresh presigned URL for transcription")
								}
							} else {
								console.error("- ❌ Could not extract R2 key from invalid URL!")
								throw new Error("Could not extract R2 key from invalid presigned URL")
							}
						} else {
							console.log("- ✅ Presigned URL is valid, using directly")
							transcriptionUrl = payload.mediaUrl
						}
					} else {
						// mediaUrl is an R2 key, generate presigned URL
						console.log("- Detected R2 key, generating presigned URL...")
						const presigned = createR2PresignedUrl({
							key: payload.mediaUrl,
							expiresInSeconds: 24 * 60 * 60, // 24 hours for transcription
						})

						if (!presigned) {
							console.error("- ❌ Presigned URL generation failed!")
							throw new Error("Failed to generate presigned URL for transcription")
						}

						transcriptionUrl = presigned.url
						console.log("- ✅ Generated presigned URL for transcription:", transcriptionUrl.slice(0, 100) + "...")
					}

					console.log("🔄 Calling transcribeAudioFromUrl with URL:", transcriptionUrl.slice(0, 100) + "...")

					// Add timeout wrapper around transcription (10 minutes max as requested)
					const transcriptionPromise = transcribeAudioFromUrl(transcriptionUrl)
					const timeoutPromise = new Promise((_, reject) => {
						setTimeout(() => reject(new Error("Transcription timeout: no response after 10 minutes")), 10 * 60 * 1000)
					})

					// Add progress tracking during transcription
					const progressPromise = new Promise((resolve, reject) => {
						const progressInterval = setInterval(() => {
							// Check if transcription is still running and update progress
							metadata.set("progressPercent", Math.min(25, (metadata.get("progressPercent") as number || 20) + 1))
						}, 30 * 1000) // Update every 30 seconds

						transcriptionPromise
							.then(resolve)
							.catch(reject)
							.finally(() => clearInterval(progressInterval))
					})

					transcriptData = await Promise.race([progressPromise, timeoutPromise]) as any
					console.log("✅ Transcription completed successfully")
					metadata.set("stageLabel", "Transcription complete")
					metadata.set("progressPercent", 30)
				} catch (transcriptionError) {
					console.error("❌ Transcription failed:", transcriptionError)
					throw new Error(`Transcription failed: ${transcriptionError instanceof Error ? transcriptionError.message : String(transcriptionError)}`)
				}
			} else {
				console.log("⏭️ Skipping transcription - no mediaUrl or already has transcript")
			}

			// Create normalized payload with transcript data
			const normalizedPayload = {
				...payload,
				transcriptData,
			}

			const uploadResult = await uploadMediaAndTranscribeCore({
				...normalizedPayload,
				client,
			})
			interviewId = uploadResult.interview.id

			metadata.set("interviewId", uploadResult.interview.id)
			metadata.set("stageLabel", "Preparing evidence extraction")
			metadata.set("progressPercent", 35)

			if (payload.analysisJobId) {
				await client
					.from("analysis_jobs")
					.update({
						status_detail: "Extracting evidence",
						progress: 25,
					})
					.eq("id", payload.analysisJobId as string)
			}

			const { extractEvidenceAndPeopleTask } = await import("./extractEvidenceAndPeople")
			metadata.set("stageLabel", "Extracting evidence and participants")
			metadata.set("progressPercent", 55)
			const evidenceResultRun = await extractEvidenceAndPeopleTask.triggerAndWait({
				...uploadResult,
				analysisJobId: payload.analysisJobId,
				userCustomInstructions: payload.userCustomInstructions,
			})

			if (!evidenceResultRun.ok) {
				const message =
					evidenceResultRun.error?.message ??
					"Failed to extract people and evidence from interview transcript."
				throw new Error(message)
			}

			if (!evidenceResultRun.output) {
				throw new Error("Evidence extraction completed without a result payload.")
			}

			const extractedOutput = evidenceResultRun.output

			metadata.set("stageLabel", "Evidence extraction complete")
			metadata.set("progressPercent", 65)

			let interviewForAnalysis = uploadResult.interview
			const { data: refreshedInterview } = await client
				.from("interviews")
				.select("*")
				.eq("id", uploadResult.interview.id)
				.maybeSingle()

			if (refreshedInterview) {
				interviewForAnalysis = refreshedInterview as typeof interviewForAnalysis
			}

			const { analyzeThemesAndPersonaTask } = await import("./analyzeThemesAndPersona")
			metadata.set("stageLabel", "Synthesizing interview insights")
			metadata.set("progressPercent", 75)

			const analysisResult = await analyzeThemesAndPersonaTask.triggerAndWait({
				metadata: uploadResult.metadata,
				interview: interviewForAnalysis,
				fullTranscript: uploadResult.fullTranscript,
				userCustomInstructions: payload.userCustomInstructions,
				evidenceResult: extractedOutput.evidenceResult,
				analysisJobId: payload.analysisJobId,
			})

			if (!analysisResult.ok) {
				const message =
					analysisResult.error?.message ?? "Failed to analyze themes and personas for interview."
				throw new Error(message)
			}

			if (!analysisResult.output) {
				throw new Error("Interview analysis completed without a result payload.")
			}

			// Generate structured conversation analysis (key takeaways, recommendations, open questions)
			// and persist to conversation_lens_analyses for the detail page UI
			metadata.set("stageLabel", "Generating conversation analysis")
			metadata.set("progressPercent", 90)

			try {
				const { generateConversationAnalysis, enrichConversationAnalysisWithEvidenceIds } = await import("~/utils/conversationAnalysis.server")
				const { upsertConversationOverviewLens } = await import(
					"~/lib/conversation-analyses/upsertConversationOverviewLens.server"
				)

				const attendees = [
					payloadMetadata.interviewerName,
					payloadMetadata.participantName,
				].filter((v): v is string => typeof v === "string" && v.trim().length > 0)

				const conversationAnalysis = await generateConversationAnalysis({
					transcript: uploadResult.fullTranscript,
					context: {
						meetingTitle: payloadMetadata.interviewTitle || interviewForAnalysis.title || undefined,
						attendees: attendees.length ? attendees : undefined,
					},
				})

				const { data: evidenceForTraceability } = await client
					.from("evidence")
					.select("id, verbatim, gist")
					.eq("interview_id", interviewForAnalysis.id)

				const enrichedConversationAnalysis = enrichConversationAnalysisWithEvidenceIds(
					conversationAnalysis,
					(evidenceForTraceability || []).map((item) => ({
						id: item.id,
						verbatim: item.verbatim,
						gist: item.gist,
					}))
				)

				await upsertConversationOverviewLens({
					db: client,
					interviewId: interviewForAnalysis.id,
					accountId: interviewForAnalysis.account_id,
					projectId: interviewForAnalysis.project_id,
					analysis: enrichedConversationAnalysis,
					computedBy: payloadMetadata.userId,
				})

				console.log("✅ Conversation analysis generated and stored as conversation-overview lens")
			} catch (convAnalysisErr) {
				// Non-fatal — the rest of the pipeline already succeeded
				console.error("⚠️ Conversation analysis generation failed (non-fatal):", convAnalysisErr)
			}

			metadata.set("stageLabel", "Analysis pipeline complete")
			metadata.set("progressPercent", 100)

			return analysisResult.output
		} catch (error) {
			metadata.set("stageLabel", "Processing failed")
			metadata.set("progressPercent", 0)

			if (payload.analysisJobId) {
				await client
					.from("analysis_jobs")
					.update({
						status: "error",
						status_detail: "Upload and transcription normalization failed",
						last_error: errorMessage(error),
					})
					.eq("id", payload.analysisJobId as string)
			}

			if (interviewId) {
				await client
					.from("interviews")
					.update({ status: "error" })
					.eq("id", interviewId as string)
			}

			throw error
		}
	},
})
