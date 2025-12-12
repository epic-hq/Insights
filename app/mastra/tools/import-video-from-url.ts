import { createTool } from "@mastra/core/tools"
import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import { format } from "date-fns"
import { z } from "zod"
import { createPlannedAnswersForInterview } from "~/lib/database/project-answers.server"
import { supabaseAdmin } from "~/lib/supabase/client.server"
import type { Database } from "~/types"
import { createAndProcessAnalysisJob } from "~/utils/processInterviewAnalysis.server"
import { storeAudioFile } from "~/utils/storeAudioFile.server"

function deriveFileName(url: string, fallbackTitle?: string | null) {
	try {
		const parsedUrl = new URL(url)
		const pathName = parsedUrl.pathname.split("/").filter(Boolean).pop()
		if (pathName) return pathName
	} catch (error) {
		consola.warn("Failed to parse video URL for filename", error)
	}
	return fallbackTitle ? `${fallbackTitle}.mp4` : "remote-video.mp4"
}

function deriveFileExtension(url: string) {
	const match = url.match(/\.([a-zA-Z0-9]{2,5})(?:$|[?#])/)
	return match ? match[1].toLowerCase() : null
}

function ensureContext(runtimeContext?: Map<string, unknown> | any) {
	const accountId = runtimeContext?.get?.("account_id") as string | undefined
	const projectId = runtimeContext?.get?.("project_id") as string | undefined
	const userId = runtimeContext?.get?.("user_id") as string | undefined

	if (!accountId || !projectId) {
		throw new Error("Missing account_id or project_id in runtime context")
	}

	return { accountId, projectId, userId }
}

export const importVideoFromUrlTool = createTool({
	id: "importVideoFromUrl",
	description:
		"Fetch a remote video/audio file by URL, store it, and kick off the Trigger.dev interview processing pipeline for the current project.",
	inputSchema: z.object({
		videoUrl: z.string().url().describe("Direct link to the video or audio file to import."),
		title: z.string().optional().describe("Optional title to use for the new interview."),
		participantName: z.string().optional().describe("Optional participant name to associate with the interview."),
		customInstructions: z.string().optional().describe("Optional custom instructions to guide analysis."),
	}),
	execute: async ({ input, runtimeContext }) => {
		const { videoUrl, title, participantName, customInstructions } = input
		const { accountId, projectId, userId } = ensureContext(runtimeContext)

		const adminClient: SupabaseClient<Database> = supabaseAdmin

		const defaultTitle = title || `Imported interview - ${format(new Date(), "yyyy-MM-dd")}`
		const inferredExtension = deriveFileExtension(videoUrl)
		const inferredFilename = deriveFileName(videoUrl, title)

		const { data: interview, error: insertError } = await adminClient
			.from("interviews")
			.insert({
				account_id: accountId,
				project_id: projectId,
				title: defaultTitle,
				participant_pseudonym: participantName || "Unknown participant",
				status: "uploading",
				source_type: "video_url",
				file_extension: inferredExtension,
				original_filename: inferredFilename,
			})
			.select()
			.single()

		if (insertError || !interview) {
			throw new Error(insertError?.message || "Failed to create interview record")
		}

		await createPlannedAnswersForInterview(adminClient, { projectId, interviewId: interview.id })

		const storageResult = await storeAudioFile({
			projectId,
			interviewId: interview.id,
			source: videoUrl,
			originalFilename: inferredFilename,
		})

		const mediaUrl = storageResult.mediaUrl || videoUrl
		if (!storageResult.mediaUrl) {
			consola.warn("Falling back to direct URL because R2 upload failed", storageResult.error)
		}

		await adminClient.from("interviews").update({ media_url: mediaUrl, status: "processing" }).eq("id", interview.id)

		const transcriptData: Record<string, unknown> = {
			needs_transcription: true,
			file_type: "media",
			original_filename: inferredFilename,
		}

		const runInfo = await createAndProcessAnalysisJob({
			interviewId: interview.id,
			transcriptData,
			customInstructions: customInstructions || "",
			adminClient,
			mediaUrl,
			initiatingUserId: userId ?? null,
		})

		return {
			message: "Uploaded media from URL and queued Trigger.dev processing. Results will appear once analysis finishes.",
			interviewId: interview.id,
			triggerRunId: runInfo?.runId ?? null,
			publicRunToken: runInfo?.publicToken ?? null,
		}
	},
})
