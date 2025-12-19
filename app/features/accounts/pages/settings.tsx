import { GripVertical, Trash2 } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { useActionData, useFetcher, useLoaderData, useLocation } from "react-router"
import { toast } from "sonner"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Separator } from "~/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { loadAccountMetadata, updateAccountMetadata } from "~/features/accounts/server/account-settings.server"
import {
	type AccountSettingsMetadata,
	DEFAULT_OPPORTUNITY_STAGES,
	normalizeStageId,
	type OpportunityStageConfig,
} from "~/features/opportunities/stage-config"
import { userContext } from "~/server/user-context"

type LoaderData = {
	accountId: string
	metadata: AccountSettingsMetadata
}

const DEFAULT_JOURNEY_STAGES: OpportunityStageConfig[] = [
	{
		id: "status-quo",
		label: "Status Quo",
		description: "User is coping with existing tools or workarounds. No active search yet.",
		discovery_focus: "Hidden pain, inertia, triggers",
	},
	{
		id: "problem-recognition",
		label: "Problem Recognition",
		description: "Pain becomes explicit. Cost, risk, or frustration is acknowledged.",
		discovery_focus: "Pain intensity, frequency, stakes",
	},
	{
		id: "solution-exploration",
		label: "Solution Exploration",
		description: "User explores approaches and alternatives. Mental models form.",
		discovery_focus: "Expectations, comparisons, buying criteria",
	},
	{
		id: "first-value",
		label: "First Value",
		description: "User experiences a concrete win or moment of clarity.",
		discovery_focus: "Activation moments, time-to-value",
	},
	{
		id: "workflow-adoption",
		label: "Workflow Adoption",
		description: "Product fits into real workflows and routines.",
		discovery_focus: "Friction, habit formation, drop-off causes",
	},
	{
		id: "dependence",
		label: "Dependence",
		description: "User trusts and relies on the product. Removal would hurt.",
		discovery_focus: "Trust, reliability, failure modes",
	},
	{
		id: "expansion",
		label: "Expansion",
		description: "Usage broadens across people, use cases, or spend.",
		discovery_focus: "Secondary jobs, adjacent value, scale limits",
	},
]

const DEFAULT_PRIORITY_CLUSTERS: OpportunityStageConfig[] = [
	{
		id: "product",
		label: "Product",
		description:
			"What should exist. Feature ideas, capabilities, scope decisions, and roadmap inputs driven by customer needs.",
	},
	{
		id: "usability",
		label: "Usability",
		description: "How it's experienced. UX friction, onboarding gaps, confusing flows, and accessibility issues.",
	},
	{
		id: "value",
		label: "Value",
		description:
			"Why it matters. Jobs-to-be-done, pain intensity, desired outcomes, ROI, and willingness-to-pay signals.",
	},
	{
		id: "engagement",
		label: "Engagement",
		description:
			"What brings users back. Activation moments, feature adoption, retention drivers, and drop-off causes.",
	},
	{
		id: "acquisition",
		label: "Acquisition",
		description: "How users arrive. Messaging, positioning, channels, awareness gaps, and demand signals.",
	},
	{
		id: "sales",
		label: "Sales",
		description: "How buying decisions happen. Objections, pricing concerns, stakeholder dynamics, and deal friction.",
	},
	{
		id: "support",
		label: "Support",
		description: "What breaks post-launch. Bugs, edge cases, workarounds, and expectation mismatches.",
	},
	{
		id: "trust-risk",
		label: "Trust & Risk",
		description: "Where hesitation comes from. Privacy, accuracy, compliance, reliability, and AI-related concerns.",
	},
	{
		id: "ops-scale",
		label: "Ops & Scale",
		description:
			"What fails at growth. Admin pain, permissions, billing ops, data hygiene, and multi-account complexity.",
	},
	{
		id: "other",
		label: "Other",
		description: "Catch-all for items that don't fit the current categories.",
	},
]

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const accountId = params.accountId

	if (!accountId) throw new Response("Account ID is required", { status: 400 })

	const metadata = await loadAccountMetadata({ supabase, accountId })

	return { accountId, metadata }
}

export async function action({ context, request, params }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const accountId = params.accountId

	if (!accountId) throw new Response("Account ID is required", { status: 400 })

	const formData = await request.formData()
	const payload = (formData.get("payload") as string) || "{}"

	let parsed: {
		opportunityStages?: OpportunityStageConfig[]
		journeyStages?: OpportunityStageConfig[]
		priorityClusters?: OpportunityStageConfig[]
	} = {}

	try {
		parsed = JSON.parse(payload)
	} catch {
		return Response.json({ error: "Invalid payload" }, { status: 400 })
	}

	const normalizeList = (items: OpportunityStageConfig[] | undefined, fallback: OpportunityStageConfig[]) => {
		const safeItems = Array.isArray(items) ? items : fallback
		return safeItems
			.map((item, idx) => {
				const label = (item.label || item.id || `Item ${idx + 1}`).toString().trim()
				const id = normalizeStageId(item.id || label)
				if (!id) return null
				const discovery_focus =
					typeof item.discovery_focus === "string" && item.discovery_focus.trim().length > 0
						? item.discovery_focus.trim()
						: undefined
				return { id, label: label || id, description: item.description?.trim() || undefined, discovery_focus }
			})
			.filter(Boolean) as OpportunityStageConfig[]
	}

	const opportunityStages = normalizeList(parsed.opportunityStages, DEFAULT_OPPORTUNITY_STAGES)
	const journeyStages = normalizeList(parsed.journeyStages, DEFAULT_JOURNEY_STAGES)
	const priorityClusters = normalizeList(parsed.priorityClusters, DEFAULT_PRIORITY_CLUSTERS)

	try {
		await updateAccountMetadata({
			supabase,
			accountId,
			metadata: {
				opportunity_stages: opportunityStages,
				journey_stages: journeyStages,
				priority_clusters: priorityClusters,
			},
		})
		return Response.json({ success: true })
	} catch (error) {
		return Response.json({ error: error instanceof Error ? error.message : "Failed to save settings" }, { status: 500 })
	}
}

type EditableListProps = {
	title: string
	description: string
	items: OpportunityStageConfig[]
	defaultItems: OpportunityStageConfig[]
	onChange: (items: OpportunityStageConfig[]) => void
	onSave?: (items: OpportunityStageConfig[]) => void
}

function EditableList({ title, description, items, defaultItems, onChange, onSave }: EditableListProps) {
	const [isEditing, setIsEditing] = useState(false)
	const [dragIndex, setDragIndex] = useState<number | null>(null)
	const computed = useMemo(
		() =>
			items.map((item, idx) => ({
				...item,
				id: normalizeStageId(item.id || item.label || `item-${idx + 1}`),
				label: item.label || item.id || `Item ${idx + 1}`,
			})),
		[items]
	)

	const updateItem = (index: number, label: string) => {
		onChange(computed.map((item, idx) => (idx === index ? { ...item, label, id: normalizeStageId(label) } : item)))
	}

	const addItem = () => {
		onChange([
			...computed,
			{ id: normalizeStageId(`item-${computed.length + 1}`), label: `Item ${computed.length + 1}` },
		])
	}

	const removeItem = (index: number) => {
		onChange(computed.filter((_, idx) => idx !== index))
	}

	const moveItem = (from: number, to: number) => {
		if (to < 0 || to >= computed.length) return
		const clone = [...computed]
		const [removed] = clone.splice(from, 1)
		clone.splice(to, 0, removed)
		onChange(clone)
	}

	const reset = () => onChange(defaultItems)

	const renderTooltipContent = (item: OpportunityStageConfig) => {
		const description = item.description?.trim()
		const discoveryFocus = item.discovery_focus?.trim()

		if (!description && !discoveryFocus) return null

		return (
			<div className="max-w-xs space-y-1 text-xs">
				{description && <p>{description}</p>}
				{discoveryFocus && <p className="text-muted-foreground">Discovery focus: {discoveryFocus}</p>}
			</div>
		)
	}

	const renderLabelChip = (item: OpportunityStageConfig) => {
		const tooltipContent = renderTooltipContent(item)
		const label = (
			<span className="rounded-md bg-background px-3 py-1 text-foreground shadow-sm ring-1 ring-border/60">
				{item.label}
			</span>
		)

		if (!tooltipContent) return label

		return (
			<Tooltip delayDuration={300}>
				<TooltipTrigger asChild>{label}</TooltipTrigger>
				<TooltipContent>{tooltipContent}</TooltipContent>
			</Tooltip>
		)
	}

	const renderEditableLabel = (item: OpportunityStageConfig, onLabelChange: (value: string) => void) => {
		const tooltipContent = renderTooltipContent(item)
		const input = <Input value={item.label} onChange={(e) => onLabelChange(e.target.value)} />

		if (!tooltipContent) return input

		return (
			<Tooltip delayDuration={300}>
				<TooltipTrigger asChild>{input}</TooltipTrigger>
				<TooltipContent>{tooltipContent}</TooltipContent>
			</Tooltip>
		)
	}

	return (
		<Card className="border-border/60">
			<CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<CardTitle className="text-xl">{title}</CardTitle>
					<CardDescription>{description}</CardDescription>
				</div>
				<div className="flex gap-2">
					<Button variant="outline" size="sm" type="button" onClick={() => setIsEditing((prev) => !prev)}>
						{isEditing ? "Done" : "Edit"}
					</Button>
					<Button variant="ghost" size="sm" type="button" onClick={reset}>
						Reset
					</Button>
				</div>
			</CardHeader>
			<CardContent className="space-y-3">
				{!isEditing ? (
					<div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
						<div className="flex flex-wrap gap-2">
							{computed.map((item) => (
								<span key={item.id}>{renderLabelChip(item)}</span>
							))}
						</div>
					</div>
				) : (
					<div className="rounded-md border border-border/60">
						<div className="grid grid-cols-[40px_1fr_200px_80px] items-center bg-muted/40 px-3 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
							<span />
							<span>Label</span>
							<span className="text-right">Stored value</span>
							<span className="text-right">Actions</span>
						</div>
						{computed.map((item, idx) => (
							<div
								key={item.id || idx}
								className="grid grid-cols-[40px_1fr_200px_80px] items-center gap-2 border-border/50 border-t px-3 py-2 text-sm"
								draggable
								onDragStart={() => setDragIndex(idx)}
								onDragOver={(e) => e.preventDefault()}
								onDrop={() => {
									if (dragIndex !== null && dragIndex !== idx) moveItem(dragIndex, idx)
									setDragIndex(null)
								}}
								onDragEnd={() => setDragIndex(null)}
							>
								<button
									type="button"
									className="flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-muted/60 hover:bg-muted"
									title="Drag to reorder"
								>
									<GripVertical className="h-4 w-4" />
								</button>
								{renderEditableLabel(item, (value) => updateItem(idx, value))}
								<TooltipProvider>
									<Tooltip delayDuration={150}>
										<TooltipTrigger asChild>
											<span className="justify-self-end rounded bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
												{normalizeStageId(item.id || item.label)}
											</span>
										</TooltipTrigger>
										<TooltipContent>
											<p>Generated from the label</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
								<div className="flex items-center justify-end gap-1">
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="h-8 w-8 text-destructive"
										onClick={() => removeItem(idx)}
										title="Delete"
										disabled={computed.length <= 1}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							</div>
						))}
						<div className="flex items-center justify-between border-border/50 border-t px-3 py-2">
							<Button variant="outline" size="sm" type="button" onClick={addItem}>
								Add row
							</Button>
							{onSave && (
								<Button size="sm" type="button" onClick={() => onSave(computed)}>
									Save section
								</Button>
							)}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	)
}

export default function AccountSettingsPage() {
	const { accountId, metadata } = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const _location = useLocation()
	const fetcher = useFetcher()

	const [opportunityStages, setOpportunityStages] = useState<OpportunityStageConfig[]>(
		metadata.opportunity_stages && metadata.opportunity_stages.length > 0
			? (metadata.opportunity_stages as OpportunityStageConfig[])
			: DEFAULT_OPPORTUNITY_STAGES
	)
	const [journeyStages, setJourneyStages] = useState<OpportunityStageConfig[]>(
		metadata.journey_stages && metadata.journey_stages.length > 0
			? (metadata.journey_stages as OpportunityStageConfig[])
			: DEFAULT_JOURNEY_STAGES
	)
	const [priorityClusters, setPriorityClusters] = useState<OpportunityStageConfig[]>(
		metadata.priority_clusters && metadata.priority_clusters.length > 0
			? (metadata.priority_clusters as OpportunityStageConfig[])
			: DEFAULT_PRIORITY_CLUSTERS
	)

	const [savingSection, setSavingSection] = useState<string | null>(null)
	const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({})
	const mountedRef = useRef(true)

	useEffect(() => {
		return () => {
			mountedRef.current = false
			Object.values(saveTimers.current).forEach((timer) => {
				if (timer) clearTimeout(timer)
			})
		}
	}, [])

	const buildPayload = (overrides?: {
		opportunityStages?: OpportunityStageConfig[]
		journeyStages?: OpportunityStageConfig[]
		priorityClusters?: OpportunityStageConfig[]
	}) => ({
		opportunityStages: overrides?.opportunityStages ?? opportunityStages,
		journeyStages: overrides?.journeyStages ?? journeyStages,
		priorityClusters: overrides?.priorityClusters ?? priorityClusters,
	})

	const scheduleSave = async (
		sectionKey: string,
		overrides?: {
			opportunityStages?: OpportunityStageConfig[]
			journeyStages?: OpportunityStageConfig[]
			priorityClusters?: OpportunityStageConfig[]
		},
		options?: { debounce?: boolean; toastOnSuccess?: boolean }
	) => {
		const payload = buildPayload(overrides)
		const debounce = options?.debounce ?? true

		const run = () => {
			if (!mountedRef.current) return
			setSavingSection(sectionKey)

			const formData = new FormData()
			formData.append("payload", JSON.stringify(payload))

			fetcher.submit(formData, {
				method: "POST",
			})

			if (options?.toastOnSuccess) {
				toast.success("Saving...")
			}

			// Reset saving state after a delay
			setTimeout(() => {
				if (mountedRef.current) {
					setSavingSection((current) => (current === sectionKey ? null : current))
				}
			}, 1000)
		}

		if (debounce) {
			if (saveTimers.current[sectionKey]) {
				clearTimeout(saveTimers.current[sectionKey] as NodeJS.Timeout)
			}
			saveTimers.current[sectionKey] = setTimeout(run, 800)
		} else {
			run()
		}
	}

	// Handle fetcher response
	useEffect(() => {
		if (fetcher.state === "idle" && fetcher.data) {
			if ((fetcher.data as any)?.error) {
				toast.error((fetcher.data as any).error)
			} else if ((fetcher.data as any)?.success) {
				// Success handled in scheduleSave
			}
			setSavingSection(null)
		}
	}, [fetcher.state, fetcher.data])

	const handleOpportunityChange = (items: OpportunityStageConfig[]) => {
		setOpportunityStages(items)
		void scheduleSave("opportunity", { opportunityStages: items }, { debounce: true })
	}

	const handleJourneyChange = (items: OpportunityStageConfig[]) => {
		setJourneyStages(items)
		void scheduleSave("journey", { journeyStages: items }, { debounce: true })
	}

	const handlePriorityChange = (items: OpportunityStageConfig[]) => {
		setPriorityClusters(items)
		void scheduleSave("priority", { priorityClusters: items }, { debounce: true })
	}

	return (
		<div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8">
			<div>
				<h1 className="text-balance font-bold text-3xl tracking-tight">Account settings</h1>
				<p className="text-muted-foreground">Pipeline defaults and ordering apply to all projects in this account.</p>
			</div>

			{actionData?.error && (
				<div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
					{actionData.error}
				</div>
			)}
			{actionData?.success && (
				<div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-primary text-sm">Saved</div>
			)}

			<div className="space-y-6">
				<EditableList
					title="Opportunity stages"
					description="Used for deal kanban columns and stage dropdowns across projects."
					items={opportunityStages}
					defaultItems={DEFAULT_OPPORTUNITY_STAGES}
					onChange={handleOpportunityChange}
					onSave={(items) =>
						scheduleSave("opportunity", { opportunityStages: items }, { debounce: false, toastOnSuccess: true })
					}
				/>

				<EditableList
					title="Journey stages"
					description="Customer journey steps for interviews, insights, or dashboards."
					items={journeyStages}
					defaultItems={DEFAULT_JOURNEY_STAGES}
					onChange={handleJourneyChange}
					onSave={(items) =>
						scheduleSave("journey", { journeyStages: items }, { debounce: false, toastOnSuccess: true })
					}
				/>

				<EditableList
					title="Task categories"
					description="Use consistent categories for tasks, prioritization, and roadmaps."
					items={priorityClusters}
					defaultItems={DEFAULT_PRIORITY_CLUSTERS}
					onChange={handlePriorityChange}
					onSave={(items) =>
						scheduleSave("priority", { priorityClusters: items }, { debounce: false, toastOnSuccess: true })
					}
				/>

				<div className="flex items-center gap-3">
					<Button type="button" onClick={() => scheduleSave("all", {}, { debounce: false, toastOnSuccess: true })}>
						Save all
					</Button>
					<Separator orientation="vertical" className="h-6" />
					<p className="text-muted-foreground text-sm">
						Applies to account {accountId}
						{savingSection ? " – saving..." : ""}
					</p>
				</div>
			</div>
		</div>
	)
}
