import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation } from "react-router"
import { GripVertical, Trash2 } from "lucide-react"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { useActionData, useLoaderData } from "react-router"
import { toast } from "sonner"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Separator } from "~/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { loadAccountMetadata, updateAccountMetadata } from "~/features/accounts/server/account-settings.server"
import {
	DEFAULT_OPPORTUNITY_STAGES,
	normalizeStageId,
	type AccountSettingsMetadata,
	type OpportunityStageConfig,
} from "~/features/opportunities/stage-config"
import { userContext } from "~/server/user-context"

type LoaderData = {
	accountId: string
	metadata: AccountSettingsMetadata
}

const DEFAULT_JOURNEY_STAGES: OpportunityStageConfig[] = [
	{ id: "aware", label: "Aware" },
	{ id: "consider", label: "Consider" },
	{ id: "trial", label: "Trial" },
	{ id: "adopt", label: "Adopt" },
	{ id: "expand", label: "Expand" },
]

const DEFAULT_PRIORITY_CLUSTERS: OpportunityStageConfig[] = [
	{ id: "product-workflows", label: "Product – Workflows" },
	{ id: "product-intelligence", label: "Product – Intelligence" },
	{ id: "ux-reliability", label: "Foundation – UX & Reliability" },
	{ id: "revenue", label: "Monetization" },
	{ id: "engagement", label: "Engagement" },
	{ id: "gtm", label: "Acquisition & GTM" },
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
		return { error: "Invalid payload" }
	}

	const normalizeList = (items: OpportunityStageConfig[] | undefined, fallback: OpportunityStageConfig[]) => {
		const safeItems = Array.isArray(items) ? items : fallback
		return safeItems
			.map((item, idx) => {
				const label = (item.label || item.id || `Item ${idx + 1}`).toString().trim()
				const id = normalizeStageId(item.id || label)
				if (!id) return null
				return { id, label: label || id, description: item.description?.trim() || undefined }
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
		onChange(
			computed.map((item, idx) => (idx === index ? { ...item, label, id: normalizeStageId(label) } : item))
		)
	}

	const addItem = () => {
		onChange([...computed, { id: normalizeStageId(`item-${computed.length + 1}`), label: `Item ${computed.length + 1}` }])
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
								<span
									key={item.id}
									className="rounded-md bg-background px-3 py-1 text-foreground shadow-sm ring-1 ring-border/60"
								>
									{item.label}
								</span>
							))}
						</div>
					</div>
				) : (
					<div className="rounded-md border border-border/60">
						<div className="grid grid-cols-[40px_1fr_200px_80px] items-center bg-muted/40 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
							<span />
							<span>Label</span>
							<span className="text-right">Stored value</span>
							<span className="text-right">Actions</span>
						</div>
						{computed.map((item, idx) => (
							<div
								key={item.id || idx}
								className="grid grid-cols-[40px_1fr_200px_80px] items-center border-t border-border/50 px-3 py-2 text-sm gap-2"
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
								<Input value={item.label} onChange={(e) => updateItem(idx, e.target.value)} />
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
						<div className="flex items-center justify-between border-t border-border/50 px-3 py-2">
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
	const location = useLocation()

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

		const run = async () => {
			if (!mountedRef.current) return
			setSavingSection(sectionKey)
			try {
				const formData = new FormData()
				formData.append("payload", JSON.stringify(payload))
				const res = await fetch(location.pathname, {
					method: "POST",
					body: formData,
					headers: { Accept: "application/json" },
				})

				// Check if response is JSON before parsing
				const contentType = res.headers.get("content-type")
				if (!contentType || !contentType.includes("application/json")) {
					throw new Error(`Server returned ${res.status} ${res.statusText}. Expected JSON but got ${contentType || "unknown content type"}`)
				}

				const result = await res.json()
				if (!res.ok || result?.error) {
					throw new Error(result?.error || "Failed to save")
				}
				if (options?.toastOnSuccess && mountedRef.current) toast.success("Saved")
			} catch (error) {
				const message = error instanceof Error ? error.message : "Failed to save"
				console.error("Settings save error:", error)
				if (mountedRef.current) toast.error(message)
			} finally {
				if (mountedRef.current) {
					setSavingSection((current) => (current === sectionKey ? null : current))
				}
			}
		}

		if (debounce) {
			if (saveTimers.current[sectionKey]) {
				clearTimeout(saveTimers.current[sectionKey] as NodeJS.Timeout)
			}
			saveTimers.current[sectionKey] = setTimeout(run, 800)
		} else {
			await run()
		}
	}

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
				<div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{actionData.error}
				</div>
			)}
			{actionData?.success && (
				<div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
					Saved
				</div>
			)}

			<div className="space-y-6">
				<EditableList
					title="Opportunity stages"
					description="Used for deal kanban columns and stage dropdowns across projects."
					items={opportunityStages}
					defaultItems={DEFAULT_OPPORTUNITY_STAGES}
					onChange={handleOpportunityChange}
					onSave={(items) => scheduleSave("opportunity", { opportunityStages: items }, { debounce: false, toastOnSuccess: true })}
				/>

				<EditableList
					title="Journey stages"
					description="Customer journey steps for interviews, insights, or dashboards."
					items={journeyStages}
					defaultItems={DEFAULT_JOURNEY_STAGES}
					onChange={handleJourneyChange}
					onSave={(items) => scheduleSave("journey", { journeyStages: items }, { debounce: false, toastOnSuccess: true })}
				/>

				<EditableList
					title="Priority clusters"
					description="Use consistent categories for prioritization and roadmaps."
					items={priorityClusters}
					defaultItems={DEFAULT_PRIORITY_CLUSTERS}
					onChange={handlePriorityChange}
					onSave={(items) => scheduleSave("priority", { priorityClusters: items }, { debounce: false, toastOnSuccess: true })}
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
