import { createTool } from "@mastra/core/tools"
import { createClient } from "@supabase/supabase-js"
import consola from "consola"
import { z } from "zod"

export const displayUserQuestionsTool = createTool({
	id: "display-user-questions",
	description: "Display research questions to the user",
	inputSchema: z.object({
		questions: z.array(z.string()).optional(),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		data: z
			.object({
				questions: z.array(z.string()).nullish().optional(),
			})
			.nullish()
			.optional(),
	}),
	execute: async ({ context, runtimeContext }) => {
		try {
			consola.log("runtimeContext", runtimeContext)
			consola.log("runtimeContext user_id", runtimeContext.get("user_id"))
			const user_id = runtimeContext.get("user_id")
			const { questions } = context

			if (!user_id) {
				return {
					success: false,
					message: "Missing user_id for save-user-settings-data; use the saveChatData action instead.",
				}
			}

			// Create Supabase client
			const supabaseUrl = process.env.SUPABASE_URL
			const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

			if (!supabaseUrl || !supabaseServiceKey) {
				throw new Error("Missing Supabase configuration")
			}

			const _supabase = createClient(supabaseUrl, supabaseServiceKey)

			// Structure the signup data
			const signupData = {
				questions,
			}

			// // // Upsert the data using the stored procedure
			// // const { data, error } = await supabase.rpc("upsert_signup_data", {
			// // 	p_user_id: user_id,
			// // 	p_signup_data: signupData,
			// // })

			// if (error) {
			// 	throw error
			// }

			return {
				success: true,
				message: "Questions displayed successfully",
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
