/**
 * ICP Match Scoring Service
 *
 * Scores a person against Ideal Customer Profile (ICP) criteria using a weighted algorithm.
 * Scores range from 0-1 and are converted to bands (HIGH/MEDIUM/LOW) for filtering.
 *
 * Algorithm:
 * - Role match (40% weight): Exact title or job_function facet match
 * - Organization match (30% weight): Industry, vertical, or company name match
 * - Company size match (30% weight): Within target size ranges
 * - Confidence multiplier: Based on data completeness (0-1)
 *
 * Band conversion:
 * - >= 0.85 → HIGH
 * - >= 0.65 → MEDIUM
 * - >= 0.40 → LOW
 * - < 0.40 → null (no band)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import type { Database } from "~/types";

type PersonWithOrg = {
  id: string;
  name: string | null;
  title: string | null;
  company: string | null;
  facets: Record<string, any> | null;
  organization: {
    id: string;
    name: string | null;
    industry: string | null;
    company_size: string | null;
  } | null;
};

export interface ICPCriteria {
  target_roles: string[];
  target_orgs: string[];
  target_company_sizes: string[];
}

export interface ICPScoreBreakdown {
  role_score: number; // 0-1
  org_score: number; // 0-1
  size_score: number; // 0-1
  overall_score: number; // weighted average
  band: "HIGH" | "MEDIUM" | "LOW" | null;
  confidence: number; // 0-1
  matched_criteria: {
    role?: string; // Which role matched
    org?: string; // Which org/industry matched
    size?: string; // Which size matched
  };
}

/**
 * Score role match (40% weight)
 * Returns { score: 0-1, matched: string | undefined }
 */
function scoreRoleMatch(
  person: PersonWithOrg,
  targetRoles: string[],
): { score: number; matched?: string } {
  if (targetRoles.length === 0) return { score: 0.5 }; // Neutral if no criteria

  const title = person.title?.toLowerCase() || "";
  const jobFunction = person.facets?.job_function?.toLowerCase() || "";

  // Exact substring match in title (1.0)
  for (const targetRole of targetRoles) {
    const target = targetRole.toLowerCase();
    if (title.includes(target)) {
      return { score: 1.0, matched: targetRole };
    }
  }

  // Fuzzy match via job_function facet (0.7)
  for (const targetRole of targetRoles) {
    const target = targetRole.toLowerCase();
    if (jobFunction.includes(target)) {
      return { score: 0.7, matched: targetRole };
    }
  }

  return { score: 0 }; // No match
}

/**
 * Score organization match (30% weight)
 * Returns { score: 0-1, matched: string | undefined }
 */
function scoreOrgMatch(
  person: PersonWithOrg,
  targetOrgs: string[],
): { score: number; matched?: string } {
  if (targetOrgs.length === 0) return { score: 0.5 }; // Neutral if no criteria

  const industry = person.organization?.industry?.toLowerCase() || "";
  const companyName = (
    person.company ||
    person.organization?.name ||
    ""
  ).toLowerCase();

  // Exact industry match (1.0)
  for (const targetOrg of targetOrgs) {
    const target = targetOrg.toLowerCase();
    if (industry.includes(target)) {
      return { score: 1.0, matched: targetOrg };
    }
  }

  // Company name match (0.8)
  for (const targetOrg of targetOrgs) {
    const target = targetOrg.toLowerCase();
    if (companyName.includes(target)) {
      return { score: 0.8, matched: targetOrg };
    }
  }

  // Related industry (0.6) - check if any word from target appears
  for (const targetOrg of targetOrgs) {
    const targetWords = targetOrg.toLowerCase().split(/\s+/);
    for (const word of targetWords) {
      if (word.length > 4 && industry.includes(word)) {
        return { score: 0.6, matched: targetOrg };
      }
    }
  }

  return { score: 0 }; // No match
}

/**
 * Score company size match (30% weight)
 * Returns { score: 0-1, matched: string | undefined }
 */
function scoreSizeMatch(
  person: PersonWithOrg,
  targetSizes: string[],
): { score: number; matched?: string } {
  if (targetSizes.length === 0) return { score: 0.5 }; // Neutral if no criteria

  const companySize = person.organization?.company_size?.toLowerCase() || "";
  if (!companySize) return { score: 0 }; // No data

  // Exact match (1.0)
  for (const targetSize of targetSizes) {
    if (companySize === targetSize.toLowerCase()) {
      return { score: 1.0, matched: targetSize };
    }
  }

  // Adjacent range (0.5) - simple heuristic for now
  // This could be enhanced with a proper range parser
  const sizeOrder = ["startup", "small", "medium", "large", "enterprise"];
  const currentIndex = sizeOrder.indexOf(companySize);
  if (currentIndex !== -1) {
    for (const targetSize of targetSizes) {
      const targetIndex = sizeOrder.indexOf(targetSize.toLowerCase());
      if (targetIndex !== -1 && Math.abs(currentIndex - targetIndex) === 1) {
        return { score: 0.5, matched: targetSize };
      }
    }
  }

  return { score: 0 }; // No match
}

/**
 * Calculate confidence based on data completeness (0-1)
 */
function calculateConfidence(person: PersonWithOrg): number {
  let confidence = 0;

  if (person.title) confidence += 0.3;
  if (person.company || person.organization?.name) confidence += 0.3;
  if (person.organization?.id) confidence += 0.2; // Has org link
  if (person.facets && Object.keys(person.facets).length > 0) confidence += 0.2;

  return Math.min(confidence, 1.0);
}

/**
 * Convert score to band
 */
function scoreToBand(score: number): "HIGH" | "MEDIUM" | "LOW" | null {
  if (score >= 0.85) return "HIGH";
  if (score >= 0.65) return "MEDIUM";
  if (score >= 0.4) return "LOW";
  return null;
}

/**
 * Get ICP criteria with project overrides
 * Uses unified-context pattern for account → project layering
 */
export async function getICPCriteria(opts: {
  supabase: SupabaseClient<Database>;
  accountId: string;
  projectId: string;
}): Promise<ICPCriteria> {
  // Load account-level defaults
  const { data: account, error: accountError } = await opts.supabase
    .from("accounts")
    .select("target_orgs, target_roles, target_company_sizes")
    .eq("id", opts.accountId)
    .single();

  if (accountError) {
    consola.warn("Failed to fetch account ICP criteria:", accountError);
  }

  // Load project-level overrides
  const { data: sections, error: sectionsError } = await opts.supabase
    .from("project_sections")
    .select("kind, meta")
    .eq("project_id", opts.projectId)
    .in("kind", ["target_orgs", "target_roles", "target_company_sizes"]);

  if (sectionsError) {
    consola.warn("Failed to fetch project ICP overrides:", sectionsError);
  }

  // Merge with project overrides taking precedence
  const targetOrgsSection = sections?.find((s) => s.kind === "target_orgs");
  const targetRolesSection = sections?.find((s) => s.kind === "target_roles");
  const targetSizesSection = sections?.find(
    (s) => s.kind === "target_company_sizes",
  );

  return {
    target_orgs:
      (targetOrgsSection?.meta as any)?.target_orgs ||
      account?.target_orgs ||
      [],
    target_roles:
      (targetRolesSection?.meta as any)?.target_roles ||
      account?.target_roles ||
      [],
    target_company_sizes:
      (targetSizesSection?.meta as any)?.target_company_sizes ||
      account?.target_company_sizes ||
      [],
  };
}

/**
 * Calculate ICP score for a person
 *
 * @param supabase - Supabase client
 * @param accountId - Account ID for ICP criteria
 * @param projectId - Project ID for ICP overrides
 * @param personId - Person to score
 * @returns Score breakdown with band and confidence
 */
export async function calculateICPScore(opts: {
  supabase: SupabaseClient<Database>;
  accountId: string;
  projectId: string;
  personId: string;
}): Promise<ICPScoreBreakdown> {
  // Fetch ICP criteria
  const criteria = await getICPCriteria({
    supabase: opts.supabase,
    accountId: opts.accountId,
    projectId: opts.projectId,
  });

  // Fetch person with organization data
  const { data: person, error: personError } = await opts.supabase
    .from("people")
    .select(
      `
			id,
			name,
			title,
			company,
			facets,
			organization:organization_id (
				id,
				name,
				industry,
				company_size
			)
		`,
    )
    .eq("id", opts.personId)
    .single();

  if (personError || !person) {
    consola.error("Failed to fetch person:", personError);
    throw new Error("Person not found");
  }

  // Score each component
  const roleMatch = scoreRoleMatch(
    person as PersonWithOrg,
    criteria.target_roles,
  );
  const orgMatch = scoreOrgMatch(person as PersonWithOrg, criteria.target_orgs);
  const sizeMatch = scoreSizeMatch(
    person as PersonWithOrg,
    criteria.target_company_sizes,
  );

  // Calculate weighted average (0.4, 0.3, 0.3)
  const rawScore =
    roleMatch.score * 0.4 + orgMatch.score * 0.3 + sizeMatch.score * 0.3;

  // Calculate confidence
  const confidence = calculateConfidence(person as PersonWithOrg);

  // Apply confidence as multiplier
  const overall_score = rawScore * confidence;

  // Determine band
  const band = scoreToBand(overall_score);

  return {
    role_score: roleMatch.score,
    org_score: orgMatch.score,
    size_score: sizeMatch.score,
    overall_score,
    band,
    confidence,
    matched_criteria: {
      role: roleMatch.matched,
      org: orgMatch.matched,
      size: sizeMatch.matched,
    },
  };
}
