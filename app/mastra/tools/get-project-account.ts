import { createClient } from "@supabase/supabase-js"
import consola from "consola"

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
	throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function getProjectAccount() {
	const projectId = "6d3594bd-04d5-48dc-8a37-14d609b3e1ad"

	const { data, error } = await supabase
		.from("projects")
		.select("id, name, account_id")
		.eq("id", projectId)
		.single()

	if (error) {
		consola.error("Error:", error)
		return
	}

	consola.info("Project details:", data)
	consola.box(`
Full BANT Lens URL:
/a/${data.account_id}/${data.id}/bant-lens

Opportunities URL:
/a/${data.account_id}/${data.id}/opportunities
  `)
}

getProjectAccount()
