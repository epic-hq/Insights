/**
 * Test semantic clustering on pain matrix
 */

import consola from "consola"
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

// Load .env file manually
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const envPath = join(__dirname, "../../../.env")

try {
	const envFile = readFileSync(envPath, "utf-8")
	for (const line of envFile.split("\n")) {
		const trimmed = line.trim()
		if (!trimmed || trimmed.startsWith("#")) continue
		const [key, ...valueParts] = trimmed.split("=")
		if (key && valueParts.length > 0) {
			const value = valueParts.join("=").replace(/^["']|["']$/g, "")
			process.env[key.trim()] = value.trim()
		}
	}
} catch (err) {
	consola.warn("Could not load .env file, using environment variables")
}

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
	throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
	auth: {
		autoRefreshToken: false,
		persistSession: false,
	},
})

async function testSemanticClustering() {
	// Use project with 98 pain facets
	const projectId = "b6afcf32-9dfa-4de3-ae05-c9ee2f30566a"

	consola.info("[test] Testing semantic clustering for project:", projectId)

	// Get raw evidence with pains before clustering
	const { data: rawEvidence } = await supabaseAdmin
		.from("evidence_facet")
		.select("id, label")
		.eq("project_id", projectId)
		.eq("kind_slug", "pain")
		.limit(100)

	consola.info(`[test] Raw pain facets before clustering: ${rawEvidence?.length || 0}`)

	// Show sample of raw pains
	if (rawEvidence && rawEvidence.length > 0) {
		consola.info("[test] Sample raw pains:")
		rawEvidence.slice(0, 10).forEach((p: any) => consola.info(`  - ${p.label}`))
	}

	// Call find_facet_clusters to see semantic matches
	const { data: clusters } = await supabaseAdmin.rpc("find_facet_clusters", {
		project_id_param: projectId,
		kind_slug_param: "pain",
		similarity_threshold: 0.82,
	})

	consola.success(`[test] Found ${clusters?.length || 0} semantic cluster pairs`)

	if (clusters && clusters.length > 0) {
		consola.info("[test] Sample semantic clusters:")
		clusters.slice(0, 10).forEach((c: any) => {
			consola.info(`  - "${c.label_1}" ↔ "${c.label_2}" (${(c.similarity * 100).toFixed(1)}%)`)
		})
	}

	// Import and call generatePainMatrix
	const { generatePainMatrix } = await import("../../features/lenses/services/generatePainMatrix.server.js")

	consola.info("[test] Generating pain matrix with semantic clustering...")
	const matrix = await generatePainMatrix({
		supabase: supabaseAdmin,
		projectId,
		minEvidencePerPain: 1,
		minGroupSize: 1,
	})

	consola.success("[test] Pain matrix generated!")
	consola.info(`[test] Pain themes after clustering: ${matrix.pain_themes.length}`)
	consola.info(`[test] User groups: ${matrix.user_groups.length}`)
	consola.info(`[test] Matrix cells: ${matrix.cells.length}`)
	consola.info(`[test] High impact cells: ${matrix.summary.high_impact_cells}`)

	// Show clustered pain themes
	consola.info("[test] Clustered pain themes:")
	matrix.pain_themes.forEach((theme) => {
		consola.info(`  - ${theme.name} (${theme.evidence_count} evidence)`)
	})

	// Calculate clustering ratio
	const clusteringRatio = rawEvidence ? (rawEvidence.length / matrix.pain_themes.length).toFixed(1) : "N/A"
	consola.success(`[test] Clustering ratio: ${rawEvidence?.length} raw → ${matrix.pain_themes.length} clustered (${clusteringRatio}x consolidation)`)
}

testSemanticClustering()
	.then(() => {
		consola.success("[test] Done!")
		process.exit(0)
	})
	.catch((err) => {
		consola.error("[test] Fatal error:", err)
		process.exit(1)
	})
