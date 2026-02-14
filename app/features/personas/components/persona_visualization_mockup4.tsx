import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
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
} from "recharts";

/**
 * Persona Visualization V2 — Radial Spectrum (Supabase‑ready + Demo fallback)
 * ---------------------------------------------------------------------------
 * This file exports:
 *  - default <PersonaSpectrumV2Demo/> (renders; uses Supabase if configured, else demo data)
 *  - <RadialSpectrumFromSupabase/> (wire to your DB)
 *  - <RadialSpectrumView/> (pure chart)
 *  - defaultMapperFromDifferentiators (optional mapping helper)
 *
 * Why this rewrite?
 *  - Fixes build error when env vars aren't available by avoiding direct, typed references to
 *    `import.meta.env.*` at module load. We now read env safely at runtime and provide a demo fallback.
 */

// ----------------------
// Types
// ----------------------
export type SpectrumPoint = { x: number; y: number; z?: number; label?: string };
export type PersonaPoints = Record<string, SpectrumPoint>; // axisName -> point
export type PersonaRow = {
	id: string;
	set_id: string;
	name_and_tagline: string;
	differentiators: string[];
	spectrum_positions?: PersonaPoints | null; // JSONB
};

export type DataSet = { name: string; color?: string; points: (SpectrumPoint & { personaId?: string })[] };

// ----------------------
// Safe env access (no hard dependency on bundler types)
// ----------------------
function readSupabaseEnv() {
	// const g: any = (typeof globalThis !== "undefined" ? (globalThis as any) : {});
	// const w: any = (typeof window !== "undefined" ? (window as any) : {});
	// const im: any = (typeof import !== "undefined" && typeof (import as any).meta !== "undefined" ? (import as any).meta : {});
	// const fromWindow = w?.ENV || {};
	// const fromGlobal = g?.ENV || {};
	// const fromImportMeta = im?.env || {};
	// const fromProcess = (typeof process !== "undefined" ? (process as any).env || {} : {});
	// const url = fromWindow.SUPABASE_URL || fromGlobal.SUPABASE_URL || fromImportMeta.VITE_SUPABASE_URL || fromProcess.VITE_SUPABASE_URL || fromProcess.SUPABASE_URL || undefined;
	// const anon = fromWindow.SUPABASE_ANON_KEY || fromGlobal.SUPABASE_ANON_KEY || fromImportMeta.VITE_SUPABASE_ANON_KEY || fromProcess.VITE_SUPABASE_ANON_KEY || fromProcess.SUPABASE_ANON_KEY || undefined;
	// return { url, anon } as { url?: string; anon?: string };
	return { url: "", anon: "" };
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
	title?: string;
	axisX?: string;
	axisY?: string;
	dataSets: DataSet[];
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
	);
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
	supabaseUrl,
	supabaseAnon,
}: {
	setId: string;
	axis?: string; // which spectrum to pull out of spectrum_positions
	axisXLabel?: string;
	axisYLabel?: string;
	bucketBy?: (p: PersonaRow) => string; // groups into datasets (e.g., Provisional vs Contrast)
	mapPersonaToPoints?: (p: PersonaRow, axis: string) => SpectrumPoint | null; // fallback mapping
	supabaseUrl?: string;
	supabaseAnon?: string;
}) {
	const [rows, setRows] = useState<PersonaRow[] | null>(null);
	const [err, setErr] = useState<string | null>(null);

	// Resolve env at runtime if not provided via props
	const env = useMemo(() => readSupabaseEnv(), []);
	const url = supabaseUrl ?? env.url;
	const anon = supabaseAnon ?? env.anon;

	useEffect(() => {
		if (!url || !anon) {
			setErr("Supabase env not configured — using demo in default export");
			return;
		}
		const sb = createClient(url, anon);
		(async () => {
			const { data, error } = await sb
				.from("personas")
				.select("id,set_id,name_and_tagline,differentiators,spectrum_positions")
				.eq("set_id", setId);
			if (error) setErr(error.message);
			else setRows((data || []) as PersonaRow[]);
		})();
	}, [setId, url, anon]);

	const dataSets: DataSet[] = useMemo(() => {
		if (!rows) return [];
		const byBucket = new Map<string, (SpectrumPoint & { personaId?: string })[]>();
		for (const p of rows) {
			const fromJson = (p.spectrum_positions || ({} as PersonaPoints))[axis] as SpectrumPoint | undefined;
			const pt = fromJson ?? mapPersonaToPoints?.(p, axis) ?? null;
			if (!pt) continue;
			const b = bucketBy(p);
			if (!byBucket.has(b)) byBucket.set(b, []);
			byBucket.get(b)?.push({ ...pt, z: pt.z ?? 80, personaId: p.id });
		}
		return Array.from(byBucket.entries()).map(([name, points], i) => ({
			name,
			color: i === 0 ? "#818cf8" : "#34d399",
			points,
		}));
	}, [rows, axis, mapPersonaToPoints, bucketBy]);

	if (err) return <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200">{err}</div>;
	if (!rows) return <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-zinc-400">Loading…</div>;

	return <RadialSpectrumView title={`Spectrum: ${axis}`} axisX={axisXLabel} axisY={axisYLabel} dataSets={dataSets} />;
}

// ----------------------
// Optional helper: compute spectrum point from differentiators
// ----------------------
export const defaultMapperFromDifferentiators = (p: PersonaRow, axis: string): SpectrumPoint | null => {
	// Naive mapping examples; replace with your domain logic
	const diffs = (p.differentiators || []).map((d) => d.toLowerCase());
	const has = (s: string) => diffs.some((d) => d.includes(s));

	if (axis.includes("Autonomy") && axis.includes("Guidance")) {
		const x = has("autonomy") || has("explore") ? 80 : has("structure") || has("guided") ? 20 : 50;
		const y = has("nudges") ? 30 : 70; // y as Nudge‑Sensitivity proxy
		return { x, y, z: 80, label: has("autonomy") ? "Autonomy" : has("guided") ? "Guidance" : "Neutral" };
	}
	if (axis.includes("Speed") && axis.includes("Depth")) {
		const x = has("fast") || has("speed") || has("sprint") ? 80 : has("depth") || has("mastery") ? 20 : 50;
		const y = has("planning") ? 60 : 40; // y as Planning tendency
		return { x, y, z: 80, label: has("depth") ? "Depth" : "Speed" };
	}
	return null;
};

// ----------------------
// Demo fallback (default export)
// ----------------------
const DEMO_DATA: DataSet[] = [
	{
		name: "Provisional",
		color: "#818cf8",
		points: [
			{ x: 22, y: 70, z: 90, label: "Structure" },
			{ x: 30, y: 65, z: 70, label: "Nudges" },
		],
	},
	{
		name: "Contrast",
		color: "#34d399",
		points: [
			{ x: 82, y: 35, z: 85, label: "Autonomy" },
			{ x: 70, y: 45, z: 60, label: "Exploration" },
		],
	},
];

export default function PersonaSpectrumV2Demo() {
	const [axis, setAxis] = useState("Autonomy ↔ Guidance");
	const [axisX, setAxisX] = useState("Autonomy → Guidance");
	const [axisY, setAxisY] = useState("Nudge‑Sensitivity");

	const env = readSupabaseEnv();
	const canUseSupabase = false; // Boolean(env.url && env.anon);

	return (
		<div className="space-y-3">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h2 className="font-semibold text-base text-zinc-100 tracking-tight">Radial Spectrum</h2>
					<p className="text-xs text-zinc-400">
						Visualize personas across two axes; colors = buckets (e.g., Provisional vs Contrast).
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<select
						className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200"
						value={axis}
						onChange={(e) => setAxis(e.target.value)}
					>
						<option>Autonomy ↔ Guidance</option>
						<option>Speed ↔ Depth</option>
					</select>
					<input
						className="w-44 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200"
						value={axisX}
						onChange={(e) => setAxisX(e.target.value)}
						placeholder="X Axis label"
					/>
					<input
						className="w-44 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200"
						value={axisY}
						onChange={(e) => setAxisY(e.target.value)}
						placeholder="Y Axis label"
					/>
				</div>
			</div>

			{!canUseSupabase && (
				<div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200 text-xs">
					Supabase env not detected. Showing demo data. To connect, expose SUPABASE_URL and SUPABASE_ANON_KEY via
					<code className="mx-1 rounded bg-zinc-900 px-1">window.ENV</code> or your bundler env, or pass props to
					<code className="mx-1 rounded bg-zinc-900 px-1">&lt;RadialSpectrumFromSupabase/&gt;</code>.
				</div>
			)}

			{canUseSupabase ? (
				<RadialSpectrumFromSupabase
					setId={"replace-with-your-persona-set-uuid"}
					axis={axis}
					axisXLabel={axisX}
					axisYLabel={axisY}
					mapPersonaToPoints={defaultMapperFromDifferentiators}
					supabaseUrl={env.url}
					supabaseAnon={env.anon}
				/>
			) : (
				<RadialSpectrumView title={`Spectrum: ${axis}`} axisX={axisX} axisY={axisY} dataSets={DEMO_DATA} />
			)}
		</div>
	);
}
