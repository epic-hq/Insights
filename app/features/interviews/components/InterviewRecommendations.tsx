/**
 * InterviewRecommendations — surfaces next steps and open questions
 * from conversation analysis with focus tags and rationale quotes.
 */
import { HelpCircle, Lightbulb } from "lucide-react";

interface Recommendation {
	focusArea: string;
	action: string;
	rationale: string;
}

interface InterviewRecommendationsProps {
	recommendations: Recommendation[];
	openQuestions: string[];
}

function getFocusAreaColor(focusArea: string): string {
	const lower = focusArea.toLowerCase();
	if (lower.includes("product")) return "bg-blue-500/10 text-blue-600";
	if (lower.includes("partner")) return "bg-emerald-500/10 text-emerald-600";
	if (lower.includes("research")) return "bg-purple-500/10 text-purple-600";
	if (lower.includes("sales")) return "bg-amber-500/10 text-amber-600";
	return "bg-primary/10 text-primary";
}

export function InterviewRecommendations({ recommendations, openQuestions }: InterviewRecommendationsProps) {
	if (recommendations.length === 0 && openQuestions.length === 0) {
		return null;
	}

	return (
		<div className="space-y-4">
			{/* Recommendations / Next Steps */}
			{recommendations.length > 0 && (
				<div className="space-y-3">
					<div className="flex items-center gap-2">
						<Lightbulb className="h-5 w-5 text-amber-500" />
						<h3 className="font-semibold text-base text-foreground">Recommendations</h3>
					</div>
					<div className="space-y-2.5">
						{recommendations.map((rec, index) => (
							<div key={`${rec.focusArea}-${index}`} className="rounded-lg border border-border bg-muted/20 p-3.5">
								<div className="mb-2 flex items-start gap-2">
									<span
										className={`mt-0.5 inline-flex shrink-0 items-center rounded px-2 py-0.5 font-semibold text-[11px] uppercase tracking-wider ${getFocusAreaColor(rec.focusArea)}`}
									>
										{rec.focusArea}
									</span>
									<p className="flex-1 font-medium text-foreground text-sm leading-relaxed">{rec.action}</p>
								</div>
								{rec.rationale && (
									<p className="text-[13px] text-muted-foreground italic leading-relaxed">{rec.rationale}</p>
								)}
							</div>
						))}
					</div>

					{/* Open Questions */}
					{openQuestions.length > 0 && (
						<div className="mt-4 space-y-2.5 border-border border-t pt-4">
							<div className="flex items-center gap-2">
								<HelpCircle className="h-4 w-4 text-blue-500" />
								<h4 className="font-semibold text-foreground text-sm">Open Questions</h4>
							</div>
							<div className="space-y-1.5">
								{openQuestions.map((question, index) => (
									<div
										key={`q-${index}`}
										className="rounded-md bg-muted/30 px-3 py-2.5 text-muted-foreground text-sm leading-relaxed"
									>
										{question}
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
