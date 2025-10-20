import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
	console.error("❌ Missing environment variables")
	process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function lookupFacets() {
	// Get facets a:232 through a:322
	const facetIds = Array.from({ length: 91 }, (_, i) => 232 + i)

	const { data: facets, error } = await supabase
		.from("facet_account")
		.select("*")
		.in("id", facetIds)
		.order("id", { ascending: true })

	if (error) {
		console.error("❌ Error fetching facets:", error)
		return
	}

	console.log(`\n📋 Found ${facets.length} facets:\n`)

	// Group by kind_id
	const byKind = facets.reduce(
		(acc, f) => {
			if (!acc[f.kind_id]) acc[f.kind_id] = []
			acc[f.kind_id].push(f)
			return acc
		},
		{} as Record<number, typeof facets>
	)

	for (const [kindId, items] of Object.entries(byKind)) {
		console.log(`\n🏷️  Kind ID ${kindId} (${items.length} facets):`)
		items.slice(0, 10).forEach((f) => {
			console.log(`   - a:${f.id} - ${f.label} (${f.slug})`)
		})
		if (items.length > 10) {
			console.log(`   ... and ${items.length - 10} more`)
		}
	}
}

lookupFacets().catch(console.error)
