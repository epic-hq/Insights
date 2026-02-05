/**
 * Manage Lenses Dialog - Settings/config for lens templates
 *
 * Refactored from the old Library page. Accessible via gear icon in the
 * Analysis page header. Allows enabling/disabling lenses and creating
 * custom lenses.
 */

import {
	Briefcase,
	Eye,
	EyeOff,
	FlaskConical,
	Loader2,
	MoreVertical,
	Package,
	Pencil,
	Sparkles,
	Trash2,
} from "lucide-react"
import { useState } from "react"
import { useFetcher, useRevalidator } from "react-router"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Switch } from "~/components/ui/switch"
import { CreateLensDialog } from "./CreateLensDialog"
import { EditLensDialog } from "./EditLensDialog"
import type { LensTemplate } from "../lib/loadLensAnalyses.server"

type ManageLensesDialogProps = {
	open: boolean
	onOpenChange: (open: boolean) => void
	templates: LensTemplate[]
	enabledLenses: string[]
	accountId: string
	userId: string | undefined
}

function getCategoryIcon(category: string | null) {
	switch (category) {
		case "research":
			return <FlaskConical className="h-4 w-4" />
		case "sales":
			return <Briefcase className="h-4 w-4" />
		case "product":
			return <Package className="h-4 w-4" />
		default:
			return <Sparkles className="h-4 w-4" />
	}
}

function getCategoryColor(category: string | null) {
	switch (category) {
		case "research":
			return "text-purple-600 bg-purple-100 dark:bg-purple-950/30 dark:text-purple-300"
		case "sales":
			return "text-blue-600 bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300"
		case "product":
			return "text-green-600 bg-green-100 dark:bg-green-950/30 dark:text-green-300"
		default:
			return "text-muted-foreground bg-muted"
	}
}

export function ManageLensesDialog({
	open,
	onOpenChange,
	templates,
	enabledLenses: initialEnabled,
	accountId,
	userId,
}: ManageLensesDialogProps) {
	const fetcher = useFetcher()
	const deleteFetcher = useFetcher()
	const visibilityFetcher = useFetcher()
	const revalidator = useRevalidator()
	const [editingTemplate, setEditingTemplate] = useState<LensTemplate | null>(null)

	// Track pending toggle for optimistic UI
	const pendingToggle = fetcher.formData?.get("toggle_lens") as string | null
	const isSubmitting = fetcher.state === "submitting"

	// Compute current enabled lenses (with optimistic update)
	const enabledLenses = (() => {
		if (pendingToggle && fetcher.formData) {
			const enabled = fetcher.formData.get("enabled") === "true"
			if (enabled) return [...initialEnabled, pendingToggle]
			return initialEnabled.filter((key) => key !== pendingToggle)
		}
		return initialEnabled
	})()

	// Sort: custom first, then system
	const sortedTemplates = [...templates].sort((a, b) => {
		if (a.is_system !== b.is_system) return a.is_system ? 1 : -1
		const catOrder = ["sales", "research", "product"]
		const orderA = catOrder.indexOf(a.category || "") === -1 ? catOrder.length : catOrder.indexOf(a.category || "")
		const orderB = catOrder.indexOf(b.category || "") === -1 ? catOrder.length : catOrder.indexOf(b.category || "")
		if (orderA !== orderB) return orderA - orderB
		return a.template_name.localeCompare(b.template_name)
	})

	const handleToggle = (templateKey: string, enabled: boolean) => {
		const newEnabled = enabled
			? [...initialEnabled, templateKey]
			: initialEnabled.filter((key) => key !== templateKey)

		fetcher.submit(
			{
				intent: "update_lens_settings",
				enabled_lenses: JSON.stringify(newEnabled),
				apply_to_existing: "false",
				toggle_lens: templateKey,
				enabled: String(enabled),
			},
			{ method: "post" },
		)
	}

	const handleDelete = (templateKey: string) => {
		if (!confirm("Delete this custom lens? This cannot be undone.")) return

		deleteFetcher.submit(
			{
				intent: "delete",
				template_key: templateKey,
				account_id: accountId,
			},
			{ method: "POST", action: "/api/lens-templates" },
		)
	}

	const handleToggleVisibility = (templateKey: string, isPublic: boolean) => {
		visibilityFetcher.submit(
			{
				intent: "update",
				template_key: templateKey,
				account_id: accountId,
				is_public: String(isPublic),
			},
			{ method: "POST", action: "/api/lens-templates" },
		)
	}

	const handleLensCreated = () => {
		revalidator.revalidate()
	}

	const handleLensUpdated = () => {
		revalidator.revalidate()
		setEditingTemplate(null)
	}

	const enabledCount = enabledLenses.filter((key) =>
		templates.some((t) => t.template_key === key),
	).length

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="max-w-xl p-0">
					<DialogHeader className="px-6 pt-6 pb-2">
						<DialogTitle>Manage Lenses</DialogTitle>
						<DialogDescription>
							{enabledCount} of {templates.length} lenses enabled.
							Toggle lenses to control which analyses run on your conversations.
						</DialogDescription>
					</DialogHeader>

					<ScrollArea className="max-h-[60vh]">
						<div className="px-6 pb-6 space-y-1">
							{sortedTemplates.map((template) => {
								const isEnabled = enabledLenses.includes(template.template_key)
								const isCustom = !template.is_system
								const isOwner = template.created_by === userId

								return (
									<div
										key={template.template_key}
										className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50"
									>
										<div className="flex items-center gap-3 min-w-0">
											<div className={`rounded-md p-1.5 ${getCategoryColor(template.category)}`}>
												{getCategoryIcon(template.category)}
											</div>
											<div className="min-w-0">
												<p className="font-medium text-sm truncate">{template.template_name}</p>
												<div className="flex items-center gap-1.5">
													<Badge variant="outline" className="text-[10px] px-1 py-0">
														{isCustom ? "Custom" : template.category || "general"}
													</Badge>
													{isCustom && !template.is_public && (
														<Badge variant="outline" className="text-[10px] px-1 py-0">
															<EyeOff className="mr-0.5 h-2.5 w-2.5" />
															Private
														</Badge>
													)}
												</div>
											</div>
										</div>

										<div className="flex items-center gap-2 flex-shrink-0">
											{isSubmitting && pendingToggle === template.template_key && (
												<Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
											)}
											<Switch
												checked={isEnabled}
												onCheckedChange={(checked) => handleToggle(template.template_key, checked)}
												disabled={isSubmitting && pendingToggle === template.template_key}
												aria-label={`${isEnabled ? "Disable" : "Enable"} ${template.template_name}`}
											/>
											{isCustom && (
												<DropdownMenu>
													<DropdownMenuTrigger asChild>
														<Button variant="ghost" size="icon" className="h-7 w-7">
															<MoreVertical className="h-3.5 w-3.5" />
														</Button>
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end">
														{isOwner ? (
															<>
																<DropdownMenuItem onClick={() => setEditingTemplate(template)}>
																	<Pencil className="mr-2 h-4 w-4" />
																	Edit
																</DropdownMenuItem>
																<DropdownMenuItem
																	onClick={() =>
																		handleToggleVisibility(template.template_key, !template.is_public)
																	}
																>
																	{template.is_public ? (
																		<>
																			<EyeOff className="mr-2 h-4 w-4" />
																			Make Private
																		</>
																	) : (
																		<>
																			<Eye className="mr-2 h-4 w-4" />
																			Share
																		</>
																	)}
																</DropdownMenuItem>
																<DropdownMenuSeparator />
																<DropdownMenuItem
																	onClick={() => handleDelete(template.template_key)}
																	className="text-red-600"
																>
																	<Trash2 className="mr-2 h-4 w-4" />
																	Delete
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
								)
							})}
						</div>
					</ScrollArea>

					{/* Create custom lens button */}
					<div className="border-t px-6 py-4">
						<CreateLensDialog accountId={accountId} onCreated={handleLensCreated} />
					</div>
				</DialogContent>
			</Dialog>

			{/* Edit lens dialog */}
			{editingTemplate && (
				<EditLensDialog
					open={!!editingTemplate}
					onOpenChange={(open) => !open && setEditingTemplate(null)}
					template={editingTemplate}
					accountId={accountId}
					onUpdated={handleLensUpdated}
				/>
			)}
		</>
	)
}
