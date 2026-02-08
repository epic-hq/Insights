/**
 * API endpoint for updating user UI preferences
 * Merges new preferences into the existing ui_preferences JSONB field
 */
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { getAuthenticatedUser } from "~/lib/supabase/client.server";
import { userContext } from "~/server/user-context";

const UpdateSchema = z.object({
	key: z.string().min(1),
	value: z.unknown(),
});

export async function action({ request, context }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	const { user } = await getAuthenticatedUser(request);
	if (!user) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const ctx = context.get(userContext);
	const supabase = ctx?.supabase;

	if (!supabase) {
		consola.error("No supabase client available in context");
		return Response.json({ error: "Server configuration error" }, { status: 500 });
	}

	try {
		const formData = await request.formData();
		const parsed = UpdateSchema.safeParse({
			key: formData.get("key"),
			value: JSON.parse(formData.get("value") as string),
		});

		if (!parsed.success) {
			return Response.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 });
		}

		const { key, value } = parsed.data;

		// Get current ui_preferences
		const { data: currentSettings } = await supabase
			.from("user_settings")
			.select("ui_preferences")
			.eq("user_id", user.sub)
			.single();

		const currentPrefs = (currentSettings?.ui_preferences as Record<string, unknown>) || {};

		// Merge new preference
		const updatedPrefs = {
			...currentPrefs,
			[key]: value,
		};

		// Update ui_preferences
		const { error } = await supabase
			.from("user_settings")
			.update({ ui_preferences: updatedPrefs })
			.eq("user_id", user.sub);

		if (error) {
			consola.error("Failed to update ui_preferences:", error);
			return Response.json({ error: error.message }, { status: 500 });
		}

		consola.log(`Updated ui_preferences.${key} for user ${user.sub}`);
		return Response.json({ success: true, ui_preferences: updatedPrefs });
	} catch (error) {
		consola.error("Failed to parse ui_preference update:", error);
		return Response.json({ error: "Failed to update preference" }, { status: 500 });
	}
}
