// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

Deno.serve(async (req) => {
	// const { name } = await req.json()
	// const data = {
	//   message: `Hello ${name}!`,
	// }

	try {
		if (req.method !== "POST") return new Response("Use POST", { status: 405 })

		const isPngAccept = (req.headers.get("accept") || "").toLowerCase().includes("image/png")

		const { prompt, size = "1024x1024", returnMode, localSave = false, filename } = (await req.json()) as Body

		if (!prompt) return new Response("Missing prompt", { status: 400 })

		// 1) Generate transparent PNG (base64)
		const genRes = await fetch("https://api.openai.com/v1/images/generations", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${OPENAI_API_KEY}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: "gpt-image-1",
				prompt,
				size,
				background: "transparent",
				response_format: "b64_json",
				n: 1,
			}),
		})

		if (!genRes.ok) {
			const err = await genRes.text()
			return new Response(JSON.stringify({ error: "openai_failed", details: err }), {
				status: 502,
				headers: { "Content-Type": "application/json" },
			})
		}

		const genJson = await genRes.json()
		const b64: string | undefined = genJson?.data?.[0]?.b64_json
		if (!b64) {
			return new Response(JSON.stringify({ error: "no_image_data", raw: genJson }), {
				status: 502,
				headers: { "Content-Type": "application/json" },
			})
		}

		const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

		// 2A) Return raw PNG so the *caller* can save (best quick test)
		if (returnMode === "png" || isPngAccept) {
			return new Response(bytes, {
				headers: {
					"Content-Type": "image/png",
					"Cache-Control": "no-store",
				},
			})
		}

		// 2B) (DEV ONLY) Try to save locally when running `supabase functions serve`
		// Note: On deployed Edge Functions the filesystem is ephemeral/readonly.
		if (localSave) {
			const key = filename ?? `illustrations/${Date.now()}-${Math.random().toString(36).slice(2)}.png`
			const outPath = `/tmp/${key.replace(/^\/+/, "")}`
			// Requires --allow-write (granted by Supabase local dev) and the path must exist
			await Deno.mkdir(new URL("file:///tmp/illustrations/").pathname, { recursive: true })
			await Deno.writeFile(outPath, bytes)
			return new Response(JSON.stringify({ ok: true, saved: outPath }), {
				headers: { "Content-Type": "application/json" },
			})
		}

		// Default JSON (base64) if you want to handle saving on the client in code
		return new Response(JSON.stringify({ ok: true, b64 }), {
			headers: { "Content-Type": "application/json" },
		})
	} catch (e) {
		return new Response(JSON.stringify({ error: "exception", message: String(e) }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		})
	}
})

/* To invoke locally:

	1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
	2. Make an HTTP request:

	curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/illustrate' \
		--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
		--header 'Content-Type: application/json' \
		--data '{"name":"Functions"}'

*/
