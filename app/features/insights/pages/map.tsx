// app/features/insights/pages/map.tsx
// -----------------------------------------------------------------------------
// Insights map visualization that:
//   1. Loads insight rows (id, name, embedding) that belong to the user
//   2. Sends them to the `cluster_insights` Supabase Edge Function
//   3. Receives [{ id, x, y, cluster, text }] back
//   4. Renders a Recharts scatter plot
// -----------------------------------------------------------------------------

import consola from "consola"
import { type LoaderFunctionArgs, useLoaderData } from "react-router-dom"
import { CartesianGrid, LabelList, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts"
import { getServerClient, getSession } from "~/lib/supabase/client.server"

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
	// TODO: delegate this to db function
	/* 1️⃣  get Supabase rows -------------------------------------------------- */
	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	// consola.info("JWT object from getClaims:", jwt)
	const accountId = jwt?.claims.sub

	// Get the user's session and access token
	const session = await getSession(request)
	const accessToken = session?.access_token

	if (!accountId) {
		throw new Response("Unauthorized", { status: 401 })
	}

	// Fetch insights with embeddings
	const { data: insights, error } = await supabase
		.from("themes")
		// .select("*")
		.select("id, pain, embedding")
		.eq("account_id", accountId)
		.not("embedding", "is", null)

	if (error) {
		consola.error("Error fetching insights:", error)
		throw new Response("Error fetching insights", { status: 500 })
	}

	if (!insights || insights.length === 0) {
		return { clusterData: [] }
	}

	/* 2️⃣  prepare data for edge function ------------------------------------ */
	const insightRows = insights
		.map((r) => {
			let embedding: number[]
			try {
				// Parse embedding from JSON string to array
				embedding = typeof r.embedding === "string" ? JSON.parse(r.embedding) : r.embedding
			} catch (err) {
				consola.error(`Failed to parse embedding for insight ${r.id}:`, err)
				return null
			}

			return {
				id: r.id,
				text: r.pain || "NA",
				embedding,
			}
		})
		.filter(Boolean) // Remove null entries

	if (insightRows.length === 0) {
		return { clusterData: [] }
	}

	/* 3️⃣  call edge function ------------------------------------------------ */
	const SUPABASE_URL = process.env.SUPABASE_URL
	const SUPABASE_FUNCTIONS_URL = process.env.SUPABASE_FUNCTIONS_URL || `${SUPABASE_URL}/functions/v1/`
	if (!accessToken) {
		throw new Response("Missing user access token", { status: 401 })
	}

	try {
		const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/cluster_insights`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify({ items: insightRows }),
		})

		if (!response.ok) {
			const errorText = await response.text()
			consola.error("Edge function error:", response.status, errorText)
			throw new Response(`Edge function error: ${response.status}`, { status: 500 })
		}

		const clusterData: ClusterPoint[] = await response.json()
		consola.info(`Successfully clustered ${clusterData.length} insights`)

		return { clusterData }
	} catch (err) {
		consola.error("Error calling cluster_insights edge function:", err)
		return { clusterData: [] }
	}
}

export default function InsightsMapPage() {
	const { clusterData } = useLoaderData<typeof loader>()

	// Debug: log the first few points to inspect available fields
	if (clusterData && clusterData.length > 0) {
		consola.info("Sample clusterData:", clusterData.slice(0, 3))
	}

	if (!clusterData || clusterData.length === 0) {
		return (
			<div className="p-8">
				<h1 className="mb-4 font-bold text-2xl">Insights Map</h1>
				<p className="text-gray-600">
					No insights with embeddings found. Upload some interviews to see the clustering visualization.
				</p>
			</div>
		)
	}

	// Color mapping for clusters
	const getClusterColor = (cluster: number) => {
		const colors = ["#8884d8", "#82ca9d", "#ffc658", "#ff7c7c", "#8dd1e1", "#d084d0"]
		return cluster === -1 ? "#999999" : colors[cluster % colors.length]
	}

	// Custom label renderer for dots
	const _renderDotLabel = (props: any) => {
		const { x, y, value } = props
		// value is the "text" field (pain) from ClusterPoint
		return (
			<text
				x={x}
				y={y - 10}
				textAnchor="middle"
				fontSize={12}
				fill="#222"
				style={{
					pointerEvents: "none",
					fontWeight: 500,
					textShadow: "0 1px 2px #fff, 0 0px 2px #fff",
				}}
			>
				{value.length > 24 ? `${value.slice(0, 24)}…` : value}
			</text>
		)
	}

	return (
		<div className="p-8">
			<h1 className="mb-4 font-bold text-2xl">Insights Map</h1>
			<p className="mb-6 text-gray-600">
				Visualization of {clusterData.length} insights clustered by semantic similarity
			</p>

			<div className="h-[700px] w-full">
				<ResponsiveContainer width="100%" height="100%">
					<ScatterChart data={clusterData} margin={{ top: 40, right: 40, bottom: 40, left: 40 }}>
						<CartesianGrid strokeDasharray="3 3" />
						<XAxis type="number" dataKey="x" name="X" hide tick={false} axisLine={false} />
						<YAxis type="number" dataKey="y" name="Y" hide tick={false} axisLine={false} />
						<Tooltip
							cursor={{ strokeDasharray: "3 3" }}
							content={({ active, payload }) => {
								if (active && payload && payload.length) {
									const data = payload[0].payload as ClusterPoint
									return (
										<div className="max-w-xs rounded border bg-white p-3 shadow-lg">
											<p className="mb-1 font-semibold">Cluster {data.cluster === -1 ? "Noise" : data.cluster}</p>
											<p className="mb-1 font-bold text-base text-gray-800">
												{data.text && data.text.length > 64 ? `${data.text.slice(0, 64)}…` : data.text}
											</p>
											<p className="text-gray-600 text-xs">Insight ID: {data.id}</p>
										</div>
									)
								}
								return null
							}}
						/>
						{clusterData.map((point, index) => (
							<Scatter
								key={`cluster-${point.cluster}-${index}`}
								data={[point]}
								fill={getClusterColor(point.cluster)}
								shape="circle"
							>
								{/* Add a label for each dot */}
								<LabelList
									dataKey="text"
									content={(props: any) => {
										const { x, y, value } = props
										return (
											<text
												x={x}
												y={y - 14}
												textAnchor="middle"
												fontSize={14}
												fill="#222"
												style={{
													pointerEvents: "none",
													fontWeight: 500,
													textShadow: "0 1px 2px #fff, 0 0px 2px #fff",
												}}
											>
												{value && value.length > 48 ? `${value.slice(0, 48)}…` : value}
											</text>
										)
									}}
								/>
							</Scatter>
						))}
					</ScatterChart>
				</ResponsiveContainer>
			</div>

			<div className="mt-4 text-gray-500 text-sm">
				<p>Each point represents an insight. Points are clustered by semantic similarity using AI embeddings.</p>
				<p>Hover over points to see the insight content.</p>
			</div>
		</div>
	)
}
