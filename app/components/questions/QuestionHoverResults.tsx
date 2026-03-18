/**
 * QuestionHoverResults — compact inline stats shown below a question row on hover.
 * Lazy-loads aggregated response stats. Single-line display to avoid disrupting layout.
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router";

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
	matrixRows?: {
		id: string;
		label: string;
		answered: number;
		avg: number | null;
		distribution: { value: number; count: number }[];
	}[];
	/** For open text — recent answer snippets */
	recentAnswers?: string[];
}

/** AI insight for a single question (from BAML analysis) */
export interface QuestionInsight {
	question: string;
	summary: string;
	answer_distribution?: { answer: string; count: number; percentage: number }[];
	key_findings: string[];
	common_answers?: string[];
	notable_outliers: string[];
}

interface QuestionHoverResultsProps {
	questionId: string;
	questionType: string;
	listId: string;
	isVisible: boolean;
	stats?: QuestionResponseStats;
	/** AI insight from saved analysis (shown for text questions instead of raw stats) */
	aiInsight?: QuestionInsight;
}

/** Cache stats so we don't re-fetch on every hover */
const statsCache = new Map<string, QuestionResponseStats>();

export function QuestionHoverResults({
	questionId,
	questionType,
	listId,
	isVisible,
	stats: preloadedStats,
	aiInsight,
}: QuestionHoverResultsProps) {
	const { accountId, projectId } = useParams();
	const [stats, setStats] = useState<QuestionResponseStats | null>(
		preloadedStats ?? statsCache.get(questionId) ?? null
	);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!isVisible || stats || loading || !accountId || !projectId) return;

		const cached = statsCache.get(questionId);
		if (cached) {
			setStats(cached);
			return;
		}

		setLoading(true);
		fetch(
			`/a/${accountId}/${projectId}/ask/api/question-stats?listId=${encodeURIComponent(listId)}&questionId=${encodeURIComponent(questionId)}`
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
	}, [accountId, isVisible, listId, loading, projectId, questionId, stats]);

	if (!isVisible) return null;

	if (!stats || stats.answered === 0) return null;

	const isSelect = questionType === "single_select" || questionType === "multi_select";
	const isLikert = questionType === "likert";
	const isMatrix = questionType === "matrix";

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
					avg <strong className="text-foreground">{stats.likertAvg.toFixed(1)}</strong>
				</span>
			)}

			{isMatrix &&
				stats.matrixRows?.slice(0, 2).map((row) => (
					<span key={row.id} className="flex items-center gap-1">
						<span className="max-w-[100px] truncate">{row.label}</span>
						<strong className="text-foreground">{row.avg?.toFixed(1) ?? "—"}</strong>
					</span>
				))}

			{/* Text: AI summary or recent answers */}
			{!isSelect && !isLikert && !isMatrix && aiInsight && (
				<span className="max-w-[300px] truncate italic">{aiInsight.summary}</span>
			)}
		</div>
	);
}
