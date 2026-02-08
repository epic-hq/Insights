import { motion } from "framer-motion";
import { AlertTriangle, Bolt, Flag, GitMerge, Quote, Target, UserCheck } from "lucide-react";
import type React from "react";
import {
	Bar,
	BarChart,
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
} from "recharts";

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
};

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
};

const changeLog = [{ version: "v0.1", note: "Added provisional + contrast (single‑interview)." }];

// Radar dimensions represent behavioral axes
const radarDims = [
	{ key: "Structure", prov: 90, cont: 20 },
	{ key: "Autonomy", prov: 25, cont: 90 },
	{ key: "Nudge‑Sensitivity", prov: 85, cont: 15 },
	{ key: "Planning", prov: 40, cont: 60 },
	{ key: "Speed", prov: 80, cont: 55 },
	{ key: "Depth", prov: 35, cont: 90 },
];

const confidenceTimeline = [{ v: "v0.1", Provisional: 1, Contrast: 1 }];

// -----------------------------
// UI Helpers
// -----------------------------
const Badge: React.FC<{ children: React.ReactNode; tone?: string }> = ({ children, tone = "neutral" }) => {
	const map = {
		neutral: "bg-zinc-800 text-zinc-200",
		success: "bg-emerald-600/20 text-emerald-300 border border-emerald-500/30",
		danger: "bg-rose-600/20 text-rose-300 border border-rose-500/30",
		warning: "bg-amber-600/20 text-amber-200 border border-amber-500/30",
		brand: "bg-indigo-600/20 text-indigo-200 border border-indigo-500/30",
	};
	return <span className={`rounded-full px-2 py-1 text-xs ${map[tone]}`}>{children}</span>;
};

const Chip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
	<span className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-200">{children}</span>
);

// -----------------------------
// Components
// -----------------------------
function PersonaCard({ p }: { p: typeof provisional }) {
	const ring =
		p.confidence === "High"
			? "ring-emerald-400"
			: p.confidence === "Medium"
				? "ring-sky-400"
				: "ring-zinc-600 ring-dashed";

	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-5 ring-1 ring-zinc-900 ring-inset"
		>
			<div className="flex items-start gap-4">
				<div
					className={`size-12 shrink-0 rounded-xl ring-2 ${ring} grid place-items-center bg-gradient-to-br from-zinc-800 to-zinc-900`}
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
						<Badge tone="brand">Confidence: {p.confidence}</Badge>
						<Badge tone="neutral">Evidence: {p.evidence_count}</Badge>
					</div>
				</div>
			</div>

			<div className="mt-4 grid grid-cols-3 gap-4">
				<div>
					<div className="flex items-center gap-2 font-medium text-sm text-zinc-300">
						<Target className="size-4" /> Goals
					</div>
					<div className="mt-2 flex flex-wrap gap-1.5">
						{p.goals.slice(0, 3).map((g) => (
							<Chip key={g}>{g}</Chip>
						))}
					</div>
				</div>
				<div>
					<div className="flex items-center gap-2 font-medium text-sm text-zinc-300">
						<AlertTriangle className="size-4" /> Top Pains
					</div>
					<div className="mt-2 flex flex-wrap gap-1.5">
						{p.pains.slice(0, 3).map((x) => (
							<Chip key={x.label}>{x.label}</Chip>
						))}
					</div>
				</div>
				<div>
					<div className="flex items-center gap-2 font-medium text-sm text-zinc-300">
						<Bolt className="size-4" /> Differentiators
					</div>
					<div className="mt-2 flex flex-wrap gap-1.5">
						{p.differentiators.slice(0, 3).map((d) => (
							<Chip key={d}>{d}</Chip>
						))}
					</div>
				</div>
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
	);
}

function SpectrumStrip({
	axis,
	leftLabel,
	rightLabel,
	provisionalValue,
	contrastValue,
}: {
	axis: string;
	leftLabel: string;
	rightLabel: string;
	provisionalValue: number; // 0..100
	contrastValue: number; // 0..100
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
	);
}

function PainBar({ data }: { data: { label: string; count: number }[] }) {
	return (
		<div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
			<div className="mb-2 flex items-center gap-2 font-medium text-sm text-zinc-300">
				<AlertTriangle className="size-4" /> Pain Priority (mentions)
			</div>
			<div className="h-56">
				<ResponsiveContainer width="100%" height="100%">
					<BarChart data={data} margin={{ left: 8, right: 8 }}>
						<CartesianGrid stroke="#27272a" vertical={false} />
						<XAxis
							dataKey="label"
							tick={{ fill: "#a1a1aa", fontSize: 12 }}
							interval={0}
							angle={-15}
							textAnchor="end"
							height={50}
						/>
						<YAxis tick={{ fill: "#a1a1aa", fontSize: 12 }} />
						<Tooltip
							contentStyle={{ background: "#09090b", border: "1px solid #27272a" }}
							labelStyle={{ color: "#e4e4e7" }}
						/>
						<Bar dataKey="count" fill="#f87171" radius={[6, 6, 0, 0]} />
					</BarChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
}

function DifferentiatorRadar() {
	const data = radarDims.map((d) => ({
		subject: d.key,
		Provisional: d.prov,
		Contrast: d.cont,
	}));
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
	);
}

function ConfidenceTimelineChart() {
	const mapVal = (v: number) => ({ 1: "Low", 2: "Medium", 3: "High" })[v];
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
	);
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
	);
}

// -----------------------------
// Page
// -----------------------------
export default function PersonasShowcase() {
	const [left, right] = [provisional, contrast];
	const [leftPole, rightPole] = ["Autonomy", "Guidance"];

	return (
		<div className="min-h-dvh bg-[#0b0b0c] text-zinc-100">
			<div className="mx-auto max-w-7xl px-6 py-10">
				<header className="mb-6">
					<motion.h1
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						className="font-semibold text-2xl tracking-tight"
					>
						Personas — Decision View
					</motion.h1>
					<p className="mt-1 text-sm text-zinc-400">
						Start with the contrast you’re testing next. Keep it lean, evidence‑backed, and actionable.
					</p>
				</header>

				{/* Top: Two persona cards */}
				<div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-2">
					<PersonaCard p={left} />
					<PersonaCard p={right} />
				</div>

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
					<PainBar data={left.pains} />
					<DifferentiatorRadar />
					<ConfidenceTimelineChart />
				</div>

				{/* Change log */}
				<ChangeLogPanel />
			</div>
		</div>
	);
}
