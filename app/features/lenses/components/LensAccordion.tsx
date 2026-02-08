/**
 * LensAccordion - Accordion view of conversation lenses for an interview
 *
 * Only shows lenses that have completed analyses with data.
 * Defaults to the first lens with data expanded.
 * Includes action button to run additional analyses.
 */

import { CheckCircle2, Clock, Loader2, Plus, RefreshCw, Sparkles, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { useFetcher, useRevalidator } from "react-router";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import type { LensAnalysisWithTemplate, LensTemplate } from "../lib/loadLensAnalyses.server";
import { GenericLensView } from "./GenericLensView";
import { LensSelector } from "./LensSelector";

type EvidenceRecord = {
	id: string;
	anchors?: unknown;
	start_ms?: number | null;
	gist?: string | null;
};

type Props = {
	interviewId: string;
	templates: LensTemplate[];
	analyses: Record<string, LensAnalysisWithTemplate>;
	className?: string;
	/** Enable inline editing of lens fields */
	editable?: boolean;
	/** Map of evidence ID to evidence record for hydrating timestamps */
	evidenceMap?: Map<string, EvidenceRecord>;
	/** Callback when a lens is applied */
	onLensApplied?: () => void;
};

/**
 * Status icon for a lens
 */
function LensStatusIcon({ analysis }: { analysis?: LensAnalysisWithTemplate }) {
	if (!analysis) {
		return <Clock className="h-4 w-4 text-muted-foreground" />;
	}

	switch (analysis.status) {
		case "completed":
			return <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
		case "processing":
			return <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />;
		case "failed":
			return <XCircle className="h-4 w-4 text-destructive" />;
		default:
			return <Clock className="h-4 w-4 text-muted-foreground" />;
	}
}

/**
 * Category badge with dark mode colors
 */
function CategoryBadge({ category }: { category: string | null }) {
	if (!category) return null;

	const colors: Record<string, string> = {
		research: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
		sales: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
		product: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
	};

	return (
		<Badge
			variant="outline"
			className={cn("text-xs", colors[category] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300")}
		>
			{category}
		</Badge>
	);
}

/**
 * Check if an analysis has meaningful data
 */
function analysisHasData(analysis: LensAnalysisWithTemplate | undefined): boolean {
	if (!analysis) return false;
	if (analysis.status !== "completed") return false;

	const data = analysis.analysis_data;
	if (!data) return false;

	// Check if there are any sections with data
	const sections = data.sections || [];
	const hasFieldData = sections.some((section: any) => {
		const fields = section.fields || [];
		return fields.some((field: any) => field.value !== null && field.value !== undefined && field.value !== "");
	});

	// Check for entities
	const hasEntities = (data.entities || []).length > 0;

	// Check for other common data fields
	const hasRecommendations = (data.recommendations || []).length > 0;
	const hasKeyInsights = (data.key_insights || []).length > 0;
	const hasHygiene = (data.hygiene || []).length > 0;

	return hasFieldData || hasEntities || hasRecommendations || hasKeyInsights || hasHygiene;
}

/**
 * Re-run button for a lens analysis
 */
function RerunLensButton({
	interviewId,
	templateKey,
	templateName,
	isProcessing,
	onTriggered,
}: {
	interviewId: string;
	templateKey: string;
	templateName: string;
	isProcessing: boolean;
	onTriggered?: () => void;
}) {
	const fetcher = useFetcher();
	const isSubmitting = fetcher.state !== "idle";
	const isRunning = isSubmitting || isProcessing;

	const handleRerun = (e: React.MouseEvent) => {
		e.stopPropagation(); // Don't toggle accordion
		fetcher.submit(
			{ interview_id: interviewId, template_key: templateKey },
			{ method: "POST", action: "/api/apply-lens" }
		);
		onTriggered?.();
	};

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRerun} disabled={isRunning}>
						<RefreshCw className={cn("h-3.5 w-3.5", isRunning && "animate-spin")} />
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					<p>Re-analyze with {templateName}</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

export function LensAccordion({
	interviewId,
	templates,
	analyses,
	className,
	editable,
	evidenceMap,
	onLensApplied,
}: Props) {
	const [showAddLens, setShowAddLens] = useState(false);
	const revalidator = useRevalidator();

	// Sort templates by display_order
	const sortedTemplates = useMemo(() => [...templates].sort((a, b) => a.display_order - b.display_order), [templates]);

	// Filter to only templates with completed analyses that have data
	const templatesWithData = useMemo(
		() =>
			sortedTemplates.filter((template) => {
				const analysis = analyses[template.template_key];
				return analysisHasData(analysis);
			}),
		[sortedTemplates, analyses]
	);

	// Templates without data (for the "add more" section)
	const templatesWithoutData = useMemo(
		() =>
			sortedTemplates.filter((template) => {
				const analysis = analyses[template.template_key];
				return !analysisHasData(analysis);
			}),
		[sortedTemplates, analyses]
	);

	// Default to first template with data expanded
	const defaultValue = templatesWithData[0]?.template_key;

	if (templates.length === 0) {
		return (
			<div className="py-12 text-center text-muted-foreground">
				<Sparkles className="mx-auto mb-3 h-8 w-8 opacity-50" />
				<p>No lens templates available</p>
			</div>
		);
	}

	if (templatesWithData.length === 0) {
		// No analyses with data yet - show a prompt to run analyses
		return (
			<div className={cn("space-y-4", className)}>
				<div className="rounded-lg border border-dashed p-6 text-center">
					<Sparkles className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-50" />
					<p className="mb-4 text-muted-foreground">No lens analyses have been run yet</p>
					<LensSelector
						interviewId={interviewId}
						templates={templates}
						analyses={analyses}
						onLensApplied={onLensApplied}
					/>
				</div>
			</div>
		);
	}

	return (
		<div className={cn("space-y-4", className)}>
			<Accordion type="single" collapsible defaultValue={defaultValue} className="space-y-3">
				{templatesWithData.map((template) => {
					const analysis = analyses[template.template_key];
					return (
						<AccordionItem
							key={template.template_key}
							value={template.template_key}
							className="rounded-lg border bg-card dark:bg-card/50"
						>
							<AccordionTrigger className="px-4 py-3 hover:no-underline [&[data-state=open]]:border-b">
								<div className="flex w-full items-center justify-between gap-3 pr-2">
									<div className="flex items-center gap-3">
										<LensStatusIcon analysis={analysis} />
										<div className="text-left">
											<span className="font-medium">{template.template_name}</span>
											{template.summary && <p className="text-muted-foreground text-sm">{template.summary}</p>}
										</div>
									</div>
									<div className="flex items-center gap-2">
										<RerunLensButton
											interviewId={interviewId}
											templateKey={template.template_key}
											templateName={template.template_name}
											isProcessing={analysis?.status === "processing" || analysis?.status === "pending"}
											onTriggered={() => {
												// Revalidate after a delay to pick up status change
												setTimeout(() => revalidator.revalidate(), 1000);
												onLensApplied?.();
											}}
										/>
										<CategoryBadge category={template.category} />
									</div>
								</div>
							</AccordionTrigger>
							<AccordionContent className="px-4 pt-2 pb-4">
								<GenericLensView
									analysis={analysis}
									template={template}
									editable={editable}
									evidenceMap={evidenceMap}
								/>
							</AccordionContent>
						</AccordionItem>
					);
				})}
			</Accordion>

			{/* Add more analyses section */}
			{templatesWithoutData.length > 0 && (
				<div className="pt-2">
					{showAddLens ? (
						<div className="rounded-lg border bg-muted/30 p-4 dark:bg-muted/10">
							<div className="mb-3 flex items-center justify-between">
								<span className="font-medium text-sm">Run Additional Analysis</span>
								<Button variant="ghost" size="sm" onClick={() => setShowAddLens(false)}>
									Cancel
								</Button>
							</div>
							<LensSelector
								interviewId={interviewId}
								templates={templatesWithoutData}
								analyses={analyses}
								onLensApplied={() => {
									setShowAddLens(false);
									onLensApplied?.();
								}}
							/>
						</div>
					) : (
						<Button variant="outline" size="sm" onClick={() => setShowAddLens(true)} className="w-full border-dashed">
							<Plus className="mr-2 h-4 w-4" />
							Run Additional Lens ({templatesWithoutData.length} available)
						</Button>
					)}
				</div>
			)}
		</div>
	);
}

/**
 * Compact lens indicator for showing in headers/lists
 */
export function LensStatusSummary({
	analyses,
	className,
}: {
	analyses: Record<string, LensAnalysisWithTemplate>;
	className?: string;
}) {
	const values = Object.values(analyses);
	const completed = values.filter((a) => a.status === "completed").length;
	const processing = values.filter((a) => a.status === "processing").length;
	const failed = values.filter((a) => a.status === "failed").length;

	if (values.length === 0) return null;

	return (
		<div className={cn("flex items-center gap-1", className)}>
			{completed > 0 && (
				<Badge
					variant="outline"
					className="bg-green-50 text-green-700 text-xs dark:bg-green-900/40 dark:text-green-300"
				>
					<CheckCircle2 className="mr-1 h-3 w-3" />
					{completed}
				</Badge>
			)}
			{processing > 0 && (
				<Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs dark:bg-blue-900/40 dark:text-blue-300">
					<Loader2 className="mr-1 h-3 w-3 animate-spin" />
					{processing}
				</Badge>
			)}
			{failed > 0 && (
				<Badge variant="outline" className="bg-red-50 text-red-700 text-xs dark:bg-red-900/40 dark:text-red-300">
					<XCircle className="mr-1 h-3 w-3" />
					{failed}
				</Badge>
			)}
		</div>
	);
}
