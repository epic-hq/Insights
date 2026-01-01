/**
 * Unified Context Loader
 *
 * Combines account-level company context with project-level research context
 * to provide a complete context object for BAML functions and AI operations.
 *
 * LAYERING STRATEGY:
 * - Account context provides DEFAULTS (company-wide settings)
 * - Project context OVERRIDES account defaults (study-specific)
 *
 * Account context (defaults, set once):
 * - company_description, customer_problem, offerings, competitors, industry
 * - target_orgs (broad: "Healthcare", "Fintech startups")
 * - target_roles (typical buyer roles)
 *
 * Project context (overrides, per-study from project_sections):
 * - target_orgs (specific: "Enterprise hospital networks") - overrides account target_orgs
 * - target_roles (narrowed for this study) - overrides account target_roles
 * - research_goal, assumptions, unknowns, custom_instructions
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import { getProjectContextGeneric } from "~/features/questions/db"
import type { Database } from "~/types"

/** Company-level context from accounts table (defaults) */
export interface CompanyContext {
	website_url: string | null
	company_description: string | null
	customer_problem: string | null
	offerings: string[] | null
	competitors: string[] | null
	industry: string | null
	target_orgs: string[] | null
	target_company_sizes: string[] | null
	target_roles: string[] | null
}

/**
 * Project-level research context from project_sections
 * All fields are optional - when present, they OVERRIDE account defaults
 */
export interface ResearchContext {
	// Research-specific (no account equivalent)
	research_goal: string | null
	research_goal_details: string | null
	assumptions: string[] | null
	unknowns: string[] | null
	custom_instructions: string | null
	research_mode: string | null
	// Layerable fields (override account defaults when present)
	customer_problem: string | null
	offerings: string[] | null
	target_orgs: string[] | null
	target_company_sizes: string[] | null
	target_roles: string[] | null
}

/** Unified context combining account + project */
export interface UnifiedContext {
	company: CompanyContext
	research: ResearchContext
	/** Merged flat object for BAML functions */
	forBaml: BamlContext
}

/** Flat context object matching BAML GenerateInputs */
export interface BamlContext {
	customer_problem: string | null
	target_org: string | null // Joined from target_orgs array
	target_company_sizes: string | null // Joined from target_company_sizes array
	target_roles: string | null // Joined from target_roles array
	offerings: string | null // Joined from offerings array
	competitors: string | null // Joined from competitors array
	research_goal: string | null
	research_goal_details: string | null
	assumptions: string | null // Joined from assumptions array
	unknowns: string | null // Joined from unknowns array
	custom_instructions: string | null
	research_mode: string | null
}

/**
 * Fetch company context from accounts table
 */
async function getCompanyContext(supabase: SupabaseClient<Database>, accountId: string): Promise<CompanyContext> {
	const { data: account, error } = await supabase
		.from("accounts")
		.select(
			"website_url, company_description, customer_problem, offerings, competitors, industry, target_orgs, target_company_sizes, target_roles"
		)
		.eq("id", accountId)
		.single()

	if (error) {
		consola.warn("Failed to fetch company context:", error)
	}

	return {
		website_url: account?.website_url ?? null,
		company_description: account?.company_description ?? null,
		customer_problem: account?.customer_problem ?? null,
		offerings: account?.offerings ?? null,
		competitors: account?.competitors ?? null,
		industry: account?.industry ?? null,
		target_orgs: account?.target_orgs ?? null,
		target_company_sizes: account?.target_company_sizes ?? null,
		target_roles: account?.target_roles ?? null,
	}
}

/**
 * Fetch research context from project_sections
 * Includes layerable fields that can override account defaults
 */
async function getResearchContext(supabase: SupabaseClient<Database>, projectId: string): Promise<ResearchContext> {
	const context = await getProjectContextGeneric(supabase, projectId)
	const merged = context?.merged ?? {}

	return {
		// Research-specific fields
		research_goal: typeof merged.research_goal === "string" ? merged.research_goal : null,
		research_goal_details: typeof merged.research_goal_details === "string" ? merged.research_goal_details : null,
		assumptions: Array.isArray(merged.assumptions) ? (merged.assumptions as string[]) : null,
		unknowns: Array.isArray(merged.unknowns) ? (merged.unknowns as string[]) : null,
		custom_instructions: typeof merged.custom_instructions === "string" ? merged.custom_instructions : null,
		research_mode: typeof merged.research_mode === "string" ? merged.research_mode : null,
		// Layerable fields (override account defaults when present)
		customer_problem: typeof merged.customer_problem === "string" ? merged.customer_problem : null,
		offerings: Array.isArray(merged.offerings) ? (merged.offerings as string[]) : null,
		target_orgs: Array.isArray(merged.target_orgs) ? (merged.target_orgs as string[]) : null,
		target_company_sizes: Array.isArray(merged.target_company_sizes) ? (merged.target_company_sizes as string[]) : null,
		target_roles: Array.isArray(merged.target_roles) ? (merged.target_roles as string[]) : null,
	}
}

/** Join array to string for BAML (comma-separated) */
function joinArray(arr: string[] | null): string | null {
	if (!arr || arr.length === 0) return null
	return arr.join(", ")
}

/** Layer arrays: project overrides account if present */
function layerArrays(accountValue: string[] | null, projectValue: string[] | null): string[] | null {
	// Project overrides if it has values
	if (projectValue && projectValue.length > 0) {
		return projectValue
	}
	// Fall back to account defaults
	return accountValue
}

/** Layer strings: project overrides account if present */
function layerString(accountValue: string | null, projectValue: string | null): string | null {
	// Project overrides if it has a non-empty value
	if (projectValue && projectValue.trim().length > 0) {
		return projectValue
	}
	// Fall back to account default
	return accountValue
}

/**
 * Get unified context combining account company context + project research context
 *
 * LAYERING: Project values override account defaults when present.
 * Layerable fields: customer_problem, offerings, target_orgs, target_roles
 *
 * @param supabase - Supabase client
 * @param accountId - Account ID for company context
 * @param projectId - Project ID for research context
 * @returns Unified context with company, research, and BAML-ready formats
 */
export async function getUnifiedContext(
	supabase: SupabaseClient<Database>,
	accountId: string,
	projectId: string
): Promise<UnifiedContext> {
	const [company, research] = await Promise.all([
		getCompanyContext(supabase, accountId),
		getResearchContext(supabase, projectId),
	])

	// LAYERING: Project overrides account defaults when present
	const effectiveCustomerProblem = layerString(company.customer_problem, research.customer_problem)
	const effectiveOfferings = layerArrays(company.offerings, research.offerings)
	const effectiveTargetOrgs = layerArrays(company.target_orgs, research.target_orgs)
	const effectiveTargetCompanySizes = layerArrays(company.target_company_sizes, research.target_company_sizes)
	const effectiveTargetRoles = layerArrays(company.target_roles, research.target_roles)

	// Create flat BAML-compatible context with layered values
	const forBaml: BamlContext = {
		customer_problem: effectiveCustomerProblem,
		target_org: joinArray(effectiveTargetOrgs),
		target_company_sizes: joinArray(effectiveTargetCompanySizes),
		target_roles: joinArray(effectiveTargetRoles),
		offerings: joinArray(effectiveOfferings),
		competitors: joinArray(company.competitors),
		research_goal: research.research_goal,
		research_goal_details: research.research_goal_details,
		assumptions: joinArray(research.assumptions),
		unknowns: joinArray(research.unknowns),
		custom_instructions: research.custom_instructions,
		research_mode: research.research_mode,
	}

	return {
		company,
		research,
		forBaml,
	}
}

/**
 * Check if company context has been set up
 */
export function hasCompanyContext(company: CompanyContext): boolean {
	return Boolean(company.website_url || company.company_description || company.customer_problem)
}

/**
 * Check if research context has been set up
 */
export function hasResearchContext(research: ResearchContext): boolean {
	return Boolean(
		research.research_goal ||
			(research.target_orgs && research.target_orgs.length > 0) ||
			(research.target_roles && research.target_roles.length > 0)
	)
}
