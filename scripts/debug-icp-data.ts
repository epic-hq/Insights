/**
 * Debug script to check ICP data pipeline
 * Run with: npx tsx scripts/debug-icp-data.ts
 */

import { createClient } from "@supabase/supabase-js";
import consola from "consola";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
	const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

	consola.start("Debugging ICP data pipeline...");

	// Get account ID from a project first (since accounts are in separate schema)
	const { data: firstProject, error: projectError } = await supabase
		.from("projects")
		.select("id, name, account_id")
		.limit(1)
		.single();

	if (projectError || !firstProject) {
		consola.error("No projects found:", projectError?.message);
		return;
	}

	const accounts = { id: firstProject.account_id, name: "Account" };
	const project = firstProject;

	consola.info(`Account: ${accounts.name} (${accounts.id})`);
	consola.info(`Project: ${project.name} (${project.id})`);

	// 1. Check evidence
	const { count: evidenceCount } = await supabase
		.from("evidence")
		.select("*", { count: "exact", head: true })
		.eq("project_id", project.id);

	consola.box(`Evidence: ${evidenceCount || 0} records`);

	// 2. Check people
	const { count: peopleCount } = await supabase
		.from("people")
		.select("*", { count: "exact", head: true })
		.eq("account_id", accounts.id);

	consola.box(`People: ${peopleCount || 0} records`);

	// 3. Check person_facets by kind
	const { data: personFacets } = await supabase
		.from("person_facet")
		.select(
			`
      facet_account_id,
      facet:facet_account!inner(
        label,
        kind_id,
        facet_kind_global!inner(
          slug,
          label
        )
      )
    `
		)
		.eq("project_id", project.id);

	const facetsByKind = new Map<string, { labels: string[]; count: number }>();

	for (const pf of personFacets || []) {
		const kindSlug = (pf.facet as any)?.facet_kind_global?.slug;
		const label = (pf.facet as any)?.label;

		if (!kindSlug) continue;

		if (!facetsByKind.has(kindSlug)) {
			facetsByKind.set(kindSlug, { labels: [], count: 0 });
		}

		const group = facetsByKind.get(kindSlug)!;
		group.count++;
		if (!group.labels.includes(label)) {
			group.labels.push(label);
		}
	}

	consola.box("Person Facets by Kind:");
	if (facetsByKind.size === 0) {
		consola.warn("  ❌ No person_facets found!");
	} else {
		for (const [kind, data] of facetsByKind.entries()) {
			consola.info(`  ${kind}: ${data.count} records, ${data.labels.length} unique labels`);
			consola.info(`    Labels: ${data.labels.join(", ")}`);
		}
	}

	// 4. Check evidence_facets (pains)
	const { data: painFacets } = await supabase
		.from("evidence_facet")
		.select("label, kind_slug")
		.eq("project_id", project.id)
		.eq("kind_slug", "pain");

	const painLabels = new Map<string, number>();
	for (const pf of painFacets || []) {
		painLabels.set(pf.label, (painLabels.get(pf.label) || 0) + 1);
	}

	consola.box("Pain Facets:");
	if (painLabels.size === 0) {
		consola.warn("  ❌ No pain facets found!");
	} else {
		consola.info(`  Total: ${painFacets?.length || 0} pain evidence items`);
		consola.info(`  Unique pains: ${painLabels.size}`);
		const topPains = Array.from(painLabels.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5);
		consola.info("  Top 5 pains:");
		for (const [label, count] of topPains) {
			consola.info(`    - "${label}" (${count}x)`);
		}
	}

	// 5. Check embeddings
	const { data: personFacetsWithEmbeddings } = await supabase
		.from("person_facet")
		.select("embedding")
		.eq("project_id", project.id)
		.not("embedding", "is", null);

	const { data: evidenceFacetsWithEmbeddings } = await supabase
		.from("evidence_facet")
		.select("embedding")
		.eq("project_id", project.id)
		.not("embedding", "is", null);

	consola.box("Embeddings:");
	consola.info(`  Person facets with embeddings: ${personFacetsWithEmbeddings?.length || 0}`);
	consola.info(`  Evidence facets with embeddings: ${evidenceFacetsWithEmbeddings?.length || 0}`);

	// 6. Check old segment column
	const { data: peopleWithSegments } = await supabase
		.from("people")
		.select("segment")
		.eq("account_id", accounts.id)
		.not("segment", "is", null);

	const segments = new Map<string, number>();
	for (const p of peopleWithSegments || []) {
		if (p.segment) {
			segments.set(p.segment, (segments.get(p.segment) || 0) + 1);
		}
	}

	consola.box("Old Segment Column Data:");
	if (segments.size === 0) {
		consola.warn("  ❌ No segment data in people.segment column");
	} else {
		consola.info(`  ${peopleWithSegments?.length || 0} people with segments`);
		consola.info("  Segments:");
		for (const [segment, count] of segments.entries()) {
			consola.info(`    - "${segment}" (${count} people)`);
		}
	}

	// 7. Summary and recommendations
	consola.box("🔍 Diagnosis Summary:");

	const issues: string[] = [];

	if (!evidenceCount || evidenceCount === 0) {
		issues.push("❌ No evidence extracted from interviews");
	}

	if (facetsByKind.size === 0) {
		issues.push("❌ No person_facets extracted (no demographics like job_function, industry)");
	}

	if (painLabels.size === 0) {
		issues.push("❌ No pain facets extracted from evidence");
	}

	const hasDemographics = Array.from(facetsByKind.keys()).some((kind) =>
		["job_function", "industry", "seniority_level", "persona", "title"].includes(kind)
	);

	if (!hasDemographics && segments.size > 0) {
		issues.push(
			"⚠️  Old segment data exists but not migrated to person_facets - run migration 20251106232652_migrate_segments_to_facets.sql"
		);
	}

	if (!hasDemographics && segments.size === 0) {
		issues.push("⚠️  BAML extraction may not be extracting demographic facets - check BAML prompts");
	}

	if (issues.length === 0) {
		consola.success("✅ All systems operational!");
	} else {
		consola.warn("Issues found:");
		for (const issue of issues) {
			consola.warn(`  ${issue}`);
		}
	}

	consola.success("Debug complete!");
}

main().catch(consola.error);
