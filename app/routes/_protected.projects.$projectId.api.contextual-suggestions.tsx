import { b } from "baml_client"
import type { ActionFunctionArgs } from "react-router"
import { getLangfuseClient } from "~/lib/langfuse"
import { userContext } from "~/server/user-context"

export async function action({ request, context }: ActionFunctionArgs) {
	const langfuse = getLangfuseClient()
	const lfTrace = langfuse?.trace?.({ name: "api.contextual-suggestions" })
	try {
		// Get user context for potential future use
		context.get(userContext)
		const formData = await request.formData()
		const research_goal = formData.get("researchGoal") as string
		const current_input = formData.get("currentInput") as string
		let suggestion_type = formData.get("suggestionType") as string
    const existing_items = JSON.parse((formData.get("existingItems") as string) || "[]")
    const shown_suggestions = JSON.parse((formData.get("shownSuggestions") as string) || "[]")
    const rejected_items = JSON.parse((formData.get("rejectedItems") as string) || "[]")
		const project_context = (formData.get("projectContext") as string) || ""
    const custom_instructions = (formData.get("customInstructions") as string) || ""
    const response_count = Number.parseInt((formData.get("responseCount") as string) || "3", 10)
    const question_category = (formData.get("questionCategory") as string) || null

    // Handle legacy "questions" type
    if (suggestion_type === "questions") {
      suggestion_type = "interview_questions"
    }

    console.log("Enhanced contextual suggestions request:", {
      research_goal,
      current_input,
      suggestion_type,
      existing_items,
      shown_suggestions,
      rejected_items,
      project_context,
      custom_instructions,
      response_count,
      question_category,
    })

		if (!research_goal || !suggestion_type) {
			console.log("Missing required parameters: research_goal and suggestion_type are required")
			return new Response(JSON.stringify({ error: "Missing required parameters: research_goal and suggestion_type are required" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			})
		}

    // Validate response_count
    if (response_count < 1 || response_count > 10) {
      console.log("Invalid response_count: must be between 1 and 10")
      return new Response(JSON.stringify({ error: "response_count must be between 1 and 10" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

		if (!b?.GenerateContextualSuggestions) {
			console.log("BAML function not available; refusing non-AI fallback")
			return new Response(
				JSON.stringify({ error: "AI generation unavailable" }),
				{ status: 503, headers: { "Content-Type": "application/json" } }
			)
		}

		const gen = lfTrace?.generation?.({ name: "baml.GenerateContextualSuggestions" })

    // Merge already-added items with suggestions already presented to the user
    const exclude_items: string[] = Array.from(
      new Set([...(Array.isArray(existing_items) ? existing_items : []), ...(Array.isArray(shown_suggestions) ? shown_suggestions : [])])
    )

    // Ensure rejected_items is an array
    const rejected_items_array: string[] = Array.isArray(rejected_items) ? rejected_items : []

    const suggestions = await b.GenerateContextualSuggestions(
      research_goal,
      current_input || "",
      suggestion_type,
      exclude_items,
      rejected_items_array,
      project_context,
      custom_instructions,
      response_count,
      question_category
    )

		console.log("Generated enhanced suggestions:", suggestions)
    gen?.update?.({
      input: {
        research_goal,
        current_input,
        suggestion_type,
        existing_items: exclude_items,
        rejected_items: rejected_items_array,
        project_context,
        custom_instructions,
        response_count,
        question_category,
      },
      output: suggestions,
    })
		gen?.end?.()
		return new Response(JSON.stringify(suggestions), {
			headers: { "Content-Type": "application/json" },
		})
	} catch (error) {
		console.error("Error generating enhanced contextual suggestions:", error)
		return new Response(
			JSON.stringify({
				error: "Failed to generate suggestions",
				details: error instanceof Error ? error.message : "Unknown error",
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			}
		)
	} finally {
		// Trace cleanup handled by langfuse automatically
	}
}
