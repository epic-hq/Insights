import "dotenv/config"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const PROJECT_ID = "6dbcbb68-0662-4ebc-9f84-dd13b8ff758d"

async function checkProjectData() {
	console.log("🔍 Checking project data...\n")

	const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

	// Check interviews
	const { data: interviews, count: interviewCount } = await supabase
		.from("interviews")
		.select("*", { count: "exact", head: false })
		.eq("project_id", PROJECT_ID)

	// Check people
	const { data: people, count: peopleCount } = await supabase
		.from("people")
		.select("*", { count: "exact", head: false })
		.limit(10)

	// Check themes
	const { data: themes } = await supabase
		.from("themes")
		.select("*")
		.eq("project_id", PROJECT_ID)
		.order("evidence_count", { ascending: false })
		.limit(10)

	// Check research questions
	const { data: questions } = await supabase
		.from("research_questions")
		.select("*")
		.eq("project_id", PROJECT_ID)
		.limit(10)

	// Check person_scale (ICP scores)
	const { data: personScales } = await supabase.from("person_scale").select("*").limit(10)

	// Check conversation lenses
	const { data: lensAnalyses } = await supabase
		.from("conversation_lens_analyses")
		.select("*")
		.eq("project_id", PROJECT_ID)
		.limit(5)

	console.log("📊 Project Data Summary:")
	console.log(`   Interviews: ${interviewCount || 0}`)
	console.log(`   People: ${peopleCount || 0}`)
	console.log(`   Themes: ${themes?.length || 0}`)
	console.log(`   Research Questions: ${questions?.length || 0}`)
	console.log(`   Person Scale records: ${personScales?.length || 0}`)
	console.log(`   Lens Analyses: ${lensAnalyses?.length || 0}\n`)

	if (themes && themes.length > 0) {
		console.log("🎯 Top Themes:")
		themes.forEach((t) => {
			console.log(`   ${t.name}: ${t.evidence_count} mentions (validation: ${t.validation_status || "none"})`)
		})
		console.log("")
	}

	if (questions && questions.length > 0) {
		console.log("❓ Research Questions:")
		questions.forEach((q) => {
			console.log(`   ${q.question_text || q.id}`)
		})
		console.log("")
	}

	if (personScales && personScales.length > 0) {
		console.log("📈 Person Scale Types:")
		const kinds = [...new Set(personScales.map((p) => p.kind_slug))]
		kinds.forEach((kind) => {
			const count = personScales.filter((p) => p.kind_slug === kind).length
			console.log(`   ${kind}: ${count} records`)
		})
		console.log("")
	}

	if (lensAnalyses && lensAnalyses.length > 0) {
		console.log("🔬 Conversation Lenses:")
		const templates = [...new Set(lensAnalyses.map((l) => l.template_key))]
		templates.forEach((template) => {
			const count = lensAnalyses.filter((l) => l.template_key === template).length
			console.log(`   ${template}: ${count} analyses`)
		})
		console.log("")
	}
}

checkProjectData()
