/**
 * Test both embed functions to compare behavior
 */

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

async function testEmbedFacet() {
	console.log("\n=== Testing embed-facet (working) ===");
	const response = await fetch(`${SUPABASE_URL}/functions/v1/embed-facet`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			facet_id: "test-id",
			label: "test label",
			kind_slug: "test",
		}),
	});

	console.log("Status:", response.status);
	console.log("Response:", await response.text());
}

async function testEmbedPersonFacet() {
	console.log("\n=== Testing embed-person-facet (broken) ===");
	const response = await fetch(`${SUPABASE_URL}/functions/v1/embed-person-facet`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			person_id: "test-id",
			facet_account_id: 123,
			label: "test label",
			kind_slug: "test",
		}),
	});

	console.log("Status:", response.status);
	console.log("Response:", await response.text());
}

await testEmbedFacet();
await testEmbedPersonFacet();
