import { createClient } from "@supabase/supabase-js"

// Load environment variables from .env files
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
	console.error("❌ Missing environment variables:")
	console.error(`   SUPABASE_URL: ${supabaseUrl ? "✓" : "✗"}`)
	console.error(`   SUPABASE_SERVICE_ROLE_KEY: ${supabaseKey ? "✓" : "✗"}`)
	console.error("\n   Make sure to run with dotenvx:")
	console.error("   dotenvx run -- pnpm tsx scripts/debug-person-facets.ts")
	process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function investigatePersonFacets(personId: string) {
	console.log(`\n🔍 Investigating facets for person: ${personId}\n`)

	// Get person details
	const { data: person, error: personError } = await supabase
		.from("people")
		.select("*")
		.eq("id", personId)
		.single()

	if (personError) {
		console.error("❌ Error fetching person:", personError)
		return
	}

	console.log("👤 Person Details:")
	console.log(`   Name: ${person.name}`)
	console.log(`   Account ID: ${person.account_id}`)
	console.log(`   Project ID: ${person.project_id}\n`)

	// Get all facets for this person
	const { data: facets, error: facetsError } = await supabase
		.from("person_facet")
		.select("*")
		.eq("person_id", personId)
		.order("created_at", { ascending: true })

	if (facetsError) {
		console.error("❌ Error fetching facets:", facetsError)
		return
	}

	console.log(`📊 Total Facets: ${facets.length}\n`)

	// Group by facet_ref
	const facetsByRef = facets.reduce(
		(acc, facet) => {
			if (!acc[facet.facet_ref]) {
				acc[facet.facet_ref] = []
			}
			acc[facet.facet_ref].push(facet)
			return acc
		},
		{} as Record<string, typeof facets>,
	)

	console.log("📋 Facets grouped by reference:\n")
	for (const [ref, items] of Object.entries(facetsByRef)) {
		console.log(`   ${ref} (${items.length} entries):`)
		items.forEach((item, idx) => {
			console.log(`     ${idx + 1}. Source: ${item.source}, Confidence: ${item.confidence}`)
			console.log(`        Created: ${new Date(item.created_at).toISOString()}`)
			console.log(`        Evidence ID: ${item.evidence_id || "none"}`)
		})
		console.log()
	}

	// Check for duplicates
	const duplicateRefs = Object.entries(facetsByRef)
		.filter(([, items]) => items.length > 1)
		.map(([ref]) => ref)

	if (duplicateRefs.length > 0) {
		console.log(`⚠️  Found ${duplicateRefs.length} duplicate facet references:`)
		duplicateRefs.forEach((ref) => {
			console.log(`   - ${ref} (${facetsByRef[ref].length} entries)`)
		})
		console.log()
	}

	// Analyze by source
	const sourceStats = facets.reduce(
		(acc, facet) => {
			acc[facet.source] = (acc[facet.source] || 0) + 1
			return acc
		},
		{} as Record<string, number>,
	)

	console.log("📈 Facets by source:")
	Object.entries(sourceStats).forEach(([source, count]) => {
		console.log(`   ${source}: ${count}`)
	})
	console.log()

	// Check for pattern issues
	const invalidRefs = facets.filter((f) => !/^(g|a|p):[0-9a-zA-Z-]+$/.test(f.facet_ref))
	if (invalidRefs.length > 0) {
		console.log(`⚠️  Found ${invalidRefs.length} facets with invalid reference format:`)
		invalidRefs.forEach((f) => {
			console.log(`   - ${f.facet_ref}`)
		})
	}
}

const personId = process.argv[2] || "66eefc5b-28d6-4c00-9ec0-6254b28ca4cc"
investigatePersonFacets(personId).catch(console.error)
