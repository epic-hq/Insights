// supabase/functions/cluster_insights/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { HDBSCAN } from "https://esm.sh/hdbscan-ts@1.0.16"
// pure-ESM builds of both libs
import { UMAP } from "https://esm.sh/umap-js@1.4.0"
import type { UUID } from "node:crypto"

type Item = { id: UUID; embedding: number[]; text?: string }

const l2norm = (v: number[]) => {
	const len = Math.hypot(...v)
	return v.map((x) => x / len)
}

Deno.serve(async (req) => {
	try {
		const { items }: { items: Item[] } = await req.json()
		if (!items?.length) {
			return new Response("Expected body { items: [...] }", { status: 400 })
		}

		/* 1.  prep embeddings ------------------------------------------------ */
		const vecs = items.map((it) => l2norm(it.embedding))

		/* 2.  UMAP ↓ 1536 → 50 dims (faster + denoise) ----------------------- */
		const umap = new UMAP({ nComponents: 50, nNeighbors: 15, minDist: 0.1 })
		const reduced = umap.it(vecs) // number[][]

		/* 3.  HDBSCAN clustering -------------------------------------------- */
		const hdb = new HDBSCAN({ minClusterSize: 5, minSamples: 5 })
		hdb.it(reduced) // fills labels_
		const labels = hdb.labels_ // int[] (-1 = noise)

		/* 4.  return id-to-cluster map -------------------------------------- */
		const result = Object.fromEntries(items.map((it, i) => [it.id, labels[i]]))

		return new Response(JSON.stringify(result), {
			headers: { "Content-Type": "application/json" },
		})
	} catch (err) {
		return new Response(JSON.stringify({ error: err.message }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		})
	}
})
