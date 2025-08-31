import { motion } from "framer-motion"
import { ArrowDown } from "lucide-react"
import type React from "react"
import { useMemo } from "react"

/**
 * FlowDiagram
 * A compact, clean, and configurable vertical process map.
 *
 * NODES (default):
 * 1) Research Goals (with Questions answered %)
 * 2) Inputs (interviews, conversations, ...)
 * 3) Evidence Group { evidence, quotes, people }
 * 4) Personas & Themes Group { personas, themes }
 * 5) Insights
 * 6) Opportunities
 *
 * Each node supports a counter badge and an optional sublabel.
 * First node shows % answered as a radial progress.
 */

// ---------------------------
// Types
// ---------------------------
export type Countish = number | undefined | null

export interface FlowCounts {
	questionsTotal?: Countish
	questionsAnswered?: Countish
	inputs?: Countish // interviews/conversations/etc
	evidence?: Countish
	quotes?: Countish
	people?: Countish
	personas?: Countish
	themes?: Countish
	insights?: Countish
	opportunities?: Countish
}

export interface FlowLabels {
	researchGoals?: string // sublabel under Research Goals
	inputs?: string // sublabel under Inputs
	evidence?: string // sublabel under Evidence group
	personasThemes?: string // sublabel under Personas & Themes group
	insights?: string // sublabel under Insights
	opportunities?: string // sublabel under Opportunities
}

export interface FlowDiagramProps {
	counts?: FlowCounts
	labels?: FlowLabels
	compact?: boolean // tighter spacing
	onNodeClick?: (id: string) => void
	className?: string
}

// ---------------------------
// Helpers
// ---------------------------
function clsx(...xs: Array<string | false | undefined>) {
	return xs.filter(Boolean).join(" ")
}

function pct(a?: Countish, b?: Countish) {
	const ans = Number(a ?? 0)
	const tot = Number(b ?? 0)
	if (!tot || tot <= 0) return 0
	return Math.max(0, Math.min(100, Math.round((ans / tot) * 100)))
}

function Badge({ value }: { value?: Countish }) {
	if (value == null) return null
	return (
		<span className="-top-2 -right-2 absolute rounded-full bg-slate-900 px-2 py-1 font-semibold text-white text-xs shadow-sm">
			{value}
		</span>
	)
}

function NodeCard({
	id,
	title,
	count,
	sublabel,
	onClick,
	highlight = false,
	children,
}: {
	id: string
	title: string
	count?: Countish
	sublabel?: string
	onClick?: (id: string) => void
	highlight?: boolean
	children?: React.ReactNode
}) {
	return (
		<motion.div
			layout
			whileHover={{ y: -2 }}
			className={clsx(
				"relative min-w-[170px] rounded-2xl border bg-white p-4 shadow-sm",
				"flex flex-col items-center text-center",
				highlight ? "border-slate-800" : "border-slate-200"
			)}
			onClick={() => onClick?.(id)}
			role="button"
			tabIndex={0}
		>
			<Badge value={count} />
			<div className="font-semibold text-slate-800 text-sm tracking-wide">{title}</div>
			{children}
			{sublabel ? <div className="mt-2 max-w-[220px] text-slate-500 text-xs">{sublabel}</div> : null}
		</motion.div>
	)
}

function RadialPercent({ value }: { value: number }) {
	const r = 22
	const c = 2 * Math.PI * r
	const dash = (value / 100) * c
	const gap = c - dash
	return (
		<svg viewBox="0 0 60 60" width={60} height={60} className="mt-2">
			<circle cx={30} cy={30} r={r} fill="none" stroke="#e2e8f0" strokeWidth={8} />
			<circle
				cx={30}
				cy={30}
				r={r}
				fill="none"
				stroke="currentColor"
				strokeWidth={8}
				strokeLinecap="round"
				strokeDasharray={`${dash} ${gap}`}
				transform="rotate(-90 30 30)"
				className="text-slate-900"
			/>
			<text
				x={30}
				y={30}
				dominantBaseline="middle"
				textAnchor="middle"
				className="fill-slate-900 font-bold text-[12px]"
			>
				{value}%
			</text>
		</svg>
	)
}

function VerticalArrow() {
	return (
		<div className="my-2 flex items-center justify-center">
			<ArrowDown className="h-6 w-6 text-slate-400" />
		</div>
	)
}

// Group card with stacked mini-nodes
function GroupCard({
	id,
	title,
	items,
	sublabel,
	onClick,
}: {
	id: string
	title: string
	items: Array<{ id: string; label: string; count?: Countish }>
	sublabel?: string
	onClick?: (id: string) => void
}) {
	return (
		<div className="relative min-w-[220px] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
			<div className="text-center font-semibold text-slate-800 text-sm tracking-wide">{title}</div>
			<div className="mt-3 grid grid-cols-1 gap-2">
				{items.map((it) => (
					<button
						key={it.id}
						onClick={() => onClick?.(it.id)}
						className="relative rounded-xl border border-slate-200 px-3 py-2 text-left hover:border-slate-300 focus:outline-none"
					>
						{it.count != null && (
							<span className="-top-2 -right-2 absolute rounded-full bg-slate-900 px-1.5 py-0.5 font-semibold text-[10px] text-white shadow-sm">
								{it.count}
							</span>
						)}
						<div className="font-medium text-slate-700 text-xs">{it.label}</div>
					</button>
				))}
			</div>
			{sublabel ? <div className="mt-2 text-center text-slate-500 text-xs">{sublabel}</div> : null}
		</div>
	)
}

export function FlowDiagram({ counts, labels, compact = false, onNodeClick, className }: FlowDiagramProps) {
	const answeredPct = useMemo(
		() => pct(counts?.questionsAnswered, counts?.questionsTotal),
		[counts?.questionsAnswered, counts?.questionsTotal]
	)

	return (
		<div className={clsx("w-full overflow-y-auto", className)}>
			<div className={clsx("mx-auto flex flex-col items-center", compact ? "gap-2 p-2" : "gap-3 p-4")}>
				{/* 1. Research Goals */}
				<NodeCard
					id="research-goals"
					title="Research Goals"
					count={counts?.questionsTotal}
					sublabel={labels?.researchGoals ?? "Questions to answer (#, % answered)"}
					onClick={onNodeClick}
					highlight
				>
					<RadialPercent value={answeredPct} />
					<div className="mt-1 text-slate-600 text-xs">
						{counts?.questionsAnswered ?? 0}/{counts?.questionsTotal ?? 0} answered
					</div>
				</NodeCard>

				<VerticalArrow />

				{/* 2. Inputs */}
				<NodeCard
					id="inputs"
					title="Inputs"
					count={counts?.inputs}
					sublabel={labels?.inputs ?? "Interviews, conversations, surveys, docs"}
					onClick={onNodeClick}
				/>

				<VerticalArrow />

				{/* 3. Evidence Group */}
				<GroupCard
					id="evidence-group"
					title="Evidence"
					items={[
						{ id: "evidence", label: "Evidence", count: counts?.evidence },
						{ id: "quotes", label: "Quotes", count: counts?.quotes },
						{ id: "people", label: "People", count: counts?.people },
					]}
					sublabel={labels?.evidence}
					onClick={onNodeClick}
				/>

				<VerticalArrow />

				{/* 4. Personas & Themes */}
				<GroupCard
					id="personas-themes"
					title="Personas & Themes"
					items={[
						{ id: "personas", label: "Personas", count: counts?.personas },
						{ id: "themes", label: "Themes", count: counts?.themes },
					]}
					sublabel={labels?.personasThemes}
					onClick={onNodeClick}
				/>

				<VerticalArrow />

				{/* 5. Insights */}
				<NodeCard
					id="insights"
					title="Insights"
					count={counts?.insights}
					sublabel={labels?.insights}
					onClick={onNodeClick}
				/>

				<VerticalArrow />

				{/* 6. Opportunities */}
				<NodeCard
					id="opportunities"
					title="Opportunities"
					count={counts?.opportunities}
					sublabel={labels?.opportunities}
					onClick={onNodeClick}
				/>
			</div>
		</div>
	)
}

// ---------------------------
// Demo export (for Canvas preview)
// ---------------------------
export default function DemoFlowDiagram() {
	return (
		<div className="min-h-[60vh] w-full bg-slate-50 py-6">
			<div className="mx-auto max-w-7xl">
				<FlowDiagram
					counts={{
						questionsTotal: 24,
						questionsAnswered: 11,
						inputs: 36,
						evidence: 128,
						quotes: 73,
						people: 19,
						personas: 6,
						themes: 14,
						insights: 21,
						opportunities: 9,
					}}
					labels={{
						researchGoals: "Questions to answer (#, % answered)",
						inputs: "Interviews, conversations, surveys, docs",
						evidence: "Raw material organized & tagged",
						personasThemes: "Consolidate signals into patterns",
						insights: "What we now know & why it matters",
						opportunities: "Strategic bets & experiments",
					}}
					onNodeClick={(id) => alert(`Clicked: ${id}`)}
				/>
			</div>
		</div>
	)
}
