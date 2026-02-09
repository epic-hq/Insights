/**
 * InterviewRecommendations — surfaces next steps and open questions
 * from conversation analysis. Previously this data was loaded but not rendered.
 */
import { ArrowRight, HelpCircle, Lightbulb } from "lucide-react";

interface Recommendation {
	focusArea: string;
	action: string;
	rationale: string;
}

interface InterviewRecommendationsProps {
	recommendations: Recommendation[];
	openQuestions: string[];
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
					<label className="flex items-center gap-2 font-semibold text-foreground text-lg">
						<Lightbulb className="h-5 w-5 text-amber-500" />
						Recommended Next Steps
					</label>
					<ul className="space-y-2">
						{recommendations.map((rec, index) => (
							<li
								key={`${rec.focusArea}-${index}`}
								className="flex gap-3 rounded-lg border border-muted/60 bg-muted/20 p-3"
							>
								<ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
								<div className="space-y-1">
									<p className="font-medium text-foreground text-sm">{rec.action}</p>
									<p className="text-muted-foreground text-xs">
										<span className="font-medium">{rec.focusArea}</span>
										{rec.rationale && <> &mdash; {rec.rationale}</>}
									</p>
								</div>
							</li>
						))}
					</ul>
				</div>
			)}

			{/* Open Questions */}
			{openQuestions.length > 0 && (
				<div className="space-y-3">
					<label className="flex items-center gap-2 font-semibold text-foreground text-lg">
						<HelpCircle className="h-5 w-5 text-blue-500" />
						Open Questions
					</label>
					<ul className="space-y-1.5">
						{openQuestions.map((question, index) => (
							<li key={`q-${index}`} className="flex items-start gap-2 text-muted-foreground text-sm">
								<span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
								{question}
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}
