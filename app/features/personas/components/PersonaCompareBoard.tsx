import clsx from "clsx"
import { BadgeInfo, Contrast, Dot, GitMerge, Users } from "lucide-react"
import React, { useCallback, useState } from "react"

/** ========== Types ==========
 * Spectrum values are normalized 0..1 (estimated or measured).
 * You can map to labels like "Autonomy → Guidance" using axis metadata.
 */

export type Persona = {
	id: string
	name: string
	kind: "core" | "provisional" | "contrast"
	avatarUrl?: string
	color?: string // optional accent
	tags?: string[]
	// Content buckets (displayed via field selector)
	goals?: string[]
	pains?: string[]
	differentiators?: string[]
	behaviors?: string[]
	roles?: string[]
	// 1D spectra (strip views): key is spectrum id, value is 0..1
	spectra1d?: Record<string, number>
	// 2D positions (scatter): value is { x:0..1, y:0..1 }
	spectra2d?: Record<string, { x: number; y: number }>
}

export type Spectrum1D = {
	id: string
	labelLeft: string
	labelRight: string
	title?: string // e.g., "Autonomy ↔ Guidance"
}

export type Spectrum2D = {
	id: string
	xLabel: string
	yLabel: string
	title?: string // e.g., "Speed vs Depth"
}

export type FieldKey = "goals" | "pains" | "differentiators" | "behaviors" | "roles"

export type PersonaCompareBoardProps = {
	personas: Persona[]
	visibleFields?: FieldKey[] // initial
	onFieldChange?: (fields: FieldKey[]) => void
	spectra1d?: Spectrum1D[] // which 1D axes to show
	spectra2d?: Spectrum2D[] // which 2D plots to show
	// optional: custom colors for persona kinds
	kindColors?: Partial<Record<Persona["kind"], string>>
}

/** ========== Utilities ========== */

const DEFAULT_KIND_COLORS: Record<Persona["kind"], string> = {
	core: "bg-sky-500",
	provisional: "bg-indigo-500",
	contrast: "bg-emerald-500",
}

const FIELD_LABEL: Record<FieldKey, string> = {
	goals: "Goals",
	pains: "Top Pains",
	differentiators: "Differentiators",
	behaviors: "Behaviors",
	roles: "Roles",
}

const ORDERED_FIELDS: FieldKey[] = ["goals", "pains", "differentiators", "behaviors", "roles"]

/** ========== Dynamic Field Selector ========== */

function FieldSelector({ value, onChange }: { value: FieldKey[]; onChange: (next: FieldKey[]) => void }) {
	const toggle = (k: FieldKey) => {
		const has = value.includes(k)
		onChange(has ? value.filter((f) => f !== k) : [...value, k])
	}
	const allOn = value.length === ORDERED_FIELDS.length
	const noneOn = value.length === 0
	const setAll = (on: boolean) => onChange(on ? [...ORDERED_FIELDS] : [])

	return (
		<div className="flex flex-wrap items-center gap-2">
			<span className="text-muted-foreground text-sm">Dimensions:</span>
			{ORDERED_FIELDS.map((k) => (
				<button
					key={k}
					onClick={() => toggle(k)}
					className={clsx(
						"rounded-full border px-3 py-1 text-xs",
						value.includes(k)
							? "border-foreground bg-foreground text-background"
							: "bg-transparent hover:bg-zinc-800 hover:text-zinc-200"
					)}
				>
					{FIELD_LABEL[k]}
				</button>
			))}
			<span className="mx-1 text-muted-foreground">|</span>
			<button
				className="text-xs underline underline-offset-2"
				onClick={() => setAll(!allOn)}
				title={allOn ? "Hide all" : "Show all"}
			>
				{allOn ? "Hide all" : "Show all"}
			</button>
			{!noneOn ? null : (
				<span className="flex items-center gap-1 text-destructive text-xs">
					<BadgeInfo size={14} />
					Nothing selected
				</span>
			)}
		</div>
	)
}

/** ========== Persona Header (kind-aware) ========== */

function PersonaHeader({ p, accent }: { p: Persona; accent: string }) {
	const Icon = p.kind === "contrast" ? Contrast : p.kind === "provisional" ? Dot : Users
	return (
		<div className="flex items-center gap-2">
			<div className={clsx("h-5 w-2 rounded", accent)} />
			<Icon size={16} className={clsx(p.kind === "contrast" ? "text-emerald-500" : "text-foreground")} />
			<span className="font-medium">{p.name}</span>
			{p.tags?.length ? (
				<span className="ml-1 max-w-[10rem] truncate text-muted-foreground text-xs">
					{p.tags.slice(0, 3).join(" • ")}
				</span>
			) : null}
		</div>
	)
}

/** ========== Matrix View w/ cross‑highlight ========== */

type MatrixViewProps = {
	personas: Persona[]
	fields: FieldKey[]
	kindColors: Record<Persona["kind"], string>
}

function MatrixView({ personas, fields, kindColors }: MatrixViewProps) {
	const [activeToken, setActiveToken] = useState<string | null>(null)
	const handleEnter = (token: string) => setActiveToken(token)
	const handleLeave = () => setActiveToken(null)
	const handleClick = (token: string) => setActiveToken((t) => (t === token ? null : token))

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

				{/* rows */}
				{fields.map((field) => (
					<React.Fragment key={field}>
						<div className="hidden bg-zinc-950/80 px-3 py-2 font-medium text-xs text-zinc-400 sm:block">
							{FIELD_LABEL[field]}
						</div>
						{personas.map((p, personaIndex) => {
							const items = (p as any)[field] as any[] | undefined
							return (
								<div key={`${p.id || personaIndex}-${field}`} className="bg-zinc-950/40 px-3 py-2">
									{items?.length ? (
										<div className="flex flex-wrap gap-1.5">
											{items.slice(0, 8).map((item, i) => {
												// Handle both string and object formats
												const displayText = typeof item === "string" ? item : item?.label || String(item)
												const token = `${field}:${String(displayText).toLowerCase()}`
												const active = activeToken === token
												const hasActiveToken = activeToken !== null
												const isGreyedOut = hasActiveToken && !active
												return (
													<button
														key={`${p.id || personaIndex}-${field}-${i}`}
														onClick={() => handleClick(token)}
														onMouseEnter={() => handleEnter(token)}
														onMouseLeave={handleLeave}
														className={`rounded-md px-2 py-1 text-xs transition ${
															active
																? "border border-zinc-600 bg-zinc-700 text-zinc-300"
																: isGreyedOut
																	? "bg-zinc-800/50 text-zinc-500 opacity-50"
																	: personaIndex === 1
																		? "border border-emerald-400/20 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
																		: "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
														}`}
													>
														{displayText}
													</button>
												)
											})}
										</div>
									) : (
										<div className="text-xs text-zinc-400">—</div>
									)}
								</div>
							)
						})}
					</React.Fragment>
				))}
			</div>
		</div>
	)
}

/** ========== 1D Strip Spectrum (dot plot) ========== */

function StripSpectrum({ personas, spectra }: { personas: Persona[]; spectra: Spectrum1D[] }) {
	const row = (s: Spectrum1D) => {
		return (
			<div key={s.id} className="rounded-lg border bg-card p-3">
				<div className="mb-2 flex items-center justify-between">
					<div className="font-medium text-sm">{s.title ?? `${s.labelLeft} ↔ ${s.labelRight}`}</div>
					<div className="text-muted-foreground text-xs">
						{s.labelLeft} → {s.labelRight}
					</div>
				</div>
				<div className="relative h-10">
					{/* rail */}
					<div className="-translate-y-1/2 absolute top-1/2 right-0 left-0 h-[2px] bg-border" />
					{/* ticks */}
					{[0, 0.25, 0.5, 0.75, 1].map((t) => (
						<div
							key={t}
							className="-translate-y-1/2 absolute top-1/2 h-3 w-[1px] bg-border"
							style={{ left: `${t * 100}%` }}
						/>
					))}
					{/* dots */}
					{personas.map((p) => {
						const v = p.spectra1d?.[s.id]
						if (v == null) return null
						const color =
							p.kind === "contrast" ? "bg-emerald-500" : p.kind === "provisional" ? "bg-indigo-400" : "bg-sky-400"
						return (
							<div
								key={p.id}
								className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2"
								style={{ left: `${Math.min(1, Math.max(0, v)) * 100}%` }}
								title={`${p.name}: ${Math.round(v * 100)} / 100 (${s.labelLeft} → ${s.labelRight})`}
							>
								<div className={clsx("h-3 w-3 rounded-full ring-2 ring-background", color)} />
							</div>
						)
					})}
				</div>
				<div className="mt-2 flex items-center justify-between text-muted-foreground text-xs">
					<span>{s.labelLeft}</span>
					<span>{s.labelRight}</span>
				</div>
			</div>
		)
	}

	return <div className="grid gap-3 md:grid-cols-2">{spectra.map(row)}</div>
}

/** ========== 2D Cartesian “Radial” Scatter (with labels & tooltips) ========== */

function ScatterSpectrum({ personas, spec }: { personas: Persona[]; spec: Spectrum2D }) {
	// simple grid (no external chart lib)
	const [hoverId, setHoverId] = useState<string | null>(null)
	return (
		<div className="rounded-lg border bg-card p-3">
			<div className="mb-2 font-medium text-sm">{spec.title ?? `${spec.xLabel} vs ${spec.yLabel}`}</div>
			<div className="relative aspect-[16/7] rounded bg-muted/40">
				{/* axes */}
				<div className="absolute top-4 right-6 bottom-22 left-10">
					<div className="absolute inset-0 rounded border border-border" />
					{/* grid lines */}
					{[0.25, 0.5, 0.75].map((g) => (
						<React.Fragment key={g}>
							<div className="absolute right-0 left-0 h-px bg-border/70" style={{ top: `${(1 - g) * 100}%` }} />
							<div className="absolute top-0 bottom-0 w-px bg-border/70" style={{ left: `${g * 100}%` }} />
						</React.Fragment>
					))}
					{/* points */}
					{personas.map((p) => {
						const pos = p.spectra2d?.[spec.id]
						if (!pos) return null
						const x = Math.min(1, Math.max(0, pos.x))
						const y = Math.min(1, Math.max(0, pos.y))
						const isHover = hoverId === p.id
						const color =
							p.kind === "contrast" ? "bg-emerald-500" : p.kind === "provisional" ? "bg-indigo-400" : "bg-sky-400"
						const glyph = p.kind === "contrast" ? "rounded-sm" : "rounded-full"
						return (
							<div
								key={p.id}
								className="absolute"
								style={{ left: `calc(${x * 100}% - 6px)`, bottom: `calc(${y * 100}% - 6px)` }}
								onMouseEnter={() => setHoverId(p.id)}
								onMouseLeave={() => setHoverId(null)}
							>
								<div className={clsx("h-3 w-3 ring-2 ring-card", glyph, color)} />
								{/* tooltip */}
								{isHover && (
									<div className="-top-2 absolute left-4 translate-y-[-100%] rounded border bg-popover px-2 py-1 text-popover-foreground text-xs shadow">
										<div className="font-medium">{p.name}</div>
										<div className="opacity-80">
											{spec.xLabel}: <b>{Math.round(x * 100)}</b> · {spec.yLabel}: <b>{Math.round(y * 100)}</b>
										</div>
										{p.tags?.length ? <div className="mt-0.5 opacity-60">{p.tags.slice(0, 3).join(" • ")}</div> : null}
									</div>
								)}
							</div>
						)
					})}
				</div>
				{/* axis labels */}
				<div className="absolute right-6 bottom-2 left-10 flex justify-between text-muted-foreground text-xs">
					<span>{spec.xLabel.split("→")[0]?.trim() || spec.xLabel}</span>
					<span>{spec.xLabel.split("→")[1]?.trim()}</span>
				</div>
				<div className="absolute top-4 bottom-22 left-1 flex flex-col items-center text-muted-foreground text-xs">
					<span className="-rotate-90 origin-left translate-x-2">{spec.yLabel}</span>
				</div>
			</div>
			{/* legend */}
			<div className="mt-2 flex gap-4 text-muted-foreground text-xs">
				<span className="flex items-center gap-1">
					<span className="h-3 w-3 rounded-full bg-sky-400 ring-2 ring-card" />
					Core
				</span>
				<span className="flex items-center gap-1">
					<span className="h-3 w-3 rounded-full bg-indigo-400 ring-2 ring-card" />
					Provisional
				</span>
				<span className="flex items-center gap-1">
					<span className="h-3 w-3 rounded-sm bg-emerald-500 ring-2 ring-card" />
					Contrast
				</span>
			</div>
		</div>
	)
}

/** ========== Change Log Panel ========== */

function ChangeLogPanel({
	changeLog = [{ version: "v0.1", note: "Initial personas created." }],
}: {
	changeLog?: { version: string; note: string }[]
}) {
	return (
		<div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
			<div className="mb-2 flex items-center gap-2 font-medium text-sm text-zinc-300">
				<GitMerge className="size-4" /> Change Log
			</div>
			<ul className="space-y-2">
				{changeLog.map((c) => (
					<li key={c.version} className="flex items-center gap-2 text-sm text-zinc-300">
						<span className="rounded-full bg-primary px-2 py-0.5 text-primary-foreground text-xs">{c.version}</span>
						<span>{c.note}</span>
					</li>
				))}
			</ul>
		</div>
	)
}

/** ========== Top-level board component (render-only) ========== */

export default function PersonaCompareBoard({
	personas,
	visibleFields = ["goals", "pains", "differentiators"],
	onFieldChange,
	spectra1d = [],
	spectra2d = [],
	kindColors = DEFAULT_KIND_COLORS,
}: PersonaCompareBoardProps) {
	const [fields, setFields] = useState<FieldKey[]>(visibleFields)

	const handleFields = useCallback(
		(next: FieldKey[]) => {
			setFields(next)
			onFieldChange?.(next)
		},
		[onFieldChange]
	)

	const anyFields = fields.length > 0

	return (
		<div className="space-y-6">
			{/* Controls */}
			<div className="flex flex-wrap items-center justify-between gap-3">
				<FieldSelector value={fields} onChange={handleFields} />
				<div className="text-muted-foreground text-xs">
					Values on spectra are normalized <b>0–100</b> (shown as %). Adjust mapping when you have measurement data.
				</div>
			</div>

			{/* Matrix */}
			{anyFields && (
				<MatrixView personas={personas} fields={fields} kindColors={{ ...DEFAULT_KIND_COLORS, ...kindColors }} />
			)}

			{/* Spectra 1D */}
			{spectra1d.length > 0 && (
				<div className="space-y-2">
					<div className="font-medium text-sm">Spectra (1D)</div>
					<StripSpectrum personas={personas} spectra={spectra1d} />
				</div>
			)}

			{/* Spectra 2D */}
			{spectra2d.length > 0 && (
				<div className="space-y-3">
					<div className="font-medium text-sm">Spectra (2D)</div>
					<div className="grid gap-3 md:grid-cols-2">
						{spectra2d.map((s) => (
							<ScatterSpectrum key={s.id} personas={personas} spec={s} />
						))}
					</div>
				</div>
			)}

			{/* Change Log */}
			<ChangeLogPanel />
		</div>
	)
}

/** ========== Example usage (remove in prod) ==========

// Example usage:
// 
// <PersonaCompareBoard
//   personas={[
//     {
//       id: "p1",
//       name: "Autonomous Amy",
//       kind: "core",
//       tags: ["IC", "Builder"],
//       goals: ["Ship quickly", "Own decisions"],
//       pains: ["Forced wizards", "Approval bottlenecks"],
//       differentiators: ["Self-serve everything"],
//       behaviors: ["Keyboard-first", "Power user"],
//       roles: ["Engineer"],
//       spectra1d: { 
//         autonomy_guidance: 0.82, 
//         speed_depth: 0.76 
//       },
//       spectra2d: { 
//         speed_vs_depth: { x: 0.76, y: 0.35 }, 
//         nudge_vs_complexity: { x: 0.82, y: 0.15 } 
//       },
//     },
//     {
//       id: "p2",
//       name: "Guided Gary",
//       kind: "contrast",
//       tags: ["Manager", "Cross‑functional"],
//       goals: ["Consistency", "Reduce rework"],
//       pains: ["Too many options", "Unclear defaults"],
//       differentiators: ["Prefers templates"],
//       roles: ["PM"],
//       spectra1d: { 
//         autonomy_guidance: 0.22, 
//         speed_depth: 0.35 
//       },
//       spectra2d: { 
//         speed_vs_depth: { x: 0.35, y: 0.65 }, 
//         nudge_vs_complexity: { x: 0.25, y: 0.7 } 
//       },
//     },
//     {
//       id: "p3",
//       name: "Exploratory Eva",
//       kind: "provisional",
//       tags: ["Design", "Prototype"],
//       goals: ["Discover options", "Learn by trying"],
//       pains: ["Rigid flows"],
//       differentiators: ["Tolerates ambiguity"],
//       roles: ["Designer"],
//       spectra1d: { 
//         autonomy_guidance: 0.6, 
//         speed_depth: 0.5 
//       },
//       spectra2d: { 
//         speed_vs_depth: { x: 0.55, y: 0.5 }, 
//         nudge_vs_complexity: { x: 0.6, y: 0.45 } 
//       },
//     },
//   ]}
//   spectra1d={[
//     { 
//       id: "autonomy_guidance", 
//       labelLeft: "Autonomy", 
//       labelRight: "Guidance", 
//       title: "Autonomy ↔ Guidance" 
//     },
//     { 
//       id: "speed_depth", 
//       labelLeft: "Speed", 
//       labelRight: "Depth", 
//       title: "Speed ↔ Depth" 
//     },
//   ]}
//   spectra2d={[
//     { 
//       id: "speed_vs_depth", 
//       xLabel: "Autonomy → Guidance", 
//       yLabel: "Nudge‑Sensitivity", 
//       title: "Speed vs Depth (est.)" 
//     },
//     { 
//       id: "nudge_vs_complexity", 
//       xLabel: "Simplicity → Complexity", 
//       yLabel: "Nudge‑Sensitivity", 
//       title: "Nudge vs Complexity" 
//     },
//   ]}
// />
*/
