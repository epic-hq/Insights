import { createClient } from "@supabase/supabase-js"
import { useEffect, useMemo, useState } from "react"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
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

/**
 * Persona Visualization V2 — Radial Spectrum wired to Supabase (Remix-friendly)
 * ---------------------------------------------------------------------------
 * Usage (client-side route or component):
 * <RadialSpectrumFromSupabase setId={personaSetId} />
 *
 * Data expectations:
 * - Table `personas` has a JSONB column `spectrum_positions` shaped like:
 *   {
 *     "Autonomy ↔ Guidance": { "x": 20, "y": 80, "z": 50, "label": "Structure" },
 *     "Speed ↔ Depth": { "x": 70, "y": 30, "z": 40, "label": "Speed" }
 *   }
 * - If `spectrum_positions` is absent, you can supply a `mapPersonaToPoints` prop.
 */

export type DataSet = { name: string; color?: string; points: (SpectrumPoint & { personaId: string })[] }

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
		// Safe demo fallback when env/DB is not available in sandbox
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
// Base Radial Scatter Component (axis-agnostic)
// ----------------------
export function RadialSpectrumView({
	title = "Attribute Spectrum",
	axisX = "Dimension X",
	axisY = "Dimension Y",
	dataSets,
}: {
	title?: string
	axisX?: string
	axisY?: string
	dataSets: DataSet[]
}) {
	return (
		<div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
			<div className="mb-2 flex items-center gap-2 font-medium text-sm text-zinc-300">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					strokeWidth={1.5}
					stroke="currentColor"
					className="size-4"
				>
					<path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h6" />
				</svg>
				{title}
			</div>
			<div className="h-80 w-full">
				<ResponsiveContainer>
					<ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
						<CartesianGrid stroke="#27272a" />
						<XAxis type="number" dataKey="x" name={axisX} domain={[0, 100]} tick={{ fill: "#a1a1aa" }} />
						<YAxis type="number" dataKey="y" name={axisY} domain={[0, 100]} tick={{ fill: "#a1a1aa" }} />
						<ZAxis type="number" dataKey="z" range={[60, 320]} />
						<Tooltip
							cursor={{ strokeDasharray: "3 3" }}
							contentStyle={{ background: "#09090b", border: "1px solid #27272a" }}
						/>
						<Legend wrapperStyle={{ color: "#a1a1aa" }} />
						{dataSets.map((ds, idx) => (
							<Scatter
								key={ds.name}
								name={ds.name}
								data={ds.points}
								fill={ds.color ?? (idx === 0 ? "#818cf8" : "#34d399")}
							/>
						))}
					</ScatterChart>
				</ResponsiveContainer>
			</div>
		</div>
	)
}

// ----------------------
// Supabase-powered Container
// ----------------------
export function RadialSpectrumFromSupabase({
	setId,
	axis = "Autonomy ↔ Guidance",
	axisXLabel = "Dimension X",
	axisYLabel = "Dimension Y",
	bucketBy = (p: PersonaRow) =>
		p.name_and_tagline?.toLowerCase().includes("independent") ? "Contrast" : "Provisional",
	mapPersonaToPoints,
	supabaseUrl = (typeof window !== "undefined" ? (window as any).ENV?.SUPABASE_URL : undefined) ||
		import.meta.env.VITE_SUPABASE_URL,
	supabaseAnon = (typeof window !== "undefined" ? (window as any).ENV?.SUPABASE_ANON_KEY : undefined) ||
		import.meta.env.VITE_SUPABASE_ANON_KEY,
}: {
	setId: string
	axis?: string // which spectrum to pull out of spectrum_positions
	axisXLabel?: string
	axisYLabel?: string
	bucketBy?: (p: PersonaRow) => string // groups into datasets (e.g., Provisional vs Contrast)
	mapPersonaToPoints?: (p: PersonaRow, axis: string) => SpectrumPoint | null // fallback mapping
	supabaseUrl?: string
	supabaseAnon?: string
}) {
	const [rows, setRows] = useState<PersonaRow[] | null>(null)
	const [err, setErr] = useState<string | null>(null)

	useEffect(() => {
		if (!supabaseUrl || !supabaseAnon) {
			// For mockup2, we'll use demo data when env is not configured
			const demoRows: PersonaRow[] = [
				{
					id: "demo-1",
					name_and_tagline: "Alex — speed-first tinkerer",
					differentiators: ["autonomy", "exploration", "fast"],
					spectrum_positions: {
						[axis]: { x: 82, y: 38, z: 90, label: "Autonomy" }
					}
				},
				{
					id: "demo-2", 
					name_and_tagline: "Sam — guidance-seeking collaborator",
					differentiators: ["guidance", "collaboration", "thorough"],
					spectrum_positions: {
						[axis]: { x: 22, y: 78, z: 85, label: "Guidance" }
					}
				}
			]
			setRows(demoRows)
			return
		}
		const sb = createClient(supabaseUrl, supabaseAnon)
		;(async () => {
			const { data, error } = await sb
				.from("personas")
				.select("id,set_id,name_and_tagline,differentiators,spectrum_positions")
				.eq("set_id", setId)
			if (error) setErr(error.message)
			else setRows(data as PersonaRow[])
		})()
	}, [setId, supabaseUrl, supabaseAnon, axis])

	const dataSets: DataSet[] = useMemo(() => {
		if (!rows) return []
		const byBucket = new Map<string, (SpectrumPoint & { personaId: string })[]>()
		for (const p of rows) {
			const fromJson = p.spectrum_positions?.[axis] as SpectrumPoint | undefined
			const pt = fromJson ?? mapPersonaToPoints?.(p, axis) ?? null
			if (!pt) continue
			const b = bucketBy(p)
			if (!byBucket.has(b)) byBucket.set(b, [])
			byBucket.get(b)?.push({ ...pt, z: pt.z ?? 80, personaId: p.id })
		}
		return Array.from(byBucket.entries()).map(([name, points], i) => ({
			name,
			color: i === 0 ? "#818cf8" : "#34d399",
			points,
		}))
	}, [rows, axis, mapPersonaToPoints, bucketBy])

	if (err) return <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-rose-200">{err}</div>
	if (!rows) return <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-zinc-400">Loading…</div>

	return <RadialSpectrumView title={`Spectrum: ${axis}`} axisX={axisXLabel} axisY={axisYLabel} dataSets={dataSets} />
}

// ----------------------
// Optional helper: compute spectrum point from differentiators
// ----------------------
export const defaultMapperFromDifferentiators = (p: PersonaRow, axis: string): SpectrumPoint | null => {
	// Naive mapping examples; replace with your domain logic
	const diffs = (p.differentiators || []).map((d) => d.toLowerCase())
	const has = (s: string) => diffs.some((d) => d.includes(s))

	if (axis.includes("Autonomy") && axis.includes("Guidance")) {
		const x = has("autonomy") || has("explore") ? 80 : has("structure") || has("guided") ? 20 : 50
		const y = has("nudges") ? 30 : 70 // y as Nudge‑Sensitivity proxy
		return { x, y, z: 80, label: has("autonomy") ? "Autonomy" : has("guided") ? "Guidance" : "Neutral" }
	}
	if (axis.includes("Speed") && axis.includes("Depth")) {
		const x = has("fast") || has("speed") || has("sprint") ? 80 : has("depth") || has("mastery") ? 20 : 50
		const y = has("planning") ? 60 : 40 // y as Planning tendency
		return { x, y, z: 80, label: has("depth") ? "Depth" : "Speed" }
	}
	return null
}

// ----------------------
// Example usage (client)
// ----------------------
// <RadialSpectrumFromSupabase
//   setId={"your-persona-set-uuid"}
//   axis="Autonomy ↔ Guidance"
//   axisXLabel="Autonomy → Guidance"
//   axisYLabel="Nudge‑Sensitivity"
//   mapPersonaToPoints={defaultMapperFromDifferentiators}
// />
