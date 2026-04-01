/**
 * Tool for updating survey configuration without touching questions.
 * Handles name, description, mode, identity, hero section, etc.
 */

import { createTool } from "@mastra/core/tools";
import consola from "consola";
import { z } from "zod";
import {
	areCanonicallyEqual,
	isRetryableSurveyMutationError,
	resolveBoundSurveyTarget,
	withSurveyMutationRetry,
} from "./survey-mutation-guards";

export const updateSurveySettingsTool = createTool({
	id: "update-survey-settings",
	description: `Update survey configuration (name, description, mode, identity, hero, etc.) without modifying questions.
Use this when the user wants to change settings like making a survey anonymous, switching to voice mode, updating the hero text, etc.`,
	inputSchema: z.object({
		surveyId: z.string().nullish().describe("The survey ID to update (defaults to active survey in context)"),
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
		surveyId: z.string().nullish(),
		requestedFieldCount: z.number().nullish(),
		appliedFieldCount: z.number().nullish(),
		skippedFieldCount: z.number().nullish(),
		verification: z
			.object({
				verified: z.boolean(),
				status: z.string(),
				mismatchFields: z.array(z.string()).nullish(),
			})
			.nullish(),
	}),
	execute: async (input, context?) => {
		try {
			const { createSupabaseAdminClient } = await import("../../lib/supabase/client.server");
			const supabase = createSupabaseAdminClient();
			const { surveyId, projectId } = await resolveBoundSurveyTarget({
				context,
				toolName: "update-survey-settings",
				supabase,
				surveyIdInput: input.surveyId,
				select:
					"id, name, description, is_live, allow_chat, allow_voice, allow_video, default_response_mode, identity_mode, identity_field, respondent_fields, hero_title, hero_subtitle, hero_cta_label, calendar_url, redirect_url, project_id, account_id",
			});

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
				if (input.identityType === "anonymous") {
					updatePayload.identity_mode = "anonymous";
					updatePayload.identity_field = "email";
				} else if (input.identityType === "email") {
					updatePayload.identity_mode = "identified";
					updatePayload.identity_field = "email";
				} else if (input.identityType === "phone") {
					updatePayload.identity_mode = "identified";
					updatePayload.identity_field = "phone";
				}
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

			const requestedFieldCount = updatedFields.length;
			if (Object.keys(updatePayload).length === 0) {
				return {
					success: false,
					message: "No settings provided to update.",
					surveyId,
					updatedFields: null,
					requestedFieldCount: 0,
					appliedFieldCount: 0,
					skippedFieldCount: 0,
					verification: {
						verified: false,
						status: "no_changes_requested",
						mismatchFields: null,
					},
				};
			}

			const { error } = await withSurveyMutationRetry({
				operation: "update-survey-settings.save",
				run: async () => {
					const result = await supabase
						.from("research_links")
						.update(updatePayload)
						.eq("id", surveyId)
						.eq("project_id", projectId);
					if (result.error && isRetryableSurveyMutationError(result.error)) {
						throw result.error;
					}
					return result;
				},
			});

			if (error) {
				consola.error("update-survey-settings: save error", error);
				return {
					success: false,
					message: `Write failed. Applied 0/${requestedFieldCount} field(s). Error: ${error.message}`,
					surveyId,
					updatedFields: null,
					requestedFieldCount,
					appliedFieldCount: 0,
					skippedFieldCount: requestedFieldCount,
					verification: {
						verified: false,
						status: "write_failed",
						mismatchFields: null,
					},
				};
			}

			const { data: persisted, error: persistedError } = await withSurveyMutationRetry({
				operation: "update-survey-settings.verify-read",
				run: async () => {
					const result = await supabase
						.from("research_links")
						.select(
							"id, name, description, is_live, allow_chat, allow_voice, allow_video, default_response_mode, identity_mode, identity_field, respondent_fields, hero_title, hero_subtitle, hero_cta_label, calendar_url, redirect_url"
						)
						.eq("id", surveyId)
						.eq("project_id", projectId)
						.single();
					if (result.error && isRetryableSurveyMutationError(result.error)) {
						throw result.error;
					}
					return result;
				},
			});

			if (persistedError || !persisted) {
				return {
					success: false,
					message: `Write may have been applied but verification read failed. Applied unknown/${requestedFieldCount}. Please refresh and retry.`,
					updatedFields: null,
					surveyId,
					requestedFieldCount,
					appliedFieldCount: null,
					skippedFieldCount: null,
					verification: {
						verified: false,
						status: "verify_read_failed",
						mismatchFields: null,
					},
				};
			}
			const persistedRecord = persisted as unknown as Record<string, unknown>;

			const mismatchFields = Object.entries(updatePayload)
				.filter(([column, expectedValue]) => !areCanonicallyEqual(persistedRecord[column], expectedValue))
				.map(([column]) => column);

			if (mismatchFields.length > 0) {
				consola.error("update-survey-settings: post-write verification mismatch", {
					surveyId,
					mismatchFields,
				});
				const appliedFieldCount = requestedFieldCount - mismatchFields.length;
				return {
					success: false,
					message: `Verification failed. Applied ${appliedFieldCount}/${requestedFieldCount} field(s). Mismatched: ${mismatchFields.join(", ")}.`,
					updatedFields: null,
					surveyId,
					requestedFieldCount,
					appliedFieldCount,
					skippedFieldCount: mismatchFields.length,
					verification: {
						verified: false,
						status: "mismatch",
						mismatchFields,
					},
				};
			}

			return {
				success: true,
				message: `Updated ${updatedFields.length} setting(s): ${updatedFields.join(", ")}. Verification: applied ${updatedFields.length}/${requestedFieldCount}.`,
				updatedFields,
				surveyId,
				requestedFieldCount,
				appliedFieldCount: updatedFields.length,
				skippedFieldCount: 0,
				verification: {
					verified: true,
					status: "verified",
					mismatchFields: null,
				},
			};
		} catch (error) {
			consola.error("update-survey-settings: unexpected error", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Unexpected error",
				updatedFields: null,
				requestedFieldCount: null,
				appliedFieldCount: null,
				skippedFieldCount: null,
				verification: {
					verified: false,
					status: "unexpected_error",
					mismatchFields: null,
				},
			};
		}
	},
});
