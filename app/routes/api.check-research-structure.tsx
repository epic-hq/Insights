import type { LoaderFunctionArgs } from "react-router"
import { getServerClient } from "~/lib/supabase/server"

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url)
	const projectId = url.searchParams.get("project_id")

	if (!projectId) {
		return Response.json({ error: "Project ID is required" }, { status: 400 })
	}

	try {
		const { client: supabase } = getServerClient(request)

		// Check decision questions
		const { data: decisionQuestions, error: dqError } = await supabase
			.from("decision_questions")
			.select("*")
			.eq("project_id", projectId)

		if (dqError) throw dqError

		// Check research questions
		const { data: researchQuestions, error: rqError } = await supabase
			.from("research_questions")
			.select("*")
			.eq("project_id", projectId)

		if (rqError) throw rqError

		// Check interview prompts
		const { data: interviewPrompts, error: ipError } = await supabase
			.from("interview_prompts")
			.select("*")
			.eq("project_id", projectId)

		if (ipError) throw ipError

		// Check project sections
		const { data: projectSections, error: psError } = await supabase
			.from("project_sections")
			.select("*")
			.eq("project_id", projectId)

		if (psError) throw psError

		return Response.json({
			project_id: projectId,
			decision_questions: decisionQuestions || [],
			research_questions: researchQuestions || [],
			interview_prompts: interviewPrompts || [],
			project_sections: projectSections || [],
			summary: {
				has_decision_questions: (decisionQuestions?.length || 0) > 0,
				has_research_questions: (researchQuestions?.length || 0) > 0,
				has_interview_prompts: (interviewPrompts?.length || 0) > 0,
				has_project_sections: (projectSections?.length || 0) > 0,
			},
		})
	} catch (error) {
		console.error("Check research structure failed:", error)
		return Response.json(
			{
				error: "Failed to check research structure",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		)
	}
}
