/**
 * API endpoint for uploading video responses to R2
 * POST /api/ask/:slug/upload-video
 */
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { uploadToR2 } from "~/utils/r2.server";

const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_TYPES = ["video/webm", "video/mp4", "video/quicktime"];

export async function action({ request, params }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	const { slug } = params;
	if (!slug) {
		return Response.json({ error: "Missing slug" }, { status: 400 });
	}

	try {
		const formData = await request.formData();
		const videoFile = formData.get("video") as File | null;
		const responseId = formData.get("responseId") as string | null;

		if (!videoFile) {
			return Response.json({ error: "No video file provided" }, { status: 400 });
		}

		if (!responseId) {
			return Response.json({ error: "No response ID provided" }, { status: 400 });
		}

		// Validate file type (allow codec suffixes like video/webm;codecs=vp9)
		const baseType = videoFile.type.split(";")[0];
		if (!ALLOWED_TYPES.includes(baseType)) {
			return Response.json({ error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(", ")}` }, { status: 400 });
		}

		// Validate file size
		if (videoFile.size > MAX_VIDEO_SIZE) {
			return Response.json(
				{
					error: `File too large. Maximum size: ${MAX_VIDEO_SIZE / 1024 / 1024}MB`,
				},
				{ status: 400 }
			);
		}

		// Get the research link to verify it exists and has video enabled
		const supabase = createSupabaseAdminClient();
		const { data: link, error: linkError } = await supabase
			.from("research_links")
			.select("id, allow_video")
			.eq("slug", slug)
			.single();

		if (linkError || !link) {
			return Response.json({ error: "Ask link not found" }, { status: 404 });
		}

		if (!link.allow_video) {
			return Response.json({ error: "Video responses are not enabled for this Ask link" }, { status: 400 });
		}

		// Verify the response exists
		const { data: response, error: responseError } = await supabase
			.from("research_link_responses")
			.select("id")
			.eq("id", responseId)
			.eq("research_link_id", link.id)
			.single();

		if (responseError || !response) {
			return Response.json({ error: "Response not found" }, { status: 404 });
		}

		// Determine file extension (use baseType since videoFile.type may have codec suffix)
		const ext = baseType === "video/webm" ? "webm" : baseType === "video/mp4" ? "mp4" : "mov";

		// Upload to R2
		const key = `ask-videos/${link.id}/${responseId}.${ext}`;
		const arrayBuffer = await videoFile.arrayBuffer();
		const body = new Uint8Array(arrayBuffer);

		consola.info("Uploading video response", {
			slug,
			responseId,
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
			consola.error("Failed to upload video to R2", uploadResult);
			return Response.json({ error: "Failed to upload video" }, { status: 500 });
		}

		// Construct the public URL
		const publicUrl = `${process.env.R2_PUBLIC_BASE_URL}/${key}`;

		// Update the response with the video URL
		const { error: updateError } = await supabase
			.from("research_link_responses")
			.update({ video_url: publicUrl })
			.eq("id", responseId);

		if (updateError) {
			consola.error("Failed to update response with video URL", updateError);
			return Response.json({ error: "Failed to save video URL" }, { status: 500 });
		}

		consola.info("Video uploaded successfully", {
			slug,
			responseId,
			publicUrl,
		});

		return Response.json({
			success: true,
			videoUrl: publicUrl,
		});
	} catch (error) {
		consola.error("Error uploading video", error);
		return Response.json({ error: "Internal server error" }, { status: 500 });
	}
}
