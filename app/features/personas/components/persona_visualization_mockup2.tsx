import { motion } from "framer-motion"
import { AlertTriangle, Bolt, Flag, GitMerge, Quote, Target, UserCheck } from "lucide-react"
import React from "react"
import type { LoaderFunctionArgs } from "react-router"
import { useLoaderData } from "react-router"
import {
	CartesianGrid,
	Legend,
	Line,
	LineChart,
	PolarAngleAxis,
	PolarGrid,
	PolarRadiusAxis,
	Radar,
	ResponsiveContainer,
	RadarChart as RRadarChart,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts"
import PersonaStrategicPanel, { PersonaStrategicPanelMockData } from "~/features/personas/components/PersonaStrategicPanel"
import { getServerClient } from "~/lib/supabase/server"
import type { Persona } from "~/types"
import PersonaCompareBoard from "./PersonaCompareBoard"
import { defaultMapperFromDifferentiators, RadialSpectrumFromSupabase } from "./persona_visualization_mockup3"

const MOCKDATA = true

export async function loader({ request, params }: LoaderFunctionArgs) {
	const { client: supabase } = getServerClient(request)
	const projectId = params.projectId as string | undefined

	// If we have Supabase configured on server, pull real data.
	try {
		if (!projectId) throw new Error("Missing projectId route param")

		// MOCKDATA
		if (MOCKDATA) {
			return {
				projectId,
				personaId: "Mock Persona ID",
				persona: {
					name: "John Doe",
					role: "Core Persona",
					kind: "core",
					tags: ["tag1", "tag2"],
					strengths: ["Woo", "Learns fast", "Likes to tinker"],
					mbti: "MBTI",
					enneagram: "Enneagram",
					temperament: "Temperament",
					behavior_patterns: ["pattern1", "pattern2"],
					emotional_profile: ["profile1", "profile2"],
					effective_strategies: ["strategy1", "strategy2"],
					recommended_questions: ["question1", "question2"],
					common_pitfalls: ["pitfall1", "pitfall2"],
					coaching_prompts: ["prompt1", "prompt2"],
					evidence: ["evidence1", "evidence2"],
					learning_loop: {
						last_tactics: ["tactic1", "tactic2"],
						notes: "Notes",
					},
				},
			}
		}

		const { data, error } = await supabase
			.from("personas")
			.select("id,name_and_tagline,differentiators,spectrum_positions,kind")
			.eq("project_id", projectId)
			.order("created_at", { ascending: false })

		if (error) throw error

		return {
			personas: (data || []) as Persona[],
			hasSupabase: true,
		}
	} catch (_e) {
		// Safe demo fallback when env/DB is not available in sandbox
		const demo: Persona[] = [
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

// -----------------------------
// Sample Data (replace from API)
// -----------------------------
const provisional = {
	name: "The Guided Sprinter",
	tagline: "Fast with scaffolding",
	role: "Student balancing class with variable work shifts",
	goals: ["Finish faster", "Reduce stress", "Avoid rework"],
	pains: [
		{ label: "Onboarding too long", count: 4 },
		{ label: "Overwhelmed by long videos", count: 5 },
		{ label: "Unclear next steps", count: 3 },
		{ label: "Poor reminders", count: 2 },
		{ label: "Too many clicks", count: 2 },
	],
	triggers: ["Deadlines", "Peer proof"],
	behaviors: ["Uses short guided steps", "Acts near deadlines", "Responds to nudges"],
	differentiators: ["Needs structure", "Acts under pressure", "Seeks nudges"],
	success: "Submits a day early with low anxiety",
	quotes: ["I just need quick steps before practice."],
	confidence: "Low",
	evidence_count: 1,
	spectrum_value: 22, // 0=Autonomy, 100=Guidance
}

const contrast = {
	name: "The Independent Explorer",
	tagline: "Finds own path",
	role: "Self-directed learner with flexible schedule",
	goals: ["Discover deeply", "Own the process", "Minimize prompts"],
	pains: [
		{ label: "Forced wizards", count: 2 },
		{ label: "Locked flows", count: 2 },
	],
	triggers: ["Curiosity", "Personal standards"],
	behaviors: ["Skips onboarding", "Explores UI", "Dismisses nudges"],
	differentiators: ["Seeks autonomy", "Explores deeply", "Ignores nudges"],
	success: "Finds optimal path without handholding",
	quotes: [],
	confidence: "Low",
	evidence_count: 1,
	spectrum_value: 82,
}

const changeLog = [{ version: "v0.1", note: "Added provisional + contrast (single‑interview)." }]

// Radar dimensions represent behavioral axes
const radarDims = [
	{ key: "Structure", prov: 90, cont: 20 },
	{ key: "Autonomy", prov: 25, cont: 90 },
	{ key: "Nudge‑Sensitivity", prov: 85, cont: 15 },
	{ key: "Planning", prov: 40, cont: 60 },
	{ key: "Speed", prov: 80, cont: 55 },
	{ key: "Depth", prov: 35, cont: 90 },
]

const confidenceTimeline = [{ v: "v0.1", Provisional: 1, Contrast: 1 }]

// -----------------------------
// UI Helpers
// -----------------------------
const Badge: React.FC<{
	children: React.ReactNode
	tone?: "neutral" | "success" | "danger" | "warning" | "brand"
}> = ({ children, tone = "neutral" }) => {
	const map = {
		neutral: "bg-zinc-800 text-zinc-200",
		success: "bg-emerald-600/20 text-emerald-300 border border-emerald-500/30",
		danger: "bg-rose-600/20 text-rose-300 border border-rose-500/30",
		warning: "bg-amber-600/20 text-amber-200 border border-amber-500/30",
		brand: "bg-indigo-600/20 text-indigo-200 border border-indigo-500/30",
	} as const
	return <span className={`rounded-full px-2 py-1 text-xs ${map[tone]}`}>{children}</span>
}

const _Chip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
	<span className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-200">{children}</span>
)

// -----------------------------
// Components
// -----------------------------

// Matrix view for quick comparisons; stacks on mobile
function PersonaCompareMatrix({
	personas,
	highlight,
	onHighlight,
}: {
	personas: (typeof provisional)[]
	highlight: string | null
	onHighlight: (k: string | null) => void
}) {
	// columns = personas; rows = attributes (Goals, Top Pains, Differentiators)
	const rows: { title: string; getter: (p: typeof provisional) => string[] }[] = [
		{ title: "Goals", getter: (p) => p.goals },
		{ title: "Top Pains", getter: (p) => p.pains.map((x) => x.label) },
		{ title: "Differentiators", getter: (p) => p.differentiators },
	]
	return (
		<div className="overflow-hidden rounded-2xl border border-zinc-800">
			<div className="grid grid-cols-1 sm:grid-cols-[180px_repeat(2,minmax(0,1fr))]">
				{/* header row */}
				<div className="hidden items-center bg-zinc-950 px-3 py-3 text-sm text-zinc-400 sm:flex">Attribute</div>
				{personas.map((p, i) => (
					<div
						key={`h-${i}`}
						className={`bg-zinc-950 px-3 py-3 font-medium text-sm ${i === 1 ? "text-emerald-300" : "text-indigo-300"}`}
					>
						{p.name}
					</div>
				))}
				{rows.map((r) => (
					<React.Fragment key={r.title}>
						<div className="hidden bg-zinc-950/80 px-3 py-2 font-medium text-xs text-zinc-400 sm:block">{r.title}</div>
						{personas.map((p, i) => (
							<div key={`${r.title}-${i}`} className="bg-zinc-950/40 px-3 py-2">
								<div className="flex flex-wrap gap-1.5">
									{r
										.getter(p)
										.slice(0, 8)
										.map((item) => {
											const active = highlight === item
											return (
												<button
													key={item}
													onClick={() => onHighlight(item)}
													onMouseEnter={() => onHighlight(item)}
													onMouseLeave={() => onHighlight(null)}
													className={`rounded-md px-2 py-1 text-xs transition ${
														active
															? "border border-indigo-400/30 bg-indigo-500/20 text-indigo-200"
															: i === 1
																? "border border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
																: "bg-zinc-800 text-zinc-200"
													}`}
												>
													{item}
												</button>
											)
										})}
								</div>
							</div>
						))}
					</React.Fragment>
				))}
			</div>
		</div>
	)
}

function PersonaCardEnhanced({
	p,
	variant,
	highlight,
	onHighlight,
}: {
	p: typeof provisional
	variant: "provisional" | "contrast"
	highlight: string | null
	onHighlight: (k: string | null) => void
}) {
	const ring =
		p.confidence === "High"
			? "ring-emerald-400"
			: p.confidence === "Medium"
				? "ring-sky-400"
				: "ring-zinc-600 ring-dashed"

	const isContrast = variant === "contrast"

	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			className={`relative overflow-hidden rounded-2xl border bg-zinc-950 p-5 ring-1 ring-inset ${
				isContrast ? "border-emerald-700/40 ring-emerald-900/40" : "border-zinc-800 ring-zinc-900"
			}`}
		>
			{/* Ribbon */}
			<div
				className={`absolute top-0 right-0 m-3 rounded-md px-2 py-1 text-[11px] tracking-wide ${
					isContrast
						? "border border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
						: "border border-indigo-400/30 bg-indigo-500/15 text-indigo-200"
				}`}
			>
				{isContrast ? "CONTRAST" : "PROVISIONAL"}
			</div>

			<div className="flex items-start gap-4">
				<div
					className={`grid size-12 shrink-0 place-items-center rounded-xl ring-2 ${ring} bg-gradient-to-br from-zinc-800 to-zinc-900 ${
						isContrast ? "ring-emerald-400/60" : ""
					}`}
				>
					<UserCheck className="size-6 text-zinc-200" />
				</div>
				<div className="flex-1">
					<h3 className="font-semibold text-lg text-zinc-100 tracking-tight">
						{p.name}
						<span className="font-normal text-zinc-400"> — “{p.tagline}”</span>
					</h3>
					<p className="mt-1 text-sm text-zinc-400">{p.role}</p>
					<div className="mt-3 flex items-center gap-2">
						<Badge tone={isContrast ? "success" : "brand"}>Confidence: {p.confidence}</Badge>
						<Badge tone="neutral">Evidence: {p.evidence_count}</Badge>
					</div>
				</div>
			</div>

			<div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
				<AttrGroup
					icon={<Target className="size-4" />}
					title="Goals"
					items={p.goals}
					highlight={highlight}
					onHighlight={onHighlight}
				/>
				<AttrGroup
					icon={<AlertTriangle className="size-4" />}
					title="Top Pains"
					items={p.pains.map((x) => x.label)}
					highlight={highlight}
					onHighlight={onHighlight}
				/>
				<AttrGroup
					icon={<Bolt className="size-4" />}
					title="Differentiators"
					items={p.differentiators}
					highlight={highlight}
					onHighlight={onHighlight}
				/>
			</div>

			{p.quotes.length > 0 && (
				<div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
					<div className="flex items-center gap-2 font-medium text-sm text-zinc-300">
						<Quote className="size-4" /> Quote
					</div>
					<p className="mt-1 text-sm text-zinc-300">“{p.quotes[0]}”</p>
				</div>
			)}
		</motion.div>
	)
}

function AttrGroup({
	icon,
	title,
	items,
	highlight,
	onHighlight,
}: {
	icon: React.ReactNode
	title: string
	items: string[]
	highlight: string | null
	onHighlight: (k: string | null) => void
}) {
	return (
		<div>
			<div className="flex items-center gap-2 font-medium text-sm text-zinc-300">
				{icon} {title}
			</div>
			<div className="mt-2 flex flex-wrap gap-1.5">
				{items.slice(0, 6).map((g) => {
					const active = highlight === g
					return (
						<button
							key={g}
							onClick={() => onHighlight(g)}
							onMouseEnter={() => onHighlight(g)}
							onMouseLeave={() => onHighlight(null)}
							className={`rounded-md px-2 py-1 text-xs transition ${
								active
									? "border border-indigo-400/30 bg-indigo-500/20 text-indigo-200"
									: "bg-zinc-800 text-zinc-200 hover:bg-zinc-800/80"
							}`}
						>
							{g}
						</button>
					)
				})}
			</div>
		</div>
	)
}

function SpectrumStrip({
	axis,
	leftLabel,
	rightLabel,
	provisionalValue,
	contrastValue,
}: {
	axis: string
	leftLabel: string
	rightLabel: string
	provisionalValue: number // 0..100
	contrastValue: number // 0..100
}) {
	return (
		<div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
			<div className="flex items-center justify-between text-sm text-zinc-300">
				<span>{leftLabel}</span>
				<span className="text-zinc-500">{axis}</span>
				<span>{rightLabel}</span>
			</div>
			<div className="relative mt-3 h-3 rounded-full bg-gradient-to-r from-zinc-800 to-zinc-700">
				<div
					className="-top-2 absolute grid size-7 place-items-center rounded-full border border-indigo-400/40 bg-indigo-500/20 backdrop-blur"
					style={{ left: `calc(${provisionalValue}% - 0.875rem)` }}
					title="Provisional"
				>
					<span className="h-2 w-2 rounded-full bg-indigo-400" />
				</div>
				<div
					className="-top-2 absolute grid size-7 place-items-center rounded-full border border-emerald-400/40 bg-emerald-500/20 backdrop-blur"
					style={{ left: `calc(${contrastValue}% - 0.875rem)` }}
					title="Contrast"
				>
					<span className="h-2 w-2 rounded-full bg-emerald-400" />
				</div>
			</div>
			<div className="mt-2 flex items-center gap-3 text-xs text-zinc-400">
				<span className="inline-flex items-center gap-1">
					<span className="inline-block size-2 rounded-full bg-indigo-400" /> Provisional
				</span>
				<span className="inline-flex items-center gap-1">
					<span className="inline-block size-2 rounded-full bg-emerald-400" /> Contrast
				</span>
			</div>
		</div>
	)
}

// Alternate to diagonal labels: dot plot (better on mobile)
function PainDotPlot({
	dataLeft,
	dataRight,
	highlight,
	onHighlight,
}: {
	dataLeft: { label: string; count: number }[]
	dataRight: { label: string; count: number }[]
	highlight: string | null
	onHighlight: (k: string | null) => void
}) {
	// unify labels
	const labels = Array.from(new Set([...dataLeft.map((d) => d.label), ...dataRight.map((d) => d.label)]))
	const rows = labels.map((label) => ({
		label,
		left: dataLeft.find((d) => d.label === label)?.count ?? 0,
		right: dataRight.find((d) => d.label === label)?.count ?? 0,
	}))

	return (
		<div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
			<div className="mb-2 flex items-center gap-2 font-medium text-sm text-zinc-300">
				<AlertTriangle className="size-4" /> Pain Priority (Provisional vs Contrast)
			</div>
			<div className="max-h-72 overflow-auto pr-2">
				<ul className="divide-y divide-zinc-800">
					{rows.map((r) => {
						const active = highlight === r.label
						return (
							<li key={r.label} className={`flex items-center gap-3 py-2 ${active ? "bg-indigo-500/5" : ""}`}>
								<button
									onClick={() => onHighlight(r.label)}
									onMouseEnter={() => onHighlight(r.label)}
									onMouseLeave={() => onHighlight(null)}
									className={`shrink-0 rounded-md px-2 py-1 text-xs ${
										active
											? "border border-indigo-400/30 bg-indigo-500/20 text-indigo-200"
											: "bg-zinc-800 text-zinc-200"
									}`}
								>
									{r.label}
								</button>
								<div className="relative ml-auto h-2 w-full max-w-[260px] rounded-full bg-zinc-800">
									{/* left dot */}
									<span
										className="-top-1 -translate-x-1/2 absolute h-4 w-4 rounded-full border border-indigo-400/40 bg-indigo-500/30"
										style={{ left: `${Math.min(r.left, 10) * 10}%` }}
										title={`Provisional: ${r.left}`}
									/>
									{/* right dot */}
									<span
										className="-top-1 -translate-x-1/2 absolute h-4 w-4 rounded-full border border-emerald-400/40 bg-emerald-500/30"
										style={{ left: `${Math.min(r.right, 10) * 10}%` }}
										title={`Contrast: ${r.right}`}
									/>
								</div>
								<div className="w-16 text-right text-xs text-zinc-400">
									{r.left}/{r.right}
								</div>
							</li>
						)
					})}
				</ul>
			</div>
			<div className="mt-2 flex items-center gap-3 text-xs text-zinc-400">
				<span className="inline-flex items-center gap-1">
					<span className="inline-block size-2 rounded-full bg-indigo-400" /> Provisional
				</span>
				<span className="inline-flex items-center gap-1">
					<span className="inline-block size-2 rounded-full bg-emerald-400" /> Contrast
				</span>
			</div>
		</div>
	)
}

function DifferentiatorRadar() {
	const data = radarDims.map((d) => ({ subject: d.key, Provisional: d.prov, Contrast: d.cont }))
	return (
		<div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
			<div className="mb-2 flex items-center gap-2 font-medium text-sm text-zinc-300">
				<Bolt className="size-4" /> Differentiator Shape
			</div>
			<div className="h-64">
				<ResponsiveContainer width="100%" height="100%">
					<RRadarChart data={data} outerRadius={90}>
						<PolarGrid stroke="#27272a" />
						<PolarAngleAxis dataKey="subject" tick={{ fill: "#a1a1aa", fontSize: 12 }} />
						<PolarRadiusAxis angle={30} stroke="#27272a" tick={{ fill: "#a1a1aa", fontSize: 10 }} />
						<Radar name="Provisional" dataKey="Provisional" stroke="#818cf8" fill="#818cf8" fillOpacity={0.35} />
						<Radar name="Contrast" dataKey="Contrast" stroke="#34d399" fill="#34d399" fillOpacity={0.25} />
						<Legend wrapperStyle={{ color: "#a1a1aa" }} />
					</RRadarChart>
				</ResponsiveContainer>
			</div>
		</div>
	)
}

function _ConfidenceTimelineChart() {
	const mapVal = (v: number) => ({ 1: "Low", 2: "Medium", 3: "High" })[v]
	return (
		<div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
			<div className="mb-2 flex items-center gap-2 font-medium text-sm text-zinc-300">
				<Flag className="size-4" /> Confidence Over Time
			</div>
			<div className="h-48">
				<ResponsiveContainer width="100%" height="100%">
					<LineChart data={confidenceTimeline} margin={{ left: 8, right: 8 }}>
						<CartesianGrid stroke="#27272a" />
						<XAxis dataKey="v" tick={{ fill: "#a1a1aa" }} />
						<YAxis tick={{ fill: "#a1a1aa" }} domain={[1, 3]} ticks={[1, 2, 3]} />
						<Tooltip
							formatter={(val: any) => mapVal(Number(val))}
							contentStyle={{ background: "#09090b", border: "1px solid #27272a" }}
							labelStyle={{ color: "#e4e4e7" }}
						/>
						<Line type="monotone" dataKey="Provisional" stroke="#818cf8" strokeWidth={2} dot />
						<Line type="monotone" dataKey="Contrast" stroke="#34d399" strokeWidth={2} dot />
					</LineChart>
				</ResponsiveContainer>
			</div>
		</div>
	)
}

function ChangeLogPanel() {
	return (
		<div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
			<div className="mb-2 flex items-center gap-2 font-medium text-sm text-zinc-300">
				<GitMerge className="size-4" /> Change Log
			</div>
			<ul className="space-y-2">
				{changeLog.map((c) => (
					<li key={c.version} className="flex items-center gap-2 text-sm text-zinc-300">
						<Badge tone="brand">{c.version}</Badge>
						<span>{c.note}</span>
					</li>
				))}
			</ul>
		</div>
	)
}

// -----------------------------
// Page
// -----------------------------
export default function PersonasShowcase() {
	const loaderData = useLoaderData<typeof loader>()
	const { personas: dbPersonas } = loaderData

	// Use demo data for display, but we'll use the project context for RadialSpectrumFromSupabase
	const [left, right] = [provisional, contrast]
	const [leftPole, rightPole] = ["Autonomy", "Guidance"]

	// Extract project ID from the first persona if available
	const projectId = dbPersonas.length > 0 ? dbPersonas[0].project_id : null

	// highlight state for cross‑component attribute hover/click
	const [highlight, setHighlight] = React.useState<string | null>(null)
	const toggleHighlight = (key: string | null) => setHighlight((prev) => (prev === key ? null : key))

	// view mode: "cards" | "matrix"
	const [view, setView] = React.useState<"cards" | "matrix">("cards")

	return (
		<div className="min-h-dvh bg-[#0b0b0c] text-zinc-100">
			<div className="font-semibold text-3xl text-zinc-400">WIP: Personas</div>
			<div className="mx-auto max-w-7xl px-6 py-10">
				<header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<motion.h1
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							className="font-semibold text-2xl tracking-tight"
						>
							Personas — Decision View
						</motion.h1>
						<p className="mt-1 text-sm text-zinc-400">
							Start with contrast you’re testing next. Click/hover attributes to highlight matches & opposites.
						</p>
					</div>
					<div className="flex items-center gap-2">
						<button
							onClick={() => setView("cards")}
							className={`rounded-md border px-3 py-1.5 text-sm ${
								view === "cards"
									? "border-indigo-500/40 bg-indigo-500/10 text-indigo-200"
									: "border-zinc-700 bg-zinc-900 text-zinc-300"
							}`}
						>
							Card View
						</button>
						<button
							onClick={() => setView("matrix")}
							className={`rounded-md border px-3 py-1.5 text-sm ${
								view === "matrix"
									? "border-indigo-500/40 bg-indigo-500/10 text-indigo-200"
									: "border-zinc-700 bg-zinc-900 text-zinc-300"
							}`}
						>
							Matrix View
						</button>
					</div>
				</header>
				{/* Top: Persona Headers with stronger Contrast styling */}
				{view === "cards" ? (
					<div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-2">
						<PersonaCardEnhanced p={left} variant="provisional" highlight={highlight} onHighlight={toggleHighlight} />
						<PersonaCardEnhanced p={right} variant="contrast" highlight={highlight} onHighlight={toggleHighlight} />
					</div>
				) : (
					<div className="mb-6">
						<PersonaCompareMatrix personas={[left, right]} highlight={highlight} onHighlight={toggleHighlight} />
					</div>
				)}
				{/* Spectrum strip */}
				<div className="mb-5">
					<SpectrumStrip
						axis="Autonomy ↔ Guidance"
						leftLabel={leftPole}
						rightLabel={rightPole}
						provisionalValue={left.spectrum_value}
						contrastValue={right.spectrum_value}
					/>
				</div>
				{/* Charts */}
				<div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
					<PainDotPlot
						dataLeft={left.pains}
						dataRight={right.pains}
						highlight={highlight}
						onHighlight={toggleHighlight}
					/>
					<DifferentiatorRadar />
					{/* <ConfidenceTimelineChart /> */}
				</div>
				<RadialSpectrumFromSupabase
					setId={projectId || "your-persona-set-uuid"}
					axis="Autonomy ↔ Guidance"
					axisXLabel="Autonomy → Guidance"
					axisYLabel="Nudge‑Sensitivity"
					mapPersonaToPoints={defaultMapperFromDifferentiators}
				/>
				<div className="2xl py-2 font-semibold">Persona Compare Board</div>
				<PersonaCompareBoard personas={[left, right]} />
				{/* Change log */}
				<ChangeLogPanel />
				{/* Persona detail - getting more strategic */}
				<div className="2xl py-2 font-semibold">STRATEGIC PERSONA DETAIL</div>
				<PersonaStrategicPanel {...PersonaStrategicPanelMockData} />
			</div>
		</div>
	)
}
