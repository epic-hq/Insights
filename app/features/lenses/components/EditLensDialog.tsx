/**
 * Dialog for editing custom lenses
 *
 * Simplified flow:
 * 1. Title + Description at top (editable)
 * 2. Regenerate button to preview new structure
 * 3. Tabs to compare Current vs Preview structure
 */

import { Check, Loader2, Pencil, RefreshCw } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { useFetcher } from "react-router"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog"
import { Label } from "~/components/ui/label"
import { Switch } from "~/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { Textarea } from "~/components/ui/textarea"
import type { LensTemplate } from "../lib/loadLensAnalyses.server"

type GeneratedTemplate = {
	template_name: string
	summary: string
	primary_objective: string
	template_definition: {
		sections: Array<{
			section_key: string
			section_name: string
			description?: string
			fields: Array<{
				field_key: string
				field_name: string
				field_type: string
				description?: string
			}>
		}>
		entities: string[]
		recommendations_enabled: boolean
	}
}

type EditLensDialogProps = {
	open: boolean
	onOpenChange: (open: boolean) => void
	template: LensTemplate
	accountId: string
	onUpdated?: () => void
}

// Helper component for rendering structure (sections + entities)
function StructurePreview({
	sections,
	entities,
}: {
	sections: GeneratedTemplate["template_definition"]["sections"]
	entities: string[]
}) {
	return (
		<div className="space-y-3">
			{sections.map((section) => (
				<Card key={section.section_key} className="bg-background">
					<CardHeader className="py-2">
						<CardTitle className="text-sm">{section.section_name}</CardTitle>
					</CardHeader>
					<CardContent className="py-2">
						<div className="flex flex-wrap gap-1">
							{section.fields.map((field) => (
								<Badge key={field.field_key} variant="outline" className="text-xs">
									{field.field_name}
								</Badge>
							))}
						</div>
					</CardContent>
				</Card>
			))}
			{entities && entities.length > 0 && (
				<div className="pt-2">
					<h4 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Also Extracts</h4>
					<div className="flex flex-wrap gap-1">
						{entities.map((entity) => (
							<Badge key={entity} variant="secondary" className="text-xs">
								{entity}
							</Badge>
						))}
					</div>
				</div>
			)}
		</div>
	)
}

export function EditLensDialog({ open, onOpenChange, template, accountId, onUpdated }: EditLensDialogProps) {
	const [description, setDescription] = useState(template.nlp_source || "")
	const [isPublic, setIsPublic] = useState(template.is_public)
	const [generated, setGenerated] = useState<GeneratedTemplate | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [structureTab, setStructureTab] = useState<"current" | "preview">("current")

	const descriptionId = useId()
	const visibilityId = useId()

	const generateFetcher = useFetcher()
	const updateFetcher = useFetcher()

	const isGenerating = generateFetcher.state === "submitting"
	const isUpdating = updateFetcher.state === "submitting"

	// Reset state when dialog opens
	useEffect(() => {
		if (open) {
			setDescription(template.nlp_source || "")
			setIsPublic(template.is_public)
			setGenerated(null)
			setError(null)
			setStructureTab("current")
		}
	}, [open, template])

	// Handle generate response - auto-switch to preview tab
	useEffect(() => {
		if (generateFetcher.data && !generated && !isGenerating) {
			if (generateFetcher.data.ok && generateFetcher.data.generated) {
				setGenerated(generateFetcher.data.generated)
				setError(null)
				setStructureTab("preview") // Auto-switch to preview
			} else if (generateFetcher.data.error) {
				setError(generateFetcher.data.error)
			}
		}
	}, [generateFetcher.data, generated, isGenerating])

	// Handle update response
	useEffect(() => {
		if (updateFetcher.data && !isUpdating) {
			if (updateFetcher.data.ok) {
				onOpenChange(false)
				onUpdated?.()
			} else if (updateFetcher.data.error) {
				setError(updateFetcher.data.error)
			}
		}
	}, [updateFetcher.data, isUpdating, onOpenChange, onUpdated])

	function handleGenerate() {
		if (description.length < 10) {
			setError("Description must be at least 10 characters")
			return
		}

		setError(null)
		setGenerated(null)

		generateFetcher.submit(
			{
				intent: "generate",
				description,
			},
			{
				method: "POST",
				action: "/api/lens-templates",
			}
		)
	}

	function handleSaveVisibility() {
		updateFetcher.submit(
			{
				intent: "update",
				template_key: template.template_key,
				account_id: accountId,
				is_public: String(isPublic),
			},
			{
				method: "POST",
				action: "/api/lens-templates",
			}
		)
	}

	function handleSaveRegenerated() {
		if (!generated) return

		updateFetcher.submit(
			{
				intent: "update",
				template_key: template.template_key,
				account_id: accountId,
				template_name: generated.template_name,
				summary: generated.summary,
				primary_objective: generated.primary_objective,
				template_definition: JSON.stringify(generated.template_definition),
				nlp_source: description,
				is_public: String(isPublic),
			},
			{
				method: "POST",
				action: "/api/lens-templates",
			}
		)
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Pencil className="h-5 w-5 text-primary" />
						Edit Custom Lens
					</DialogTitle>
					<DialogDescription>Modify the description and regenerate to update the lens structure.</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					{/* Lens name (read-only) */}
					<div>
						<h3 className="font-semibold text-lg">{template.template_name}</h3>
						<p className="text-muted-foreground text-sm">{template.summary}</p>
					</div>

					{/* Description input - always visible */}
					<div className="space-y-2">
						<Label htmlFor={descriptionId}>Description</Label>
						<Textarea
							id={descriptionId}
							placeholder="e.g., Extract competitive intelligence including which competitors were mentioned, how they compare to us, why customers switched..."
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							className="min-h-[80px]"
							disabled={isGenerating || isUpdating}
						/>
					</div>

					{/* Regenerate button */}
					<Button
						onClick={handleGenerate}
						disabled={description.length < 10 || isGenerating}
						variant="outline"
						className="w-full"
					>
						{isGenerating ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Generating preview...
							</>
						) : (
							<>
								<RefreshCw className="mr-2 h-4 w-4" />
								{generated ? "Regenerate Preview" : "Generate Preview"}
							</>
						)}
					</Button>

					{/* Error message */}
					{error && (
						<div className="rounded-md bg-red-50 p-3 text-red-700 text-sm dark:bg-red-950/20 dark:text-red-400">
							{error}
						</div>
					)}

					{/* Structure comparison tabs - only show Preview tab when generated */}
					<Tabs value={structureTab} onValueChange={(v) => setStructureTab(v as "current" | "preview")}>
						<TabsList className={generated ? "grid w-full grid-cols-2" : "w-full"}>
							<TabsTrigger value="current">Current Structure</TabsTrigger>
							{generated && (
								<TabsTrigger value="preview" className="relative">
									Preview
									<Badge variant="secondary" className="ml-2 text-[10px]">
										New
									</Badge>
								</TabsTrigger>
							)}
						</TabsList>

						<TabsContent value="current" className="mt-3">
							<StructurePreview
								sections={template.template_definition.sections}
								entities={template.template_definition.entities || []}
							/>
						</TabsContent>

						{generated && (
							<TabsContent value="preview" className="mt-3">
								<div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
									<div className="mb-3 flex items-center justify-between">
										<span className="font-medium text-sm">{generated.template_name}</span>
										<Badge variant="outline" className="text-xs">
											Preview
										</Badge>
									</div>
									<StructurePreview
										sections={generated.template_definition.sections}
										entities={generated.template_definition.entities}
									/>
								</div>
							</TabsContent>
						)}
					</Tabs>

					{/* Visibility toggle */}
					<div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
						<div>
							<Label htmlFor={visibilityId} className="font-medium">
								Share with team
							</Label>
							<p className="text-muted-foreground text-xs">
								{isPublic ? "All team members can use this lens" : "Only you can use this lens"}
							</p>
						</div>
						<Switch id={visibilityId} checked={isPublic} onCheckedChange={setIsPublic} disabled={isUpdating} />
					</div>
				</div>

				<DialogFooter className="flex-col gap-2 sm:flex-row">
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUpdating}>
						Cancel
					</Button>
					{generated ? (
						<Button onClick={handleSaveRegenerated} disabled={isUpdating}>
							{isUpdating ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Saving...
								</>
							) : (
								<>
									<Check className="mr-2 h-4 w-4" />
									Save New Structure
								</>
							)}
						</Button>
					) : (
						isPublic !== template.is_public && (
							<Button onClick={handleSaveVisibility} disabled={isUpdating}>
								{isUpdating ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Saving...
									</>
								) : (
									<>
										<Check className="mr-2 h-4 w-4" />
										Save Changes
									</>
								)}
							</Button>
						)
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
