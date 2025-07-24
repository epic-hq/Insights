// supabase/functions/cluster_insights/index.ts
/** biome-ignore-all lint/suspicious/noFocusedTests: <explanation> */
// Supabase Edge Function: cluster_insights
// -------------------------------------------------------------
// Accepts POST { items: [ { id: string; embedding: number[]; text?: string } , ... ] }
// Returns   [{ id, x, y, cluster, text }]
// -------------------------------------------------------------
// Usage (curl):
// curl -X POST \
//   -H "Authorization: Bearer $SERVICE_ROLE" \
//   -H "Content-Type: application/json" \
//   -d @payload.json \
//   https://<project>.functions.supabase.co/cluster_insights

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { HDBSCAN } from "npm:hdbscan-ts@1.0.16"
import { UMAP } from "npm:umap-js@1.4.0"

// import { HDBSCAN } from "https://esm.sh/hdbscan-ts@1.0.16"
// // Pure‑ESM builds that work in Deno Edge
// import { UMAP } from "https://esm.sh/umap-js@1.4.0?bundle"

/** L2‑normalize a vector so cosine distance ⇔ Euclidean. */
const l2 = (v: number[]): number[] => {
	const len = Math.hypot(...v)
	return len === 0 ? v : v.map((x) => x / len)
}

/** Build a JSON Response helper */
const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	})

// -------------------------------------------------------------
Deno.serve(async (req) => {
	try {
		if (req.method !== "POST") {
			return json({ error: "POST only" }, 405)
		}

		const { items } = await req.json()
		if (!Array.isArray(items) || items.length === 0) {
			return json({ error: "Body must be { items: [...] }" }, 400)
		}

		/* 1️⃣  Normalise embeddings */
		const vecs: number[][] = items.map((it: any) => l2(it.embedding))
		const n = vecs.length

		/* 2️⃣  UMAP to 2‑D (skip if n <= 2) */
		let coords: number[][] = vecs.map(() => [0, 0])
		if (n > 2) {
			const umap = new UMAP({
				nComponents: 2,
				nNeighbors: Math.max(2, Math.min(15, n - 1)),
				minDist: 0.1,
			})
			coords = umap.fit(vecs)
		}

		/* 3️⃣  HDBSCAN clustering (robust defaults) */
		const hdb = new HDBSCAN({
			minClusterSize: Math.max(2, Math.floor(n / 3)),
			minSamples: Math.max(2, Math.floor(n / 4)),
		})
		hdb.fit(coords)
		const labels: number[] = hdb.labels_

		/* 4️⃣  Build output */
		const out = items.map((it: any, i: number) => ({
			id: it.id,
			x: coords[i][0],
			y: coords[i][1],
			cluster: labels[i], // -1 == noise
			text: it.text ?? "",
		}))

		return json(out)
	} catch (err: any) {
		return json({ error: err.message, stack: err.stack }, 500)
	}
})
