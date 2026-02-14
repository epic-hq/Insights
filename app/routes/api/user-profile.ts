import { supabaseAdmin } from "~/lib/supabase/client.server";

/**
 * User Profile API
 * Fetches user profile data from user_settings table
 * Used by EntityInteractionPanel to display commenter names
 */
export async function loader({ request }: { request: Request }) {
	const url = new URL(request.url);
	const userId = url.searchParams.get("userId");

	if (!userId) {
		return Response.json({ error: { message: "Missing userId" } }, { status: 400 });
	}

	// Query user_settings directly with admin client to bypass RLS
	const { data, error } = await supabaseAdmin
		.from("user_settings")
		.select("user_id, first_name, last_name, email, image_url")
		.eq("user_id", userId)
		.single();

	if (error || !data) {
		return Response.json({ error: { message: "User not found" } }, { status: 404 });
	}

	// Build display name from first/last name or fallback to email
	const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || data.email || "User";

	return Response.json({
		id: data.user_id,
		name,
		avatar_url: data.image_url || null,
	});
}
