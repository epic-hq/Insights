import { b } from "baml_client"
import type { ActionFunctionArgs } from "react-router"
import { getLangfuseClient } from "~/lib/langfuse"
import { userContext } from "~/server/user-context"

export async function action({ request, context }: ActionFunctionArgs) {
	const langfuse = getLangfuseClient()
	const lfTrace = (langfuse as any).trace?.({ name: "api.contextual-suggestions" })
	try {
		const ctx = context.get(userContext)
		const formData = await request.formData()
		const research_goal = formData.get("researchGoal") as string
		const current_input = formData.get("currentInput") as string
		const suggestion_type = formData.get("suggestionType") as string
    const existing_items = JSON.parse((formData.get("existingItems") as string) || "[]")
    const shown_suggestions = JSON.parse((formData.get("shownSuggestions") as string) || "[]")
		const project_context = (formData.get("projectContext") as string) || ""

    console.log("Contextual suggestions request:", {
      research_goal,
      current_input,
      suggestion_type,
      existing_items,
      shown_suggestions,
      project_context,
    })

		if (!research_goal || !suggestion_type) {
			console.log("Missing required parameters")
			return new Response(JSON.stringify({ error: "Missing required parameters" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			})
		}

		// @ts-expect-error - function may not exist until baml generate runs
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

    const suggestions = await b.GenerateContextualSuggestions(
      research_goal,
      current_input || "",
      suggestion_type,
      exclude_items,
      project_context
    )

		console.log("Generated suggestions:", suggestions)
    gen?.update?.({
      input: {
        suggestions: suggestions,
        research_goal,
        current_input,
        suggestion_type,
        existing_items: exclude_items,
        project_context,
      },
      output: suggestions,
    })
		gen?.end?.()
		return new Response(JSON.stringify(suggestions), {
			headers: { "Content-Type": "application/json" },
		})
	} catch (error) {
		console.error("Error generating contextual suggestions:", error)
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
		lfTrace?.end?.()
	}
}
