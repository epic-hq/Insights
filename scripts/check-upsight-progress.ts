import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const projectId = "6dbcbb68-0662-4ebc-9f84-dd13b8ff758d"

const { count: embeddings } = await supabase
	.from("person_facet")
	.select("*", { count: "exact", head: true })
	.eq("project_id", projectId)
	.not("embedding", "is", null)

const { count: total } = await supabase
	.from("person_facet")
	.select("*", { count: "exact", head: true })
	.eq("project_id", projectId)

console.log("\nUpSight Interviews Project:")
console.log("- Total person_facets:", total)
console.log("- With embeddings:", embeddings)
console.log("- Progress:", Math.round(((embeddings || 0) / (total || 1)) * 100) + "%")
console.log("- Remaining:", (total || 0) - (embeddings || 0), "\n")
