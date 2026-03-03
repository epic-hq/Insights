/**
 * QuestionHoverResults — compact inline stats shown below a question row on hover.
 * Lazy-loads aggregated response stats. Single-line display to avoid disrupting layout.
 */
import { useEffect, useState } from "react";

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
  questionId: string;
  questionType: string;
  listId: string;
  isVisible: boolean;
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
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [isVisible, questionId, listId, stats, loading]);

  if (!isVisible) return null;

  if (loading) {
    return (
      <div className="ml-12 py-1 text-[10px] text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!stats || stats.answered === 0) return null;

  const isSelect =
    questionType === "single_select" || questionType === "multi_select";
  const isLikert = questionType === "likert";

  return (
    <div className="ml-12 flex items-center gap-3 py-1 text-[10px] text-muted-foreground">
      <span>{stats.answered} responses</span>
      {stats.skipRate > 0 && <span>{stats.skipRate}% skipped</span>}

      {/* Select: top answers inline */}
      {isSelect &&
        stats.distribution?.slice(0, 3).map((item) => (
          <span key={item.label} className="flex items-center gap-0.5">
            <span className="max-w-[80px] truncate">{item.label}</span>
            <strong className="text-foreground">{item.pct}%</strong>
          </span>
        ))}

      {/* Likert: just the average */}
      {isLikert && stats.likertAvg != null && (
        <span>
          avg{" "}
          <strong className="text-foreground">
            {stats.likertAvg.toFixed(1)}
          </strong>
        </span>
      )}

      {/* Text: word count */}
      {stats.avgWordCount != null && (
        <span>
          avg{" "}
          <strong className="text-foreground">
            {stats.avgWordCount} words
          </strong>
        </span>
      )}
    </div>
  );
}
