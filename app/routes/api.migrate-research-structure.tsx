import { randomUUID } from "node:crypto";
import { b } from "baml_client";
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { getServerClient } from "~/lib/supabase/client.server";

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	try {
		const formData = await request.formData();
		const project_id = formData.get("project_id") as string;
		const force = formData.get("force") === "true";

		if (!project_id) {
			return Response.json({ error: "Project ID is required" }, { status: 400 });
		}

		const { client: supabase } = getServerClient(request);

		// Check if structure already exists
		if (!force) {
			const { data: existingDQs } = await supabase
				.from("decision_questions")
				.select("id")
				.eq("project_id", project_id)
				.limit(1);

			if (existingDQs && existingDQs.length > 0) {
				return Response.json(
					{
						error: "Research structure already exists for this project",
						suggestion: "Use force=true to regenerate",
					},
					{ status: 409 }
				);
			}
		}

		// Load project context from project_sections
		const { data: projectSections, error: sectionsError } = await supabase
			.from("project_sections")
			.select("kind, content_md")
			.eq("project_id", project_id)
			.in("kind", ["research_goal", "target_roles", "target_orgs", "assumptions", "unknowns"]);

		if (sectionsError) {
			throw sectionsError;
		}

		// Extract project context
		const projectContext =
			projectSections?.reduce(
				(acc, section) => {
					acc[section.kind] = section.content_md;
					return acc;
				},
				{} as Record<string, string>
			) || {};

		consola.log("[MIGRATION] Project context:", projectContext);

		// Validate we have minimum required data
		if (!projectContext.research_goal?.trim()) {
			return Response.json(
				{
					error: "No research goal found in project sections",
					suggestion: "Complete project setup first",
				},
				{ status: 400 }
			);
		}

		// Generate research structure using BAML
		const inputs = {
			target_org: projectContext.target_orgs || "",
			target_roles: projectContext.target_roles || "",
			research_goal: projectContext.research_goal,
			research_goal_details: "", // Could add this to project_sections if needed
			assumptions: projectContext.assumptions || "",
			unknowns: projectContext.unknowns || "",
			custom_instructions: "Generate a comprehensive research structure based on the existing project setup.",
			session_id: randomUUID(),
			round: 1,
			interview_time_limit: 30,
		};

		consola.log("[MIGRATION] Generating structure with inputs:", inputs);

		const researchStructure = await b.GenerateResearchStructure(inputs);

		consola.log("[MIGRATION] Generated structure:", {
			decision_questions: researchStructure.decision_questions.length,
			research_questions: researchStructure.research_questions.length,
			interview_prompts: researchStructure.interview_prompts.length,
		});

		// Save to database
		const { error: saveError } = await saveResearchStructure(supabase, project_id, researchStructure);

		if (saveError) {
			throw saveError;
		}

		return Response.json({
			success: true,
			migrated: true,
			structure: {
				decision_questions: researchStructure.decision_questions.length,
				research_questions: researchStructure.research_questions.length,
				interview_prompts: researchStructure.interview_prompts.length,
			},
			message: `Successfully migrated project to research structure: ${researchStructure.decision_questions.length} decision questions, ${researchStructure.research_questions.length} research questions, ${researchStructure.interview_prompts.length} interview prompts`,
		});
	} catch (error) {
		consola.error("[MIGRATION] Failed:", error);
		return Response.json(
			{
				error: "Migration failed",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}

async function saveResearchStructure(supabase: any, projectId: string, structure: any) {
	try {
		// Clear existing structure if force migration
		await supabase.from("interview_prompt_research_questions").delete().eq("project_id", projectId);
		await supabase.from("interview_prompts").delete().eq("project_id", projectId);
		await supabase.from("research_questions").delete().eq("project_id", projectId);
		await supabase.from("decision_questions").delete().eq("project_id", projectId);

		// 1. Save Decision Questions
		const decisionQuestions = structure.decision_questions.map((dq: any) => ({
			id: dq.id,
			project_id: projectId,
			text: dq.text,
			rationale: dq.rationale,
		}));

		const { error: dqError } = await supabase.from("decision_questions").insert(decisionQuestions);
		if (dqError) throw dqError;

		// 2. Save Research Questions
		const researchQuestions = structure.research_questions.map((rq: any) => ({
			id: rq.id,
			project_id: projectId,
			text: rq.text,
			rationale: rq.rationale,
			decision_question_id: rq.decision_question_id,
		}));

		const { error: rqError } = await supabase.from("research_questions").insert(researchQuestions);
		if (rqError) throw rqError;

		// 3. Save Interview Prompts
		const interviewPrompts = structure.interview_prompts.map((ip: any) => ({
			id: ip.id,
			project_id: projectId,
			text: ip.text,
		}));

		const { error: ipError } = await supabase.from("interview_prompts").insert(interviewPrompts);
		if (ipError) throw ipError;

		// 4. Link Interview Prompts to Research Questions
		const promptResearchLinks = structure.interview_prompts.map((ip: any) => ({
			id: randomUUID(),
			project_id: projectId,
			prompt_id: ip.id,
			research_question_id: ip.research_question_id,
		}));

		const { error: linkError } = await supabase.from("interview_prompt_research_questions").insert(promptResearchLinks);
		if (linkError) throw linkError;

		consola.log("[MIGRATION] Structure saved successfully");
		return { error: null };
	} catch (error) {
		consola.error("[MIGRATION] Database save failed:", error);
		return { error };
	}
}
