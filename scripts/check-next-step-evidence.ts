import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const interviewId = "b8d86566-9001-4e69-9a7b-20d38447843e"

async function main() {
	const { data: evidence } = await supabase
		.from("evidence")
		.select("id, verbatim, gist")
		.eq("interview_id", interviewId)
		.order("created_at", { ascending: true })

	console.log("Evidence count:", evidence?.length || 0)
	console.log("\nSearching for next step mentions...")

	const nextStepKeywords = [
		"follow up",
		"reach out",
		"send",
		"email",
		"schedule",
		"meeting",
		"call",
		"demo",
		"show you",
	]

	let found = 0
	evidence?.forEach((ev, idx) => {
		const text = `${ev.verbatim} ${ev.gist || ""}`.toLowerCase()
		const hasNextStep = nextStepKeywords.some((keyword) => text.includes(keyword))
		if (hasNextStep) {
			found++
			console.log("\n🎯 Evidence", idx + 1, "(", ev.id.substring(0, 8), ")")
			console.log("   Verbatim:", ev.verbatim?.substring(0, 200))
			console.log("   Gist:", ev.gist?.substring(0, 150))
		}
	})

	console.log("\n\nTotal evidence with next step keywords:", found)
	console.log("Percentage:", ((found / (evidence?.length || 1)) * 100).toFixed(1), "%")
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err)
		process.exit(1)
	})
