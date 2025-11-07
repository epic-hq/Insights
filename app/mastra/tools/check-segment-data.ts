import { createClient } from "@supabase/supabase-js"
import consola from "consola"

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
	consola.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
	process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSegmentData() {
	consola.info("Checking segment data in database...")

	// Check old people.segment field
	consola.info("\n1. Checking old people.segment field:")
	const { data: segmentData } = await supabase
		.from("people")
		.select("segment")
		.not("segment", "is", null)
		.limit(20)

	const segments = new Set(segmentData?.map((p) => p.segment).filter(Boolean))
	consola.info(`Found ${segments.size} unique segments:`, Array.from(segments))

	// Check new people fields
	consola.info("\n2. Checking new people fields:")
	const fields = ["job_function", "seniority_level", "title", "industry", "life_stage", "age_range"]

	for (const field of fields) {
		const { data } = await supabase.from("people").select(field).not(field, "is", null).limit(10)

		const uniqueValues = new Set(data?.map((p) => (p as any)[field]).filter(Boolean))
		consola.info(`  ${field}: ${uniqueValues.size} unique values`, Array.from(uniqueValues).slice(0, 5))
	}

	// Check facet_kind_global
	consola.info("\n3. Checking facet_kind_global:")
	const { data: kinds } = await supabase.from("facet_kind_global").select("id, slug, label").order("id")

	for (const kind of kinds || []) {
		consola.info(`  ${kind.id}: ${kind.slug} (${kind.label})`)
	}

	// Check facet_account by kind
	consola.info("\n4. Checking facet_account counts by kind:")
	for (const kind of kinds || []) {
		const { count } = await supabase
			.from("facet_account")
			.select("*", { count: "exact", head: true })
			.eq("kind_id", kind.id)

		consola.info(`  ${kind.slug}: ${count} facets`)

		if (count && count > 0) {
			const { data: samples } = await supabase
				.from("facet_account")
				.select("label")
				.eq("kind_id", kind.id)
				.limit(5)

			consola.info(`    Examples:`, samples?.map((s) => s.label))
		}
	}
}

checkSegmentData()
