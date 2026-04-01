/**
 * InterviewRecommendations — surfaces next steps from conversation analysis
 * with rationale-first layout and focus area tags.
 */
import { Lightbulb } from "lucide-react";

interface Recommendation {
	focusArea: string;
	action: string;
	rationale: string;
}

interface InterviewRecommendationsProps {
	recommendations: Recommendation[];
}

function getFocusAreaColor(focusArea: string): string {
	const lower = focusArea.toLowerCase();
	if (lower.includes("product")) return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
	if (lower.includes("partner")) return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
	if (lower.includes("research")) return "bg-purple-500/10 text-purple-600 dark:text-purple-400";
	if (lower.includes("sales")) return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
	return "bg-primary/10 text-primary";
}

export function InterviewRecommendations({ recommendations }: InterviewRecommendationsProps) {
	if (recommendations.length === 0) return null;

	return (
		<div className="space-y-3">
			<div className="flex items-center gap-2">
				<Lightbulb className="h-5 w-5 text-amber-500" />
				<h3 className="font-semibold text-base text-foreground">Recommendations</h3>
			</div>
			<div className="space-y-2.5">
				{recommendations.map((rec, index) => (
					<div key={`${rec.focusArea}-${index}`} className="rounded-lg border border-border/60 bg-muted/20 p-3.5">
						<div className="mb-2 flex items-start justify-between gap-2">
							{rec.rationale ? (
								<p className="flex-1 text-muted-foreground text-sm leading-relaxed">{rec.rationale}</p>
							) : (
								<div className="flex-1" />
							)}
							<span
								className={`inline-flex shrink-0 items-center rounded px-2 py-0.5 font-semibold text-[11px] uppercase tracking-wider ${getFocusAreaColor(rec.focusArea)}`}
							>
								{rec.focusArea}
							</span>
						</div>
						<p className="font-medium text-foreground text-sm leading-relaxed">{rec.action}</p>
					</div>
				))}
			</div>
		</div>
	);
}
