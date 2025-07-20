// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

// Deno.serve(async (req) => {
//   const { name } = await req.json()
//   const data = {
//     message: `Hello ${name}!`,
//   }

//   return new Response(
//     JSON.stringify(data),
//     { headers: { "Content-Type": "application/json" } },
//   )
// })
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

Deno.serve(async (req) => {
	try {
		const { id, category, jtbd } = await req.json()
		if (!id || !category || !jtbd) {
			return new Response("Missing `id`, `category` or `jtbd`", { status: 400 })
		}

		// 1) Fetch embedding from OpenAI
		const openaiRes = await fetch("https://api.openai.com/v1/embeddings", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
			},
			body: JSON.stringify({
				model: "text-embedding-ada-002",
				input: `${category}: ${jtbd}`,
			}),
		})

		if (!openaiRes.ok) {
			const err = await openaiRes.text()
			throw new Error(`OpenAI error: ${err}`)
		}

		const { data } = await openaiRes.json()
		const embedding: number[] = data[0].embedding

		// 2) Write back to Supabase
		const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

		const { error } = await supabase.from("insights").update({ embedding: embedding }).eq("id", id)

		if (error) throw error

		return new Response(JSON.stringify({ success: true }), {
			headers: { "Content-Type": "application/json" },
		})
	} catch (err) {
		return new Response(JSON.stringify({ success: false, message: err.message, stack: err.stack }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		})
	}
})

/* To invoke locally:

	1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
	2. Make an HTTP request:

	curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/embed' \
		--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
		--header 'Content-Type: application/json' \
		--data '{"name":"Functions"}'

*/
