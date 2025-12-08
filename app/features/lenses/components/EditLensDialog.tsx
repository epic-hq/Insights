/**
 * Dialog for editing custom lenses
 *
 * Allows users to modify the description and regenerate the template structure.
 * Shows the existing structure as context for editing.
 */

import { useState, useEffect } from "react"
import { Loader2, Sparkles, RefreshCw, Check, Pencil } from "lucide-react"
import { useFetcher } from "react-router"
import { Button } from "~/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog"
import { Label } from "~/components/ui/label"
import { Textarea } from "~/components/ui/textarea"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Switch } from "~/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
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

export function EditLensDialog({ open, onOpenChange, template, accountId, onUpdated }: EditLensDialogProps) {
	const [description, setDescription] = useState(template.nlp_source || "")
	const [isPublic, setIsPublic] = useState(template.is_public)
	const [generated, setGenerated] = useState<GeneratedTemplate | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [activeTab, setActiveTab] = useState<"current" | "regenerate">("current")

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
			setActiveTab("current")
		}
	}, [open, template])

	// Handle generate response
	useEffect(() => {
		if (generateFetcher.data && !generated && !isGenerating) {
			if (generateFetcher.data.ok && generateFetcher.data.generated) {
				setGenerated(generateFetcher.data.generated)
				setError(null)
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
			<DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Pencil className="h-5 w-5 text-primary" />
						Edit Custom Lens
					</DialogTitle>
					<DialogDescription>
						View current structure, adjust visibility, or regenerate the lens with a new description.
					</DialogDescription>
				</DialogHeader>

				<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "current" | "regenerate")}>
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="current">Current Structure</TabsTrigger>
						<TabsTrigger value="regenerate">Regenerate</TabsTrigger>
					</TabsList>

					{/* Current Structure Tab */}
					<TabsContent value="current" className="space-y-4">
						{/* Visibility toggle */}
						<div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
							<div>
								<Label htmlFor="is-public-current" className="font-medium">
									Share with team
								</Label>
								<p className="text-muted-foreground text-xs">
									{isPublic ? "All team members can use this lens" : "Only you can use this lens"}
								</p>
							</div>
							<Switch
								id="is-public-current"
								checked={isPublic}
								onCheckedChange={setIsPublic}
								disabled={isUpdating}
							/>
						</div>

						{/* Current template info */}
						<div className="space-y-4 rounded-lg border p-4">
							<div>
								<h3 className="font-semibold text-lg">{template.template_name}</h3>
								<p className="text-muted-foreground text-sm">{template.summary}</p>
							</div>

							{/* Original description */}
							{template.nlp_source && (
								<div className="rounded border bg-muted/30 p-3">
									<p className="text-muted-foreground text-sm italic">
										Original prompt: "{template.nlp_source}"
									</p>
								</div>
							)}

							{/* Sections preview */}
							<div className="space-y-3">
								<h4 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
									Sections ({template.template_definition.sections.length})
								</h4>
								{template.template_definition.sections.map((section) => (
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
							</div>

							{/* Entities */}
							{template.template_definition.entities && template.template_definition.entities.length > 0 && (
								<div>
									<h4 className="mb-2 font-medium text-muted-foreground text-sm uppercase tracking-wide">
										Also Extracts
									</h4>
									<div className="flex flex-wrap gap-2">
										{template.template_definition.entities.map((entity) => (
											<Badge key={entity} variant="secondary">
												{entity}
											</Badge>
										))}
									</div>
								</div>
							)}
						</div>

						{/* Save visibility button */}
						{isPublic !== template.is_public && (
							<Button onClick={handleSaveVisibility} disabled={isUpdating} className="w-full">
								{isUpdating ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Saving...
									</>
								) : (
									<>
										<Check className="mr-2 h-4 w-4" />
										Save Visibility Change
									</>
								)}
							</Button>
						)}
					</TabsContent>

					{/* Regenerate Tab */}
					<TabsContent value="regenerate" className="space-y-4">
						<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 text-sm dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
							<strong>Note:</strong> Regenerating will replace the lens structure. Existing analyses will
							remain but may not align perfectly with the new structure.
						</div>

						{/* Description input */}
						<div className="space-y-2">
							<Label htmlFor="description">What do you want to learn from conversations?</Label>
							<Textarea
								id="description"
								placeholder="e.g., Extract competitive intelligence including which competitors were mentioned, how they compare to us, why customers switched, and pricing information shared"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								className="min-h-[100px]"
								disabled={isGenerating || isUpdating}
							/>
							<p className="text-muted-foreground text-xs">
								Be specific about the information you want to capture. The existing lens structure is shown
								above for reference.
							</p>
						</div>

						{/* Generate button */}
						{!generated && (
							<Button
								onClick={handleGenerate}
								disabled={description.length < 10 || isGenerating}
								className="w-full"
								variant="outline"
							>
								{isGenerating ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Generating new structure...
									</>
								) : (
									<>
										<RefreshCw className="mr-2 h-4 w-4" />
										Preview New Structure
									</>
								)}
							</Button>
						)}

						{/* Error message */}
						{error && (
							<div className="rounded-md bg-red-50 p-3 text-red-700 text-sm dark:bg-red-950/20 dark:text-red-400">
								{error}
							</div>
						)}

						{/* Generated preview */}
						{generated && (
							<div className="space-y-4 rounded-lg border bg-muted/30 p-4">
								<div className="flex items-start justify-between">
									<div>
										<h3 className="font-semibold text-lg">{generated.template_name}</h3>
										<p className="text-muted-foreground text-sm">{generated.summary}</p>
									</div>
									<Badge variant="secondary">Preview</Badge>
								</div>

								{/* Sections preview */}
								<div className="space-y-3">
									<h4 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
										Sections ({generated.template_definition.sections.length})
									</h4>
									{generated.template_definition.sections.map((section) => (
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
								</div>

								{/* Entities */}
								{generated.template_definition.entities.length > 0 && (
									<div>
										<h4 className="mb-2 font-medium text-muted-foreground text-sm uppercase tracking-wide">
											Also Extracts
										</h4>
										<div className="flex flex-wrap gap-2">
											{generated.template_definition.entities.map((entity) => (
												<Badge key={entity} variant="secondary">
													{entity}
												</Badge>
											))}
										</div>
									</div>
								)}

								{/* Visibility toggle */}
								<div className="flex items-center justify-between rounded-lg border bg-background p-3">
									<div>
										<Label htmlFor="is-public-new" className="font-medium">
											Share with team
										</Label>
										<p className="text-muted-foreground text-xs">
											{isPublic ? "All team members can use this lens" : "Only you can use this lens"}
										</p>
									</div>
									<Switch
										id="is-public-new"
										checked={isPublic}
										onCheckedChange={setIsPublic}
										disabled={isUpdating}
									/>
								</div>

								{/* Actions */}
								<div className="flex gap-2">
									<Button
										variant="outline"
										onClick={() => {
											setGenerated(null)
										}}
										disabled={isGenerating || isUpdating}
										className="flex-1"
									>
										{isGenerating ? (
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										) : (
											<RefreshCw className="mr-2 h-4 w-4" />
										)}
										Try Again
									</Button>
									<Button onClick={handleSaveRegenerated} disabled={isUpdating} className="flex-1">
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
								</div>
							</div>
						)}
					</TabsContent>
				</Tabs>

				<DialogFooter className="sm:justify-start">
					<p className="text-muted-foreground text-xs">
						Custom lenses use AI to analyze conversations. Re-run analysis on conversations to apply changes.
					</p>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
