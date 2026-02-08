/**
 * Dialog for creating custom lenses via AI generation
 *
 * Flow:
 * 1. User enters description of what they want to extract
 * 2. AI generates template preview
 * 3. User can save or edit description and regenerate
 */

import { Check, Loader2, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";

type GeneratedTemplate = {
	template_name: string;
	summary: string;
	primary_objective: string;
	template_definition: {
		sections: Array<{
			section_key: string;
			section_name: string;
			description?: string;
			fields: Array<{
				field_key: string;
				field_name: string;
				field_type: string;
				description?: string;
			}>;
		}>;
		entities: string[];
		recommendations_enabled: boolean;
	};
};

type CreateLensDialogProps = {
	accountId: string;
	onCreated?: () => void;
};

export function CreateLensDialog({ accountId, onCreated }: CreateLensDialogProps) {
	const [open, setOpen] = useState(false);
	const [description, setDescription] = useState("");
	const [isPublic, setIsPublic] = useState(true);
	const [generated, setGenerated] = useState<GeneratedTemplate | null>(null);
	const [error, setError] = useState<string | null>(null);

	const generateFetcher = useFetcher();
	const createFetcher = useFetcher();

	const isGenerating = generateFetcher.state === "submitting";
	const isCreating = createFetcher.state === "submitting";

	// Handle generate response
	if (generateFetcher.data && !generated && !isGenerating) {
		if (generateFetcher.data.ok && generateFetcher.data.generated) {
			setGenerated(generateFetcher.data.generated);
			setError(null);
		} else if (generateFetcher.data.error) {
			setError(generateFetcher.data.error);
		}
	}

	// Handle create response
	if (createFetcher.data && !isCreating) {
		if (createFetcher.data.ok) {
			// Success - close dialog and notify parent
			setOpen(false);
			resetState();
			onCreated?.();
		} else if (createFetcher.data.error && !error) {
			setError(createFetcher.data.error);
		}
	}

	function resetState() {
		setDescription("");
		setGenerated(null);
		setError(null);
		setIsPublic(true);
	}

	function handleGenerate() {
		if (description.length < 10) {
			setError("Description must be at least 10 characters");
			return;
		}

		setError(null);
		setGenerated(null);

		generateFetcher.submit(
			{
				intent: "generate",
				description,
			},
			{
				method: "POST",
				action: "/api/lens-templates",
			}
		);
	}

	// Clear preview so user can edit description before regenerating
	function handleEditDescription() {
		setGenerated(null);
		// Don't auto-regenerate - let user edit and click Generate
	}

	function handleSave() {
		if (!generated) return;

		createFetcher.submit(
			{
				intent: "create",
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
		);
	}

	function handleOpenChange(newOpen: boolean) {
		setOpen(newOpen);
		if (!newOpen) {
			resetState();
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				<Button>
					<Sparkles className="mr-2 h-4 w-4" />
					Create Custom Lens
				</Button>
			</DialogTrigger>
			<DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Wand2 className="h-5 w-5 text-primary" />
						Create Custom Lens
					</DialogTitle>
					<DialogDescription>
						Describe what you want to extract from conversations. AI will generate a structured analysis template.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					{/* Description input */}
					<div className="space-y-2">
						<Label htmlFor="description">What do you want to learn from conversations?</Label>
						<Textarea
							id="description"
							placeholder="e.g., Extract competitive intelligence including which competitors were mentioned, how they compare to us, why customers switched, and pricing information shared"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							className="min-h-[100px]"
							disabled={isGenerating || isCreating}
						/>
						<p className="text-muted-foreground text-xs">
							Be specific about the information you want to capture. Mention key themes, data points, and any frameworks
							you want to apply.
						</p>
					</div>

					{/* Generate button */}
					{!generated && (
						<Button onClick={handleGenerate} disabled={description.length < 10 || isGenerating} className="w-full">
							{isGenerating ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Generating template...
								</>
							) : (
								<>
									<Sparkles className="mr-2 h-4 w-4" />
									Generate Template
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
									<Label htmlFor="is-public" className="font-medium">
										Share with team
									</Label>
									<p className="text-muted-foreground text-xs">
										{isPublic ? "All team members can use this lens" : "Only you can use this lens"}
									</p>
								</div>
								<Switch id="is-public" checked={isPublic} onCheckedChange={setIsPublic} disabled={isCreating} />
							</div>

							{/* Actions */}
							<div className="flex gap-2">
								<Button
									variant="outline"
									onClick={handleEditDescription}
									disabled={isGenerating || isCreating}
									className="flex-1"
								>
									<Pencil className="mr-2 h-4 w-4" />
									Edit Description
								</Button>
								<Button onClick={handleSave} disabled={isCreating} className="flex-1">
									{isCreating ? (
										<>
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											Saving...
										</>
									) : (
										<>
											<Check className="mr-2 h-4 w-4" />
											Save Lens
										</>
									)}
								</Button>
							</div>
						</div>
					)}
				</div>

				<DialogFooter className="sm:justify-start">
					<p className="text-muted-foreground text-xs">
						Custom lenses use AI to analyze conversations. Results may vary based on conversation content.
					</p>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
