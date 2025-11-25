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

function logMeta(req: Request, extra?: Record<string, unknown>) {
	try {
		const url = new URL(req.url)
		const h = req.headers
		return {
			method: req.method,
			url: req.url,
			host: h.get("host"),
			origin: h.get("origin"),
			referer: h.get("referer"),
			forwarded: h.get("forwarded"),
			xfwdFor: h.get("x-forwarded-for"),
			xfwdProto: h.get("x-forwarded-proto"),
			xfwdHost: h.get("x-forwarded-host"),
			authority: `${url.protocol}//${url.host}`,
			extra,
		}
	} catch (_e) {
		return { method: req.method, url: req.url, extra }
	}
}

Deno.serve(async (req) => {
	// Debug: Log Authorization header specifically
	const authHeader = req.headers.get("authorization")

	if (authHeader?.startsWith("Bearer ")) {
		try {
			const jwt = authHeader.split(" ")[1]
			const payload = jwt.split(".")[1]
			const _decoded = JSON.parse(atob(payload))
		} catch (_e) {}
	}

	try {
		console.log("[embed] request meta", JSON.stringify(logMeta(req)))
		const { id, name, pain } = await req.json()
		if (!id || !name || !pain) {
			return new Response("Missing `id`, `name` or `pain`", { status: 400 })
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
				input: `${name}: ${pain}`,
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

		const { error } = await supabase.from("themes").update({ embedding: embedding }).eq("id", id)

		if (error) throw error

		return new Response(JSON.stringify({ success: true }), {
			headers: { "Content-Type": "application/json" },
		})
	} catch (err) {
		console.error("[embed] exception", err)
		return new Response(JSON.stringify({ success: false, message: (err as Error).message, stack: (err as Error).stack }), {
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
		--data '{"name":"Functions", "pain":"Functions"}'

*/
