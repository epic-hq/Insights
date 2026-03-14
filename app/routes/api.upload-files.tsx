/**
 * Batch File Upload API
 *
 * Accepts multiple files via multipart/form-data, stores each in R2,
 * creates interview records upfront, and triggers background orchestrator
 * tasks for transcription + analysis. Returns immediately with interview IDs
 * so the frontend can track progress via Supabase realtime.
 *
 * This differs from /api/upload-file which blocks on transcription.
 * Here, transcription happens in the background via the orchestrator.
 */

import type { UUID } from "node:crypto";
import { tasks } from "@trigger.dev/sdk";
import consola from "consola";
import { format } from "date-fns";
import type { ActionFunctionArgs } from "react-router";
import { ensureInterviewInterviewerLink } from "~/features/people/services/internalPeople.server";
import { createPlannedAnswersForInterview } from "~/lib/database/project-answers.server";
import { buildFeatureGateContext, checkLimitAccess } from "~/lib/feature-gate/check-limit.server";
import { getServerClient } from "~/lib/supabase/client.server";
import { userContext } from "~/server/user-context";
import { storeAudioFile } from "~/utils/storeAudioFile.server";
import { safeSanitizeTranscriptPayload } from "~/utils/transcript/sanitizeTranscriptData.server";

/** Max files per batch upload to prevent abuse */
const MAX_BATCH_SIZE = 20;

interface FileResult {
	index: number;
	filename: string;
	interviewId: string | null;
	error: string | null;
}

function detectSourceType(file: File): string {
	const fileExtension = file.name.split(".").pop()?.toLowerCase() || "";
	const isTextFile =
		file.type.startsWith("text/") ||
		file.name.endsWith(".txt") ||
		file.name.endsWith(".md") ||
		file.name.endsWith(".markdown");
	const isPdfFile = file.type === "application/pdf" || file.name.endsWith(".pdf");

	if (isTextFile || isPdfFile) return "transcript";
	if (file.type.startsWith("video/")) return "video_upload";
	if (file.type.startsWith("audio/")) return "audio_upload";
	if (["mp4", "mov", "avi", "mkv", "m4v"].includes(fileExtension)) return "video_upload";
	return "audio_upload";
}

function isDocumentFile(file: File): boolean {
	return (
		file.type.startsWith("text/") ||
		file.name.endsWith(".txt") ||
		file.name.endsWith(".md") ||
		file.name.endsWith(".markdown") ||
		file.type === "application/pdf" ||
		file.name.endsWith(".pdf")
	);
}

export async function action({ request, context }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	const ctx = context.get(userContext);
	const userId = ctx?.claims?.sub ?? null;
	const supabase = ctx?.supabase ?? getServerClient(request).client;

	const formData = await request.formData();
	const projectId = formData.get("projectId") as UUID;

	if (!projectId) {
		return Response.json({ error: "No projectId provided" }, { status: 400 });
	}

	// Collect all files from formData
	const files: File[] = [];
	for (const [key, value] of formData.entries()) {
		if (key === "files" && value instanceof File) {
			files.push(value);
		}
	}

	if (files.length === 0) {
		return Response.json({ error: "No files uploaded" }, { status: 400 });
	}

	if (files.length > MAX_BATCH_SIZE) {
		return Response.json(
			{ error: `Maximum ${MAX_BATCH_SIZE} files per upload` },
			{ status: 400 },
		);
	}

	// Resolve account
	const { data: projectRow, error: projectError } = await supabase
		.from("projects")
		.select("account_id")
		.eq("id", projectId)
		.single();

	if (projectError || !projectRow?.account_id) {
		consola.error("[upload-files] Unable to resolve project account", projectId, projectError);
		return Response.json({ error: "Unable to resolve project account" }, { status: 404 });
	}

	const accountId = projectRow.account_id;

	// Check quota for all files upfront
	if (userId) {
		const gateCtx = await buildFeatureGateContext(accountId, userId);
		const limitCheck = await checkLimitAccess(gateCtx, "ai_analyses");
		if (!limitCheck.allowed) {
			return Response.json(
				{
					error: "ai_analyses_limit_exceeded",
					message: `You've used all ${limitCheck.limit} AI analyses this month. Upgrade to analyze more interviews.`,
					currentUsage: limitCheck.currentUsage,
					limit: limitCheck.limit,
					upgradeUrl: limitCheck.upgradeUrl,
				},
				{ status: 403 },
			);
		}
		// Check if remaining quota covers the batch
		if (limitCheck.remaining !== undefined && limitCheck.remaining < files.length) {
			return Response.json(
				{
					error: "ai_analyses_limit_exceeded",
					message: `You can only process ${limitCheck.remaining} more interview${limitCheck.remaining === 1 ? "" : "s"} this month. You're uploading ${files.length}.`,
					currentUsage: limitCheck.currentUsage,
					limit: limitCheck.limit,
					remaining: limitCheck.remaining,
					upgradeUrl: limitCheck.upgradeUrl,
				},
				{ status: 403 },
			);
		}
	}

	consola.info(`[upload-files] Processing batch of ${files.length} files`, {
		projectId,
		accountId,
		filenames: files.map((f) => f.name),
	});

	// Process each file: create record, store in R2, trigger background processing
	const results: FileResult[] = [];
	const interviewIds: string[] = [];

	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		const fileExtension = file.name.split(".").pop()?.toLowerCase() || "";
		const sourceType = detectSourceType(file);
		const isDocument = isDocumentFile(file);
		const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");

		try {
			// Create interview record
			const title = isDocument
				? `${isPdf ? "PDF" : "Text"} Transcript - ${format(new Date(), "yyyy-MM-dd")} (${i + 1})`
				: `Interview - ${format(new Date(), "yyyy-MM-dd")} (${i + 1})`;

			const { data: interview, error: insertError } = await supabase
				.from("interviews")
				.insert({
					account_id: accountId,
					project_id: projectId,
					title,
					status: "uploading",
					original_filename: file.name,
					source_type: sourceType,
					file_extension: fileExtension,
				})
				.select()
				.single();

			if (insertError || !interview) {
				consola.error(`[upload-files] Failed to create interview for ${file.name}`, insertError);
				results.push({ index: i, filename: file.name, interviewId: null, error: "Failed to create interview record" });
				continue;
			}

			const interviewId = interview.id;
			interviewIds.push(interviewId);

			// Link interviewer
			if (userId) {
				await ensureInterviewInterviewerLink({
					supabase,
					accountId,
					projectId,
					interviewId,
					userId,
					userSettings: ctx.user_settings || null,
					userMetadata: ctx.user_metadata || null,
				});
			}

			await createPlannedAnswersForInterview(supabase, { projectId, interviewId });

			if (isDocument) {
				// Text/PDF: extract content inline (fast), then trigger orchestrator
				let textContent: string;

				if (isPdf) {
					// Dynamic import — pdf-parse has inconsistent default export across ESM/CJS
					const pdfMod = (await import("pdf-parse")) as Record<string, unknown>;
					const pdfParse = (pdfMod.default || pdfMod) as (buf: Buffer) => Promise<{ text: string; numpages: number }>;
					const buffer = Buffer.from(await file.arrayBuffer());
					const pdfData = await pdfParse(buffer);
					textContent = pdfData.text;

					if (!textContent?.trim()) {
						results.push({ index: i, filename: file.name, interviewId, error: "PDF appears to be scanned/image-based" });
						await supabase.from("interviews").update({ status: "error" }).eq("id", interviewId);
						continue;
					}
				} else {
					textContent = await file.text();
				}

				if (!textContent?.trim()) {
					results.push({ index: i, filename: file.name, interviewId, error: "File is empty" });
					await supabase.from("interviews").update({ status: "error" }).eq("id", interviewId);
					continue;
				}

				const transcriptData = safeSanitizeTranscriptPayload({
					full_transcript: textContent.trim(),
					audio_duration: null,
					file_type: isPdf ? "pdf" : "text",
					original_filename: file.name,
				});

				let mediaUrl = "";
				if (isPdf) {
					const { mediaUrl: storedUrl } = await storeAudioFile({
						projectId,
						interviewId,
						source: file,
						originalFilename: file.name,
						contentType: file.type,
					});
					if (storedUrl) mediaUrl = storedUrl;
				}

				// Persist transcript
				await supabase
					.from("interviews")
					.update({
						transcript: textContent.trim(),
						transcript_formatted: transcriptData as unknown as Record<string, unknown>,
						status: "transcribed",
						media_url: mediaUrl,
					})
					.eq("id", interviewId);

				// Trigger orchestrator skipping upload (transcript already extracted)
				await tasks.trigger("interview.v2.orchestrator", {
					analysisJobId: interviewId,
					metadata: {
						accountId,
						projectId,
						userId: userId ?? undefined,
						fileName: file.name,
						interviewTitle: title,
					},
					transcriptData,
					mediaUrl,
					existingInterviewId: interviewId,
					resumeFrom: "evidence",
					skipSteps: ["upload"],
				});
			} else {
				// Audio/Video: store in R2, trigger full orchestrator (transcription in background)
				const { mediaUrl: storedMediaUrl, error: storageError } = await storeAudioFile({
					projectId,
					interviewId,
					source: file,
					originalFilename: file.name,
					contentType: file.type,
				});

				if (storageError || !storedMediaUrl) {
					consola.error(`[upload-files] R2 storage failed for ${file.name}`, storageError);
					results.push({ index: i, filename: file.name, interviewId, error: `Storage failed: ${storageError}` });
					await supabase.from("interviews").update({ status: "error" }).eq("id", interviewId);
					continue;
				}

				// Update interview with media URL
				await supabase
					.from("interviews")
					.update({ media_url: storedMediaUrl })
					.eq("id", interviewId);

				// Trigger full orchestrator — transcription happens in background
				await tasks.trigger("interview.v2.orchestrator", {
					analysisJobId: interviewId,
					metadata: {
						accountId,
						projectId,
						userId: userId ?? undefined,
						fileName: file.name,
						interviewTitle: `Interview - ${format(new Date(), "yyyy-MM-dd")} (${i + 1})`,
					},
					transcriptData: { needs_transcription: true },
					mediaUrl: storedMediaUrl,
					existingInterviewId: interviewId,
				});
			}

			results.push({ index: i, filename: file.name, interviewId, error: null });
			consola.info(`[upload-files] Queued ${file.name} → interview ${interviewId}`);
		} catch (err) {
			const message = err instanceof Error ? err.message : "Unknown error";
			consola.error(`[upload-files] Error processing ${file.name}:`, message);
			results.push({ index: i, filename: file.name, interviewId: null, error: message });
		}
	}

	const successful = results.filter((r) => !r.error);
	const failed = results.filter((r) => r.error);

	consola.info(`[upload-files] Batch complete: ${successful.length} queued, ${failed.length} failed`);

	return Response.json({
		success: failed.length === 0,
		total: files.length,
		queued: successful.length,
		failed: failed.length,
		interviewIds,
		results,
	});
}
