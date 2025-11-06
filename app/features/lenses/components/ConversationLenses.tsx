import { type ReactNode, useMemo } from "react"
import { AlertTriangle, BarChart3, Cpu, Headset, Map, Sparkles, Target, Users, Heart } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion"
import { Badge } from "~/components/ui/badge"
import InlineEdit from "~/components/ui/inline-edit"
import { cn } from "~/lib/utils"
import type { InterviewLensFramework, InterviewLensView } from "~/features/lenses/types"
import { LensSlotTable } from "./CompanyTable"
import { StakeholderList } from "./PersonDetail"
import { LensExecutionPanel } from "./ConversationViewer"

type CustomLensDefaults = Record<string, { summary?: string; notes?: string; highlights?: string[] }>

type PersonLens = {
	id: string
	name: string
	painsAndGoals?: {
		pains: string[]
		gains: string[]
	}
	empathyMap?: {
		says: string[]
		does: string[]
		thinks: string[]
		feels: string[]
	}
}

type SalesLensesSectionProps = {
	lens: InterviewLensView | null
	customLenses: Record<string, { summary?: string; notes?: string }>
	customLensDefaults: CustomLensDefaults
	onUpdateLens: (lensId: string, field: "summary" | "notes", value: string) => void
	updatingLensId?: string | null
	personLenses?: PersonLens[]
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
	SPICED: { icon: Sparkles, color: "text-fuchsia-600", background: "bg-fuchsia-50" },
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

export function SalesLensesSection({
	lens,
	customLenses,
	customLensDefaults,
	onUpdateLens,
	updatingLensId,
	personLenses = [],
}: SalesLensesSectionProps) {
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
			content: <LensSlotTable framework={framework} showHeader={false} />,
		}
	})

	const customLensItems: LensHeaderConfig[] = ["productImpact", "customerService", "pessimistic"].map((lensId) => {
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
				description: "Capture support expectations, friction points, and service-level considerations raised by participants.",
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
				<div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-4">
					<p className="mb-2 text-muted-foreground text-xs uppercase tracking-wide">Signals captured</p>
					<ul className="space-y-2 text-sm text-foreground">
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
				title: `${person.name}: Pain & Goals`,
				icon: painsGoalsStyle.icon,
				colorClass: painsGoalsStyle.color,
				backgroundClass: painsGoalsStyle.background,
				summary: person.painsAndGoals.pains[0] || person.painsAndGoals.gains[0] || "",
				notes: "",
				highlights: [],
				badge: null,
				content: (
					<div className="grid gap-3 sm:grid-cols-2">
						{person.painsAndGoals.pains.length > 0 && (
							<div className="rounded-lg border border-border/50 bg-background p-3">
								<p className="mb-2 text-muted-foreground text-xs uppercase tracking-wide">Pains</p>
								<ul className="space-y-2 text-sm text-foreground">
									{person.painsAndGoals.pains.map((pain, index) => (
										<li key={`pain-${index}`} className="flex gap-2">
											<span className="mt-[3px] text-destructive">•</span>
											<span>{pain}</span>
										</li>
									))}
								</ul>
							</div>
						)}
						{person.painsAndGoals.gains.length > 0 && (
							<div className="rounded-lg border border-border/50 bg-background p-3">
								<p className="mb-2 text-muted-foreground text-xs uppercase tracking-wide">Goals & Gains</p>
								<ul className="space-y-2 text-sm text-foreground">
									{person.painsAndGoals.gains.map((gain, index) => (
										<li key={`gain-${index}`} className="flex gap-2">
											<span className="mt-[3px] text-emerald-600">•</span>
											<span>{gain}</span>
										</li>
									))}
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
					title: `${person.name}: Empathy Map`,
					icon: empathyStyle.icon,
					colorClass: empathyStyle.color,
					backgroundClass: empathyStyle.background,
					summary: person.empathyMap.says[0] || person.empathyMap.thinks[0] || "",
					notes: "",
					highlights: [],
					badge: null,
					content: (
						<div className="grid gap-3 sm:grid-cols-2">
							{person.empathyMap.says.length > 0 && (
								<div className="rounded-lg border border-border/50 bg-background p-3">
									<p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Says</p>
									<ul className="space-y-1.5 text-sm text-foreground">
										{person.empathyMap.says.slice(0, 4).map((item, index) => (
											<li key={`says-${index}`} className="flex gap-2">
												<span className="mt-[3px] text-muted-foreground">•</span>
												<span>{item}</span>
											</li>
										))}
									</ul>
								</div>
							)}
							{person.empathyMap.does.length > 0 && (
								<div className="rounded-lg border border-border/50 bg-background p-3">
									<p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Does</p>
									<ul className="space-y-1.5 text-sm text-foreground">
										{person.empathyMap.does.slice(0, 4).map((item, index) => (
											<li key={`does-${index}`} className="flex gap-2">
												<span className="mt-[3px] text-muted-foreground">•</span>
												<span>{item}</span>
											</li>
										))}
									</ul>
								</div>
							)}
							{person.empathyMap.thinks.length > 0 && (
								<div className="rounded-lg border border-border/50 bg-background p-3">
									<p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Thinks</p>
									<ul className="space-y-1.5 text-sm text-foreground">
										{person.empathyMap.thinks.slice(0, 4).map((item, index) => (
											<li key={`thinks-${index}`} className="flex gap-2">
												<span className="mt-[3px] text-muted-foreground">•</span>
												<span>{item}</span>
											</li>
										))}
									</ul>
								</div>
							)}
							{person.empathyMap.feels.length > 0 && (
								<div className="rounded-lg border border-border/50 bg-background p-3">
									<p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Feels</p>
									<ul className="space-y-1.5 text-sm text-foreground">
										{person.empathyMap.feels.slice(0, 4).map((item, index) => (
											<li key={`feels-${index}`} className="flex gap-2">
												<span className="mt-[3px] text-muted-foreground">•</span>
												<span>{item}</span>
											</li>
										))}
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

	// Order: frameworks first, then custom lenses, then person lenses
	const combinedItems = [...frameworkItems, ...customLensItems, ...personLensItems]
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
				<h2 className="font-semibold text-lg text-foreground">Conversation lenses</h2>
				<p className="text-muted-foreground text-sm">
					Mix of structured frameworks and team-specific perspectives that keep engineering, customer success, and deal
					risks aligned.
				</p>
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
									<span className="font-semibold text-sm text-foreground">{item.title}</span>
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
								className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-3"
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
							{item.highlights && item.highlights.length > 0 ? (
								<div className="rounded-lg border border-border/50 bg-background p-3">
									<p className="mb-2 text-muted-foreground text-xs uppercase tracking-wide">Signals to watch</p>
									<ul className="space-y-2 text-sm text-foreground">
										{item.highlights.map((highlight, index) => (
											<li key={`${item.id}-highlight-${index}`} className="flex gap-2">
												<span className="mt-[3px] text-muted-foreground">•</span>
												<span>{highlight}</span>
											</li>
										))}
									</ul>
								</div>
							) : null}
							{item.content}
						</AccordionContent>
					</AccordionItem>
				))}
			</Accordion>

			{lens ? (
				<div className="grid gap-4 lg:grid-cols-2">
					<StakeholderList stakeholders={lens.entities.stakeholders} />
					<LensExecutionPanel
						nextSteps={lens.entities.nextSteps}
						mapMilestones={lens.entities.mapMilestones}
						objections={lens.entities.objections}
					/>
				</div>
			) : null}
		</div>
	)
}

function friendlyFrameworkOrder(name: string) {
	switch (name) {
		case "BANT_GPCT":
			return 0
		case "SPICED":
			return 1
		case "MEDDIC":
			return 2
		case "MAP":
			return 3
		default:
			return 99
	}
}

function friendlyFrameworkName(name: string) {
	switch (name) {
		case "BANT_GPCT":
			return "BANT / GPCT"
		case "SPICED":
			return "SPICED"
		case "MEDDIC":
			return "MEDDIC"
		case "MAP":
			return "Mutual Action Plan"
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
