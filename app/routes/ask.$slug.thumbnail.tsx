import type { LoaderFunctionArgs } from "react-router";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { createR2PresignedUrl } from "~/utils/r2.server";

export async function loader({ params }: LoaderFunctionArgs) {
	const slug = params.slug;
	if (!slug) {
		throw new Response("Missing slug", { status: 400 });
	}

	const supabase = createSupabaseAdminClient();
	const { data: link, error } = await supabase
		.from("research_links")
		.select("walkthrough_thumbnail_url, is_live")
		.eq("slug", slug)
		.maybeSingle();

	if (error) {
		throw new Response(error.message, { status: 500 });
	}

	if (!link || !link.is_live || !link.walkthrough_thumbnail_url) {
		throw new Response("Thumbnail not found", { status: 404 });
	}

	const presigned = createR2PresignedUrl({
		key: link.walkthrough_thumbnail_url,
		expiresInSeconds: 600,
		responseContentType: "image/jpeg",
	});

	if (!presigned) {
		throw new Response("Thumbnail signing unavailable", { status: 500 });
	}

	return Response.redirect(presigned.url, 302);
}
