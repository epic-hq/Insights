/**
 * API endpoint for uploading per-question intro videos to R2
 * POST /api/research-links/:listId/upload-question-video
 */
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { getServerClient } from "~/lib/supabase/client.server";
import { createR2PresignedUrl, uploadToR2 } from "~/utils/r2.server";

const MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200MB for question videos
const ALLOWED_TYPE_PREFIXES = ["video/webm", "video/mp4", "video/quicktime"];

function isAllowedVideoType(mimeType: string): boolean {
	// Handle MIME types with codec info like "video/webm;codecs=vp9"
	const baseType = mimeType.split(";")[0].trim();
	return ALLOWED_TYPE_PREFIXES.includes(baseType);
}

export async function action({ request, params }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	const { listId } = params;
	if (!listId) {
		return Response.json({ error: "Missing list ID" }, { status: 400 });
	}

	// Create authenticated client
	const { client: supabase, headers } = getServerClient(request);

	// Get current user
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return Response.json({ error: "Unauthorized" }, { status: 401, headers });
	}

	try {
		const formData = await request.formData();
		const videoFile = formData.get("video") as File | null;
		const questionId = formData.get("questionId") as string | null;

		if (!videoFile) {
			return Response.json({ error: "No video file provided" }, { status: 400, headers });
		}

		if (!questionId) {
			return Response.json({ error: "Missing question ID" }, { status: 400, headers });
		}

		// Validate file type
		if (!isAllowedVideoType(videoFile.type)) {
			return Response.json(
				{
					error: `Invalid file type. Allowed: ${ALLOWED_TYPE_PREFIXES.join(", ")}`,
				},
				{ status: 400, headers }
			);
		}

		// Validate file size
		if (videoFile.size > MAX_VIDEO_SIZE) {
			return Response.json(
				{
					error: `File too large. Maximum size: ${MAX_VIDEO_SIZE / 1024 / 1024}MB`,
				},
				{ status: 400, headers }
			);
		}

		// Verify the user has access to this research link
		const { data: link, error: linkError } = await supabase
			.from("research_links")
			.select("id, account_id")
			.eq("id", listId)
			.single();

		if (linkError || !link) {
			return Response.json({ error: "Ask link not found" }, { status: 404, headers });
		}

		// Determine file extension (handle MIME types with codec info)
		const baseType = videoFile.type.split(";")[0].trim();
		const ext = baseType === "video/webm" ? "webm" : baseType === "video/mp4" ? "mp4" : "mov";

		// Upload to R2 with question-specific key
		const key = `ask-question-videos/${link.id}/${questionId}.${ext}`;
		const arrayBuffer = await videoFile.arrayBuffer();
		const body = new Uint8Array(arrayBuffer);

		consola.info("Uploading question video", {
			listId,
			questionId,
			size: videoFile.size,
			type: videoFile.type,
			key,
		});

		const uploadResult = await uploadToR2({
			key,
			body,
			contentType: videoFile.type,
		});

		if (!uploadResult.success) {
			consola.error("Failed to upload question video to R2", uploadResult);
			return Response.json({ error: "Failed to upload video" }, { status: 500, headers });
		}

		consola.info("Question video uploaded successfully", {
			listId,
			questionId,
			key,
		});

		// Generate signed URL for immediate playback
		const presigned = createR2PresignedUrl({
			key,
			expiresInSeconds: 3600,
			responseContentType: baseType,
		});

		return Response.json(
			{
				success: true,
				videoKey: key,
				videoUrl: presigned?.url ?? null,
			},
			{ headers }
		);
	} catch (error) {
		consola.error("Error uploading question video", error);
		return Response.json({ error: "Internal server error" }, { status: 500, headers });
	}
}
