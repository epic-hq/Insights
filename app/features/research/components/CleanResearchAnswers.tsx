import { ArrowRight, ChevronDownIcon } from "lucide-react";
import { useEffect, useState } from "react";
import {
	ConfidenceBarChart,
	type ConfidenceVariant,
	getConfidenceLevelFromAnswerCount,
} from "~/components/ui/ConfidenceBarChart";
import { Card, CardContent } from "~/components/ui/card";

interface ResearchAnswerEvidence {
	id: string;
	verbatim: string;
	support: string;
	modality: string;
	anchors: unknown;
	interview_id: string | null;
	created_at: string | null;
}

interface ResearchAnswerNode {
	id: string;
	question_text: string;
	question_category: string | null;
	status: string;
	order_index: number | null;
	answered_at: string | null;
	interview: {
		id: string | null;
		title: string | null;
		interview_date: string | null;
	};
	respondent: {
		id: string | null;
		name: string | null;
	};
	answer_text: string | null;
	detected_question_text: string | null;
	metrics: {
		evidence_count: number;
		interview_count: number;
		persona_count: number;
	};
	evidence: ResearchAnswerEvidence[];
}

interface ResearchQuestionNode {
	id: string;
	text: string;
	metrics: {
		answered_answer_count: number;
		open_answer_count: number;
		evidence_count: number;
		interview_count: number;
		persona_count: number;
	};
	answers: ResearchAnswerNode[];
}

interface DecisionQuestionNode {
	id: string;
	text: string;
	metrics: {
		research_question_count: number;
		answered_answer_count: number;
		open_answer_count: number;
		evidence_count: number;
		interview_count: number;
		persona_count: number;
	};
	research_questions: ResearchQuestionNode[];
}

export interface ResearchAnswersData {
	decision_questions: DecisionQuestionNode[];
	research_questions_without_decision: ResearchQuestionNode[];
	orphan_answers: ResearchAnswerNode[];
	latest_analysis_run?: {
		id: string;
		run_summary: string | null;
		recommended_actions: string[];
	} | null;
	analysis_results?: Array<{
		question_type: "decision" | "research";
		question_id: string;
		summary: string;
		confidence: number;
		next_steps: string | null;
		goal_achievement_summary: string | null;
	}>;
}

interface CleanResearchAnswersProps {
	projectId: string;
	className?: string;
	projectRoutes?: { evidence: { index: () => string } };
	onMetrics?: (metrics: { answered: number; open: number; total: number }) => void;
	onData?: (data: ResearchAnswersData | null) => void;
	confidenceVariant?: ConfidenceVariant;
}

function DecisionCard({
	decision,
	projectRoutes,
	confidenceVariant = "bars",
}: {
	decision: DecisionQuestionNode;
	projectRoutes?: { evidence: { index: () => string } };
	confidenceVariant?: ConfidenceVariant;
}) {
	const confidenceLevel = getConfidenceLevelFromAnswerCount(decision.metrics.answered_answer_count);

	// Get the best answer summary
	const bestAnswer = decision.research_questions
		.flatMap((rq) => rq.answers)
		.filter((answer) => answer.answer_text && answer.answer_text.length > 50)
		.sort((a, b) => (b.metrics.evidence_count || 0) - (a.metrics.evidence_count || 0))[0];

	// Generate evidence link for research questions
	const getEvidenceLink = (rqId: string) => (projectRoutes ? `${projectRoutes.evidence.index()}?rq_id=${rqId}` : null);

	return (
		<Card className="mb-4 border border-gray-200 sm:mb-6">
			<CardContent className="p-4 sm:p-6">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div className="flex items-start gap-3">
						<ConfidenceBarChart level={confidenceLevel} variant={confidenceVariant} className="mt-1 flex-shrink-0" />
						<div className="min-w-0 flex-1">
							<h3 className="font-medium text-base text-foreground sm:text-lg">{decision.text}</h3>
							{bestAnswer?.answer_text && (
								<div className="mt-2 text-foreground/70 text-sm sm:text-base">
									{bestAnswer.answer_text.split("\n").map((line, index) => (
										<p key={index} className={index > 0 ? "mt-1" : ""}>
											{line.trim()}
										</p>
									))}
								</div>
							)}
						</div>
					</div>
					<div className="flex items-center gap-2">
						{/* <Badge variant={confidenceLevel === "high" ? "default" : confidenceLevel === "medium" ? "secondary" : "destructive"}>
							{confidenceLevel}
						</Badge>
						<span className="text-gray-500 text-sm">({decision.metrics.answered_answer_count})</span> */}
					</div>
				</div>

				{decision.research_questions.length > 0 && (
					<div className="mx-4 mt-6 md:mx-8">
						<details className="group">
							<summary className="flex cursor-pointer items-center justify-between font-medium text-foreground/80 text-sm">
								<div className="hidden md:block">Details</div>
								<div className="flex items-center gap-2">
									<span className="text-foreground/60 text-xs">{decision.metrics.evidence_count}</span>
									<ChevronDownIcon className="h-4 w-4 text-foreground/50 transition-transform duration-200 group-open:rotate-180" />
								</div>
							</summary>
							<div className="mt-3 space-y-2 sm:space-y-3">
								{decision.research_questions
									.filter((rq) => rq.answers.some((a) => a.answer_text && a.answer_text.length > 30))
									.slice(0, 3)
									.map((rq) => {
										const bestRQAnswer = rq.answers
											.filter((a) => a.answer_text && a.answer_text.length > 30)
											.sort((a, b) => (b.metrics.evidence_count || 0) - (a.metrics.evidence_count || 0))[0];

										const evidenceLink = getEvidenceLink(rq.id);

										return (
											<div key={rq.id} className="rounded-lg bg-gray-50 p-3 sm:p-4">
												<div className="flex items-start justify-between gap-3">
													<div className="min-w-0 flex-1">
														<h5 className="font-medium text-foreground text-sm">{rq.text}</h5>
														{bestRQAnswer?.answer_text && (
															<div className="mt-1 text-foreground/70 text-sm">
																{bestRQAnswer.answer_text.split("\n").map((line, index) => (
																	<p key={index} className={index > 0 ? "mt-1" : ""}>
																		{line.trim()}
																	</p>
																))}
															</div>
														)}
													</div>
													{evidenceLink && (
														<a
															href={evidenceLink}
															className="flex-shrink-0 text-foreground/50 hover:text-foreground/70"
															title="View related evidence"
														>
															<ArrowRight className="h-4 w-4" />
														</a>
													)}
												</div>
											</div>
										);
									})}
							</div>
						</details>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export function CleanResearchAnswers({
	projectId,
	className,
	projectRoutes,
	onData,
	confidenceVariant = "bars",
}: CleanResearchAnswersProps) {
	const [data, setData] = useState<ResearchAnswersData | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		const fetchData = async () => {
			try {
				setLoading(true);
				const response = await fetch(`/api.research-answers?projectId=${projectId}`);
				if (!response.ok) throw new Error("Failed to load");
				const body = (await response.json()) as { data: ResearchAnswersData };
				if (!cancelled) {
					setData(body.data);
					onData?.(body.data);
				}
			} catch {
				// Silent fail
			} finally {
				if (!cancelled) setLoading(false);
			}
		};
		void fetchData();
		return () => {
			cancelled = true;
		};
	}, [projectId, onData]);

	if (loading) {
		return (
			<div className={className}>
				<div className="space-y-4">
					<div className="h-24 animate-pulse rounded bg-gray-100" />
					<div className="h-24 animate-pulse rounded bg-gray-100" />
				</div>
			</div>
		);
	}

	if (!data?.decision_questions?.length) return null;

	return (
		<div className={className}>
			<h2 className="mb-4 font-semibold text-foreground text-lg sm:mb-6 sm:text-xl">Decision Analysis</h2>
			{data.decision_questions.map((decision) => (
				<DecisionCard
					key={decision.id}
					decision={decision}
					projectRoutes={projectRoutes}
					confidenceVariant={confidenceVariant}
				/>
			))}
		</div>
	);
}
