import { ArrowRight, Globe, GripVertical, Loader2, Sparkles, Trash2, X } from "lucide-react"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { useActionData, useFetcher, useLoaderData, useLocation, useNavigate } from "react-router"
import { toast } from "sonner"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Separator } from "~/components/ui/separator"
import { Textarea } from "~/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { loadAccountMetadata, updateAccountMetadata } from "~/features/accounts/server/account-settings.server"
import {
	type AccountSettingsMetadata,
	DEFAULT_OPPORTUNITY_STAGES,
	normalizeStageId,
	type OpportunityStageConfig,
} from "~/features/opportunities/stage-config"
import { researchCompanyWebsite } from "~/mastra/tools/research-company-website"
import { userContext } from "~/server/user-context"

/**
 * Company context stored on accounts.accounts table
 * Used by AI for question generation, analysis, and lens application
 */
interface CompanyContext {
	website_url: string | null
	company_description: string | null
	customer_problem: string | null
	offerings: string[] | null
	target_orgs: string[] | null
	target_company_sizes: string[] | null
	target_roles: string[] | null
	competitors: string[] | null
	industry: string | null
}

type LoaderData = {
	accountId: string
	metadata: AccountSettingsMetadata
	companyContext: CompanyContext
	isOnboarding: boolean
	defaultProjectId: string | null
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

export async function loader({ context, params, request }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const accountId = params.accountId

	if (!accountId) throw new Response("Account ID is required", { status: 400 })

	// Check if this is onboarding mode
	const url = new URL(request.url)
	const isOnboarding = url.searchParams.get("onboarding") === "1"

	const metadata = await loadAccountMetadata({ supabase, accountId })

	// Load company context from accounts.accounts table
	const { data: account } = await supabase
		.schema("accounts")
		.from("accounts")
		.select(
			"website_url, company_description, customer_problem, offerings, target_orgs, target_company_sizes, target_roles, competitors, industry"
		)
		.eq("id", accountId)
		.single()

	const companyContext: CompanyContext = {
		website_url: account?.website_url ?? null,
		company_description: account?.company_description ?? null,
		customer_problem: account?.customer_problem ?? null,
		offerings: account?.offerings ?? null,
		target_orgs: account?.target_orgs ?? null,
		target_company_sizes: account?.target_company_sizes ?? null,
		target_roles: account?.target_roles ?? null,
		competitors: account?.competitors ?? null,
		industry: account?.industry ?? null,
	}

	// Get default project for redirect after onboarding
	let defaultProjectId: string | null = null
	if (isOnboarding) {
		const { data: userSettings } = await supabase
			.from("user_settings")
			.select("last_used_project_id")
			.eq("user_id", ctx.claims?.sub)
			.single()
		defaultProjectId = userSettings?.last_used_project_id ?? null
	}

	return {
		accountId,
		metadata,
		companyContext,
		isOnboarding,
		defaultProjectId,
	}
}

export async function action({ context, request, params }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const accountId = params.accountId

	if (!accountId) throw new Response("Account ID is required", { status: 400 })

	const formData = await request.formData()
	const intent = formData.get("intent") as string

	// Handle company context update
	if (intent === "update_company_context") {
		const payload = formData.get("payload") as string
		try {
			const data = JSON.parse(payload) as Partial<CompanyContext>

			const { error } = await supabase
				.schema("accounts")
				.from("accounts")
				.update({
					website_url: data.website_url,
					company_description: data.company_description,
					customer_problem: data.customer_problem,
					offerings: data.offerings,
					target_orgs: data.target_orgs,
					target_company_sizes: data.target_company_sizes,
					target_roles: data.target_roles,
					competitors: data.competitors,
					industry: data.industry,
				})
				.eq("id", accountId)

			if (error) {
				return Response.json({ error: error.message }, { status: 500 })
			}
			return Response.json({ success: true })
		} catch (e) {
			return Response.json({ error: e instanceof Error ? e.message : "Invalid payload" }, { status: 400 })
		}
	}

	// Handle website research
	if (intent === "research_website") {
		const websiteUrl = formData.get("website_url") as string
		if (!websiteUrl) {
			return Response.json({ error: "Website URL is required" }, { status: 400 })
		}
		try {
			const result = await researchCompanyWebsite(websiteUrl)
			return Response.json(result)
		} catch (e) {
			return Response.json({ error: e instanceof Error ? e.message : "Research failed" }, { status: 500 })
		}
	}

	// Handle account metadata update (existing)
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
				return {
					id,
					label: label || id,
					description: item.description?.trim() || undefined,
					discovery_focus,
				}
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
		return Response.json(
			{
				error: error instanceof Error ? error.message : "Failed to save settings",
			},
			{ status: 500 }
		)
	}
}

/**
 * Tag input component for managing string arrays
 */
function TagInput({
	value,
	onChange,
	placeholder,
}: {
	value: string[]
	onChange: (value: string[]) => void
	placeholder?: string
}) {
	const [input, setInput] = useState("")

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" || e.key === ",") {
			e.preventDefault()
			const trimmed = input.trim()
			if (trimmed && !value.includes(trimmed)) {
				onChange([...value, trimmed])
				setInput("")
			}
		} else if (e.key === "Backspace" && !input && value.length > 0) {
			onChange(value.slice(0, -1))
		}
	}

	const removeTag = (tag: string) => {
		onChange(value.filter((t) => t !== tag))
	}

	return (
		<div className="flex flex-wrap gap-2 rounded-md border bg-background p-2">
			{value.map((tag) => (
				<Badge key={tag} variant="secondary" className="gap-1 pr-1 font-normal text-xs">
					{tag}
					<button
						type="button"
						onClick={() => removeTag(tag)}
						className="ml-1 rounded-full hover:bg-muted-foreground/20"
					>
						<X className="h-3 w-3" />
					</button>
				</Badge>
			))}
			<input
				type="text"
				value={input}
				onChange={(e) => setInput(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder={value.length === 0 ? placeholder : "Add more..."}
				className="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
			/>
		</div>
	)
}

/**
 * Company context section - set once, inherited by all projects
 */
function CompanyContextSection({
	context,
	onSave,
	onResearch,
	isResearching,
}: {
	context: CompanyContext
	onSave: (data: CompanyContext) => void
	onResearch: (url: string) => void
	isResearching: boolean
}) {
	const [data, setData] = useState<CompanyContext>(context)
	const [hasChanges, setHasChanges] = useState(false)

	// Generate stable IDs for form elements
	const id = useId()
	const websiteUrlId = `${id}-website-url`
	const companyDescriptionId = `${id}-company-description`
	const customerProblemId = `${id}-customer-problem`
	const industryId = `${id}-industry`

	const updateField = <K extends keyof CompanyContext>(key: K, value: CompanyContext[K]) => {
		setData((prev) => ({ ...prev, [key]: value }))
		setHasChanges(true)
	}

	const handleSave = () => {
		onSave(data)
		setHasChanges(false)
	}

	// Update local state when context changes (e.g., after research)
	useEffect(() => {
		setData(context)
	}, [context])

	return (
		<div>
			<div className="mb-4 flex items-center gap-2">
				<Globe className="h-5 w-5" />
				<h2 className="font-semibold text-xl">Company Context</h2>
			</div>
			<Card className="border-border/60">
				<CardHeader>
					<CardDescription>
						Set once for your account. AI uses this context for question generation, analysis, and lens application
						across all projects.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					{/* Website URL with Research */}
					<div className="space-y-2">
						<Label htmlFor={websiteUrlId}>Company Website</Label>
						<div className="flex gap-2">
							<Input
								id={websiteUrlId}
								type="url"
								placeholder="https://yourcompany.com"
								value={data.website_url || ""}
								onChange={(e) => updateField("website_url", e.target.value)}
								className="flex-1"
							/>
							<Button
								type="button"
								variant="outline"
								onClick={() => data.website_url && onResearch(data.website_url)}
								disabled={!data.website_url || isResearching}
							>
								{isResearching ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Researching...
									</>
								) : (
									<>
										<Sparkles className="mr-2 h-4 w-4" />
										Auto-fill
									</>
								)}
							</Button>
						</div>
						<p className="text-muted-foreground text-xs">
							Enter your website and click Auto-fill to populate fields automatically
						</p>
					</div>

					{/* Description */}
					<div className="space-y-2">
						<Label htmlFor={companyDescriptionId}>Company Description</Label>
						<Textarea
							id={companyDescriptionId}
							placeholder="Brief description of what your company does (1-2 sentences)"
							value={data.company_description || ""}
							onChange={(e) => updateField("company_description", e.target.value)}
							rows={2}
						/>
					</div>

					{/* Customer Problem */}
					<div className="space-y-2">
						<Label htmlFor={customerProblemId}>Customer Problem</Label>
						<Textarea
							id={customerProblemId}
							placeholder="The main problem or pain point you solve for customers"
							value={data.customer_problem || ""}
							onChange={(e) => updateField("customer_problem", e.target.value)}
							rows={2}
						/>
					</div>

					{/* Industry */}
					<div className="space-y-2">
						<Label htmlFor={industryId}>Industry</Label>
						<Input
							id={industryId}
							placeholder="e.g., B2B SaaS, Healthcare Technology, Fintech"
							value={data.industry || ""}
							onChange={(e) => updateField("industry", e.target.value)}
						/>
					</div>

					{/* Offerings */}
					<div className="space-y-2">
						<Label>Products & Services</Label>
						<TagInput
							value={data.offerings || []}
							onChange={(v) => updateField("offerings", v)}
							placeholder="Type and press Enter to add..."
						/>
						<p className="text-muted-foreground text-xs">Main products or services you offer</p>
					</div>

					{/* Target Organizations */}
					<div className="space-y-2">
						<Label>Target Organizations</Label>
						<TagInput
							value={data.target_orgs || []}
							onChange={(v) => updateField("target_orgs", v)}
							placeholder="e.g., Enterprise hospital networks, Fintech startups..."
						/>
					</div>

					{/* Target Company Sizes */}
					<div className="space-y-2">
						<Label>Target Company Sizes</Label>
						<TagInput
							value={data.target_company_sizes || []}
							onChange={(v) => updateField("target_company_sizes", v)}
							placeholder="e.g., Startup, SMB, Enterprise..."
						/>
					</div>

					{/* Target Roles */}
					<div className="space-y-2">
						<Label>Target Roles</Label>
						<TagInput
							value={data.target_roles || []}
							onChange={(v) => updateField("target_roles", v)}
							placeholder="e.g., Product Manager, CTO, VP Engineering..."
						/>
					</div>

					{/* Competitors */}
					<div className="space-y-2">
						<Label>Competitors</Label>
						<TagInput
							value={data.competitors || []}
							onChange={(v) => updateField("competitors", v)}
							placeholder="Known competitors..."
						/>
					</div>

					{/* Save Button */}
					<div className="flex justify-end">
						<Button type="button" onClick={handleSave} disabled={!hasChanges} className="gap-2">
							Save Company Context
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	)
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
			{
				id: normalizeStageId(`item-${computed.length + 1}`),
				label: `Item ${computed.length + 1}`,
			},
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
	const { accountId, metadata, companyContext, isOnboarding, defaultProjectId } = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const _location = useLocation()
	const navigate = useNavigate()
	const fetcher = useFetcher()
	const researchFetcher = useFetcher()
	const companyFetcher = useFetcher()
	const [hasSavedInOnboarding, setHasSavedInOnboarding] = useState(false)

	// Track local company context state for UI updates
	const [localCompanyContext, setLocalCompanyContext] = useState<CompanyContext>(companyContext)
	const [isResearching, setIsResearching] = useState(false)
	const researchedUrlRef = useRef<string | null>(null)

	// Handle research results - auto-save after populating
	useEffect(() => {
		if (researchFetcher.state === "idle" && researchFetcher.data) {
			setIsResearching(false)
			const result = researchFetcher.data as {
				success?: boolean
				error?: string
				data?: {
					description?: string
					customer_problem?: string
					offerings?: string[]
					target_orgs?: string[]
					target_roles?: string[]
					competitors?: string[]
					industry?: string
				}
			}
			if (result.success && result.data) {
				// Merge research results with existing context, preserving the researched URL
				const researchedUrl = researchedUrlRef.current
				const updatedContext: CompanyContext = {
					...localCompanyContext,
					website_url: researchedUrl || localCompanyContext.website_url,
					company_description: result.data?.description || localCompanyContext.company_description,
					customer_problem: result.data?.customer_problem || localCompanyContext.customer_problem,
					offerings: result.data?.offerings || localCompanyContext.offerings,
					target_orgs: result.data?.target_orgs || localCompanyContext.target_orgs,
					target_roles: result.data?.target_roles || localCompanyContext.target_roles,
					competitors: result.data?.competitors || localCompanyContext.competitors,
					industry: result.data?.industry || localCompanyContext.industry,
					target_company_sizes: localCompanyContext.target_company_sizes,
				}
				setLocalCompanyContext(updatedContext)
				researchedUrlRef.current = null

				// Auto-save the researched data so user doesn't lose it
				const formData = new FormData()
				formData.append("intent", "update_company_context")
				formData.append("payload", JSON.stringify(updatedContext))
				companyFetcher.submit(formData, { method: "POST" })

				toast.success("Company info auto-filled and saved")
			} else if (result.error) {
				toast.error(result.error)
			}
		}
	}, [researchFetcher.state, researchFetcher.data])

	// Handle company context save results
	useEffect(() => {
		if (companyFetcher.state === "idle" && companyFetcher.data) {
			const result = companyFetcher.data as {
				success?: boolean
				error?: string
			}
			if (result.success) {
				toast.success("Company context saved")
				if (isOnboarding) {
					setHasSavedInOnboarding(true)
				}
			} else if (result.error) {
				toast.error(result.error)
			}
		}
	}, [companyFetcher.state, companyFetcher.data, isOnboarding])

	const handleResearchWebsite = (url: string) => {
		setIsResearching(true)
		researchedUrlRef.current = url // Track URL for when results come back
		const formData = new FormData()
		formData.append("intent", "research_website")
		formData.append("website_url", url)
		researchFetcher.submit(formData, { method: "POST" })
	}

	const handleSaveCompanyContext = (data: CompanyContext) => {
		setLocalCompanyContext(data)
		const formData = new FormData()
		formData.append("intent", "update_company_context")
		formData.append("payload", JSON.stringify(data))
		companyFetcher.submit(formData, { method: "POST" })
	}

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

	const handleContinueToProjectSetup = () => {
		if (defaultProjectId) {
			navigate(`/a/${accountId}/${defaultProjectId}/setup`)
		} else {
			// Fallback to dashboard if no project ID
			navigate(`/a/${accountId}`)
		}
	}

	// Onboarding mode: Focused UI for company context only
	if (isOnboarding) {
		return (
			<div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8">
				{/* Phase indicator */}
				<div className="text-center">
					<div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm">
						<span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground text-xs">
							1
						</span>
						<span className="font-medium">Define</span>
						<span className="text-muted-foreground">→ Collect → Learn</span>
					</div>
				</div>

				<header className="text-center">
					<h1 className="mb-2 font-semibold text-2xl text-foreground">Welcome! Let's set up your company</h1>
					<p className="text-muted-foreground">
						Tell us about your company so we can help you get the most relevant insights from your customer
						conversations.
					</p>
				</header>

				{actionData?.error && (
					<div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
						{actionData.error}
					</div>
				)}

				<CompanyContextSection
					context={localCompanyContext}
					onSave={handleSaveCompanyContext}
					onResearch={handleResearchWebsite}
					isResearching={isResearching}
				/>

				{/* Continue button */}
				<div className="flex justify-center">
					<Button
						size="lg"
						onClick={handleContinueToProjectSetup}
						disabled={!hasSavedInOnboarding && !localCompanyContext.website_url}
						className="gap-2"
					>
						Continue to Project Setup
						<ArrowRight className="h-4 w-4" />
					</Button>
				</div>

				<p className="text-center text-muted-foreground text-sm">
					You can always update these settings later from Account Settings.
				</p>
			</div>
		)
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
				{/* Company Context - set once, inherited by all projects */}
				<CompanyContextSection
					context={localCompanyContext}
					onSave={handleSaveCompanyContext}
					onResearch={handleResearchWebsite}
					isResearching={isResearching}
				/>

				<Separator className="my-8" />

				<div>
					<h2 className="mb-2 font-semibold text-xl">System Settings</h2>
					<p className="text-muted-foreground text-sm">
						Configure stages and categories for opportunities, journeys, and tasks.
					</p>
				</div>

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
