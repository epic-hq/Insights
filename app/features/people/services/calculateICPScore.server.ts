/**
 * ICP Match Scoring Service
 *
 * Scores a person against Ideal Customer Profile (ICP) criteria using a weighted algorithm.
 * Scores range from 0-1 and are converted to bands (HIGH/MEDIUM/LOW) for filtering.
 *
 * Algorithm (v2 — skip missing dimensions):
 * - Only scores dimensions where the person HAS data AND criteria are defined
 * - Role match (base weight 0.4): Exact title or role field match
 * - Organization match (base weight 0.3): Industry, vertical, or company name match
 * - Company size match (base weight 0.3): Within target size ranges
 * - Weights are re-normalized across scored dimensions (e.g., if only role has data, it gets 100%)
 * - Confidence = dimensions_scored / total_criteria_dimensions (informational, not a multiplier)
 *
 * Band conversion:
 * - >= 0.85 → HIGH
 * - >= 0.65 → MEDIUM
 * - >= 0.40 → LOW
 * - < 0.40 → null (no band)
 * - No scorable dimensions → null score, null band (indeterminate)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import type { Database } from "~/types";

type PersonWithOrg = {
	id: string;
	name: string | null;
	title: string | null;
	role: string | null;
	company: string | null;
	organizations: {
		id: string;
		name: string | null;
		industry: string | null;
		size_range: string | null;
	} | null;
};

export interface ICPCriteria {
	target_roles: string[];
	target_orgs: string[];
	target_size_ranges: string[];
}

export interface ICPScoreBreakdown {
	role_score: number | null; // 0-1, null if dimension skipped
	org_score: number | null; // 0-1, null if dimension skipped
	size_score: number | null; // 0-1, null if dimension skipped
	overall_score: number | null; // weighted average, null if no dimensions scorable
	band: "HIGH" | "MEDIUM" | "LOW" | null;
	confidence: number; // 0-1 (dimensions_scored / criteria_dimensions)
	dimensions_scored: number; // How many of 3 dimensions had data
	dimensions_total: number; // How many criteria dimensions are defined
	matched_criteria: {
		role?: string; // Which role matched
		org?: string; // Which org/industry matched
		size?: string; // Which size matched
	};
}

type DimensionResult = {
	score: number;
	matched?: string;
	hasData: boolean;
};

/**
 * Score role match (base weight 0.4)
 * Returns score + whether person has data for this dimension
 */
function scoreRoleMatch(person: PersonWithOrg, targetRoles: string[]): DimensionResult {
	const hasTitle = !!person.title;
	const hasRole = !!person.role;
	const hasData = hasTitle || hasRole;

	if (targetRoles.length === 0 || !hasData) {
		return { score: 0, hasData };
	}

	const title = person.title?.toLowerCase() || "";
	const role = person.role?.toLowerCase() || "";

	// Exact substring match in title (1.0)
	for (const targetRole of targetRoles) {
		const target = targetRole.toLowerCase();
		if (title && title.includes(target)) {
			return { score: 1.0, matched: targetRole, hasData: true };
		}
	}

	// Fuzzy match via role field (0.7)
	for (const targetRole of targetRoles) {
		const target = targetRole.toLowerCase();
		if (role && role.includes(target)) {
			return { score: 0.7, matched: targetRole, hasData: true };
		}
	}

	return { score: 0, hasData: true }; // Has data but no match
}

/**
 * Score organization match (base weight 0.3)
 * Returns score + whether person has data for this dimension
 */
function scoreOrgMatch(person: PersonWithOrg, targetOrgs: string[]): DimensionResult {
	const hasCompany = !!person.company;
	const hasOrg = !!person.organizations;
	const hasData = hasCompany || hasOrg;

	if (targetOrgs.length === 0 || !hasData) {
		return { score: 0, hasData };
	}

	const industry = person.organizations?.industry?.toLowerCase() || "";
	const companyName = (person.company || person.organizations?.name || "").toLowerCase();

	// Exact industry match (1.0)
	for (const targetOrg of targetOrgs) {
		const target = targetOrg.toLowerCase();
		if (industry && industry.includes(target)) {
			return { score: 1.0, matched: targetOrg, hasData: true };
		}
	}

	// Company name match (0.8)
	for (const targetOrg of targetOrgs) {
		const target = targetOrg.toLowerCase();
		if (companyName && companyName.includes(target)) {
			return { score: 0.8, matched: targetOrg, hasData: true };
		}
	}

	// Related industry (0.6) - check if any word from target appears
	for (const targetOrg of targetOrgs) {
		const targetWords = targetOrg.toLowerCase().split(/\s+/);
		for (const word of targetWords) {
			if (word.length > 4 && industry && industry.includes(word)) {
				return { score: 0.6, matched: targetOrg, hasData: true };
			}
		}
	}

	return { score: 0, hasData: true }; // Has data but no match
}

/**
 * Score company size match (base weight 0.3)
 * Returns score + whether person has data for this dimension
 */
function scoreSizeMatch(person: PersonWithOrg, targetSizes: string[]): DimensionResult {
	const companySize = person.organizations?.size_range?.toLowerCase() || "";
	const hasData = !!companySize;

	if (targetSizes.length === 0 || !hasData) {
		return { score: 0, hasData };
	}

	// Exact match (1.0)
	for (const targetSize of targetSizes) {
		if (companySize === targetSize.toLowerCase()) {
			return { score: 1.0, matched: targetSize, hasData: true };
		}
	}

	// Adjacent range (0.5)
	const sizeOrder = ["startup", "small", "medium", "large", "enterprise"];
	const currentIndex = sizeOrder.indexOf(companySize);
	if (currentIndex !== -1) {
		for (const targetSize of targetSizes) {
			const targetIndex = sizeOrder.indexOf(targetSize.toLowerCase());
			if (targetIndex !== -1 && Math.abs(currentIndex - targetIndex) === 1) {
				return { score: 0.5, matched: targetSize, hasData: true };
			}
		}
	}

	return { score: 0, hasData: true }; // Has data but no match
}

/**
 * Convert score to band
 */
function scoreToBand(score: number | null): "HIGH" | "MEDIUM" | "LOW" | null {
	if (score == null) return null;
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
		.schema("accounts")
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
	const targetSizesSection = sections?.find((s) => s.kind === "target_company_sizes");

	return {
		target_orgs: (targetOrgsSection?.meta as any)?.target_orgs || account?.target_orgs || [],
		target_roles: (targetRolesSection?.meta as any)?.target_roles || account?.target_roles || [],
		target_size_ranges: (targetSizesSection?.meta as any)?.target_company_sizes || account?.target_company_sizes || [],
	};
}

/**
 * Calculate ICP score for a person
 *
 * Uses dynamic weight redistribution: only scores dimensions where the person
 * has data AND criteria are defined. Re-normalizes weights across scored dimensions.
 * Returns null score when no dimensions are scorable (indeterminate).
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
			role,
			company,
			organizations:default_organization_id (
				id,
				name,
				industry,
				size_range
			)
		`
		)
		.eq("id", opts.personId)
		.single();

	if (personError || !person) {
		consola.error("Failed to fetch person:", personError);
		throw new Error("Person not found");
	}

	// Score each component
	const roleResult = scoreRoleMatch(person as PersonWithOrg, criteria.target_roles);
	const orgResult = scoreOrgMatch(person as PersonWithOrg, criteria.target_orgs);
	const sizeResult = scoreSizeMatch(person as PersonWithOrg, criteria.target_size_ranges);

	// Count how many criteria dimensions are defined
	const criteriaDimensions: Array<{ result: DimensionResult; weight: number }> = [];
	if (criteria.target_roles.length > 0) criteriaDimensions.push({ result: roleResult, weight: 0.4 });
	if (criteria.target_orgs.length > 0) criteriaDimensions.push({ result: orgResult, weight: 0.3 });
	if (criteria.target_size_ranges.length > 0) criteriaDimensions.push({ result: sizeResult, weight: 0.3 });

	// Filter to only dimensions where person has data
	const scorableDimensions = criteriaDimensions.filter((d) => d.result.hasData);

	const dimensions_total = criteriaDimensions.length;
	const dimensions_scored = scorableDimensions.length;

	// If no dimensions can be scored, return indeterminate
	if (scorableDimensions.length === 0) {
		return {
			role_score: roleResult.hasData ? roleResult.score : null,
			org_score: orgResult.hasData ? orgResult.score : null,
			size_score: sizeResult.hasData ? sizeResult.score : null,
			overall_score: null,
			band: null,
			confidence: 0,
			dimensions_scored: 0,
			dimensions_total,
			matched_criteria: {},
		};
	}

	// Re-normalize weights across scored dimensions
	const totalWeight = scorableDimensions.reduce((sum, d) => sum + d.weight, 0);
	const overall_score = scorableDimensions.reduce((sum, d) => sum + (d.result.score * d.weight) / totalWeight, 0);

	// Confidence = how many dimensions we could actually score
	const confidence = dimensions_total > 0 ? dimensions_scored / dimensions_total : 0;

	const band = scoreToBand(overall_score);

	return {
		role_score: roleResult.hasData ? roleResult.score : null,
		org_score: orgResult.hasData ? orgResult.score : null,
		size_score: sizeResult.hasData ? sizeResult.score : null,
		overall_score,
		band,
		confidence,
		dimensions_scored,
		dimensions_total,
		matched_criteria: {
			role: roleResult.matched,
			org: orgResult.matched,
			size: sizeResult.matched,
		},
	};
}
