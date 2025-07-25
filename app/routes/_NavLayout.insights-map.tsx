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
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, LabelList } from "recharts"
import { getServerClient } from "~/lib/supabase/server"

const anonToken =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiZ2lucXZna29ubm9rdHJ0dHF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyMTcxMDksImV4cCI6MjA2Nzc5MzEwOX0.Z_ybpc9JF1rJCNNpF00ze2gTp99iHgBVt-IHqCh4pvw"
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
	const _accessToken = jwt?.claims.access_token
	const {
		data: { session },
	} = await supabase.auth.getSession()
	if (!accountId) {
		throw new Response("Unauthorized", { status: 401 })
	}

	const { data: rows, error } = await supabase
		.from("insights")
		.select("id, name, embedding")
		.eq("account_id", accountId)

	if (error) {
		consola.error("Error fetching insights:", error)
		throw new Response(error.message, { status: 500 })
	}

	consola.log(`Found ${rows?.length} insights`)

	// Debug: log a sample of what embeddings look like
	if (rows && rows.length > 0) {
		consola.log("Sample insight:", {
			id: rows[0].id,
			name: rows[0].name,
			embedding: rows[0].embedding
				? `${typeof rows[0].embedding} (length: ${Array.isArray(rows[0].embedding) ? rows[0].embedding.length : "not array"})`
				: "null",
		})
	}

	const items = (rows ?? [])
		.filter((r) => r.embedding)
		.map((r) => {
			try {
				// Parse embedding from JSON string to array
				const embedding = typeof r.embedding === "string" ? JSON.parse(r.embedding) : r.embedding
				if (!Array.isArray(embedding) || embedding.length === 0) {
					return null
				}
				return { id: r.id, embedding: embedding as number[], text: r.name ?? "" }
			} catch (error) {
				consola.error(`Failed to parse embedding for insight ${r.id}:`, error)
				return null
			}
		})
		.filter((item): item is NonNullable<typeof item> => item !== null)

	consola.log(`Found ${items.length} insights with valid embeddings`)

	if (items.length < 2) {
		return { points: [] }
	}

	/* 2️⃣  call cluster_insights edge function -------------------------------- */
	// Use dedicated functions URL or fallback to local development
	const SUPABASE_FUNCTIONS_URL = process.env.SUPABASE_FUNCTIONS_URL
	const SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54321"
	const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

	if (!SUPABASE_SERVICE_ROLE_KEY) {
		consola.error("SUPABASE_SERVICE_ROLE_KEY not found")
		throw new Response("Server configuration error", { status: 500 })
	}

	// Use dedicated functions URL if available, otherwise construct from base URL
	const edgeUrl = SUPABASE_FUNCTIONS_URL
		? `${SUPABASE_FUNCTIONS_URL}/cluster_insights`
		: `${SUPABASE_URL}/functions/v1/cluster_insights`

	// consola.log("Calling edge function at:", edgeUrl)
	// consola.log("With items count:", items.length)
	// consola.log("With access token:", accountId, accessToken, "\njwt:", jwt)
	// consola.log("With session:", session)

	try {
		const edgeRes = await fetch(edgeUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${anonToken}`,
			},
			body: JSON.stringify({ items }),
		})

		if (!edgeRes.ok) {
			const text = await edgeRes.text()
			consola.error("Edge function error:", {
				status: edgeRes.status,
				statusText: edgeRes.statusText,
				body: text,
			})
			throw new Response(`Edge function error: ${text}`, { status: 502 })
		}

		const points: ClusterPoint[] = await edgeRes.json()
		consola.log(`Received ${points.length} clustered points`)
		return { points }
	} catch (fetchError) {
		consola.error("Failed to call edge function:", fetchError)
		throw new Response("Failed to process insights clustering", { status: 502 })
	}
}

/* -------------------------------------------------------------------------- */
export default function InsightsMap() {
	const { points } = useLoaderData<typeof loader>()

	if (points.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center h-96 text-center">
				<div className="text-gray-400 mb-4">
					<svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
					</svg>
				</div>
				<h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Insights to Cluster</h3>
				<p className="text-gray-500 dark:text-gray-400 max-w-sm">
					Need at least 2 insights with embeddings to generate the clustering visualization.
				</p>
			</div>
		)
	}

	const clusters = Array.from(new Set(points.map((p) => p.cluster))).sort((a, b) => a - b)
	
	// Color palette for clusters
	const clusterColors = [
		"#3B82F6", // blue
		"#10B981", // emerald
		"#F59E0B", // amber
		"#EF4444", // red
		"#8B5CF6", // violet
		"#06B6D4", // cyan
		"#F97316", // orange
		"#84CC16", // lime
		"#EC4899", // pink
		"#6B7280", // gray (for noise cluster -1)
	]
	
	// Transform data for bubble chart with smart labeling
	const bubbleData = points.map((point) => {
		// Smart text truncation based on word boundaries
		const words = point.text.split(' ')
		let label = point.text
		
		// If text is too long, try to break at word boundaries
		if (point.text.length > 18) {
			let truncated = ''
			for (const word of words) {
				if ((truncated + word).length <= 15) {
					truncated += (truncated ? ' ' : '') + word
				} else {
					break
				}
			}
			label = truncated + (truncated.length < point.text.length ? '...' : '')
		}
		
		return {
			...point,
			z: 250, // Even bigger bubbles for better label visibility
			fill: clusterColors[point.cluster === -1 ? clusterColors.length - 1 : point.cluster % (clusterColors.length - 1)],
			label
		}
	})

	return (
		<div className="w-full max-w-[80vw] mx-auto">
			<div className="mb-6">
				<h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Insights Clustering Map</h2>
				<p className="text-gray-600 dark:text-gray-400">
					Visualization of {points.length} insights grouped into {clusters.filter(c => c !== -1).length} clusters using AI embeddings
				</p>
			</div>
			
			<div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
				<div className="h-[500px] w-full">
					<ResponsiveContainer width="100%" height="100%">
						<ScatterChart margin={{ top: 20, right: 20, bottom: 60, left: 60 }}>
							<CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" className="dark:stroke-gray-600" />
							<XAxis 
								dataKey="x" 
								type="number" 
								name="Dimension 1" 
								domain={["dataMin - 0.5", "dataMax + 0.5"]} 
								tick={{ fontSize: 12, fill: "#6B7280" }}
								label={{ value: "Dimension 1", position: "insideBottom", offset: -10, style: { textAnchor: "middle", fill: "#6B7280" } }}
							/>
							<YAxis 
								dataKey="y" 
								type="number" 
								name="Dimension 2" 
								domain={["dataMin - 0.5", "dataMax + 0.5"]} 
								tick={{ fontSize: 12, fill: "#6B7280" }}
								label={{ value: "Dimension 2", angle: -90, position: "insideLeft", style: { textAnchor: "middle", fill: "#6B7280" } }}
							/>
							<Tooltip 
								content={({ active, payload }) => {
									if (active && payload && payload.length) {
										const data = payload[0].payload
										return (
											<div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-3 shadow-lg">
												<p className="font-medium text-gray-900 dark:text-gray-100">{data.text}</p>
												<p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
													Cluster: {data.cluster === -1 ? "Noise" : data.cluster}
												</p>
											</div>
										)
									}
									return null
								}}
							/>
							{clusters.map((c) => (
								<Scatter 
									key={c} 
									data={bubbleData.filter((p) => p.cluster === c)} 
									name={c === -1 ? "Noise" : `Cluster ${c}`}
									fill={clusterColors[c === -1 ? clusterColors.length - 1 : c % (clusterColors.length - 1)]}
									shape="circle"
								>
									<LabelList 
										dataKey="label" 
										position="center" 
										style={{ 
											fill: "white", 
											fontSize: "12px", 
											fontWeight: "600",
											textAnchor: "middle",
											textShadow: "0 1px 2px rgba(0,0,0,0.5)",
											pointerEvents: "none"
										}} 
									/>
								</Scatter>
							))}
						</ScatterChart>
					</ResponsiveContainer>
				</div>
				
				{/* Legend */}
				<div className="mt-4 flex flex-wrap justify-center gap-4">
					{clusters.map((c) => (
						<div key={c} className="flex items-center gap-2">
							<div 
								className="h-3 w-3 rounded-full" 
								style={{ backgroundColor: clusterColors[c === -1 ? clusterColors.length - 1 : c % (clusterColors.length - 1)] }}
							/>
							<span className="text-sm text-gray-600 dark:text-gray-400">
								{c === -1 ? "Noise" : `Cluster ${c}`} ({points.filter(p => p.cluster === c).length})
							</span>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
