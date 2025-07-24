// app/routes/insights.map.tsx
// -----------------------------------------------------------------------------
// Remix route that:
//   1. Loads insight rows (id, name, embedding) that belong to the user
//   2. Sends them to the `cluster_insights` Supabase Edge Function
//   3. Receives [{ id, x, y, cluster, text }] back
//   4. Renders a Recharts scatter plot
// -----------------------------------------------------------------------------

import consola from "consola"
import { type LoaderFunctionArgs, useLoaderData } from "react-router-dom"
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts"
import type { Database } from "~/../supabase/types"
import { getServerClient } from "~/lib/supabase/server"

/* -------------------------------------------------------------------------- */

/** Tuple coming back from edge function */
export interface ClusterPoint {
	id: string
	x: number
	y: number
	cluster: number // -1 = noise
	text: string
}

export async function loader({ request }: LoaderFunctionArgs) {
	/* 1️⃣  get Supabase rows -------------------------------------------------- */
	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	const accountId = jwt?.claims.sub

	type InsightRow = Database["public"]["Tables"]["insights"]["Row"]
	const { data: rows, error } = await supabase
		.from("insights")
		.select("id, name, embedding")
		.eq("account_id", accountId)

	if (error) throw { error: error.message, status: 500 }

	const items = (rows ?? [])
		.filter((r): r is InsightRow & { embedding: number[] } => Array.isArray(r.embedding))
		.map((r) => ({ id: r.id, embedding: r.embedding, text: r.name ?? "" }))

	if (items.length < 2) {
		return { points: [] }
	}

	/* 2️⃣  call cluster_insights edge function -------------------------------- */
	const edgeUrl = `${process.env.SUPABASE_FUNCTIONS_URL}/cluster_insights`

	consola.log("edgeUrl", edgeUrl)
	const edgeRes = await fetch(edgeUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			// service role works server-side; use anon if RLS allows
			Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
		},
		body: JSON.stringify({ items }),
	})

	if (!edgeRes.ok) {
		const text = await edgeRes.text()
		throw { error: `Edge function error: ${text}`, status: 502 }
	}

	const points: ClusterPoint[] = await edgeRes.json()
	return { points }
}

/* -------------------------------------------------------------------------- */
export default function InsightsMap() {
	const { points } = useLoaderData<typeof loader>()

	if (points.length === 0) {
		return (
			<p className="text-center text-gray-500 dark:text-gray-400">
				Not enough insights with embeddings to plot clusters.
			</p>
		)
	}

	const clusters = Array.from(new Set(points.map((p) => p.cluster))).sort((a, b) => a - b)

	return (
		<div className="h-[600px] w-full">
			<ResponsiveContainer width="100%" height="100%">
				<ScatterChart>
					<CartesianGrid strokeDasharray="3 3" />
					<XAxis dataKey="x" type="number" name="UMAP-X" domain={["dataMin", "dataMax"]} />
					<YAxis dataKey="y" type="number" name="UMAP-Y" domain={["dataMin", "dataMax"]} />
					<Tooltip formatter={(_: unknown, __: unknown, p) => p.payload.text} />
					{clusters.map((c) => (
						<Scatter key={c} data={points.filter((p) => p.cluster === c)} name={`Cluster ${c}`} />
					))}
				</ScatterChart>
			</ResponsiveContainer>
		</div>
	)
}
