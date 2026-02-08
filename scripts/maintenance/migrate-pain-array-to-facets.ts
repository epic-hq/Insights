/**
 * Migrate old pains text[] format to evidence_facet table
 *
 * This script:
 * 1. Finds all evidence records with pains text[] populated
 * 2. For each pain in the array, creates corresponding facet_account and evidence_facet entries
 * 3. The new evidence_facet records will trigger embedding generation automatically
 */

import { createClient } from "@supabase/supabase-js";
import consola from "consola";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
	throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
	auth: {
		autoRefreshToken: false,
		persistSession: false,
	},
});

const PAIN_KIND_ID = 4; // From facet_kind_global

/**
 * Convert label to URL-friendly slug
 */
function slugify(text: string): string {
	return text
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, "") // Remove non-word chars
		.replace(/[\s_-]+/g, "_") // Replace spaces/underscores with single underscore
		.replace(/^-+|-+$/g, ""); // Remove leading/trailing dashes
}

/**
 * Get or create facet_account entry for a given label
 */
async function getOrCreateFacetAccount(opts: { accountId: string; label: string }): Promise<number | null> {
	const { accountId, label } = opts;
	const slug = slugify(label);

	// Check if facet_account already exists
	const { data: existing } = await supabaseAdmin
		.from("facet_account")
		.select("id")
		.eq("account_id", accountId)
		.eq("kind_id", PAIN_KIND_ID)
		.eq("slug", slug)
		.single();

	if (existing) {
		return existing.id;
	}

	// Create new facet_account
	const { data: created, error } = await supabaseAdmin
		.from("facet_account")
		.insert({
			account_id: accountId,
			kind_id: PAIN_KIND_ID,
			slug: slug,
			label: label,
			is_active: true,
		})
		.select("id")
		.single();

	if (error) {
		consola.error(`[migrate-pains] Failed to create facet_account for "${label}":`, error);
		return null;
	}

	return created.id;
}

async function migratePainsToFacets(projectId?: string) {
	consola.info("[migrate-pains] Starting migration...");

	// Get all evidence records with pains text[]
	let query = supabaseAdmin
		.from("evidence")
		.select("id, account_id, project_id, pains, interview_id")
		.not("pains", "is", null);

	if (projectId) {
		query = query.eq("project_id", projectId);
		consola.info(`[migrate-pains] Filtering to project: ${projectId}`);
	}

	const { data: evidenceRecords, error } = await query;

	if (error) {
		consola.error("[migrate-pains] Error fetching evidence records:", error);
		throw error;
	}

	if (!evidenceRecords || evidenceRecords.length === 0) {
		consola.success("[migrate-pains] No evidence records with pains[] found!");
		return;
	}

	// Filter to only records with non-empty pains array
	const recordsWithPains = evidenceRecords.filter((r) => r.pains && Array.isArray(r.pains) && r.pains.length > 0);

	if (recordsWithPains.length === 0) {
		consola.success("[migrate-pains] No evidence records with non-empty pains[] found!");
		return;
	}

	consola.info(`[migrate-pains] Found ${recordsWithPains.length} evidence records with pains to migrate`);

	let totalPains = 0;
	let successCount = 0;
	let errorCount = 0;
	let skippedCount = 0;

	for (const evidence of recordsWithPains) {
		const { id: evidenceId, account_id, project_id, pains } = evidence;

		for (const painLabel of pains as string[]) {
			totalPains++;
			const trimmedLabel = painLabel.trim();

			if (!trimmedLabel) {
				skippedCount++;
				continue;
			}

			try {
				// Check if evidence_facet already exists for this evidence + label combination
				const { data: existingFacet } = await supabaseAdmin
					.from("evidence_facet")
					.select("id")
					.eq("evidence_id", evidenceId)
					.eq("label", trimmedLabel)
					.eq("kind_slug", "pain")
					.single();

				if (existingFacet) {
					consola.debug(`[migrate-pains] ⊘ Evidence facet already exists for "${trimmedLabel}"`);
					skippedCount++;
					continue;
				}

				// Get or create facet_account
				const facetAccountId = await getOrCreateFacetAccount({
					accountId: account_id,
					label: trimmedLabel,
				});

				if (!facetAccountId) {
					errorCount++;
					continue;
				}

				// Create evidence_facet (this will trigger embedding generation)
				const { error: insertError } = await supabaseAdmin.from("evidence_facet").insert({
					evidence_id: evidenceId,
					account_id: account_id,
					project_id: project_id,
					kind_slug: "pain",
					facet_account_id: facetAccountId,
					label: trimmedLabel,
					source: "interview",
					confidence: 0.8,
				});

				if (insertError) {
					consola.error(`[migrate-pains] ✗ Failed to create evidence_facet for "${trimmedLabel}":`, insertError);
					errorCount++;
					continue;
				}

				consola.debug(`[migrate-pains] ✓ Created evidence_facet for "${trimmedLabel}"`);
				successCount++;
			} catch (err) {
				consola.error(`[migrate-pains] ✗ Error processing pain "${trimmedLabel}":`, err);
				errorCount++;
			}
		}
	}

	consola.success(
		`[migrate-pains] Migration complete! Total pains: ${totalPains}, Created: ${successCount}, Skipped: ${skippedCount}, Failed: ${errorCount}`
	);

	// Verify migration
	const { data: verifyData } = await supabaseAdmin.from("evidence").select("id").not("pains", "is", null);

	const remaining =
		verifyData?.filter((r: any) => {
			return r.pains && Array.isArray(r.pains) && r.pains.length > 0;
		}).length || 0;

	consola.info(`[migrate-pains] Evidence records still in old format: ${remaining}`);
	consola.info("[migrate-pains] Note: These may have been migrated already, check evidence_facet table");
}

// Run the migration
const projectId = process.argv[2]; // Optional: filter to specific project

migratePainsToFacets(projectId)
	.then(() => {
		consola.success("[migrate-pains] Done!");
		process.exit(0);
	})
	.catch((err) => {
		consola.error("[migrate-pains] Fatal error:", err);
		process.exit(1);
	});
