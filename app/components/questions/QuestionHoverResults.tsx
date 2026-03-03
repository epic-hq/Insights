/**
 * QuestionHoverResults — inline expandable panel shown below a question row on hover.
 * Lazy-loads aggregated response stats for the question.
 * Shows: distribution for select, histogram for likert, word count/time for open text.
 */
import { useCallback, useEffect, useState } from "react";
import { cn } from "~/lib/utils";

/** Response stats shape returned by the API */
export interface QuestionResponseStats {
  questionId: string;
  answered: number;
  skipped: number;
  skipRate: number;
  avgTimeSeconds?: number;
  /** For select questions: answer → percentage */
  distribution?: { label: string; pct: number }[];
  /** For likert: scale value → count */
  likertDistribution?: { value: number; count: number }[];
  likertAvg?: number;
  /** For open text */
  avgWordCount?: number;
}

interface QuestionHoverResultsProps {
  /** Question ID to fetch stats for */
  questionId: string;
  /** Question type to determine display format */
  questionType: string;
  /** Survey/list ID for the API call */
  listId: string;
  /** Whether to show (controlled by parent hover state) */
  isVisible: boolean;
  /** Optional pre-loaded stats (skip fetch) */
  stats?: QuestionResponseStats;
}

/** Cache stats so we don't re-fetch on every hover */
const statsCache = new Map<string, QuestionResponseStats>();

export function QuestionHoverResults({
  questionId,
  questionType,
  listId,
  isVisible,
  stats: preloadedStats,
}: QuestionHoverResultsProps) {
  const [stats, setStats] = useState<QuestionResponseStats | null>(
    preloadedStats ?? statsCache.get(questionId) ?? null,
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isVisible || stats || loading) return;

    const cached = statsCache.get(questionId);
    if (cached) {
      setStats(cached);
      return;
    }

    setLoading(true);
    fetch(
      `/api/research-links/question-stats?listId=${encodeURIComponent(listId)}&questionId=${encodeURIComponent(questionId)}`,
    )
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch stats");
        return r.json();
      })
      .then((data: QuestionResponseStats) => {
        statsCache.set(questionId, data);
        setStats(data);
      })
      .catch(() => {
        // Silently fail — no stats available yet
        setStats(null);
      })
      .finally(() => setLoading(false));
  }, [isVisible, questionId, listId, stats, loading]);

  if (!isVisible) return null;

  // Loading state
  if (loading) {
    return (
      <div className="border-t border-border/30 bg-muted/20 px-4 py-2">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Loading results...
        </div>
      </div>
    );
  }

  // No stats yet (new survey, or API not implemented yet)
  if (!stats || stats.answered === 0) {
    return (
      <div className="border-t border-border/30 bg-muted/20 px-4 py-2">
        <span className="text-muted-foreground text-xs">No responses yet</span>
      </div>
    );
  }

  const isSelect =
    questionType === "single_select" || questionType === "multi_select";
  const isLikert = questionType === "likert";

  return (
    <div className="border-t border-border/30 bg-muted/20 px-4 py-2.5">
      {/* Select question: answer distribution */}
      {isSelect && stats.distribution && (
        <div className="space-y-1">
          {stats.distribution.slice(0, 5).map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {item.label}
              </span>
              <div className="h-1 w-20 overflow-hidden rounded-full bg-border/50">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${item.pct}%` }}
                />
              </div>
              <span className="w-8 text-right font-mono text-muted-foreground tabular-nums">
                {item.pct}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Likert: mini histogram + average */}
      {isLikert && stats.likertDistribution && (
        <div className="flex items-end gap-3">
          <div className="flex flex-1 items-end gap-1" style={{ height: 24 }}>
            {stats.likertDistribution.map((bar) => {
              const maxCount = Math.max(
                ...stats.likertDistribution!.map((b) => b.count),
              );
              const height = maxCount > 0 ? (bar.count / maxCount) * 24 : 2;
              return (
                <div
                  key={bar.value}
                  className="flex-1 rounded-t bg-primary"
                  style={{ height: Math.max(2, height) }}
                />
              );
            })}
          </div>
          {stats.likertAvg != null && (
            <div className="text-right">
              <div className="font-semibold text-foreground text-lg leading-none">
                {stats.likertAvg.toFixed(1)}
              </div>
              <div className="text-[9px] text-muted-foreground">avg</div>
            </div>
          )}
        </div>
      )}

      {/* Stats row (shared across types) */}
      <div
        className={cn(
          "flex gap-3 text-[10px] text-muted-foreground",
          (isSelect || isLikert) && "mt-2 border-t border-border/30 pt-2",
        )}
      >
        <span>{stats.answered} answered</span>
        {stats.avgTimeSeconds != null && (
          <span>
            Avg time{" "}
            <strong className="text-foreground">{stats.avgTimeSeconds}s</strong>
          </span>
        )}
        {stats.skipRate > 0 && (
          <span>
            Skip rate{" "}
            <strong className="text-foreground">{stats.skipRate}%</strong>
          </span>
        )}
        {stats.avgWordCount != null && (
          <span>
            Avg{" "}
            <strong className="text-foreground">
              {stats.avgWordCount} words
            </strong>
          </span>
        )}
      </div>
    </div>
  );
}
