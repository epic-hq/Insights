import { useMemo, useState } from "react"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { useLoaderData } from "react-router"
import {
	CartesianGrid,
	Legend,
	ResponsiveContainer,
	Scatter,
	ScatterChart,
	Tooltip,
	XAxis,
	YAxis,
	ZAxis,
} from "recharts"
import { getServerClient } from "~/lib/supabase/server"

// ---------------------------------------------------------------------------
// Remix Route: /projects/:projectId/personas/spectrum
// - Server loader pulls personas (id, name_and_tagline, kind, differentiators, spectrum_positions)
// - Client renders an editable spectrum scatter: values are 0–100 scale (percentile-ish).
// - If Supabase env missing, uses demo data (no crash) and shows a banner.
// - Tooltips now show persona name, kind, x/y with units, and optional label.
// - Axis footers show left/right ends of the chosen spectrum for clarity.
// ---------------------------------------------------------------------------

export const meta: MetaFunction = () => [
	{ title: "Persona Spectrum | Insights" },
	{ name: "description", content: "Compare personas on configurable spectrums with clear labels." },
]

// ----------------------
// Types
// ----------------------
type SpectrumPoint = { x: number; y: number; z?: number; label?: string }
export type PersonaRow = {
	id: string
	name_and_tagline: string
	differentiators: string[] | null
	spectrum_positions: Record<string, SpectrumPoint> | null
	kind?: "provisional" | "contrast" | "core" | string | null
}

export async function loader({ request, params }: LoaderFunctionArgs) {
	const { client: supabase } = getServerClient(request)
	const projectId = params.projectId as string | undefined

	// If we have Supabase configured on server, pull real data.
	try {
		if (!projectId) throw new Error("Missing projectId route param")

		const { data, error } = await supabase
			.from("personas")
			.select("id,name_and_tagline,differentiators,spectrum_positions,kind")
			.eq("project_id", projectId)
			.order("created_at", { ascending: false })

		if (error) throw error

		return {
			personas: (data || []) as PersonaRow[],
			hasSupabase: true,
		}
	} catch (_e) {
		// Safe _eemo fallback when env/DB is not available in sandbox
		const demo: PersonaRow[] = [
			{
				id: "p1",
				name_and_tagline: "Alex — speed-first tinkerer",
				differentiators: ["autonomy", "exploration", "fast"],
				spectrum_positions: {
					"Autonomy ↔ Guidance": { x: 82, y: 38, z: 90, label: "Autonomy" },
					"Speed ↔ Depth": { x: 78, y: 42, z: 80, label: "Speed" },
				},
				kind: "contrast",
			},
			{
				id: "p2",
				name_and_tagline: "Jamie — structure-seeking optimizer",
				differentiators: ["structure", "nudges", "planning"],
				spectrum_positions: {
					"Autonomy ↔ Guidance": { x: 24, y: 68, z: 80, label: "Guidance" },
					"Speed ↔ Depth": { x: 28, y: 60, z: 70, label: "Depth" },
				},
				kind: "provisional",
			},
		]

		return { personas: demo, hasSupabase: false }
	}
}

// ----------------------
// Helpers
// ----------------------
function parseAxisSides(axis: string): [string, string] {
	const parts = axis.split("↔")
	if (parts.length === 2) return [parts[0].trim(), parts[1].trim()]
	const hy = axis.split("-")
	if (hy.length === 2) return [hy[0].trim(), hy[1].trim()]
	return ["Left", "Right"]
}

function bucketName(kind?: string | null) {
	const k = (kind || "").toLowerCase()
	if (k.includes("contrast")) return "Contrast"
	if (k.includes("provisional")) return "Provisional"
	if (k.includes("core")) return "Core"
	return "Other"
}

function colorForBucket(name: string) {
	const n = name.toLowerCase()
	if (n.includes("contrast")) return "#34d399" // emerald
	if (n.includes("provisional")) return "#818cf8" // indigo
	if (n.includes("core")) return "#94a3b8" // slate
	return "#a78bfa" // violet fallback
}

// Optional mapper when spectrum_positions[axis] is missing
function mapFromDifferentiators(p: PersonaRow, axis: string): SpectrumPoint | null {
	const diffs = (p.differentiators || []).map((d) => d.toLowerCase())
	const has = (s: string) => diffs.some((d) => d.includes(s))

	if (axis.includes("Autonomy") && axis.includes("Guidance")) {
		const x = has("autonomy") || has("explore") ? 80 : has("structure") || has("guided") ? 20 : 50
		const y = has("nudges") ? 30 : 70 // y ~ nudge sensitivity (lower = needs nudges)
		return { x, y, z: 80, label: has("autonomy") ? "Autonomy" : has("guided") ? "Guidance" : "Neutral" }
	}
	if (axis.includes("Speed") && axis.includes("Depth")) {
		const x = has("fast") || has("speed") || has("sprint") ? 80 : has("depth") || has("mastery") ? 20 : 50
		const y = has("planning") ? 60 : 40 // y ~ planning vs improvisation
		return { x, y, z: 80, label: has("depth") ? "Depth" : "Speed" }
	}
	return null
}

// ----------------------
// React Component
// ----------------------
export default function SpectrumRoute() {
	const { personas, hasSupabase } = useLoaderData<typeof loader>()

	const [spectrum, setSpectrum] = useState("Autonomy ↔ Guidance")
	const [xLabel, setXLabel] = useState("Autonomy → Guidance (0–100)")
	const [yLabel, setYLabel] = useState("Nudge‑Sensitivity (0–100)")
	const [left, right] = parseAxisSides(spectrum)

	// Build datasets for recharts
	const dataSets = useMemo(() => {
		const buckets = new Map<string, { name: string; color: string; points: any[] }>()

		for (const p of personas) {
			const pt = p.spectrum_positions?.[spectrum] || mapFromDifferentiators(p, spectrum)
			if (!pt) continue
			const bname = bucketName(p.kind)
			const bucket = buckets.get(bname) || { name: bname, color: colorForBucket(bname), points: [] }
			bucket.points.push({ ...pt, personaId: p.id, personaName: p.name_and_tagline })
			buckets.set(bname, bucket)
		}
		return Array.from(buckets.values())
	}, [personas, spectrum])

	return (
		<div className="mx-auto max-w-6xl p-6">
			<div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="font-semibold text-2xl text-zinc-100">Radial Spectrum</h1>
					<p className="text-xs text-zinc-400">
						Values are <b>0–100</b>. X locates a persona along{" "}
						<b>
							{left} → {right}
						</b>
						. Y is a second dimension (you choose the meaning).
					</p>
					{!hasSupabase && (
						<div className="mt-2 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
							Supabase not detected. Showing demo data from the loader fallback.
						</div>
					)}
				</div>
				<div className="flex flex-wrap items-end gap-2">
					<div className="flex flex-col">
						<label className="text-[10px] text-zinc-500">Spectrum</label>
						<select
							className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200"
							value={spectrum}
							onChange={(e) => setSpectrum(e.target.value)}
						>
							<option>Autonomy ↔ Guidance</option>
							<option>Speed ↔ Depth</option>
						</select>
					</div>
					<div className="flex flex-col">
						<label className="text-[10px] text-zinc-500">X Label</label>
						<input
							className="w-56 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200"
							value={xLabel}
							onChange={(e) => setXLabel(e.target.value)}
						/>
					</div>
					<div className="flex flex-col">
						<label className="text-[10px] text-zinc-500">Y Label</label>
						<input
							className="w-56 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200"
							value={yLabel}
							onChange={(e) => setYLabel(e.target.value)}
						/>
					</div>
				</div>
			</div>

			<div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
				<div className="mb-2 flex items-center justify-between font-medium text-sm text-zinc-300">
					<div>Spectrum: {spectrum}</div>
					<div className="flex items-center gap-3 text-xs text-zinc-400">
						<span className="inline-flex items-center gap-1">
							<span className="inline-block size-2 rounded-full bg-indigo-400" /> Provisional/Core
						</span>
						<span className="inline-flex items-center gap-1">
							<span className="inline-block size-2 rounded-full bg-emerald-400" /> Contrast
						</span>
					</div>
				</div>

				<div className="h-80 w-full">
					<ResponsiveContainer>
						<ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
							<CartesianGrid stroke="#27272a" />
							<XAxis
								type="number"
								dataKey="x"
								name={xLabel}
								domain={[0, 100]}
								tick={{ fill: "#a1a1aa" }}
								label={{ value: xLabel, position: "insideBottomRight", offset: -10, fill: "#a1a1aa" }}
							/>
							<YAxis
								type="number"
								dataKey="y"
								name={yLabel}
								domain={[0, 100]}
								tick={{ fill: "#a1a1aa" }}
								label={{ value: yLabel, angle: -90, position: "insideLeft", fill: "#a1a1aa" }}
							/>
							<ZAxis type="number" dataKey="z" range={[60, 320]} />
							<Tooltip
								cursor={{ strokeDasharray: "3 3" }}
								content={({ active, payload }) => {
									if (!active || !payload || !payload.length) return null
									const p: any = payload[0].payload
									return (
										<div className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200">
											<div className="font-medium">{p.personaName || "Unknown"}</div>
											<div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1">
												<span className="text-zinc-400">X ({xLabel}):</span>
												<span>{Math.round(p.x)}</span>
												<span className="text-zinc-400">Y ({yLabel}):</span>
												<span>{Math.round(p.y)}</span>
												{p.label && (
													<>
														<span className="text-zinc-400">Tag:</span>
														<span>{p.label}</span>
													</>
												)}
											</div>
										</div>
									)
								}}
							/>
							<Legend wrapperStyle={{ color: "#a1a1aa" }} />
							{dataSets.map((ds) => (
								<Scatter key={ds.name} name={ds.name} data={ds.points} fill={ds.color} />
							))}
						</ScatterChart>
					</ResponsiveContainer>
				</div>

				{/* Left/Right anchors under the chart for clarity */}
				<div className="pointer-events-none mt-1 flex items-center justify-between px-1 text-[11px] text-zinc-400">
					<span>{left}</span>
					<span>{right}</span>
				</div>
			</div>

			{/* Quick how-it-works */}
			<div className="mt-4 text-xs text-zinc-400">
				<p className="mb-1 font-semibold text-zinc-300">How are values assigned?</p>
				<ol className="list-decimal pl-5">
					<li>
						<b>Primary</b>: read <code>personas.spectrum_positions["{spectrum}"]</code> (JSONB → "x","y","z","label") on
						a 0–100 scale.
					</li>
					<li>
						<b>Fallback</b>: infer from <code>differentiators</code> (e.g., the word “autonomy” pushes X → 80;
						“structure” → 20).
					</li>
					<li>
						<b>Manual</b>: you can always write explicit numbers during review.
					</li>
				</ol>
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------
// DB Notes (DDL you can run once):
//   ALTER TABLE personas ADD COLUMN IF NOT EXISTS spectrum_positions jsonb DEFAULT '{}'::jsonb;
//   -- Example write:
//   -- UPDATE personas SET spectrum_positions = jsonb_set(COALESCE(spectrum_positions,'{}'::jsonb), '{Autonomy ↔ Guidance}', '{"x":82,"y":38,"z":90,"label":"Autonomy"}', true) WHERE id = '...';
// ---------------------------------------------------------------------------
