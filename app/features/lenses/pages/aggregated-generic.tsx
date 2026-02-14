/**
 * Generic Aggregated Lens View
 *
 * Renders aggregated analysis for any lens template (including custom lenses).
 * Uses the template_key from the URL to load and display lens analyses.
 * Includes AI-synthesized cross-interview insights when available.
 */

import { tasks } from "@trigger.dev/sdk";
import consola from "consola";
import {
	AlertCircle,
	ChevronRight,
	FileText,
	Glasses,
	Lightbulb,
	Loader2,
	MoreVertical,
	Pencil,
	RefreshCw,
	Sparkles,
} from "lucide-react";
import { useState } from "react";
import {
	type ActionFunctionArgs,
	Link,
	type LoaderFunctionArgs,
	useFetcher,
	useLoaderData,
	useRevalidator,
} from "react-router";
import type { synthesizeLensSummaryTask } from "~/../src/trigger/lens/synthesizeLensSummary";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import { userContext } from "~/server/user-context";
import { EditLensDialog } from "../components/EditLensDialog";
import { GenericLensView } from "../components/GenericLensView";
import type { LensTemplate } from "../lib/loadLensAnalyses.server";

// ============================================================================
// Types
// ============================================================================

type AggregatedAnalysis = {
	interview_id: string;
	interview_title: string;
	participant_pseudonym: string | null;
	analysis_data: Record<string, unknown>;
	processed_at: string | null;
	confidence_score: number | null;
};

type KeyTakeaway = {
	title: string;
	insight: string;
	supporting_interviews: string[];
	confidence: number;
	category: "consensus" | "pattern" | "discrepancy" | "recommendation";
};

type LensSynthesis = {
	id: string;
	status: "pending" | "processing" | "completed" | "failed" | "stale";
	executive_summary: string | null;
	key_takeaways: KeyTakeaway[];
	recommendations: string[];
	conflicts_to_review: string[];
	overall_confidence: number | null;
	interview_count: number;
	processed_at: string | null;
	error_message: string | null;
};

// ============================================================================
// Loader
// ============================================================================

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext);
	const supabase = ctx.supabase;

	if (!supabase) {
		throw new Response("Unauthorized", { status: 401 });
	}

	const projectId = params.projectId as string;
	const accountId = params.accountId as string;
	const templateKey = params.templateKey as string;
	const projectPath = `/a/${accountId}/${projectId}`;

	if (!projectId || !templateKey) {
		throw new Response("Project ID and Template Key required", { status: 400 });
	}

	consola.info("[aggregated-generic] Loading template:", templateKey, "for project:", projectId);

	// Load the template
	const { data: templateData, error: templateError } = await supabase
		.from("conversation_lens_templates")
		.select("*")
		.eq("template_key", templateKey)
		.single();

	if (templateError || !templateData) {
		throw new Response("Template not found", { status: 404 });
	}

	// Load all completed analyses for this template in this project
	// Note: Using separate queries to avoid RLS issues with joined tables
	const { data: analyses, error: analysesError } = await supabase
		.from("conversation_lens_analyses")
		.select("id, interview_id, analysis_data, processed_at, confidence_score")
		.eq("project_id", projectId)
		.eq("template_key", templateKey)
		.eq("status", "completed")
		.order("processed_at", { ascending: false });

	if (analysesError) {
		consola.error("[aggregated-generic] Error loading analyses:", analysesError);
	}

	consola.info("[aggregated-generic] Found analyses:", analyses?.length || 0, "for template:", templateKey);

	// Load interview details separately to avoid join issues
	const interviewIds = (analyses || []).map((a) => a.interview_id);
	const interviewMap = new Map<string, { title: string; participant_pseudonym: string | null }>();

	if (interviewIds.length > 0) {
		const { data: interviews } = await supabase
			.from("interviews")
			.select("id, title, participant_pseudonym")
			.in("id", interviewIds);

		for (const interview of interviews || []) {
			interviewMap.set(interview.id, {
				title: interview.title || "Untitled",
				participant_pseudonym: interview.participant_pseudonym,
			});
		}
	}

	// Transform to our aggregated format
	const aggregatedAnalyses: AggregatedAnalysis[] = (analyses || []).map((a) => {
		const interview = interviewMap.get(a.interview_id);
		return {
			interview_id: a.interview_id,
			interview_title: interview?.title || "Untitled",
			participant_pseudonym: interview?.participant_pseudonym || null,
			analysis_data: a.analysis_data as Record<string, unknown>,
			processed_at: a.processed_at,
			confidence_score: a.confidence_score,
		};
	});

	// Load existing synthesis (if any)
	let synthesis: LensSynthesis | null = null;
	const { data: summaryData } = await supabase
		.from("conversation_lens_summaries")
		.select(
			"id, status, executive_summary, key_takeaways, recommendations, conflicts_to_review, overall_confidence, interview_count, processed_at, error_message"
		)
		.eq("project_id", projectId)
		.eq("template_key", templateKey)
		.single();

	if (summaryData) {
		synthesis = {
			id: summaryData.id,
			status: summaryData.status as LensSynthesis["status"],
			executive_summary: summaryData.executive_summary,
			key_takeaways: (summaryData.key_takeaways as KeyTakeaway[]) || [],
			recommendations: (summaryData.recommendations as string[]) || [],
			conflicts_to_review: (summaryData.conflicts_to_review as string[]) || [],
			overall_confidence: summaryData.overall_confidence,
			interview_count: summaryData.interview_count,
			processed_at: summaryData.processed_at,
			error_message: summaryData.error_message,
		};

		// Check if synthesis is stale (interview count changed)
		if (synthesis.status === "completed" && synthesis.interview_count !== (analyses?.length || 0)) {
			synthesis.status = "stale";
		}
	}

	// Build template object
	const lensTemplate: LensTemplate = {
		template_key: templateData.template_key,
		template_name: templateData.template_name,
		summary: templateData.summary,
		category: templateData.category,
		display_order: templateData.display_order ?? 100,
		template_definition: templateData.template_definition as LensTemplate["template_definition"],
		account_id: templateData.account_id ?? null,
		created_by: templateData.created_by ?? null,
		is_system: templateData.is_system ?? true,
		is_public: templateData.is_public ?? true,
		nlp_source: templateData.nlp_source ?? null,
	};

	return {
		template: lensTemplate,
		analyses: aggregatedAnalyses,
		synthesis,
		projectPath,
		accountId,
		projectId,
		userId: ctx.claims?.sub,
	};
}

// ============================================================================
// Action - Trigger synthesis
// ============================================================================

export async function action({ context, params, request }: ActionFunctionArgs) {
	const ctx = context.get(userContext);
	const supabase = ctx.supabase;

	if (!supabase || !ctx.claims?.sub) {
		throw new Response("Unauthorized", { status: 401 });
	}

	const projectId = params.projectId as string;
	const accountId = params.accountId as string;
	const templateKey = params.templateKey as string;

	if (!projectId || !templateKey || !accountId) {
		throw new Response("Missing required parameters", { status: 400 });
	}

	const formData = await request.formData();
	const intent = formData.get("intent");
	const customInstructions = formData.get("customInstructions") as string | null;
	const force = formData.get("force") === "true";

	if (intent === "synthesize") {
		try {
			const result = await tasks.trigger<typeof synthesizeLensSummaryTask>("lens.synthesize-summary", {
				projectId,
				templateKey,
				accountId,
				customInstructions: customInstructions || undefined,
				force,
			});

			consola.info(`[aggregated-generic] Triggered synthesis for ${templateKey}, run ID: ${result.id}`);

			return { success: true, runId: result.id };
		} catch (error) {
			consola.error("[aggregated-generic] Failed to trigger synthesis:", error);
			return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
		}
	}

	return { success: false, error: "Unknown intent" };
}

// ============================================================================
// Components
// ============================================================================

function EmptyState({ templateName }: { templateName: string }) {
	return (
		<div className="py-16 text-center">
			<FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-50" />
			<h2 className="mb-2 font-semibold text-lg">No Analyses Yet</h2>
			<p className="mb-4 text-muted-foreground">
				Apply the "{templateName}" lens to your conversations to see aggregated insights here.
			</p>
		</div>
	);
}

function SummaryStats({ analysisCount }: { analysisCount: number }) {
	return (
		<div className="grid grid-cols-2 gap-4 md:grid-cols-3">
			<Card>
				<CardContent className="pt-6">
					<div className="font-bold text-2xl">{analysisCount}</div>
					<p className="text-muted-foreground text-sm">Conversations Analyzed</p>
				</CardContent>
			</Card>
		</div>
	);
}

function getCategoryBadgeVariant(category: KeyTakeaway["category"]) {
	switch (category) {
		case "consensus":
			return "default";
		case "pattern":
			return "secondary";
		case "discrepancy":
			return "destructive";
		case "recommendation":
			return "outline";
		default:
			return "secondary";
	}
}

function SynthesisHeroSection({
	synthesis,
	analysisCount,
	isSubmitting,
	onRefresh,
}: {
	synthesis: LensSynthesis | null;
	analysisCount: number;
	isSubmitting: boolean;
	onRefresh: (force: boolean) => void;
}) {
	// No synthesis yet - show prompt to generate
	if (!synthesis) {
		return (
			<Card className="border-dashed">
				<CardContent className="flex flex-col items-center justify-center py-8 text-center">
					<Sparkles className="mb-3 h-8 w-8 text-muted-foreground" />
					<h3 className="mb-2 font-semibold">Generate AI Synthesis</h3>
					<p className="mb-4 max-w-md text-muted-foreground text-sm">
						Synthesize key takeaways, patterns, and recommendations across {analysisCount} conversation
						{analysisCount !== 1 ? "s" : ""}.
					</p>
					<Button onClick={() => onRefresh(false)} disabled={isSubmitting || analysisCount === 0}>
						{isSubmitting ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Generating...
							</>
						) : (
							<>
								<Sparkles className="mr-2 h-4 w-4" />
								Generate Synthesis
							</>
						)}
					</Button>
				</CardContent>
			</Card>
		);
	}

	// Processing state
	if (synthesis.status === "processing") {
		return (
			<Card className="border-primary/20 bg-primary/5">
				<CardContent className="flex items-center gap-4 py-6">
					<Loader2 className="h-6 w-6 animate-spin text-primary" />
					<div>
						<h3 className="font-semibold">Generating AI Synthesis</h3>
						<p className="text-muted-foreground text-sm">
							Analyzing patterns across {synthesis.interview_count} conversations...
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	// Failed state
	if (synthesis.status === "failed") {
		return (
			<Alert variant="destructive">
				<AlertCircle className="h-4 w-4" />
				<AlertTitle>Synthesis Failed</AlertTitle>
				<AlertDescription className="flex items-center justify-between">
					<span>{synthesis.error_message || "An error occurred during synthesis."}</span>
					<Button variant="outline" size="sm" onClick={() => onRefresh(true)} disabled={isSubmitting}>
						{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Retry"}
					</Button>
				</AlertDescription>
			</Alert>
		);
	}

	// Completed or stale synthesis
	const isStale = synthesis.status === "stale";

	return (
		<Card className={isStale ? "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20" : ""}>
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between">
					<div className="flex items-center gap-2">
						<Sparkles className="h-5 w-5 text-primary" />
						<CardTitle className="text-lg">AI Synthesis</CardTitle>
						{isStale && (
							<Badge variant="outline" className="border-amber-500 text-amber-600">
								Stale
							</Badge>
						)}
					</div>
					<Button variant="ghost" size="sm" onClick={() => onRefresh(true)} disabled={isSubmitting}>
						{isSubmitting ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<>
								<RefreshCw className="mr-1 h-3 w-3" />
								Refresh
							</>
						)}
					</Button>
				</div>
				{isStale && (
					<p className="text-amber-600 text-sm">
						{analysisCount - synthesis.interview_count} new conversation(s) added since last synthesis.
					</p>
				)}
			</CardHeader>
			<CardContent className="space-y-6">
				{/* Executive Summary */}
				{synthesis.executive_summary && (
					<div>
						<h4 className="mb-2 font-medium text-muted-foreground text-sm">Executive Summary</h4>
						<div className="whitespace-pre-line text-sm">{synthesis.executive_summary}</div>
					</div>
				)}

				{/* Key Takeaways */}
				{synthesis.key_takeaways.length > 0 && (
					<div>
						<h4 className="mb-3 font-medium text-muted-foreground text-sm">Key Takeaways</h4>
						<div className="space-y-3">
							{synthesis.key_takeaways.map((takeaway, i) => (
								<div key={i} className="rounded-lg border bg-muted/30 p-3">
									<div className="mb-1 flex items-center gap-2">
										<Lightbulb className="h-4 w-4 text-amber-500" />
										<span className="font-medium text-sm">{takeaway.title}</span>
										<Badge variant={getCategoryBadgeVariant(takeaway.category)} className="text-xs">
											{takeaway.category}
										</Badge>
									</div>
									<p className="text-muted-foreground text-sm">{takeaway.insight}</p>
									{takeaway.supporting_interviews.length > 0 && (
										<p className="mt-1 text-muted-foreground text-xs">
											Based on {takeaway.supporting_interviews.length} interview
											{takeaway.supporting_interviews.length !== 1 ? "s" : ""}
										</p>
									)}
								</div>
							))}
						</div>
					</div>
				)}

				{/* Recommendations */}
				{synthesis.recommendations.length > 0 && (
					<div>
						<h4 className="mb-2 font-medium text-muted-foreground text-sm">Recommendations</h4>
						<ul className="space-y-1 text-sm">
							{synthesis.recommendations.map((rec, i) => (
								<li key={i} className="flex items-start gap-2">
									<ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
									<span>{rec}</span>
								</li>
							))}
						</ul>
					</div>
				)}

				{/* Conflicts to Review */}
				{synthesis.conflicts_to_review.length > 0 && (
					<Alert>
						<AlertCircle className="h-4 w-4" />
						<AlertTitle>Conflicts to Review</AlertTitle>
						<AlertDescription>
							<ul className="mt-2 space-y-1 text-sm">
								{synthesis.conflicts_to_review.map((conflict, i) => (
									<li key={i}>{conflict}</li>
								))}
							</ul>
						</AlertDescription>
					</Alert>
				)}

				{/* Metadata */}
				{synthesis.processed_at && (
					<p className="text-muted-foreground text-xs">
						Last synthesized {new Date(synthesis.processed_at).toLocaleDateString()} at{" "}
						{new Date(synthesis.processed_at).toLocaleTimeString()}
						{synthesis.overall_confidence && ` • ${Math.round(synthesis.overall_confidence * 100)}% confidence`}
					</p>
				)}
			</CardContent>
		</Card>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export default function AggregatedGenericPage() {
	const { template, analyses, synthesis, projectPath, accountId, userId } = useLoaderData<typeof loader>();
	const routes = useProjectRoutes(projectPath);
	const revalidator = useRevalidator();
	const fetcher = useFetcher<typeof action>();
	const [editDialogOpen, setEditDialogOpen] = useState(false);

	const isCustom = !template.is_system;
	const isOwner = template.created_by === userId;
	const isSubmitting = fetcher.state === "submitting";

	const handleLensUpdated = () => {
		revalidator.revalidate();
		setEditDialogOpen(false);
	};

	const handleRefreshSynthesis = (force: boolean) => {
		fetcher.submit({ intent: "synthesize", force: force.toString() }, { method: "post" });
		// Revalidate after a delay to check for status updates
		setTimeout(() => revalidator.revalidate(), 2000);
	};

	if (analyses.length === 0) {
		return (
			<div className="container mx-auto max-w-6xl px-4 py-8">
				<div className="mb-6 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="rounded-lg bg-primary/10 p-2">
							<Glasses className="h-6 w-6 text-primary" />
						</div>
						<div>
							<div className="flex items-center gap-2">
								<h1 className="font-bold text-2xl">{template.template_name}</h1>
								{isCustom && (
									<Badge variant="secondary" className="text-xs">
										Custom
									</Badge>
								)}
							</div>
							{template.summary && <p className="text-muted-foreground">{template.summary}</p>}
						</div>
					</div>
					{isCustom && isOwner && (
						<>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="outline" size="icon">
										<MoreVertical className="h-4 w-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
										<Pencil className="mr-2 h-4 w-4" />
										Edit Lens
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
							<EditLensDialog
								open={editDialogOpen}
								onOpenChange={setEditDialogOpen}
								template={template}
								accountId={accountId}
								onUpdated={handleLensUpdated}
							/>
						</>
					)}
				</div>
				<EmptyState templateName={template.template_name} />
			</div>
		);
	}

	return (
		<div className="container mx-auto max-w-6xl space-y-8 px-4 py-8">
			{/* Header */}
			<div className="flex items-start justify-between">
				<div className="flex items-center gap-3">
					<div className="rounded-lg bg-primary/10 p-2">
						<Glasses className="h-6 w-6 text-primary" />
					</div>
					<div>
						<div className="flex items-center gap-2">
							<h1 className="font-bold text-2xl">{template.template_name}</h1>
							{isCustom && (
								<Badge variant="secondary" className="text-xs">
									Custom
								</Badge>
							)}
						</div>
						<p className="text-muted-foreground">
							Aggregated insights from {analyses.length} conversation
							{analyses.length !== 1 ? "s" : ""}
						</p>
					</div>
				</div>
				{isCustom && isOwner && (
					<>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="icon">
									<MoreVertical className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
									<Pencil className="mr-2 h-4 w-4" />
									Edit Lens
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
						<EditLensDialog
							open={editDialogOpen}
							onOpenChange={setEditDialogOpen}
							template={template}
							accountId={accountId}
							onUpdated={handleLensUpdated}
						/>
					</>
				)}
			</div>

			{/* AI Synthesis Hero Section */}
			<SynthesisHeroSection
				synthesis={synthesis}
				analysisCount={analyses.length}
				isSubmitting={isSubmitting}
				onRefresh={handleRefreshSynthesis}
			/>

			{/* Summary Stats + Recent Interviews */}
			<div className="grid gap-6 lg:grid-cols-3">
				<SummaryStats analysisCount={analyses.length} />
				{/* Recent Interviews - Last 3 */}
				<Card className="lg:col-span-2">
					<CardHeader className="pb-3">
						<CardTitle className="text-base">Recent Interviews</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex flex-wrap gap-2">
							{analyses.slice(0, 3).map((analysis) => (
								<Link
									key={analysis.interview_id}
									to={routes.interviews.detail(analysis.interview_id)}
									className="inline-flex items-center gap-1 rounded-md border bg-muted/30 px-3 py-1.5 text-sm transition-colors hover:bg-muted"
								>
									{analysis.interview_title}
									<ChevronRight className="h-3 w-3" />
								</Link>
							))}
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Individual Analyses */}
			<div className="space-y-6">
				<h2 className="font-semibold text-lg">Conversation Analyses</h2>
				{analyses.map((analysis) => (
					<Card key={analysis.interview_id}>
						<CardHeader className="pb-3">
							<div className="flex items-center justify-between">
								<div>
									<CardTitle className="text-base">
										<Link
											to={routes.interviews.detail(analysis.interview_id)}
											className="hover:text-primary hover:underline"
										>
											{analysis.interview_title}
										</Link>
									</CardTitle>
									{analysis.participant_pseudonym && (
										<CardDescription>{analysis.participant_pseudonym}</CardDescription>
									)}
								</div>
								<Link to={routes.interviews.detail(analysis.interview_id)}>
									<Button variant="ghost" size="sm">
										View Interview
										<ChevronRight className="ml-1 h-4 w-4" />
									</Button>
								</Link>
							</div>
						</CardHeader>
						<CardContent>
							<GenericLensView
								analysis={{
									id: analysis.interview_id,
									interview_id: analysis.interview_id,
									template_key: template.template_key,
									analysis_data: analysis.analysis_data,
									confidence_score: analysis.confidence_score,
									status: "completed",
									error_message: null,
									processed_at: analysis.processed_at,
									created_at: analysis.processed_at || new Date().toISOString(),
									template,
								}}
								template={template}
							/>
						</CardContent>
					</Card>
				))}
			</div>

			{/* Source Interviews Summary */}
			<Card>
				<CardHeader>
					<CardTitle>Source Conversations</CardTitle>
					<CardDescription>All conversations analyzed with this lens</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid gap-2 md:grid-cols-2">
						{analyses.map((analysis) => (
							<Link
								key={analysis.interview_id}
								to={routes.interviews.detail(analysis.interview_id)}
								className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
							>
								<div>
									<p className="font-medium text-sm">{analysis.interview_title}</p>
									{analysis.participant_pseudonym && (
										<p className="text-muted-foreground text-xs">{analysis.participant_pseudonym}</p>
									)}
								</div>
								<ChevronRight className="h-4 w-4 text-muted-foreground" />
							</Link>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
