/**
 * Test embed-person-facet edge function directly
 * Run with: npx tsx scripts/test-embed-person-facet.ts
 */

import { createClient } from "@supabase/supabase-js"
import consola from "consola"

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!

async function main() {
	consola.start("Testing embed-person-facet edge function...")

	// Get a sample person_facet
	const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!)

	const { data: personFacet } = await supabase
		.from("person_facet")
		.select(
			`
      person_id,
      facet_account_id,
      facet:facet_account!inner(
        label,
        facet_kind_global!inner(slug)
      )
    `
		)
		.limit(1)
		.single()

	if (!personFacet) {
		consola.error("No person_facets found")
		return
	}

	const label = (personFacet.facet as any)?.label
	const kindSlug = (personFacet.facet as any)?.facet_kind_global?.slug

	consola.info(`Testing with: ${kindSlug} = "${label}"`)

	// Call the edge function directly
	const payload = {
		person_id: personFacet.person_id,
		facet_account_id: personFacet.facet_account_id,
		label: label,
		kind_slug: kindSlug,
	}

	consola.info("Calling edge function with payload:", payload)

	const response = await fetch(`${SUPABASE_URL}/functions/v1/embed-person-facet`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	})

	const text = await response.text()

	consola.info(`Response status: ${response.status}`)
	consola.info(`Response body: ${text}`)

	if (response.ok) {
		consola.success("✅ Edge function succeeded!")

		// Check if embedding was written
		const { data: updated } = await supabase
			.from("person_facet")
			.select("embedding")
			.eq("person_id", personFacet.person_id)
			.eq("facet_account_id", personFacet.facet_account_id)
			.single()

		if (updated?.embedding) {
			consola.success("✅ Embedding was written to database!")
		} else {
			consola.error("❌ Embedding was NOT written to database")
		}
	} else {
		consola.error("❌ Edge function failed:", text)
	}
}

main().catch(consola.error)
