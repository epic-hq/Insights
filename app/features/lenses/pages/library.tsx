/**
 * Lens Library - Browse and configure conversation lenses
 *
 * Simple single-view interface with toggle buttons on each lens card.
 * Lenses are sorted by category then alphabetically.
 */

import consola from "consola"
import {
	Briefcase,
	Eye,
	EyeOff,
	FlaskConical,
	Glasses,
	Loader2,
	MoreVertical,
	Package,
	Pencil,
	Sparkles,
	Trash2,
	Users,
	Wand2,
} from "lucide-react"
import { useState } from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router"
import { useFetcher, useLoaderData, useRevalidator } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import InlineEdit from "~/components/ui/inline-edit"
import { Switch } from "~/components/ui/switch"
import { Textarea } from "~/components/ui/textarea"
import { type AccountSettingsMetadata, PLATFORM_DEFAULT_LENS_KEYS } from "~/features/opportunities/stage-config"
import { userContext } from "~/server/user-context"
import { CreateLensDialog } from "../components/CreateLensDialog"
import { EditLensDialog } from "../components/EditLensDialog"
import { type LensTemplate, loadLensTemplates } from "../lib/loadLensAnalyses.server"

export const meta: MetaFunction = () => {
	return [{ title: "Lens Library | Insights" }, { name: "description", content: "Browse conversation analysis lenses" }]
}

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const projectId = params.projectId
	const accountId = params.accountId

	if (!supabase) {
		throw new Response("Unauthorized", { status: 401 })
	}

	const templates = await loadLensTemplates(supabase as any)

	// Load enabled lenses using hierarchy:
	// 1. project_settings.enabled_lenses (if configured)
	// 2. account_settings.metadata.default_lens_keys (account defaults)
	// 3. PLATFORM_DEFAULT_LENS_KEYS (platform fallback)
	let enabledLenses: string[] = [...PLATFORM_DEFAULT_LENS_KEYS]
	let interviewCount = 0

	// First, try to get account defaults
	if (accountId) {
		const { data: accountSettings } = await supabase
			.from("account_settings")
			.select("metadata")
			.eq("account_id", accountId)
			.maybeSingle()

		if (accountSettings?.metadata) {
			const metadata = accountSettings.metadata as AccountSettingsMetadata
			if (Array.isArray(metadata.default_lens_keys) && metadata.default_lens_keys.length > 0) {
				enabledLenses = metadata.default_lens_keys
			}
		}
	}

	// Then, check for project-specific overrides
	if (projectId) {
		const { data: project } = await supabase.from("projects").select("project_settings").eq("id", projectId).single()

		if (project?.project_settings) {
			const settings = project.project_settings as Record<string, unknown>
			if (Array.isArray(settings.enabled_lenses) && settings.enabled_lenses.length > 0) {
				enabledLenses = settings.enabled_lenses as string[]
			}
		}

		// Get interview count
		const { count } = await supabase
			.from("interviews")
			.select("id", { count: "exact", head: true })
			.eq("project_id", projectId)

		interviewCount = count || 0
	}

	return { templates, enabledLenses, interviewCount, projectId, accountId, userId: ctx.claims?.sub }
}

export async function action({ request, context, params }: ActionFunctionArgs) {
	const formData = await request.formData()
	const intent = formData.get("intent") as string

	if (intent !== "update_lens_settings") {
		return { error: "Unknown action" }
	}

	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const projectId = params.projectId

	if (!supabase) {
		return { error: "Unauthorized" }
	}

	if (!projectId) {
		return { error: "Project ID required" }
	}

	const enabledLensesJson = (formData.get("enabled_lenses") as string) || "[]"
	const applyToExisting = formData.get("apply_to_existing") === "true"

	let enabledLenses: string[]
	try {
		enabledLenses = JSON.parse(enabledLensesJson)
	} catch {
		return { error: "Invalid lens settings" }
	}

	// Get current project settings
	const { data: project } = await supabase
		.from("projects")
		.select("project_settings, account_id")
		.eq("id", projectId)
		.single()

	const currentSettings = (project?.project_settings as Record<string, unknown>) || {}
	let previousLenses = currentSettings.enabled_lenses as string[] | undefined

	// If no project settings, get previous from account defaults or platform defaults
	if (!previousLenses || previousLenses.length === 0) {
		const accountId = params.accountId
		if (accountId) {
			const { data: accountSettings } = await supabase
				.from("account_settings")
				.select("metadata")
				.eq("account_id", accountId)
				.maybeSingle()

			const metadata = (accountSettings?.metadata || {}) as AccountSettingsMetadata
			previousLenses = metadata.default_lens_keys || PLATFORM_DEFAULT_LENS_KEYS
		} else {
			previousLenses = PLATFORM_DEFAULT_LENS_KEYS
		}
	}

	// Merge new lens settings
	const newSettings = {
		...currentSettings,
		enabled_lenses: enabledLenses,
	}

	const { error } = await supabase
		.from("projects")
		.update({ project_settings: newSettings, updated_at: new Date().toISOString() })
		.eq("id", projectId)

	if (error) {
		return { error: `Failed to save lens settings: ${error.message}` }
	}

	// If apply to existing, trigger backfill
	let backfillTriggered = false
	if (applyToExisting && project?.account_id) {
		const newlyEnabled = enabledLenses.filter((lens) => !previousLenses.includes(lens))

		if (newlyEnabled.length > 0) {
			const { data: interviews } = await supabase
				.from("interviews")
				.select("id")
				.eq("project_id", projectId)
				.neq("lens_visibility", "private")

			if (interviews && interviews.length > 0) {
				try {
					const { applyAllLensesTask } = await import("~/../src/trigger/lens/applyAllLenses")

					for (const interview of interviews) {
						await applyAllLensesTask.trigger({
							interviewId: interview.id,
							accountId: project.account_id,
							projectId,
							lensesToApply: newlyEnabled,
						})
					}

					backfillTriggered = true
					consola.info(`[LensSettings] Triggered backfill for ${interviews.length} interviews`)
				} catch (err) {
					consola.error("[LensSettings] Failed to trigger backfill:", err)
				}
			}
		}
	}

	return { success: true, backfillTriggered }
}

/**
 * Get icon for a lens category
 */
function getCategoryIcon(category: string | null) {
	switch (category) {
		case "research":
			return <FlaskConical className="h-5 w-5" />
		case "sales":
			return <Briefcase className="h-5 w-5" />
		case "product":
			return <Package className="h-5 w-5" />
		default:
			return <Sparkles className="h-5 w-5" />
	}
}

/**
 * Get color scheme for a lens category
 */
function getCategoryColors(category: string | null): {
	bg: string
	text: string
	border: string
	iconBg: string
} {
	switch (category) {
		case "research":
			return {
				bg: "bg-purple-50",
				text: "text-purple-700",
				border: "border-purple-200",
				iconBg: "bg-purple-100",
			}
		case "sales":
			return {
				bg: "bg-blue-50",
				text: "text-blue-700",
				border: "border-blue-200",
				iconBg: "bg-blue-100",
			}
		case "product":
			return {
				bg: "bg-green-50",
				text: "text-green-700",
				border: "border-green-200",
				iconBg: "bg-green-100",
			}
		default:
			return {
				bg: "bg-gray-50",
				text: "text-gray-700",
				border: "border-gray-200",
				iconBg: "bg-gray-100",
			}
	}
}

/**
 * Card for creating a new custom lens - shows textarea and generate button
 */
function CreateLensCard({ accountId, onCreated }: { accountId: string; onCreated?: () => void }) {
	const [description, setDescription] = useState("")
	const fetcher = useFetcher()

	const isGenerating = fetcher.state === "submitting"
	const canGenerate = description.trim().length >= 10

	// Handle successful creation - reset and notify parent
	if (fetcher.data?.ok && !isGenerating) {
		setDescription("")
		onCreated?.()
	}

	function handleGenerate() {
		if (!canGenerate) return

		fetcher.submit(
			{
				intent: "generate_and_create",
				account_id: accountId,
				description: description.trim(),
				is_public: "true",
			},
			{
				method: "POST",
				action: "/api/lens-templates",
			}
		)
	}

	return (
		<Card className="border-2 border-primary/30 border-dashed bg-primary/5 transition-shadow hover:shadow-md">
			<CardHeader className="pb-2">
				<div className="flex items-center gap-3">
					<div className="rounded-lg bg-primary/10 p-2.5">
						<Sparkles className="h-5 w-5 text-primary" />
					</div>
					<CardTitle className="text-lg">Create Custom Lens</CardTitle>
				</div>
			</CardHeader>
			<CardContent className="space-y-3">
				<Textarea
					placeholder="Describe what you want to extract from conversations..."
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					className="min-h-[80px] resize-none bg-background"
					disabled={isGenerating}
				/>
				<div className="flex justify-end">
					<Button size="sm" onClick={handleGenerate} disabled={!canGenerate || isGenerating}>
						{isGenerating ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Generating...
							</>
						) : (
							<>
								<Wand2 className="mr-2 h-4 w-4" />
								Generate
							</>
						)}
					</Button>
				</div>
				{fetcher.data?.error && <p className="text-red-500 text-sm">{fetcher.data.error}</p>}
			</CardContent>
		</Card>
	)
}

/**
 * Lens card component - displays lens info with toggle in upper right
 */
function LensCard({
	template,
	isEnabled,
	onToggle,
	onDelete,
	onToggleVisibility,
	onEdit,
	onUpdateField,
	isSubmitting,
	isOwner,
}: {
	template: LensTemplate
	isEnabled: boolean
	onToggle: (templateKey: string, enabled: boolean) => void
	onDelete?: (templateKey: string) => void
	onToggleVisibility?: (templateKey: string, isPublic: boolean) => void
	onEdit?: (template: LensTemplate) => void
	onUpdateField?: (templateKey: string, field: "template_name" | "summary", value: string) => void
	isSubmitting: boolean
	isOwner: boolean
}) {
	const [dialogOpen, setDialogOpen] = useState(false)
	const colors = getCategoryColors(template.category)
	const isCustom = !template.is_system

	function handleEditClick() {
		setDialogOpen(false)
		onEdit?.(template)
	}

	return (
		<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
			<Card className={`${colors.border} transition-shadow hover:shadow-md`}>
				<CardHeader className="pb-2">
					<div className="flex items-start justify-between gap-3">
						{/* Clickable area to open details */}
						<DialogTrigger asChild>
							<button type="button" className="flex items-center gap-3 text-left hover:opacity-80">
								<div className={`rounded-lg p-2.5 ${colors.iconBg} ${colors.text}`}>
									{getCategoryIcon(template.category)}
								</div>
								<div>
									<CardTitle className="text-lg">{template.template_name}</CardTitle>
									<div className="mt-1 flex items-center gap-2">
										<Badge variant="outline" className="text-muted-foreground">
											{isCustom ? "Custom" : template.category || "general"}
										</Badge>
										{isCustom && !template.is_public && (
											<Badge variant="outline" className="text-xs">
												<EyeOff className="mr-1 h-3 w-3" />
												Private
											</Badge>
										)}
									</div>
								</div>
							</button>
						</DialogTrigger>

						{/* Toggle and actions in upper right */}
						<div className="flex items-center gap-2">
							{isSubmitting && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
							<Switch
								checked={isEnabled}
								onCheckedChange={(checked) => onToggle(template.template_key, checked)}
								disabled={isSubmitting}
								aria-label={`${isEnabled ? "Disable" : "Enable"} ${template.template_name}`}
							/>
							{/* Actions menu for custom lenses - show for all custom, but only owner can edit/delete */}
							{isCustom && (
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="ghost" size="icon" className="h-8 w-8">
											<MoreVertical className="h-4 w-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										{isOwner ? (
											<>
												<DropdownMenuItem onClick={() => onEdit?.(template)}>
													<Pencil className="mr-2 h-4 w-4" />
													Edit Lens
												</DropdownMenuItem>
												<DropdownMenuItem
													onClick={() => onToggleVisibility?.(template.template_key, !template.is_public)}
												>
													{template.is_public ? (
														<>
															<EyeOff className="mr-2 h-4 w-4" />
															Make Private
														</>
													) : (
														<>
															<Eye className="mr-2 h-4 w-4" />
															Share with Team
														</>
													)}
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem
													onClick={() => onDelete?.(template.template_key)}
													className="text-red-600 focus:text-red-600"
												>
													<Trash2 className="mr-2 h-4 w-4" />
													Delete Lens
												</DropdownMenuItem>
											</>
										) : (
											<DropdownMenuItem disabled className="text-muted-foreground">
												Shared by team member
											</DropdownMenuItem>
										)}
									</DropdownMenuContent>
								</DropdownMenu>
							)}
						</div>
					</div>
				</CardHeader>
				<CardContent className="pt-0">
					{template.summary && <p className="text-muted-foreground text-sm">{template.summary}</p>}
				</CardContent>
			</Card>

			{/* Details dialog content */}
			<DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<div className={`rounded-lg p-2 ${colors.iconBg}`}>{getCategoryIcon(template.category)}</div>
						{isCustom && isOwner && onUpdateField ? (
							<InlineEdit
								value={template.template_name}
								placeholder="Lens name..."
								textClassName="text-lg font-semibold"
								onSubmit={(value) => onUpdateField(template.template_key, "template_name", value)}
							/>
						) : (
							template.template_name
						)}
					</DialogTitle>
					{isCustom && isOwner && onUpdateField ? (
						<InlineEdit
							value={template.summary || ""}
							placeholder="Add a description..."
							textClassName="text-muted-foreground text-sm"
							onSubmit={(value) => onUpdateField(template.template_key, "summary", value)}
						/>
					) : (
						<DialogDescription>{template.summary}</DialogDescription>
					)}
				</DialogHeader>

				<div className="mt-4 space-y-6">
					{/* Sections */}
					<div>
						<h4 className="mb-3 font-semibold text-muted-foreground text-sm uppercase tracking-wide">
							Sections ({template.template_definition.sections.length})
						</h4>
						<div className="space-y-4">
							{template.template_definition.sections.map((section) => (
								<Card key={section.section_key} className="bg-muted/30">
									<CardHeader className="py-3">
										<CardTitle className="text-base">{section.section_name}</CardTitle>
										{section.description && <CardDescription>{section.description}</CardDescription>}
									</CardHeader>
									<CardContent className="py-2">
										<div className="space-y-2">
											{section.fields.map((field) => (
												<div
													key={field.field_key}
													className="flex items-center justify-between rounded bg-background px-2 py-1 text-sm"
												>
													<span className="font-medium">{field.field_name}</span>
													<Badge variant="outline" className="text-xs">
														{field.field_type}
													</Badge>
												</div>
											))}
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					</div>

					{/* Entities */}
					{template.template_definition.entities && template.template_definition.entities.length > 0 && (
						<div>
							<h4 className="mb-3 font-semibold text-muted-foreground text-sm uppercase tracking-wide">
								Entities Extracted
							</h4>
							<div className="flex flex-wrap gap-2">
								{template.template_definition.entities.map((entity) => (
									<Badge key={entity} variant="secondary">
										<Users className="mr-1 h-3 w-3" />
										{entity}
									</Badge>
								))}
							</div>
						</div>
					)}

					{/* Original description for custom lenses */}
					{isCustom && template.nlp_source && (
						<div>
							<h4 className="mb-3 font-semibold text-muted-foreground text-sm uppercase tracking-wide">
								Original Description
							</h4>
							<p className="text-muted-foreground text-sm italic">"{template.nlp_source}"</p>
						</div>
					)}

					{/* Created by info for custom lenses */}
					{isCustom && isOwner && <div className="border-t pt-4 text-muted-foreground text-xs">Mine</div>}
				</div>

				{/* Edit button for custom lenses owned by user */}
				{isCustom && isOwner && onEdit && (
					<DialogFooter className="mt-6">
						<Button variant="outline" onClick={handleEditClick}>
							<Pencil className="mr-2 h-4 w-4" />
							Edit Lens
						</Button>
					</DialogFooter>
				)}
			</DialogContent>
		</Dialog>
	)
}
/**
 * Sort templates by category then alphabetically by name
 */
function sortTemplates(templates: LensTemplate[]): LensTemplate[] {
	const categoryOrder = ["sales", "research", "product"]

	return [...templates].sort((a, b) => {
		// Sort by category first
		const catA = a.category || "zzz" // Put uncategorized last
		const catB = b.category || "zzz"
		const catIndexA = categoryOrder.indexOf(catA)
		const catIndexB = categoryOrder.indexOf(catB)

		// If both in order, use that order; if one not in order, put it after
		const orderA = catIndexA === -1 ? categoryOrder.length : catIndexA
		const orderB = catIndexB === -1 ? categoryOrder.length : catIndexB

		if (orderA !== orderB) {
			return orderA - orderB
		}

		// Same category: sort alphabetically by name
		return a.template_name.localeCompare(b.template_name)
	})
}

export default function LensLibrary() {
	const { templates, enabledLenses, projectId, accountId, userId } = useLoaderData<typeof loader>()
	const fetcher = useFetcher()
	const deleteFetcher = useFetcher()
	const visibilityFetcher = useFetcher()
	const revalidator = useRevalidator()

	// Edit dialog state
	const [editingTemplate, setEditingTemplate] = useState<LensTemplate | null>(null)

	// Track pending toggle for optimistic UI
	const pendingToggle = fetcher.formData?.get("toggle_lens") as string | null
	const isSubmitting = fetcher.state === "submitting"

	// Compute current enabled lenses (with optimistic update)
	const currentEnabledLenses = (() => {
		if (pendingToggle && fetcher.formData) {
			const enabled = fetcher.formData.get("enabled") === "true"
			if (enabled) {
				return [...enabledLenses, pendingToggle]
			}
			return enabledLenses.filter((key) => key !== pendingToggle)
		}
		return enabledLenses
	})()

	// Sort templates by category then alphabetically
	const sortedTemplates = sortTemplates(templates)

	// Handle toggle - immediately submit to save
	const handleToggle = (templateKey: string, enabled: boolean) => {
		if (!projectId) return

		// Calculate new enabled lenses
		const newEnabledLenses = enabled
			? [...enabledLenses, templateKey]
			: enabledLenses.filter((key) => key !== templateKey)

		fetcher.submit(
			{
				intent: "update_lens_settings",
				enabled_lenses: JSON.stringify(newEnabledLenses),
				apply_to_existing: "false",
				toggle_lens: templateKey,
				enabled: String(enabled),
			},
			{ method: "post" }
		)
	}

	// Handle delete custom lens
	const handleDelete = (templateKey: string) => {
		if (!accountId || !confirm("Delete this custom lens? This cannot be undone.")) return

		deleteFetcher.submit(
			{
				intent: "delete",
				template_key: templateKey,
				account_id: accountId,
			},
			{
				method: "POST",
				action: "/api/lens-templates",
			}
		)
	}

	// Handle toggle visibility
	const handleToggleVisibility = (templateKey: string, isPublic: boolean) => {
		if (!accountId) return

		visibilityFetcher.submit(
			{
				intent: "update",
				template_key: templateKey,
				account_id: accountId,
				is_public: String(isPublic),
			},
			{
				method: "POST",
				action: "/api/lens-templates",
			}
		)
	}

	// Handle lens created - revalidate to show new lens
	const handleLensCreated = () => {
		revalidator.revalidate()
	}

	// Handle edit custom lens
	const handleEdit = (template: LensTemplate) => {
		setEditingTemplate(template)
	}

	// Handle lens updated - revalidate and close dialog
	const handleLensUpdated = () => {
		revalidator.revalidate()
		setEditingTemplate(null)
	}

	// Handle inline field update
	const handleUpdateField = (templateKey: string, field: "template_name" | "summary", value: string) => {
		if (!accountId) return

		visibilityFetcher.submit(
			{
				intent: "update",
				template_key: templateKey,
				account_id: accountId,
				[field]: value,
			},
			{
				method: "POST",
				action: "/api/lens-templates",
			}
		)
	}

	// Count enabled lenses
	const enabledCount = currentEnabledLenses.filter((key) => templates.some((t) => t.template_key === key)).length

	// Group templates: custom first, then system
	const customTemplates = sortedTemplates.filter((t) => !t.is_system)
	const systemTemplates = sortedTemplates.filter((t) => t.is_system)

	// Helper to render a lens card
	const renderLensCard = (template: LensTemplate) => (
		<LensCard
			key={template.template_key}
			template={template}
			isEnabled={currentEnabledLenses.includes(template.template_key)}
			onToggle={handleToggle}
			onDelete={handleDelete}
			onToggleVisibility={handleToggleVisibility}
			onEdit={handleEdit}
			onUpdateField={handleUpdateField}
			isSubmitting={isSubmitting && pendingToggle === template.template_key}
			isOwner={template.created_by === userId}
		/>
	)

	return (
		<div className="container max-w-6xl py-8">
			{/* Header */}
			<div className="mb-8">
				<div className="mb-2 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="rounded-lg bg-primary/10 p-2">
							<Glasses className="h-6 w-6 text-primary" />
						</div>
						<h1 className="font-bold text-3xl">Lens Library</h1>
					</div>
					<div className="flex items-center gap-3">
						<Badge variant="secondary" className="text-sm">
							{enabledCount} of {templates.length} enabled
						</Badge>
						{accountId && <CreateLensDialog accountId={accountId} onCreated={handleLensCreated} />}
					</div>
				</div>
				<p className="text-lg text-muted-foreground">
					Lenses automatically extract structured insights from your conversations. Enable lenses to populate feeds,
					power dashboards, and generate on-demand analysis.
				</p>
			</div>

			{/* Custom Lenses Section - always show with create card */}
			<div className="mb-8">
				<h2 className="mb-4 flex items-center gap-2 font-semibold text-lg">
					<Sparkles className="h-5 w-5 text-primary" />
					Custom Lenses
				</h2>
				<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
					{/* Create new lens card - always first */}
					{accountId && <CreateLensCard accountId={accountId} onCreated={handleLensCreated} />}
					{customTemplates.map(renderLensCard)}
				</div>
			</div>

			{/* System Lenses Section */}
			<div>
				<h2 className="mb-4 flex items-center gap-2 font-semibold text-lg">
					<Package className="h-5 w-5 text-muted-foreground" />
					System Lenses
				</h2>
				<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{systemTemplates.map(renderLensCard)}</div>
			</div>

			{/* Edit Lens Dialog */}
			{editingTemplate && accountId && (
				<EditLensDialog
					open={!!editingTemplate}
					onOpenChange={(open) => !open && setEditingTemplate(null)}
					template={editingTemplate}
					accountId={accountId}
					onUpdated={handleLensUpdated}
				/>
			)}

			{/* Feedback messages */}
			{fetcher.data?.error && (
				<div className="mt-4 rounded-md bg-red-50 p-3 text-red-700 text-sm dark:bg-red-950/20 dark:text-red-400">
					{fetcher.data.error}
				</div>
			)}
			{deleteFetcher.data?.error && (
				<div className="mt-4 rounded-md bg-red-50 p-3 text-red-700 text-sm dark:bg-red-950/20 dark:text-red-400">
					{deleteFetcher.data.error}
				</div>
			)}
		</div>
	)
}
