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
 * - target_industries (broad: "Healthcare", "Fintech")
 * - target_roles (typical buyer roles)
 *
 * Project context (overrides, per-study from project_sections):
 * - target_orgs (specific: "Enterprise hospital networks") - overrides target_industries
 * - target_roles (narrowed for this study) - overrides account target_roles
 * - research_goal, assumptions, unknowns, custom_instructions
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import { getProjectContextGeneric } from "~/features/questions/db";
import type { Database } from "~/types";

/** Company-level context from accounts table (defaults) */
export interface CompanyContext {
  website_url: string | null;
  company_description: string | null;
  customer_problem: string | null;
  offerings: string[] | null;
  competitors: string[] | null;
  industry: string | null;
  /** Broad industry categories - default for target_org */
  target_industries: string[] | null;
  /** Typical buyer roles - default for target_roles */
  target_roles: string[] | null;
}

/** Project-level research context from project_sections */
export interface ResearchContext {
  target_orgs: string[] | null;
  target_roles: string[] | null;
  research_goal: string | null;
  research_goal_details: string | null;
  assumptions: string[] | null;
  unknowns: string[] | null;
  custom_instructions: string | null;
  research_mode: string | null;
}

/** Unified context combining account + project */
export interface UnifiedContext {
  company: CompanyContext;
  research: ResearchContext;
  /** Merged flat object for BAML functions */
  forBaml: BamlContext;
}

/** Flat context object matching BAML GenerateInputs */
export interface BamlContext {
  customer_problem: string | null;
  target_org: string | null; // Joined from target_orgs array
  target_roles: string | null; // Joined from target_roles array
  offerings: string | null; // Joined from offerings array
  competitors: string | null; // Joined from competitors array
  research_goal: string | null;
  research_goal_details: string | null;
  assumptions: string | null; // Joined from assumptions array
  unknowns: string | null; // Joined from unknowns array
  custom_instructions: string | null;
  research_mode: string | null;
}

/**
 * Fetch company context from accounts table
 */
async function getCompanyContext(
  supabase: SupabaseClient<Database>,
  accountId: string,
): Promise<CompanyContext> {
  const { data: account, error } = await supabase
    .from("accounts")
    .select(
      "website_url, company_description, customer_problem, offerings, competitors, industry, target_industries, target_roles",
    )
    .eq("id", accountId)
    .single();

  if (error) {
    consola.warn("Failed to fetch company context:", error);
  }

  return {
    website_url: account?.website_url ?? null,
    company_description: account?.company_description ?? null,
    customer_problem: account?.customer_problem ?? null,
    offerings: account?.offerings ?? null,
    competitors: account?.competitors ?? null,
    industry: account?.industry ?? null,
    target_industries: account?.target_industries ?? null,
    target_roles: account?.target_roles ?? null,
  };
}

/**
 * Fetch research context from project_sections
 */
async function getResearchContext(
  supabase: SupabaseClient<Database>,
  projectId: string,
): Promise<ResearchContext> {
  const context = await getProjectContextGeneric(supabase, projectId);
  const merged = context?.merged ?? {};

  return {
    target_orgs: Array.isArray(merged.target_orgs)
      ? (merged.target_orgs as string[])
      : null,
    target_roles: Array.isArray(merged.target_roles)
      ? (merged.target_roles as string[])
      : null,
    research_goal:
      typeof merged.research_goal === "string" ? merged.research_goal : null,
    research_goal_details:
      typeof merged.research_goal_details === "string"
        ? merged.research_goal_details
        : null,
    assumptions: Array.isArray(merged.assumptions)
      ? (merged.assumptions as string[])
      : null,
    unknowns: Array.isArray(merged.unknowns)
      ? (merged.unknowns as string[])
      : null,
    custom_instructions:
      typeof merged.custom_instructions === "string"
        ? merged.custom_instructions
        : null,
    research_mode:
      typeof merged.research_mode === "string" ? merged.research_mode : null,
  };
}

/** Join array to string for BAML (comma-separated) */
function joinArray(arr: string[] | null): string | null {
  if (!arr || arr.length === 0) return null;
  return arr.join(", ");
}

/** Layer arrays: project overrides account if present */
function layerArrays(
  accountValue: string[] | null,
  projectValue: string[] | null,
): string[] | null {
  // Project overrides if it has values
  if (projectValue && projectValue.length > 0) {
    return projectValue;
  }
  // Fall back to account defaults
  return accountValue;
}

/**
 * Get unified context combining account company context + project research context
 *
 * LAYERING: Project values override account defaults when present.
 * - target_orgs (project) overrides target_industries (account)
 * - target_roles (project) overrides target_roles (account)
 *
 * @param supabase - Supabase client
 * @param accountId - Account ID for company context
 * @param projectId - Project ID for research context
 * @returns Unified context with company, research, and BAML-ready formats
 */
export async function getUnifiedContext(
  supabase: SupabaseClient<Database>,
  accountId: string,
  projectId: string,
): Promise<UnifiedContext> {
  const [company, research] = await Promise.all([
    getCompanyContext(supabase, accountId),
    getResearchContext(supabase, projectId),
  ]);

  // LAYERING: Project overrides account defaults
  // - target_orgs (project-specific) > target_industries (account default)
  // - target_roles (project-specific) > target_roles (account default)
  const effectiveTargetOrg = layerArrays(
    company.target_industries,
    research.target_orgs,
  );
  const effectiveTargetRoles = layerArrays(
    company.target_roles,
    research.target_roles,
  );

  // Create flat BAML-compatible context with layered values
  const forBaml: BamlContext = {
    customer_problem: company.customer_problem,
    target_org: joinArray(effectiveTargetOrg),
    target_roles: joinArray(effectiveTargetRoles),
    offerings: joinArray(company.offerings),
    competitors: joinArray(company.competitors),
    research_goal: research.research_goal,
    research_goal_details: research.research_goal_details,
    assumptions: joinArray(research.assumptions),
    unknowns: joinArray(research.unknowns),
    custom_instructions: research.custom_instructions,
    research_mode: research.research_mode,
  };

  return {
    company,
    research,
    forBaml,
  };
}

/**
 * Check if company context has been set up
 */
export function hasCompanyContext(company: CompanyContext): boolean {
  return Boolean(
    company.website_url ||
    company.company_description ||
    company.customer_problem,
  );
}

/**
 * Check if research context has been set up
 */
export function hasResearchContext(research: ResearchContext): boolean {
  return Boolean(
    research.research_goal ||
    (research.target_orgs && research.target_orgs.length > 0) ||
    (research.target_roles && research.target_roles.length > 0),
  );
}
