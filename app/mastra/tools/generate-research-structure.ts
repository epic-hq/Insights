import { createTool } from "@mastra/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import { z } from "zod";
import { getProjectContextGeneric } from "~/features/questions/db";
import { supabaseAdmin } from "~/lib/supabase/client.server";
import type { Database } from "~/types";

export const generateResearchStructureTool = createTool({
	id: "generate-research-structure",
	description:
		"Generate a complete research structure including decision questions, research questions, and interview prompts based on project goals and context. This creates the research plan and conversation prompts needed to conduct interviews.",
	inputSchema: z.object({
		projectId: z
			.string()
			.nullish()
			.describe("Project ID to generate research structure for. Defaults to the current project in context."),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		structure: z
			.object({
				decision_questions: z.array(
					z.object({
						id: z.string(),
						text: z.string(),
						rationale: z.string().optional(),
					})
				),
				research_questions: z.array(
					z.object({
						id: z.string(),
						text: z.string(),
						rationale: z.string().optional(),
						decision_question_id: z.string().optional(),
					})
				),
				interview_prompts: z.array(
					z.object({
						id: z.string(),
						text: z.string(),
						category: z.string().optional(),
						research_question_id: z.string(),
					})
				),
			})
			.nullable()
			.optional(),
		validation_gates: z.record(z.string(), z.any()).nullable().optional(),
	}),
	execute: async (input, context?) => {
		const supabase = supabaseAdmin as SupabaseClient<Database>;
		const runtimeProjectId = context?.requestContext?.get?.("project_id");
		const runtimeAccountId = context?.requestContext?.get?.("account_id");

		// Extract projectId from tool parameters or runtime context
		const projectId = input.projectId ?? runtimeProjectId ?? null;

		consola.debug("generate-research-structure: execute start", {
			projectId,
			accountId: runtimeAccountId,
		});

		if (!projectId) {
			consola.warn("generate-research-structure: missing projectId");
			return {
				success: false,
				message: "Missing projectId. Pass one explicitly or ensure the runtime context sets project_id.",
				structure: null,
				validation_gates: null,
			};
		}

		const projectIdStr = projectId as string;

		try {
			// First, fetch the project context to get all the necessary fields
			const projectContext = await getProjectContextGeneric(supabase, projectIdStr);

			if (!projectContext?.merged) {
				consola.warn("generate-research-structure: no project context found");
				return {
					success: false,
					message: "No project context found. Please ensure project goals are set first.",
					structure: null,
					validation_gates: null,
				};
			}

			const merged = projectContext.merged;

			// Validate required fields
			const researchGoal = typeof merged.research_goal === "string" ? merged.research_goal : null;
			const targetRoles = Array.isArray(merged.target_roles) ? merged.target_roles : [];

			if (!researchGoal || !researchGoal.trim()) {
				return {
					success: false,
					message: "Research goal is required to generate research structure.",
					structure: null,
					validation_gates: null,
				};
			}

			if (targetRoles.length === 0) {
				return {
					success: false,
					message: "At least one target role is required to generate research structure.",
					structure: null,
					validation_gates: null,
				};
			}

			// Check if research structure already exists
			const { data: existingDecisionQuestions } = await supabase
				.from("decision_questions")
				.select("id")
				.eq("project_id", projectIdStr)
				.limit(1);

			const { data: existingResearchQuestions } = await supabase
				.from("research_questions")
				.select("id")
				.eq("project_id", projectIdStr)
				.limit(1);

			const hasExistingStructure =
				existingDecisionQuestions &&
				existingDecisionQuestions.length > 0 &&
				existingResearchQuestions &&
				existingResearchQuestions.length > 0;

			if (hasExistingStructure) {
				consola.debug("generate-research-structure: structure already exists, skipping generation");
				return {
					success: true,
					message: "Research structure already exists for this project.",
					structure: null,
					validation_gates: null,
				};
			}

			// Prepare form data for the API call
			const formData = new FormData();
			formData.append("project_id", projectIdStr);
			formData.append("research_goal", researchGoal);

			if (merged.research_goal_details && typeof merged.research_goal_details === "string") {
				formData.append("research_goal_details", merged.research_goal_details);
			}

			if (merged.customer_problem && typeof merged.customer_problem === "string") {
				formData.append("customer_problem", merged.customer_problem);
			}

			if (Array.isArray(merged.target_orgs) && merged.target_orgs.length > 0) {
				formData.append("target_orgs", merged.target_orgs.join(", "));
			}

			if (targetRoles.length > 0) {
				formData.append("target_roles", targetRoles.join(", "));
			}

			if (merged.offerings && typeof merged.offerings === "string") {
				formData.append("offerings", merged.offerings);
			}

			if (Array.isArray(merged.competitors) && merged.competitors.length > 0) {
				formData.append("competitors", merged.competitors.join(", "));
			}

			if (Array.isArray(merged.assumptions) && merged.assumptions.length > 0) {
				formData.append("assumptions", merged.assumptions.join("\n"));
			}

			if (Array.isArray(merged.unknowns) && merged.unknowns.length > 0) {
				formData.append("unknowns", merged.unknowns.join("\n"));
			}

			if (merged.custom_instructions && typeof merged.custom_instructions === "string") {
				formData.append("custom_instructions", merged.custom_instructions);
			}

			// Add research mode if available
			const researchMode =
				merged.research_mode ||
				merged.conversation_type ||
				(merged.settings && typeof merged.settings === "object" && "research_mode" in merged.settings
					? merged.settings.research_mode
					: null);

			if (researchMode && typeof researchMode === "string") {
				formData.append("research_mode", researchMode);
			}

			// Make the API call to generate the research structure
			// Note: We need to construct the full URL for internal API calls
			const baseUrl = process.env.APP_URL || "http://localhost:3000";
			const response = await fetch(`${baseUrl}/api/generate-research-structure`, {
				method: "POST",
				body: formData,
			});

			if (!response.ok) {
				const errorBody = await response.json();
				throw new Error(errorBody.details || errorBody.error || "Failed to generate research structure");
			}

			const result = await response.json();

			consola.debug("generate-research-structure: successfully generated", {
				projectId: projectIdStr,
				decisionQuestions: result.structure?.decision_questions?.length ?? 0,
				researchQuestions: result.structure?.research_questions?.length ?? 0,
				interviewPrompts: result.structure?.interview_prompts?.length ?? 0,
			});

			return {
				success: true,
				message: result.message || "Successfully generated research structure",
				structure: result.structure,
				validation_gates: result.validation_gates,
			};
		} catch (error) {
			consola.error("generate-research-structure: unexpected error", error);
			return {
				success: false,
				message: `Failed to generate research structure: ${error instanceof Error ? error.message : String(error)}`,
				structure: null,
				validation_gates: null,
			};
		}
	},
});
