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
		const project_context = (formData.get("projectContext") as string) || ""

		console.log("Contextual suggestions request:", {
			research_goal,
			current_input,
			suggestion_type,
			existing_items,
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
			console.log("BAML function not available")
			// Return fallback suggestions for now
			const fallbackSuggestions = {
				decision_questions: [
					"What outcomes matter most to customers?",
					"Which features drive adoption?",
					"What causes user churn?",
				],
				assumptions: [
					"Users value speed over features",
					"Price is less important than value",
					"Onboarding affects retention",
				],
				unknowns: ["Customer willingness to pay", "Feature usage patterns", "Competitive alternatives"],
				organizations: ["Early-stage startups", "Mid-market SaaS", "Enterprise companies"],
				roles: ["Product Manager", "Head of Growth", "UX Researcher"],
			}

			return new Response(
				JSON.stringify(fallbackSuggestions[suggestion_type as keyof typeof fallbackSuggestions] || []),
				{
					headers: { "Content-Type": "application/json" },
				}
			)
		}

		const gen = lfTrace?.generation?.({ name: "baml.GenerateContextualSuggestions" })

		const suggestions = await b.GenerateContextualSuggestions(
			research_goal,
			current_input || "",
			suggestion_type,
			existing_items,
			project_context
		)

		console.log("Generated suggestions:", suggestions)
		gen?.update?.({
			input: { suggestions: suggestions, research_goal, current_input, suggestion_type, existing_items, project_context },
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
