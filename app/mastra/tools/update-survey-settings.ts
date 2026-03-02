/**
 * Tool for updating survey configuration without touching questions.
 * Handles name, description, mode, identity, hero section, etc.
 */

import { createTool } from "@mastra/core/tools";
import consola from "consola";
import { z } from "zod";

function toNonEmptyString(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export const updateSurveySettingsTool = createTool({
	id: "update-survey-settings",
	description: `Update survey configuration (name, description, mode, identity, hero, etc.) without modifying questions.
Use this when the user wants to change settings like making a survey anonymous, switching to voice mode, updating the hero text, etc.`,
	inputSchema: z.object({
		surveyId: z.string().describe("The survey ID to update"),
		name: z.string().nullish().describe("Survey name/title"),
		description: z.string().nullish().describe("Survey description"),
		isLive: z.boolean().nullish().describe("Whether the survey is live"),
		allowChat: z.boolean().nullish().describe("Allow chat response mode"),
		allowVoice: z.boolean().nullish().describe("Allow voice response mode"),
		allowVideo: z.boolean().nullish().describe("Allow video response mode"),
		defaultResponseMode: z.enum(["form", "chat", "voice"]).nullish().describe("Default response mode for respondents"),
		identityType: z.enum(["anonymous", "email", "phone"]).nullish().describe("How respondents identify themselves"),
		respondentFields: z
			.array(z.string())
			.nullish()
			.describe("Fields to collect from respondents (e.g. first_name, last_name, company)"),
		heroTitle: z.string().nullish().describe("Hero section title"),
		heroSubtitle: z.string().nullish().describe("Hero section subtitle"),
		heroCtaLabel: z.string().nullish().describe("Call-to-action button label"),
		calendarUrl: z.string().nullish().describe("Calendar booking URL"),
		redirectUrl: z.string().nullish().describe("Post-completion redirect URL"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		updatedFields: z.array(z.string()).nullish(),
	}),
	execute: async (input, context?) => {
		try {
			const contextSurveyId = context?.requestContext?.get?.("survey_id");
			const surveyId =
				toNonEmptyString(input.surveyId) ??
				(typeof contextSurveyId === "string" ? toNonEmptyString(contextSurveyId) : null);
			if (!surveyId) {
				return { success: false, message: "Missing surveyId." };
			}

			const { createSupabaseAdminClient } = await import("../../lib/supabase/client.server");
			const supabase = createSupabaseAdminClient();

			// Build the update payload, only including fields that were actually provided
			const updatePayload: Record<string, unknown> = {};
			const updatedFields: string[] = [];

			if (input.name != null) {
				updatePayload.name = input.name;
				updatedFields.push("name");
			}
			if (input.description !== undefined) {
				updatePayload.description = input.description;
				updatedFields.push("description");
			}
			if (input.isLive != null) {
				updatePayload.is_live = input.isLive;
				updatedFields.push("isLive");
			}
			if (input.allowChat != null) {
				updatePayload.allow_chat = input.allowChat;
				updatedFields.push("allowChat");
			}
			if (input.allowVoice != null) {
				updatePayload.allow_voice = input.allowVoice;
				updatedFields.push("allowVoice");
			}
			if (input.allowVideo != null) {
				updatePayload.allow_video = input.allowVideo;
				updatedFields.push("allowVideo");
			}
			if (input.defaultResponseMode != null) {
				updatePayload.default_response_mode = input.defaultResponseMode;
				updatedFields.push("defaultResponseMode");
			}
			if (input.identityType != null) {
				updatePayload.identity_type = input.identityType;
				updatedFields.push("identityType");
			}
			if (input.respondentFields !== undefined) {
				updatePayload.respondent_fields = input.respondentFields;
				updatedFields.push("respondentFields");
			}
			if (input.heroTitle !== undefined) {
				updatePayload.hero_title = input.heroTitle;
				updatedFields.push("heroTitle");
			}
			if (input.heroSubtitle !== undefined) {
				updatePayload.hero_subtitle = input.heroSubtitle;
				updatedFields.push("heroSubtitle");
			}
			if (input.heroCtaLabel !== undefined) {
				updatePayload.hero_cta_label = input.heroCtaLabel;
				updatedFields.push("heroCtaLabel");
			}
			if (input.calendarUrl !== undefined) {
				updatePayload.calendar_url = input.calendarUrl;
				updatedFields.push("calendarUrl");
			}
			if (input.redirectUrl !== undefined) {
				updatePayload.redirect_url = input.redirectUrl;
				updatedFields.push("redirectUrl");
			}

			if (Object.keys(updatePayload).length === 0) {
				return { success: false, message: "No settings provided to update." };
			}

			const { error } = await supabase.from("research_links").update(updatePayload).eq("id", surveyId);

			if (error) {
				consola.error("update-survey-settings: save error", error);
				return { success: false, message: `Failed to update: ${error.message}` };
			}

			return {
				success: true,
				message: `Updated ${updatedFields.length} setting(s): ${updatedFields.join(", ")}.`,
				updatedFields,
			};
		} catch (error) {
			consola.error("update-survey-settings: unexpected error", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Unexpected error",
			};
		}
	},
});
