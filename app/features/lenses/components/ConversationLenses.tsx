import type { LucideIcon } from "lucide-react"
import {
	AlertTriangle,
	BarChart3,
	CheckCircle2,
	Cpu,
	Headset,
	Heart,
	Map,
	Sparkles,
	Target,
	Users,
	XCircle,
} from "lucide-react"
import { type ReactNode, useMemo } from "react"
import { Link } from "react-router"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion"
import { Badge } from "~/components/ui/badge"
import InlineEdit from "~/components/ui/inline-edit"
import type { InterviewLensFramework, InterviewLensView, LensSlotValue } from "~/features/lenses/types"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { cn } from "~/lib/utils"
import { LensSlotTable } from "./CompanyTable"

type CustomLensDefaults = Record<string, { summary?: string; notes?: string; highlights?: string[] }>

type PersonLensItem = {
	text: string
	evidenceId?: string
	anchors?: unknown
}

// Helper to extract timestamp in seconds from anchors array
function getTimestampFromAnchors(anchors: unknown): number | null {
	if (!Array.isArray(anchors) || anchors.length === 0) return null
	const firstAnchor = anchors[0] as any
	if (!firstAnchor) return null

	// Try start_ms first (milliseconds)
	if (typeof firstAnchor.start_ms === "number") {
		return Math.floor(firstAnchor.start_ms / 1000)
	}

	// Try start_seconds
	if (typeof firstAnchor.start_seconds === "number") {
		return firstAnchor.start_seconds
	}

	// Try legacy start field
	if (typeof firstAnchor.start === "number") {
		// If > 500, assume milliseconds, otherwise seconds
		return firstAnchor.start > 500 ? Math.floor(firstAnchor.start / 1000) : firstAnchor.start
	}

	return null
}

type PersonLens = {
	id: string
	name: string
	painsAndGoals?: {
		pains: PersonLensItem[]
		gains: PersonLensItem[]
	}
	empathyMap?: {
		says: PersonLensItem[]
		does: PersonLensItem[]
		thinks: PersonLensItem[]
		feels: PersonLensItem[]
	}
}

type SalesLensesSectionProps = {
	lens: InterviewLensView | null
	customLenses: Record<string, { summary?: string; notes?: string }>
	customLensDefaults: CustomLensDefaults
	onUpdateLens: (lensId: string, field: "summary" | "notes", value: string) => void
	onUpdateSlot?: (slotId: string, field: "summary" | "textValue", value: string) => void
	updatingLensId?: string | null
	personLenses?: PersonLens[]
	projectPath: string
}

type LensHeaderConfig = {
	id: string
	title: string
	icon: LucideIcon
	colorClass: string
	backgroundClass: string
	summary: string
	notes?: string
	highlights?: string[]
	badge?: string | null
	content?: ReactNode
}

const FRAMEWORK_ICON_MAP: Record<
	string,
	{
		icon: LucideIcon
		color: string
		background: string
	}
> = {
	BANT_GPCT: { icon: Target, color: "text-amber-600", background: "bg-amber-50" },
	MEDDIC: { icon: BarChart3, color: "text-sky-600", background: "bg-sky-50" },
	MAP: { icon: Map, color: "text-emerald-600", background: "bg-emerald-50" },
}

const CUSTOM_LENS_ICON_MAP: Record<string, { icon: LucideIcon; color: string; background: string }> = {
	productImpact: { icon: Cpu, color: "text-indigo-600", background: "bg-indigo-50" },
	customerService: { icon: Headset, color: "text-blue-600", background: "bg-blue-50" },
	pessimistic: { icon: AlertTriangle, color: "text-rose-600", background: "bg-rose-50" },
	personPainsGoals: { icon: Heart, color: "text-pink-600", background: "bg-pink-50" },
	personEmpathy: { icon: Users, color: "text-purple-600", background: "bg-purple-50" },
}

// Helper to get confidence badge
function getConfidenceBadge(confidence: number | null | undefined) {
	if (confidence === null || confidence === undefined) {
		return (
			<Badge variant="outline" className="bg-gray-100 text-[0.65rem] text-gray-600">
				Unknown
			</Badge>
		)
	}
	if (confidence >= 0.7) {
		return (
			<Badge variant="outline" className="bg-emerald-100 text-[0.65rem] text-emerald-700">
				High
			</Badge>
		)
	}
	if (confidence >= 0.4) {
		return (
			<Badge variant="outline" className="bg-amber-100 text-[0.65rem] text-amber-700">
				Medium
			</Badge>
		)
	}
	return (
		<Badge variant="outline" className="bg-rose-100 text-[0.65rem] text-rose-700">
			Low
		</Badge>
	)
}

// Helper to render a compact framework field
function CompactFrameworkField({
	label,
	slot,
	frameworkId,
	onUpdateField,
}: {
	label: string
	slot?: LensSlotValue
	frameworkId: string
	onUpdateField: (slotId: string, field: "summary" | "textValue", value: string) => void
}) {
	const hasValue = slot && (slot.textValue || slot.summary || slot.numericValue || slot.dateValue)
	const Icon = hasValue ? CheckCircle2 : XCircle
	const iconColor = hasValue ? "text-emerald-600" : "text-gray-400"

	const displayValue =
		slot?.summary ||
		slot?.textValue ||
		(slot?.numericValue !== null && slot?.numericValue !== undefined ? String(slot?.numericValue) : null) ||
		slot?.dateValue ||
		""

	// Always allow editing, even if slot doesn't exist yet
	return (
		<div className="flex items-start gap-3 rounded-lg border border-border/50 bg-background p-3">
			<Icon className={cn("mt-0.5 h-4 w-4 flex-shrink-0", iconColor)} />
			<div className="min-w-0 flex-1">
				<div className="mb-1 flex items-center justify-between gap-2">
					<p className="font-medium text-foreground text-sm">{label}</p>
					{hasValue && slot && getConfidenceBadge(slot.confidence)}
				</div>
				<div onClick={(e) => e.stopPropagation()} onFocusCapture={(e) => e.stopPropagation()}>
					<InlineEdit
						value={displayValue}
						placeholder={`Add ${label.toLowerCase()}...`}
						onSubmit={(value) => {
							if (slot?.id) {
								// Prefer updating summary if it exists, otherwise textValue
								const field = slot.summary ? "summary" : "textValue"
								onUpdateField(slot.id, field, value)
							} else {
								// TODO: Handle creating new slot when it doesn't exist
								console.warn(
									`Cannot save ${label} - slot not found in database. Refresh the page after interview analysis completes.`
								)
							}
						}}
						submitOnBlur
						textClassName={cn("break-words text-sm", hasValue ? "text-foreground/90" : "text-muted-foreground italic")}
						inputClassName="text-sm"
					/>
				</div>
			</div>
		</div>
	)
}

// Render compact BANT view
function renderBantCompactView(
	framework: InterviewLensFramework,
	onUpdateField: (slotId: string, field: "summary" | "textValue", value: string) => void
): ReactNode {
	const budget = framework.slots.find((s) => s.fieldKey === "budget" || s.fieldKey.toLowerCase().includes("budget"))
	const authority = framework.slots.find(
		(s) => s.fieldKey === "authority" || s.fieldKey.toLowerCase().includes("authority")
	)
	const need = framework.slots.find((s) => s.fieldKey === "need" || s.fieldKey.toLowerCase().includes("need"))
	const timeline = framework.slots.find(
		(s) => s.fieldKey === "timeline" || s.fieldKey.toLowerCase().includes("timeline")
	)

	return (
		<div className="grid gap-3 sm:grid-cols-2">
			<CompactFrameworkField label="Budget" slot={budget} frameworkId={framework.name} onUpdateField={onUpdateField} />
			<CompactFrameworkField
				label="Authority"
				slot={authority}
				frameworkId={framework.name}
				onUpdateField={onUpdateField}
			/>
			<CompactFrameworkField label="Need" slot={need} frameworkId={framework.name} onUpdateField={onUpdateField} />
			<CompactFrameworkField
				label="Timeline"
				slot={timeline}
				frameworkId={framework.name}
				onUpdateField={onUpdateField}
			/>
		</div>
	)
}

// Render compact MEDDIC view
function renderMeddicCompactView(
	framework: InterviewLensFramework,
	onUpdateField: (slotId: string, field: "summary" | "textValue", value: string) => void
): ReactNode {
	const metrics = framework.slots.find((s) => s.fieldKey === "metrics" || s.fieldKey.toLowerCase().includes("metric"))
	const economicBuyer = framework.slots.find(
		(s) => s.fieldKey === "economic_buyer" || s.fieldKey.toLowerCase().includes("economic")
	)
	const decisionCriteria = framework.slots.find(
		(s) => s.fieldKey === "decision_criteria" || s.fieldKey.toLowerCase().includes("criteria")
	)
	const decisionProcess = framework.slots.find(
		(s) => s.fieldKey === "decision_process" || s.fieldKey.toLowerCase().includes("process")
	)
	const pain = framework.slots.find((s) => s.fieldKey === "pain" || s.fieldKey.toLowerCase().includes("pain"))
	const champion = framework.slots.find(
		(s) => s.fieldKey === "champion" || s.fieldKey.toLowerCase().includes("champion")
	)

	return (
		<div className="grid gap-3 sm:grid-cols-2">
			<CompactFrameworkField
				label="Metrics"
				slot={metrics}
				frameworkId={framework.name}
				onUpdateField={onUpdateField}
			/>
			<CompactFrameworkField
				label="Economic Buyer"
				slot={economicBuyer}
				frameworkId={framework.name}
				onUpdateField={onUpdateField}
			/>
			<CompactFrameworkField
				label="Decision Criteria"
				slot={decisionCriteria}
				frameworkId={framework.name}
				onUpdateField={onUpdateField}
			/>
			<CompactFrameworkField
				label="Decision Process"
				slot={decisionProcess}
				frameworkId={framework.name}
				onUpdateField={onUpdateField}
			/>
			<CompactFrameworkField
				label="Identify Pain"
				slot={pain}
				frameworkId={framework.name}
				onUpdateField={onUpdateField}
			/>
			<CompactFrameworkField
				label="Champion"
				slot={champion}
				frameworkId={framework.name}
				onUpdateField={onUpdateField}
			/>
		</div>
	)
}

// Render Next Steps view showing milestones
function renderNextStepsView(
	nextSteps?: Array<{ id: string; description: string; ownerName: string | null; dueDate: string | null }>,
	milestones?: Array<{ id: string; label: string; status: string; ownerName: string | null; dueDate: string | null }>
): ReactNode {
	const hasNextSteps = (nextSteps?.length ?? 0) > 0
	const hasMilestones = (milestones?.length ?? 0) > 0

	if (!hasNextSteps && !hasMilestones) {
		return (
			<div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center">
				<p className="text-muted-foreground text-sm">No next steps or milestones captured from this interview.</p>
			</div>
		)
	}

	return (
		<div className="space-y-4">
			{hasNextSteps && (
				<div className="space-y-3">
					<h4 className="font-medium text-foreground text-sm">Next Steps</h4>
					<div className="space-y-2">
						{nextSteps!.map((step) => (
							<div key={step.id} className="rounded-lg border border-border/50 bg-background p-3">
								<p className="text-foreground text-sm">{step.description}</p>
								<div className="mt-2 flex flex-wrap gap-3 text-muted-foreground text-xs">
									{step.ownerName && <span>Owner: {step.ownerName}</span>}
									{step.dueDate && <span>Due: {step.dueDate}</span>}
								</div>
							</div>
						))}
					</div>
				</div>
			)}
			{hasMilestones && (
				<div className="space-y-3">
					<h4 className="font-medium text-foreground text-sm">Milestones</h4>
					<div className="space-y-2">
						{milestones!.map((milestone) => (
							<div key={milestone.id} className="rounded-lg border border-border/50 bg-background p-3">
								<div className="flex items-center justify-between gap-2">
									<p className="font-medium text-foreground text-sm">{milestone.label}</p>
									<Badge variant="outline" className="text-[0.65rem] uppercase">
										{milestone.status.replace("_", " ")}
									</Badge>
								</div>
								<div className="mt-2 flex flex-wrap gap-3 text-muted-foreground text-xs">
									{milestone.ownerName && <span>Owner: {milestone.ownerName}</span>}
									{milestone.dueDate && <span>Due: {milestone.dueDate}</span>}
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	)
}

export function SalesLensesSection({
	lens,
	customLenses,
	customLensDefaults,
	onUpdateLens,
	onUpdateSlot,
	updatingLensId,
	personLenses = [],
	projectPath,
}: SalesLensesSectionProps) {
	const routes = useProjectRoutes(projectPath)

	const sortedFrameworks = useMemo(() => {
		if (!lens) return []
		return [...lens.frameworks].sort((a, b) => friendlyFrameworkOrder(a.name) - friendlyFrameworkOrder(b.name))
	}, [lens])

	const frameworkItems: LensHeaderConfig[] = sortedFrameworks.map((framework) => {
		const overrides = customLenses[framework.name] ?? {}
		const defaultSummary = deriveKeyTakeaway(framework) ?? ""
		const defaultNotes = deriveFrameworkNotes(framework)
		const highlights = deriveFrameworkHighlights(framework)
		const style = FRAMEWORK_ICON_MAP[framework.name] ?? {
			icon: Sparkles,
			color: "text-slate-600",
			background: "bg-slate-50",
		}

		const hygieneBadge =
			framework.hygiene.length > 0
				? `${framework.hygiene.length} ${framework.hygiene.length === 1 ? "alert" : "alerts"}`
				: null

		// Use compact views for BANT and MEDDIC, next steps view for MAP, full table for others
		let content: ReactNode
		const handleUpdateField = (slotId: string, field: "summary" | "textValue", value: string) => {
			if (onUpdateSlot) {
				onUpdateSlot(slotId, field, value)
			}
		}

		if (framework.name === "BANT_GPCT") {
			content = renderBantCompactView(framework, handleUpdateField)
		} else if (framework.name === "MEDDIC") {
			content = renderMeddicCompactView(framework, handleUpdateField)
		} else if (framework.name === "MAP") {
			content = renderNextStepsView(lens?.entities.nextSteps, lens?.entities.mapMilestones)
		} else {
			content = <LensSlotTable framework={framework} showHeader={false} />
		}

		return {
			id: framework.name,
			title: friendlyFrameworkName(framework.name),
			icon: style.icon,
			colorClass: style.color,
			backgroundClass: style.background,
			summary: overrides.summary ?? defaultSummary,
			notes: overrides.notes ?? defaultNotes ?? "",
			highlights,
			badge: hygieneBadge,
			content,
		}
	})

	const customLensItems: LensHeaderConfig[] = ["productImpact"].map((lensId) => {
		const overrides = customLenses[lensId] ?? {}
		const defaults = customLensDefaults[lensId] ?? {}
		const style = CUSTOM_LENS_ICON_MAP[lensId] ?? {
			icon: Sparkles,
			color: "text-slate-600",
			background: "bg-slate-50",
		}

		const descriptors: Record<string, { title: string; description: string }> = {
			productImpact: {
				title: "Product",
				description: "Surface the technical debt, integration work, and product gaps highlighted in this conversation.",
			},
			customerService: {
				title: "Customer Service",
				description:
					"Capture support expectations, friction points, and service-level considerations raised by participants.",
			},
			pessimistic: {
				title: "Pessimistic",
				description: "Track unresolved risks, objections, and worst-case scenarios to stress-test the opportunity.",
			},
		}

		const descriptor = descriptors[lensId] ?? { title: lensId, description: "" }

		const highlights = defaults.highlights ?? []

		return {
			id: lensId,
			title: descriptor.title,
			icon: style.icon,
			colorClass: style.color,
			backgroundClass: style.background,
			summary: overrides.summary ?? defaults.summary ?? "",
			notes: overrides.notes ?? defaults.notes ?? descriptor.description,
			highlights,
			badge: null,
			content: highlights.length ? (
				<div className="rounded-lg border border-border/60 border-dashed bg-muted/20 p-4">
					<p className="mb-2 text-muted-foreground text-xs uppercase tracking-wide">Signals captured</p>
					<ul className="space-y-2 text-foreground text-sm">
						{highlights.map((item, index) => (
							<li key={`${lensId}-highlight-${index}`} className="flex gap-2">
								<span className="mt-[3px] text-muted-foreground">•</span>
								<span>{item}</span>
							</li>
						))}
					</ul>
				</div>
			) : null,
		}
	})

	// Create person lens items
	const personLensItems: LensHeaderConfig[] = personLenses.flatMap((person) => {
		const items: LensHeaderConfig[] = []

		// Pain & Goals lens for each person
		if (person.painsAndGoals && (person.painsAndGoals.pains.length > 0 || person.painsAndGoals.gains.length > 0)) {
			const painsGoalsStyle = CUSTOM_LENS_ICON_MAP.personPainsGoals
			items.push({
				id: `person-pains-goals-${person.id}`,
				title: `Pain & Goals (${person.name})`,
				icon: painsGoalsStyle.icon,
				colorClass: painsGoalsStyle.color,
				backgroundClass: painsGoalsStyle.background,
				summary: person.painsAndGoals.pains[0]?.text || person.painsAndGoals.gains[0]?.text || "",
				notes: "",
				highlights: [],
				badge: null,
				content: (
					<div className="grid gap-3 sm:grid-cols-2">
						{person.painsAndGoals.pains.length > 0 && (
							<div className="rounded-lg border border-border/50 bg-background p-3">
								<p className="mb-2 text-muted-foreground text-xs uppercase tracking-wide">Pains</p>
								<ul className="space-y-2 text-foreground text-sm">
									{person.painsAndGoals.pains.map((pain, index) => {
										const timestamp = getTimestampFromAnchors(pain.anchors)
										const url = pain.evidenceId
											? `${routes.evidence.detail(pain.evidenceId)}${timestamp ? `?t=${timestamp}` : ""}`
											: null
										return (
											<li key={`pain-${index}`} className="flex gap-2">
												<span className="mt-[3px] text-destructive">•</span>
												{url ? (
													<Link to={url} className="hover:text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
														{pain.text}
													</Link>
												) : (
													<span>{pain.text}</span>
												)}
											</li>
										)
									})}
								</ul>
							</div>
						)}
						{person.painsAndGoals.gains.length > 0 && (
							<div className="rounded-lg border border-border/50 bg-background p-3">
								<p className="mb-2 text-muted-foreground text-xs uppercase tracking-wide">Goals & Gains</p>
								<ul className="space-y-2 text-foreground text-sm">
									{person.painsAndGoals.gains.map((gain, index) => {
										const timestamp = getTimestampFromAnchors(gain.anchors)
										const url = gain.evidenceId
											? `${routes.evidence.detail(gain.evidenceId)}${timestamp ? `?t=${timestamp}` : ""}`
											: null
										return (
											<li key={`gain-${index}`} className="flex gap-2">
												<span className="mt-[3px] text-emerald-600">•</span>
												{url ? (
													<Link to={url} className="hover:text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
														{gain.text}
													</Link>
												) : (
													<span>{gain.text}</span>
												)}
											</li>
										)
									})}
								</ul>
							</div>
						)}
					</div>
				),
			})
		}

		// Empathy Map lens for each person
		if (person.empathyMap) {
			const hasEmpathyData =
				person.empathyMap.says.length > 0 ||
				person.empathyMap.does.length > 0 ||
				person.empathyMap.thinks.length > 0 ||
				person.empathyMap.feels.length > 0

			if (hasEmpathyData) {
				const empathyStyle = CUSTOM_LENS_ICON_MAP.personEmpathy
				items.push({
					id: `person-empathy-${person.id}`,
					title: `Empathy Map (${person.name})`,
					icon: empathyStyle.icon,
					colorClass: empathyStyle.color,
					backgroundClass: empathyStyle.background,
					summary: person.empathyMap.says[0]?.text || person.empathyMap.thinks[0]?.text || "",
					notes: "",
					highlights: [],
					badge: null,
					content: (
						<div className="grid gap-3 sm:grid-cols-2">
							{person.empathyMap.says.length > 0 && (
								<div className="rounded-lg border border-border/50 bg-background p-3">
									<p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Says</p>
									<ul className="space-y-1.5 text-foreground text-sm">
										{person.empathyMap.says.slice(0, 4).map((item, index) => {
											const timestamp = getTimestampFromAnchors(item.anchors)
											const url = item.evidenceId
												? `${routes.evidence.detail(item.evidenceId)}${timestamp ? `?t=${timestamp}` : ""}`
												: null
											return (
												<li key={`says-${index}`} className="flex gap-2">
													<span className="mt-[3px] text-muted-foreground">•</span>
													{url ? (
														<Link to={url} className="hover:text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
															{item.text}
														</Link>
													) : (
														<span>{item.text}</span>
													)}
												</li>
											)
										})}
									</ul>
								</div>
							)}
							{person.empathyMap.does.length > 0 && (
								<div className="rounded-lg border border-border/50 bg-background p-3">
									<p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Does</p>
									<ul className="space-y-1.5 text-foreground text-sm">
										{person.empathyMap.does.slice(0, 4).map((item, index) => {
											const timestamp = getTimestampFromAnchors(item.anchors)
											const url = item.evidenceId
												? `${routes.evidence.detail(item.evidenceId)}${timestamp ? `?t=${timestamp}` : ""}`
												: null
											return (
												<li key={`does-${index}`} className="flex gap-2">
													<span className="mt-[3px] text-muted-foreground">•</span>
													{url ? (
														<Link to={url} className="hover:text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
															{item.text}
														</Link>
													) : (
														<span>{item.text}</span>
													)}
												</li>
											)
										})}
									</ul>
								</div>
							)}
							{person.empathyMap.thinks.length > 0 && (
								<div className="rounded-lg border border-border/50 bg-background p-3">
									<p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Thinks</p>
									<ul className="space-y-1.5 text-foreground text-sm">
										{person.empathyMap.thinks.slice(0, 4).map((item, index) => {
											const timestamp = getTimestampFromAnchors(item.anchors)
											const url = item.evidenceId
												? `${routes.evidence.detail(item.evidenceId)}${timestamp ? `?t=${timestamp}` : ""}`
												: null
											return (
												<li key={`thinks-${index}`} className="flex gap-2">
													<span className="mt-[3px] text-muted-foreground">•</span>
													{url ? (
														<Link to={url} className="hover:text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
															{item.text}
														</Link>
													) : (
														<span>{item.text}</span>
													)}
												</li>
											)
										})}
									</ul>
								</div>
							)}
							{person.empathyMap.feels.length > 0 && (
								<div className="rounded-lg border border-border/50 bg-background p-3">
									<p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Feels</p>
									<ul className="space-y-1.5 text-foreground text-sm">
										{person.empathyMap.feels.slice(0, 4).map((item, index) => {
											const timestamp = getTimestampFromAnchors(item.anchors)
											const url = item.evidenceId
												? `${routes.evidence.detail(item.evidenceId)}${timestamp ? `?t=${timestamp}` : ""}`
												: null
											return (
												<li key={`feels-${index}`} className="flex gap-2">
													<span className="mt-[3px] text-muted-foreground">•</span>
													{url ? (
														<Link to={url} className="hover:text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
															{item.text}
														</Link>
													) : (
														<span>{item.text}</span>
													)}
												</li>
											)
										})}
									</ul>
								</div>
							)}
						</div>
					),
				})
			}
		}

		return items
	})

	// Order: frameworks first, then person lenses, then custom lenses (Product last)
	const combinedItems = [...frameworkItems, ...personLensItems, ...customLensItems]
	const defaultAccordionValue = combinedItems[0]?.id

	if (combinedItems.length === 0) {
		return (
			<div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-muted-foreground text-sm">
				Lens insights will appear once conversation analysis finishes for this interview.
			</div>
		)
	}

	return (
		<div className="space-y-6">
			<header className="space-y-2">
				<h2 className="font-semibold text-foreground text-lg">Conversation lenses</h2>
				<p className="text-muted-foreground text-sm">Focused perspectives on the content</p>
			</header>

			<Accordion type="single" collapsible defaultValue={defaultAccordionValue} className="space-y-3">
				{combinedItems.map((item) => (
					<AccordionItem
						value={item.id}
						key={item.id}
						className="overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm"
					>
						<AccordionTrigger className="flex w-full items-center gap-3 px-4 py-3 text-left hover:no-underline">
							<div className={cn("flex h-9 w-9 items-center justify-center rounded-full", item.backgroundClass)}>
								<item.icon className={cn("h-4 w-4", item.colorClass)} />
							</div>
							<div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
								<div className="flex items-center gap-2">
									<span className="font-semibold text-foreground text-sm">{item.title}</span>
									{item.badge ? (
										<Badge variant="outline" className="text-[0.65rem] uppercase">
											{item.badge}
										</Badge>
									) : null}
									{updatingLensId === item.id ? (
										<Badge variant="outline" className="text-[0.65rem] uppercase">
											Saving…
										</Badge>
									) : null}
								</div>
								<div
									className="flex-1"
									onClick={(event) => event.stopPropagation()}
									onFocusCapture={(event) => event.stopPropagation()}
								>
									<InlineEdit
										value={item.summary ?? ""}
										placeholder="Add a key takeaway everyone can act on"
										onSubmit={(value) => onUpdateLens(item.id, "summary", value)}
										submitOnBlur
										textClassName="line-clamp-2 text-left text-sm text-muted-foreground sm:text-sm"
									/>
								</div>
							</div>
						</AccordionTrigger>
						<AccordionContent className="space-y-4 px-4 pb-4">
							<div
								className="rounded-lg border border-border/60 border-dashed bg-muted/10 p-3"
								onClick={(event) => event.stopPropagation()}
								onFocusCapture={(event) => event.stopPropagation()}
							>
								<p className="mb-1 text-muted-foreground text-xs uppercase tracking-wide">Context & notes</p>
								<InlineEdit
									value={item.notes ?? ""}
									multiline
									placeholder="Capture how this perspective should influence follow-up work."
									onSubmit={(value) => onUpdateLens(item.id, "notes", value)}
									submitOnBlur
									textClassName="text-sm text-foreground"
									inputClassName="text-sm"
								/>
							</div>
							{item.content}
						</AccordionContent>
					</AccordionItem>
				))}
			</Accordion>
		</div>
	)
}

function friendlyFrameworkOrder(name: string) {
	switch (name) {
		case "BANT_GPCT":
			return 0
		case "MEDDIC":
			return 1
		case "MAP":
			return 2
		default:
			return 99
	}
}

function friendlyFrameworkName(name: string) {
	switch (name) {
		case "BANT_GPCT":
			return "BANT / GPCT"
		case "MEDDIC":
			return "MEDDIC"
		case "MAP":
			return "Next Steps"
		default:
			return name
	}
}

function deriveKeyTakeaway(framework: InterviewLensFramework) {
	const prioritizedSlots = framework.slots.filter((slot) => slot.textValue || slot.summary)
	const firstMeaningful = prioritizedSlots[0]
	if (firstMeaningful?.summary) return firstMeaningful.summary
	if (firstMeaningful?.textValue) return firstMeaningful.textValue

	const fallback = framework.slots.find((slot) => slot.status || slot.dateValue)
	if (fallback?.status) return `${fallback.label ?? fallback.fieldKey}: ${fallback.status}`
	if (fallback?.dateValue) return `${fallback.label ?? fallback.fieldKey}: ${fallback.dateValue}`

	return ""
}

function deriveFrameworkNotes(framework: InterviewLensFramework) {
	const meaningful = framework.slots
		.map((slot) => slot.summary || slot.textValue)
		.filter((value): value is string => Boolean(value && value.trim()))

	if (meaningful.length === 0) return undefined
	return meaningful.slice(0, 2).join("; ")
}

function deriveFrameworkHighlights(framework: InterviewLensFramework) {
	return framework.slots
		.filter((slot) => slot.summary || slot.textValue)
		.slice(0, 5)
		.map((slot) => slot.summary || slot.textValue || "")
		.filter((value) => value.trim().length > 0)
}
