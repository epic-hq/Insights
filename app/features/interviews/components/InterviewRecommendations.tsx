/**
 * InterviewRecommendations — surfaces next steps and open questions
 * from conversation analysis with focus tags and rationale quotes.
 */
import { HelpCircle, Lightbulb } from "lucide-react";
import { Badge } from "~/components/ui/badge";

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

export function InterviewRecommendations({
  recommendations,
  openQuestions,
}: InterviewRecommendationsProps) {
  if (recommendations.length === 0 && openQuestions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Recommendations / Next Steps */}
      {recommendations.length > 0 && (
        <div className="space-y-3 rounded-lg border border-muted/60 bg-card p-5">
          <label className="flex items-center gap-2 font-semibold text-foreground text-lg">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Recommendations
          </label>
          <div className="space-y-3">
            {recommendations.map((rec, index) => (
              <div
                key={`${rec.focusArea}-${index}`}
                className="rounded-lg border border-muted/60 bg-muted/20 p-3"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded px-2 py-0.5 font-semibold text-[11px] uppercase tracking-wide ${getFocusAreaColor(rec.focusArea)}`}
                  >
                    {rec.focusArea}
                  </span>
                  <p className="flex-1 font-medium text-foreground text-sm">
                    {rec.action}
                  </p>
                </div>
                {rec.rationale && (
                  <p className="italic text-muted-foreground text-xs leading-relaxed">
                    {rec.rationale}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Open Questions */}
          {openQuestions.length > 0 && (
            <div className="mt-5 space-y-3 border-t border-muted/60 pt-5">
              <label className="flex items-center gap-2 font-semibold text-sm">
                <HelpCircle className="h-4 w-4 text-blue-500" />
                Open Questions
              </label>
              <div className="space-y-2">
                {openQuestions.map((question, index) => (
                  <div
                    key={`q-${index}`}
                    className="rounded-md bg-muted/20 px-3 py-2 text-muted-foreground text-sm"
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
