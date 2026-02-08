/**
 * Enhanced Project Context Loader for Interview Question Generation
 *
 * Extends the basic project context with additional sources:
 * - Account-level context (company info, industry, competitors)
 * - Existing themes from prior interviews
 * - Personas with goals/pains
 * - Applied conversation lenses
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import type { Database } from "~/types";
import { getProjectContextGeneric } from "./db";

interface AccountContext {
	company_description: string | null;
	customer_problem: string | null;
	industry: string | null;
	offerings: string[] | null;
	competitors: string[] | null;
	target_orgs: string[] | null;
	target_roles: string[] | null;
}

interface ThemeSummary {
	name: string;
	statement: string | null;
	evidenceCount: number;
}

interface PersonaSummary {
	name: string;
	description: string | null;
	goals: string[];
	pains: string[];
	frustrations: string[];
	percentage: number | null;
}

interface LensSummary {
	templateKey: string;
	templateName: string;
	primaryObjective: string | null;
}

export interface EnhancedProjectContext {
	// From project sections
	target_orgs: string;
	target_roles: string;
	research_goal: string;
	research_goal_details: string;
	assumptions: string;
	unknowns: string;
	research_mode: string | null;
	custom_instructions: string;

	// Account-level context
	company_description: string | null;
	customer_problem: string | null;
	industry: string | null;
	offerings: string | null;
	competitors: string | null;

	// Synthesized from prior research
	themes: ThemeSummary[];
	personas: PersonaSummary[];
	lenses: LensSummary[];
}

const MAX_THEMES = 8;
const MAX_PERSONAS = 5;
const MAX_LENSES = 4;

export async function getEnhancedProjectContext(
	supabase: SupabaseClient<Database>,
	projectId: string
): Promise<EnhancedProjectContext | null> {
	try {
		// Get basic project context from sections
		const basicContext = await getProjectContextGeneric(supabase, projectId);
		if (!basicContext) {
			consola.warn("[enhanced-context] No basic project context found");
			return null;
		}

		const meta = basicContext.merged as Record<string, unknown>;

		// Get project to find account_id
		const { data: project } = await supabase.from("projects").select("account_id").eq("id", projectId).single();

		// Fetch all additional context in parallel
		const [accountResult, themesResult, personasResult, lensesResult] = await Promise.all([
			// Account context
			project?.account_id
				? supabase
						.schema("accounts")
						.from("accounts")
						.select(
							"company_description, customer_problem, industry, offerings, target_orgs, target_roles, competitors"
						)
						.eq("id", project.account_id)
						.single()
				: Promise.resolve({ data: null, error: null }),

			// Top themes by evidence count
			supabase
				.from("themes")
				.select(
					`
            id,
            name,
            statement,
            theme_evidence(count)
          `
				)
				.eq("project_id", projectId)
				.order("created_at", { ascending: false })
				.limit(MAX_THEMES * 2), // Fetch more, then sort by evidence

			// Personas
			supabase
				.from("personas")
				.select("name, description, goals, pains, frustrations, percentage")
				.eq("project_id", projectId)
				.order("percentage", { ascending: false, nullsFirst: false })
				.limit(MAX_PERSONAS),

			// Applied lenses - use simple query, process templates separately
			supabase
				.from("conversation_lens_analyses")
				.select("template_key")
				.eq("project_id", projectId)
				.eq("status", "completed")
				.limit(MAX_LENSES),
		]);

		// Process account context
		const account = accountResult.data as AccountContext | null;

		// Process themes - sort by evidence count and take top N
		const themes: ThemeSummary[] = [];
		if (themesResult.data) {
			const themesWithCount = themesResult.data
				.map((t: any) => ({
					name: t.name,
					statement: t.statement,
					evidenceCount: t.theme_evidence?.[0]?.count ?? 0,
				}))
				.sort((a, b) => b.evidenceCount - a.evidenceCount)
				.slice(0, MAX_THEMES);

			themes.push(...themesWithCount);
		}

		// Process personas
		const personas: PersonaSummary[] = [];
		if (personasResult.data) {
			for (const p of personasResult.data) {
				personas.push({
					name: p.name,
					description: p.description,
					goals: Array.isArray(p.goals) ? p.goals.filter(Boolean) : [],
					pains: Array.isArray(p.pains) ? p.pains.filter(Boolean) : [],
					frustrations: Array.isArray(p.frustrations) ? p.frustrations.filter(Boolean) : [],
					percentage: p.percentage,
				});
			}
		}

		// Process lenses - just use template_key as identifier
		const lenses: LensSummary[] = [];
		if (lensesResult.data) {
			const lensData = lensesResult.data as unknown as Array<{
				template_key: string;
			}>;
			for (const l of lensData) {
				lenses.push({
					templateKey: l.template_key,
					templateName: l.template_key, // Use key as name since we skip the join
					primaryObjective: null,
				});
			}
		}

		// Helper to join arrays
		const joinArray = (val: unknown): string => {
			if (Array.isArray(val)) return val.filter(Boolean).join(", ");
			if (typeof val === "string") return val;
			return "";
		};

		return {
			// Basic project context
			target_orgs: joinArray(meta.target_orgs) || joinArray(account?.target_orgs),
			target_roles: joinArray(meta.target_roles) || joinArray(account?.target_roles),
			research_goal: (meta.research_goal as string) || (meta.customer_problem as string) || "",
			research_goal_details: (meta.research_goal_details as string) || "",
			assumptions: joinArray(meta.assumptions),
			unknowns: joinArray(meta.unknowns),
			research_mode: (meta.research_mode as string) || null,
			custom_instructions: (meta.custom_instructions as string) || "",

			// Account context
			company_description: account?.company_description ?? null,
			customer_problem: account?.customer_problem ?? (meta.customer_problem as string) ?? null,
			industry: account?.industry ?? null,
			offerings: joinArray(account?.offerings) || null,
			competitors: joinArray(account?.competitors) || null,

			// Synthesized context
			themes,
			personas,
			lenses,
		};
	} catch (error) {
		consola.error("[enhanced-context] Error fetching enhanced context:", error);
		return null;
	}
}

/**
 * Build custom instructions string that incorporates all context
 */
export function buildEnhancedCustomInstructions(context: EnhancedProjectContext, baseInstructions = ""): string {
	const parts: string[] = [];

	if (baseInstructions.trim()) {
		parts.push(baseInstructions.trim());
	}

	// Add company context
	if (context.company_description) {
		parts.push(`COMPANY CONTEXT: ${context.company_description}`);
	}

	if (context.industry) {
		parts.push(`INDUSTRY: ${context.industry}`);
	}

	// Add existing themes to avoid repetition and encourage deeper exploration
	if (context.themes.length > 0) {
		const themesList = context.themes.map((t) => `- ${t.name}${t.statement ? `: ${t.statement}` : ""}`).join("\n");
		parts.push(
			`EXISTING THEMES FROM PRIOR RESEARCH (avoid re-asking basics, explore deeper or adjacent areas):\n${themesList}`
		);
	}

	// Add persona context for tailored questions
	if (context.personas.length > 0) {
		const personasList = context.personas
			.map((p) => {
				const details: string[] = [];
				if (p.goals.length) details.push(`Goals: ${p.goals.slice(0, 3).join("; ")}`);
				if (p.pains.length) details.push(`Pains: ${p.pains.slice(0, 3).join("; ")}`);
				return `- ${p.name}${p.percentage ? ` (${p.percentage}%)` : ""}: ${details.join(". ")}`;
			})
			.join("\n");
		parts.push(`KNOWN PERSONAS (tailor questions to their specific perspectives):\n${personasList}`);
	}

	// Add lens objectives
	if (context.lenses.length > 0) {
		const lensesList = context.lenses
			.map((l) => `- ${l.templateName}: ${l.primaryObjective || "No objective specified"}`)
			.join("\n");
		parts.push(`ACTIVE ANALYSIS FRAMEWORKS (ensure questions help fill these frameworks):\n${lensesList}`);
	}

	return parts.join("\n\n");
}
