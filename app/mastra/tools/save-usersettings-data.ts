import { createTool } from "@mastra/core/tools"
import { createClient } from "@supabase/supabase-js"
import consola from "consola"
import { z } from "zod"

export const saveUserSettingsDataTool = createTool({
	id: "save-user-settings-data",
	description: "Save user signup chat data to user_settings",
	inputSchema: z.object({
		// user_id: z.string().describe("User ID").optional(),
		problem: z.string().describe("Business objective or problem to solve"),
		challenges: z.string().describe("Challenges in getting answers"),
		content_types: z.string().describe("Content types to analyze"),
		other_feedback: z.string().describe("Additional feedback or information"),
		completed: z.boolean().describe("Whether signup chat is completed").default(true),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		data: z
			.object({
				goal: z.string(),
				challenges: z.string(),
				content_types: z.string(),
				other_feedback: z.string(),
				completed: z.boolean(),
			})
			.optional(),
	}),
	execute: async ({ context, runtimeContext }) => {
		try {
			consola.debug("runtimeContext", runtimeContext)
			consola.debug("runtimeContext user_id", runtimeContext.get("user_id"))
			const user_id = runtimeContext.get("user_id")
			const { problem, challenges, content_types, other_feedback, completed } = context

			if (!user_id) {
				return {
					success: false,
					message: "Missing user_id for save-user-settings-data",
				}
			}

			// Create Supabase client
			const supabaseUrl = process.env.SUPABASE_URL
			const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

			if (!supabaseUrl || !supabaseServiceKey) {
				throw new Error("Missing Supabase configuration")
			}

			const supabase = createClient(supabaseUrl, supabaseServiceKey)

			// Structure the signup data
			const signupData = {
				goal: problem,
				challenges,
				content_types,
				other_feedback,
				completed,
			}

			// Upsert the data using the stored procedure
			const { data, error } = await supabase.rpc("upsert_signup_data", {
				p_user_id: user_id,
				p_signup_data: signupData,
			})

			if (error) {
				throw error
			}

			return {
				success: true,
				message: "Signup data saved successfully",
				data: signupData,
			}
		} catch (error) {
			console.error("Error saving signup data:", error)
			return {
				success: false,
				message: `Failed to save signup data: ${error instanceof Error ? error.message : "Unknown error"}`,
			}
		}
	},
})
