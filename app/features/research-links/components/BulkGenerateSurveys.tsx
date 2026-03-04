/**
 * Bulk Generate Surveys
 *
 * Dialog component for creating a campaign and generating personalized
 * surveys for multiple selected people. Orchestrates the full flow:
 * 1. Select campaign strategy
 * 2. Create campaign
 * 3. Add people to campaign
 * 4. Generate personalized questions
 * 5. Open QuickView carousel for review
 */

import { Loader2, Sparkles, Users, Zap } from "lucide-react";
import { useCallback, useState } from "react";
import { useParams, useRevalidator } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { type PersonalizedSurveyItem, SurveyQuickView } from "./SurveyQuickView";

const STRATEGIES = [
	{
		value: "sparse_data_discovery",
		label: "Discovery",
		description: "Fill knowledge gaps for people with sparse data",
	},
	{
		value: "pricing_validation",
		label: "Pricing Validation",
		description: "Gather pricing feedback from high-ICP contacts",
	},
	{
		value: "theme_validation",
		label: "Theme Validation",
		description: "Validate themes with low evidence counts",
	},
	{
		value: "general_research",
		label: "General Research",
		description: "Balanced approach for general insights",
	},
] as const;

const GOALS = [
	{ value: "discover", label: "Discover" },
	{ value: "validate", label: "Validate" },
	{ value: "deep_dive", label: "Deep Dive" },
	{ value: "pricing", label: "Pricing" },
] as const;

type GenerationStep = "configure" | "creating" | "adding" | "generating" | "done" | "error";

interface BulkGenerateSurveysProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	selectedPeople: Array<{
		id: string;
		name: string;
		title?: string | null;
		email?: string | null;
	}>;
	onComplete?: () => void;
}

export function BulkGenerateSurveys({ open, onOpenChange, selectedPeople, onComplete }: BulkGenerateSurveysProps) {
	const params = useParams();
	const revalidator = useRevalidator();
	const { accountId, projectId } = params;

	const [strategy, setStrategy] = useState<string>("sparse_data_discovery");
	const [goal, setGoal] = useState<string>("discover");
	const [campaignGoal, setCampaignGoal] = useState("");
	const [step, setStep] = useState<GenerationStep>("configure");
	const [error, setError] = useState<string | null>(null);
	const [progress, setProgress] = useState({ current: 0, total: 0 });

	// QuickView state
	const [quickViewOpen, setQuickViewOpen] = useState(false);
	const [generatedSurveys, setGeneratedSurveys] = useState<PersonalizedSurveyItem[]>([]);

	const apiBase = `/a/${accountId}/${projectId}/api/campaigns`;

	const handleGenerate = useCallback(async () => {
		if (!accountId || !projectId) return;

		try {
			setError(null);
			setStep("creating");

			// Step 1: Create campaign
			const createRes = await fetch(`${apiBase}/create`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					strategy,
					goal: campaignGoal || undefined,
				}),
			});

			if (!createRes.ok) {
				const err = await createRes.json();
				console.error("[BulkGenerate] Create campaign failed:", err);
				throw new Error(err.error || "Failed to create campaign");
			}

			const createData = await createRes.json();
			console.log("[BulkGenerate] Campaign created:", createData);
			const { campaign } = createData;

			// Step 2: Add people
			setStep("adding");
			const addRes = await fetch(`${apiBase}/add-people`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					campaignId: campaign.id,
					personIds: selectedPeople.map((p) => p.id),
					surveyGoal: goal,
				}),
			});

			if (!addRes.ok) {
				const err = await addRes.json();
				console.error("[BulkGenerate] Add people failed:", err);
				throw new Error(err.error || "Failed to add people to campaign");
			}
			const addData = await addRes.json();
			console.log("[BulkGenerate] People added:", addData);

			// Step 3: Generate questions
			setStep("generating");
			setProgress({ current: 0, total: selectedPeople.length });

			const genRes = await fetch(`${apiBase}/generate-questions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					campaignId: campaign.id,
					questionCount: 5,
				}),
			});

			if (!genRes.ok) {
				const err = await genRes.json();
				throw new Error(err.error || "Failed to generate questions");
			}

			const genData = await genRes.json();
			console.log("[BulkGenerate] Generation response:", JSON.stringify(genData, null, 2));
			setProgress({
				current: genData.success,
				total: genData.total,
			});

			// Build survey items from the API response (includes questions)
			const surveyItems: PersonalizedSurveyItem[] = (genData.results ?? [])
				.filter((r: { success: boolean }) => r.success)
				.map(
					(r: {
						personId: string;
						surveyId: string;
						questions: Array<{
							id: string;
							prompt: string;
							type: string;
							rationale: string;
							uses_attributes: string[];
							evidence_type: string;
							order: number;
						}>;
						generationMetadata?: Record<string, unknown>;
					}) => {
						const person = selectedPeople.find((p) => p.id === r.personId);
						return {
							id: r.surveyId,
							personId: r.personId,
							personName: person?.name || "Unknown",
							personTitle: person?.title,
							personEmail: person?.email,
							surveyGoal: goal,
							status: "draft",
							questions: r.questions ?? [],
							generationMetadata: r.generationMetadata,
						};
					}
				);

			console.log(
				"[BulkGenerate] Built survey items:",
				surveyItems.length,
				"surveys,",
				surveyItems.reduce((acc, s) => acc + s.questions.length, 0),
				"total questions"
			);
			setGeneratedSurveys(surveyItems);
			setStep("done");
			revalidator.revalidate();
		} catch (err) {
			console.error("[BulkGenerate] Error:", err);
			setError(err instanceof Error ? err.message : "An error occurred");
			setStep("error");
		}
	}, [accountId, projectId, apiBase, strategy, goal, campaignGoal, selectedPeople, revalidator]);

	const handleApprove = useCallback(async (surveyId: string) => {
		// TODO: Call API to update survey status to 'approved'
	}, []);

	const handleSkip = useCallback(async (surveyId: string) => {
		// TODO: Call API to update survey status
	}, []);

	const handleEditQuestion = useCallback(async (surveyId: string, questionId: string, newText: string) => {
		// TODO: Call API to update question text
	}, []);

	const handleClose = useCallback(() => {
		setStep("configure");
		setError(null);
		setProgress({ current: 0, total: 0 });
		onOpenChange(false);
		onComplete?.();
	}, [onOpenChange, onComplete]);

	const isProcessing = ["creating", "adding", "generating"].includes(step);

	const stepLabels: Record<GenerationStep, string> = {
		configure: "Configure",
		creating: "Creating campaign...",
		adding: "Adding people...",
		generating: `Generating questions (${progress.current}/${progress.total})...`,
		done: "Complete!",
		error: "Error",
	};

	return (
		<>
			<Dialog open={open && !quickViewOpen} onOpenChange={handleClose}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Sparkles className="h-5 w-5 text-purple-500" />
							Generate Personalized Surveys
						</DialogTitle>
						<DialogDescription>
							Create AI-personalized survey questions for {selectedPeople.length} selected{" "}
							{selectedPeople.length === 1 ? "person" : "people"}.
						</DialogDescription>
					</DialogHeader>

					{step === "configure" && (
						<div className="space-y-4 py-2">
							{/* Selected people preview */}
							<div className="flex flex-wrap gap-1.5">
								{selectedPeople.slice(0, 5).map((p) => (
									<Badge key={p.id} variant="secondary" className="text-xs">
										<Users className="mr-1 h-3 w-3" />
										{p.name}
									</Badge>
								))}
								{selectedPeople.length > 5 && (
									<Badge variant="outline" className="text-xs">
										+{selectedPeople.length - 5} more
									</Badge>
								)}
							</div>

							{/* Strategy selection */}
							<div className="space-y-1.5">
								<Label>Campaign Strategy</Label>
								<Select value={strategy} onValueChange={setStrategy}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{STRATEGIES.map((s) => (
											<SelectItem key={s.value} value={s.value}>
												<div>
													<span>{s.label}</span>
													<span className="ml-2 text-muted-foreground text-xs">{s.description}</span>
												</div>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{/* Survey goal */}
							<div className="space-y-1.5">
								<Label>Survey Goal</Label>
								<Select value={goal} onValueChange={setGoal}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{GOALS.map((g) => (
											<SelectItem key={g.value} value={g.value}>
												{g.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{/* Optional goal description */}
							<div className="space-y-1.5">
								<Label>
									Campaign Goal <span className="text-muted-foreground">(optional)</span>
								</Label>
								<Textarea
									placeholder="e.g., Validate pricing sensitivity for enterprise segment"
									value={campaignGoal}
									onChange={(e) => setCampaignGoal(e.target.value)}
									className="min-h-[60px]"
								/>
							</div>
						</div>
					)}

					{isProcessing && (
						<div className="flex flex-col items-center gap-3 py-8">
							<Loader2 className="h-8 w-8 animate-spin text-purple-500" />
							<p className="text-muted-foreground text-sm">{stepLabels[step]}</p>
						</div>
					)}

					{step === "done" && (
						<div className="flex flex-col items-center gap-3 py-6">
							<div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
								<Zap className="h-6 w-6 text-green-600" />
							</div>
							<p className="font-medium text-sm">
								Generated surveys for {progress.current} of {progress.total} people
							</p>
							{progress.current < progress.total && (
								<p className="text-muted-foreground text-xs">
									{progress.total - progress.current} failed — you can retry later
								</p>
							)}
						</div>
					)}

					{step === "error" && (
						<div className="py-4">
							<p className="text-destructive text-sm">{error}</p>
						</div>
					)}

					<DialogFooter>
						{step === "configure" && (
							<>
								<Button variant="ghost" onClick={handleClose}>
									Cancel
								</Button>
								<Button onClick={handleGenerate} disabled={selectedPeople.length === 0}>
									<Sparkles className="mr-1 h-4 w-4" />
									Generate {selectedPeople.length} Surveys
								</Button>
							</>
						)}
						{step === "done" && (
							<>
								<Button variant="ghost" onClick={handleClose}>
									Close
								</Button>
								{generatedSurveys.length > 0 && (
									<Button
										onClick={() => {
											onOpenChange(false);
											setQuickViewOpen(true);
										}}
									>
										Review Surveys
									</Button>
								)}
							</>
						)}
						{step === "error" && (
							<>
								<Button variant="ghost" onClick={handleClose}>
									Close
								</Button>
								<Button
									onClick={() => {
										setStep("configure");
										setError(null);
									}}
								>
									Try Again
								</Button>
							</>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* QuickView carousel */}
			<SurveyQuickView
				open={quickViewOpen}
				onOpenChange={setQuickViewOpen}
				surveys={generatedSurveys}
				onApprove={handleApprove}
				onSkip={handleSkip}
				onEditQuestion={handleEditQuestion}
			/>
		</>
	);
}
