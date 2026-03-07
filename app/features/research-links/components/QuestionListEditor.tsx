/**
 * Streamlined question list editor with Airtable-style layout.
 * Shows a clean list of questions (number + prompt + indicators).
 * Clicking a question opens a side drawer with all editing controls.
 */
import { AnimatePresence, motion } from "framer-motion";
import {
	AlertTriangle,
	ArrowDown,
	ArrowUp,
	BarChart3,
	Check,
	ChevronDown as ChevronDownIcon,
	GitBranch,
	Image,
	Loader2,
	Paperclip,
	Pencil,
	Plus,
	Sparkles,
	Trash2,
	Upload,
	X,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRevalidator } from "react-router";
import { toast } from "sonner";
import { QuestionHoverResults } from "~/components/questions/QuestionHoverResults";
import { UnifiedQuestionList } from "~/components/questions/UnifiedQuestionList";
import { QuestionTypeBadge, UnifiedQuestionRow } from "~/components/questions/UnifiedQuestionRow";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import type { BranchRule } from "../branching";
import type { ResearchLinkQuestion } from "../schemas";
import { createEmptyQuestion } from "../schemas";
import { buildSurveySectionGraph } from "../section-graph";
import { DEFAULT_SECTION_ID, deriveSurveySections } from "../sections";
import { formatFlowAverageLabel, formatPathBreakdown, summarizeSurveyFlow } from "../survey-flow";
import { getMediaType, isR2Key } from "../utils";
import { QuestionBranchingEditor } from "./QuestionBranchingEditor";
import { QuestionMediaEditor } from "./QuestionMediaEditor";

/** Format questions as clean text for clipboard */
function formatQuestionsForClipboard(questions: ResearchLinkQuestion[]): string {
	const lines: string[] = [];
	for (const [i, q] of questions.entries()) {
		if (q.hidden) continue;
		const num = i + 1;
		const typeLabel = questionTypeLabel(q.type);
		let line = `${num}. ${q.prompt || "(Untitled)"}`;
		if (q.type !== "auto") line += `  [${typeLabel}]`;
		if (q.required) line += "  *Required";
		lines.push(line);

		// Show options for select questions
		if ((q.type === "single_select" || q.type === "multi_select") && q.options?.length) {
			for (const opt of q.options) {
				lines.push(`   - ${opt}`);
			}
			if (q.allowOther) lines.push("   - Other (write-in)");
		}

		// Show likert scale
		if (q.type === "likert") {
			const scale = q.likertScale ?? 5;
			const low = q.likertLabels?.low ?? "1";
			const high = q.likertLabels?.high ?? String(scale);
			lines.push(`   Scale 1–${scale}: ${low} → ${high}`);
		}
	}
	return lines.join("\n");
}

/**
 * Tiny media thumbnail for the question list row.
 * Fetches a signed URL for R2 keys; shows an image preview for images,
 * or a type-appropriate icon for video/audio.
 */
function QuestionMediaThumbnail({ url }: { url: string }) {
	const [src, setSrc] = useState<string | null>(isR2Key(url) ? null : url);
	const type = getMediaType(url);

	useEffect(() => {
		if (!isR2Key(url)) {
			setSrc(url);
			return;
		}
		fetch(`/api/upload-image?key=${encodeURIComponent(url)}`)
			.then((r) => r.json())
			.then((d) => setSrc(d.url ?? null))
			.catch(() => setSrc(null));
	}, [url]);

	if (type === "image" && src) {
		return <img src={src} alt="" className="h-7 w-7 shrink-0 rounded border border-border/50 object-cover" />;
	}

	// For video/audio/unknown, show a colored icon
	return <Paperclip className="h-3.5 w-3.5 shrink-0 text-blue-500" />;
}

/**
 * Options input that manages local state and only parses on blur.
 * This allows users to type commas and spaces naturally.
 */
function OptionsInput({
	options,
	onChange,
}: {
	options: string[] | null;
	onChange: (options: string[] | null) => void;
}) {
	const serializedOptions = useMemo(() => (options ?? []).join("\n"), [options]);
	const [localValue, setLocalValue] = useState(() => serializedOptions);
	const [isEditing, setIsEditing] = useState(false);

	// Sync from parent when options change externally
	useEffect(() => {
		if (!isEditing) {
			setLocalValue(serializedOptions);
		}
	}, [serializedOptions, isEditing]);

	const parseAndSync = () => {
		const parsed = localValue
			.split(/\r?\n/)
			.map((o) => o.trim())
			.filter(Boolean);
		onChange(parsed.length > 0 ? parsed : null);
	};

	const lineCount = Math.max(3, localValue.split(/\r?\n/).filter(Boolean).length + 1);

	return (
		<Textarea
			value={localValue}
			onChange={(e) => setLocalValue(e.target.value)}
			onFocus={() => setIsEditing(true)}
			onBlur={() => {
				setIsEditing(false);
				parseAndSync();
			}}
			placeholder={"One option per line\nCommas are kept as part of the option text"}
			className="text-xs"
			rows={lineCount}
		/>
	);
}

/** Human-readable question type label */
function questionTypeLabel(type: string): string {
	const labels: Record<string, string> = {
		auto: "Auto",
		short_text: "Short text",
		long_text: "Long text",
		single_select: "Select one",
		multi_select: "Select many",
		likert: "Likert scale",
		image_select: "Image select",
	};
	return labels[type] ?? type;
}

function formatBranchRuleValue(value: string | string[] | undefined): string {
	if (Array.isArray(value)) return value.filter(Boolean).join(", ");
	return value?.trim() ?? "";
}

function getBranchTargetMeta(
	rule: BranchRule,
	questions: ResearchLinkQuestion[],
	sections: ReturnType<typeof deriveSurveySections>
): {
	targetLabel: string;
	targetQuestionId: string | null;
	targetPrompt: string | null;
} {
	if (rule.action === "end_survey") {
		return { targetLabel: "End survey", targetQuestionId: null, targetPrompt: null };
	}
	if (rule.targetSectionId) {
		const section = sections.find((entry) => entry.id === rule.targetSectionId);
		if (section) {
			const startIndex = questions.findIndex((q) => q.id === section.startQuestionId);
			return {
				targetLabel: `Section: ${section.title}`,
				targetQuestionId: section.startQuestionId,
				targetPrompt: startIndex >= 0 ? (questions[startIndex]?.prompt ?? null) : null,
			};
		}
	}
	const targetIndex = rule.targetQuestionId ? questions.findIndex((q) => q.id === rule.targetQuestionId) : -1;
	if (targetIndex < 0 || !rule.targetQuestionId) {
		return { targetLabel: "Unknown", targetQuestionId: null, targetPrompt: null };
	}
	return {
		targetLabel: `Q${targetIndex + 1}`,
		targetQuestionId: rule.targetQuestionId,
		targetPrompt: questions[targetIndex]?.prompt ?? null,
	};
}

function formatRuleConditionForGrouping(rule: BranchRule): string {
	if (rule.conditions.conditions.length === 0) return "otherwise";
	const parts = rule.conditions.conditions.map((condition) => {
		const value = formatBranchRuleValue(condition.value);
		switch (condition.operator) {
			case "equals":
			case "selected":
				return value ? `"${value}"` : "selected";
			case "not_equals":
			case "not_selected":
				return value ? `not "${value}"` : "not selected";
			case "contains":
				return value ? `contains "${value}"` : "contains";
			case "not_contains":
				return value ? `does not contain "${value}"` : "does not contain";
			case "answered":
				return "answered";
			case "not_answered":
				return "not answered";
			default:
				return condition.operator;
		}
	});
	return parts.join(rule.conditions.logic === "or" ? " OR " : " AND ");
}

function groupRulesByTarget(
	ruleRows: Array<{
		rule: BranchRule;
		targetLabel: string;
		targetQuestionId: string | null;
		targetPrompt: string | null;
	}>
) {
	const grouped = new Map<
		string,
		{
			targetLabel: string;
			targetQuestionId: string | null;
			targetPrompt: string | null;
			conditions: Set<string>;
			ruleCount: number;
			rules: BranchRule[];
		}
	>();

	for (const { rule, targetLabel, targetQuestionId, targetPrompt } of ruleRows) {
		const groupKey = `${targetLabel}:${targetQuestionId ?? "none"}`;
		const entry = grouped.get(groupKey) ?? {
			targetLabel,
			targetQuestionId,
			targetPrompt,
			conditions: new Set<string>(),
			ruleCount: 0,
			rules: [],
		};
		entry.ruleCount += 1;
		entry.conditions.add(formatRuleConditionForGrouping(rule));
		entry.rules.push(rule);
		grouped.set(groupKey, entry);
	}

	return Array.from(grouped.values()).map((entry) => {
		const conditionList = Array.from(entry.conditions).filter(Boolean);
		let conditionSummary = "otherwise";
		if (conditionList.length === 1) {
			conditionSummary = conditionList[0];
		} else if (conditionList.length > 1 && conditionList.length <= 4) {
			conditionSummary = conditionList.join(" OR ");
		} else if (conditionList.length > 4) {
			conditionSummary = `${conditionList.slice(0, 3).join(", ")} +${conditionList.length - 3} more`;
		}

		return {
			targetLabel: entry.targetLabel,
			targetQuestionId: entry.targetQuestionId,
			targetPrompt: entry.targetPrompt,
			ruleCount: entry.ruleCount,
			conditionSummary,
			rules: entry.rules,
			ruleIds: entry.rules.map((rule) => rule.id),
		};
	});
}

const QUESTION_SECONDS_BY_TYPE: Record<string, number> = {
	auto: 16,
	short_text: 16,
	long_text: 28,
	single_select: 9,
	multi_select: 14,
	likert: 9,
	image_select: 14,
};
const SURVEY_LENGTH_WARN_SECONDS = 5 * 60;

function estimateQuestionSeconds(question: ResearchLinkQuestion): number {
	return QUESTION_SECONDS_BY_TYPE[question.type] ?? QUESTION_SECONDS_BY_TYPE.auto;
}

function formatEstimatedMinutes(totalSeconds: number): string {
	if (totalSeconds <= 0) return "~0 min";
	return `~${Math.max(1, Math.round(totalSeconds / 60))} min`;
}

function normalizeSectionTitleInput(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

function buildSectionIdFromTitle(title: string, existingIds: Set<string>): string {
	const base =
		normalizeSectionTitleInput(title)
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || "section";
	let candidate = base;
	let suffix = 2;
	while (existingIds.has(candidate)) {
		candidate = `${base}-${suffix}`;
		suffix += 1;
	}
	return candidate;
}

type QuestionEditorAction =
	| { type: "add"; question: ResearchLinkQuestion }
	| { type: "update"; id: string; updates: Partial<ResearchLinkQuestion> }
	| { type: "remove"; id: string }
	| { type: "move"; id: string; direction: -1 | 1 };

function cleanupBranchingAfterQuestionDelete(
	questions: ResearchLinkQuestion[],
	deletedQuestionId: string
): ResearchLinkQuestion[] {
	return questions
		.filter((question) => question.id !== deletedQuestionId)
		.map((question) => {
			if (!question.branching) return question;
			const cleanedRules = question.branching.rules.filter((rule) => {
				if (rule.targetQuestionId === deletedQuestionId) return false;
				if (rule.conditions.conditions.some((c) => c.questionId === deletedQuestionId)) return false;
				return true;
			});
			const cleanedDefaultNext =
				question.branching.defaultNext === deletedQuestionId ? undefined : question.branching.defaultNext;
			if (cleanedRules.length === 0 && !cleanedDefaultNext) {
				return { ...question, branching: null };
			}
			return {
				...question,
				branching: { rules: cleanedRules, defaultNext: cleanedDefaultNext },
			};
		});
}

function applyQuestionEditorAction(
	questions: ResearchLinkQuestion[],
	action: QuestionEditorAction
): ResearchLinkQuestion[] {
	switch (action.type) {
		case "add":
			return [...questions, action.question];
		case "update":
			return questions.map((question) =>
				question.id === action.id
					? {
							...question,
							...action.updates,
						}
					: question
			);
		case "remove":
			return cleanupBranchingAfterQuestionDelete(questions, action.id);
		case "move": {
			const index = questions.findIndex((question) => question.id === action.id);
			if (index < 0) return questions;
			const newIndex = index + action.direction;
			if (newIndex < 0 || newIndex >= questions.length) return questions;
			const reordered = [...questions];
			const [item] = reordered.splice(index, 1);
			reordered.splice(newIndex, 0, item);
			return reordered;
		}
		default:
			return questions;
	}
}

function normalizeInsightText(value: string): string {
	return value
		.toLowerCase()
		.replace(/["'`]/g, "")
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

function hasNumericSignal(value: string): boolean {
	return /\b\d+(?:\.\d+)?%?\b/.test(value);
}

function sanitizeInsight(insight: AiQuestionInsight | undefined, responseCount: number): AiQuestionInsight | undefined {
	if (!insight) return undefined;

	const distribution = (insight.answer_distribution ?? []).filter((item) => item.answer?.trim());
	const labelSet = new Set(distribution.map((item) => normalizeInsightText(item.answer)));
	const findings = (insight.key_findings ?? [])
		.map((finding) => finding.trim())
		.filter(Boolean)
		.filter((finding) => {
			const normalized = normalizeInsightText(finding);
			return normalized.length > 4 && !labelSet.has(normalized);
		});
	const dedupedFindings = [...new Set(findings)];

	if (dedupedFindings.length === 0 && distribution.length > 0) {
		const top = distribution[0];
		if (top) {
			dedupedFindings.push(
				`${top.count} of ${Math.max(responseCount, top.count)} responses (${top.percentage}%) selected "${top.answer}".`
			);
		}
	}

	let summary = insight.summary?.trim() ?? "";
	if ((!summary || !hasNumericSignal(summary)) && distribution.length > 0) {
		const top = distribution[0];
		if (top) {
			summary = `Top response was "${top.answer}" at ${top.percentage}% (${top.count} of ${Math.max(responseCount, top.count)} responses).`;
		}
	}

	return {
		...insight,
		summary,
		key_findings: dedupedFindings,
		answer_distribution: distribution,
	};
}

/**
 * Response Insights section for the question edit drawer.
 * Shows AI analysis results, key findings, and staleness info.
 */
function DrawerInsightsSection({
	aiInsight,
	responseCount,
	newSinceAnalysis,
	listId,
	onDetailedAnalysis,
}: {
	aiInsight?: AiQuestionInsight;
	responseCount: number;
	newSinceAnalysis: number;
	listId?: string;
	onDetailedAnalysis?: (result: SavedAiAnalysis["result"]) => void;
}) {
	const { accountId, projectId } = useParams();
	const revalidator = useRevalidator();
	const [expanded, setExpanded] = useState(true);
	const [analyzing, setAnalyzing] = useState(false);

	const handleReanalyze = async () => {
		if (!listId || !accountId || !projectId) return;
		setAnalyzing(true);
		try {
			const fd = new FormData();
			fd.set("listId", listId);
			fd.set("mode", "detailed");
			const res = await fetch(`/a/${accountId}/${projectId}/ask/api/analyze-responses`, { method: "POST", body: fd });
			const data = (await res.json()) as { mode?: string; result?: SavedAiAnalysis["result"] };
			if (!res.ok) throw new Error("Analysis failed");
			if (data.mode === "detailed" && data.result) {
				onDetailedAnalysis?.(data.result);
			}
			toast.success("Analysis complete");
			revalidator.revalidate();
		} catch {
			toast.error("Analysis failed — try again");
		} finally {
			setAnalyzing(false);
		}
	};

	const hasAiInsight = Boolean(aiInsight);
	const isStale = newSinceAnalysis > 0;

	return (
		<div className="rounded-lg border border-border/60 bg-muted/20">
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="flex w-full items-center justify-between px-3 py-2"
			>
				<div className="flex items-center gap-1.5">
					<BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
					<span className="font-medium text-xs">Response Insights</span>
					<span className="text-[10px] text-muted-foreground">
						({responseCount} response{responseCount !== 1 ? "s" : ""})
					</span>
					{isStale && hasAiInsight && (
						<span className="flex items-center gap-0.5 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-600 dark:text-amber-400">
							<AlertTriangle className="h-2.5 w-2.5" />
							{newSinceAnalysis} new
						</span>
					)}
				</div>
				<ChevronDownIcon
					className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? "" : "-rotate-90"}`}
				/>
			</button>

			{expanded && (
				<div className="space-y-3 border-t px-3 py-3">
					{hasAiInsight && aiInsight ? (
						<>
							{/* Summary */}
							<p className="text-foreground/80 text-xs leading-relaxed">{aiInsight.summary}</p>

							{/* Key findings */}
							{aiInsight.key_findings.length > 0 && (
								<div className="space-y-1">
									<span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
										Key findings
									</span>
									<ul className="space-y-0.5">
										{aiInsight.key_findings.map((finding: string, i: number) => (
											<li key={i} className="flex items-start gap-1.5 text-[11px] text-foreground/70">
												<span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary/50" />
												{finding}
											</li>
										))}
									</ul>
								</div>
							)}

							{/* Answer distribution bars (for select/likert-type insights) */}
							{aiInsight.answer_distribution && aiInsight.answer_distribution.length > 0 && (
								<div className="space-y-1">
									<span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
										Distribution
									</span>
									{aiInsight.answer_distribution.map((item, i) => (
										<div key={i} className="flex items-center gap-2">
											<span className="w-24 truncate text-[10px] text-foreground/70">{item.answer}</span>
											<div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
												<div className="h-full rounded-full bg-primary/60" style={{ width: `${item.percentage}%` }} />
											</div>
											<span className="w-8 text-right font-mono text-[9px] text-muted-foreground tabular-nums">
												{item.percentage}%
											</span>
										</div>
									))}
								</div>
							)}

							{/* Notable outliers */}
							{aiInsight.notable_outliers.length > 0 && (
								<div className="space-y-1">
									<span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
										Notable outliers
									</span>
									<ul className="space-y-0.5">
										{aiInsight.notable_outliers.map((outlier, i) => (
											<li key={i} className="text-[11px] text-foreground/60 italic">
												{outlier}
											</li>
										))}
									</ul>
								</div>
							)}

							{/* Stale / re-analyze */}
							{isStale && (
								<div className="flex items-center justify-between rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1.5">
									<span className="text-[10px] text-amber-700 dark:text-amber-400">
										Analysis from {analysisResponseCount(responseCount, newSinceAnalysis)} responses —{" "}
										{newSinceAnalysis} new since
									</span>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="h-6 text-[10px]"
										disabled={analyzing}
										onClick={handleReanalyze}
									>
										{analyzing ? (
											<Loader2 className="mr-1 h-3 w-3 animate-spin" />
										) : (
											<Sparkles className="mr-1 h-3 w-3" />
										)}
										Re-analyze
									</Button>
								</div>
							)}
						</>
					) : (
						<div className="flex flex-col items-center gap-2 py-2">
							<p className="text-center text-[11px] text-muted-foreground">
								{responseCount >= 3
									? "Run AI analysis to get insights for this question"
									: "Collect more responses to unlock AI insights"}
							</p>
							{responseCount >= 3 && (
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="h-7 text-xs"
									disabled={analyzing}
									onClick={handleReanalyze}
								>
									{analyzing ? (
										<Loader2 className="mr-1 h-3 w-3 animate-spin" />
									) : (
										<Sparkles className="mr-1 h-3 w-3" />
									)}
									Run AI Analysis
								</Button>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

/** Helper to compute analysis-time response count */
function analysisResponseCount(total: number, newSince: number): number {
	return total - newSince;
}

/**
 * Side-drawer panel for editing a single question's settings.
 */
function QuestionEditDrawer({
	question,
	questions,
	index,
	listId,
	isOpen,
	onClose,
	updateQuestion,
	reassignQuestionToSection,
	removeQuestion,
	moveQuestion,
	aiInsight,
	responseCount,
	newSinceAnalysis,
	coachingFlag,
	onDetailedAnalysis,
}: {
	question: ResearchLinkQuestion;
	questions: ResearchLinkQuestion[];
	index: number;
	listId?: string;
	isOpen: boolean;
	onClose: () => void;
	updateQuestion: (id: string, updates: Partial<ResearchLinkQuestion>) => void;
	reassignQuestionToSection: (questionId: string, section: { id: string; title: string }) => void;
	removeQuestion: (id: string) => void;
	moveQuestion: (id: string, direction: -1 | 1) => void;
	aiInsight?: AiQuestionInsight;
	responseCount?: number;
	newSinceAnalysis?: number;
	coachingFlag?: { issue: string; summary: string; alternatives: string[] };
	onDetailedAnalysis?: (result: SavedAiAnalysis["result"]) => void;
}) {
	// Image upload state
	const [uploadingImageKey, setUploadingImageKey] = useState<string | null>(null);
	const [showCreateSectionInput, setShowCreateSectionInput] = useState(false);
	const [newSectionTitle, setNewSectionTitle] = useState("");
	const imageInputRef = useRef<HTMLInputElement>(null);
	const pendingUploadRef = useRef<{
		questionId: string;
		optionIndex: number;
	} | null>(null);
	const [draft, setDraft] = useState<ResearchLinkQuestion>(question);
	const draftRef = useRef<ResearchLinkQuestion>(question);
	const pendingQuestionUpdateRef = useRef<Partial<ResearchLinkQuestion> | null>(null);
	const pendingQuestionUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const draftSessionKeyRef = useRef<string | null>(null);

	const commitQuestionUpdates = useCallback(
		(updates: Partial<ResearchLinkQuestion>) => {
			updateQuestion(question.id, updates);
		},
		[question.id, updateQuestion]
	);

	const flushPendingQuestionUpdates = useCallback(() => {
		if (pendingQuestionUpdateTimerRef.current) {
			clearTimeout(pendingQuestionUpdateTimerRef.current);
			pendingQuestionUpdateTimerRef.current = null;
		}
		const pending = pendingQuestionUpdateRef.current;
		if (!pending) return;
		pendingQuestionUpdateRef.current = null;
		commitQuestionUpdates(pending);
	}, [commitQuestionUpdates]);

	const applyDraftUpdates = useCallback(
		(updates: Partial<ResearchLinkQuestion>, mode: "immediate" | "debounced" = "immediate") => {
			setDraft((prev) => {
				const next = { ...prev, ...updates };
				draftRef.current = next;
				return next;
			});

			if (mode === "debounced") {
				pendingQuestionUpdateRef.current = {
					...(pendingQuestionUpdateRef.current ?? {}),
					...updates,
				};
				if (pendingQuestionUpdateTimerRef.current) {
					clearTimeout(pendingQuestionUpdateTimerRef.current);
				}
				pendingQuestionUpdateTimerRef.current = setTimeout(() => {
					const pending = pendingQuestionUpdateRef.current;
					pendingQuestionUpdateRef.current = null;
					pendingQuestionUpdateTimerRef.current = null;
					if (pending) {
						commitQuestionUpdates(pending);
					}
				}, 300);
				return;
			}

			flushPendingQuestionUpdates();
			commitQuestionUpdates(updates);
		},
		[commitQuestionUpdates, flushPendingQuestionUpdates]
	);

	const sectionOptions = useMemo(() => deriveSurveySections(questions), [questions]);

	const assignSection = useCallback(
		(section: { id: string; title: string }) => {
			reassignQuestionToSection(question.id, section);
			setDraft((prev) => {
				const next = {
					...prev,
					sectionId: section.id === DEFAULT_SECTION_ID ? null : section.id,
					sectionTitle: section.title,
				};
				draftRef.current = next;
				return next;
			});
		},
		[question.id, reassignQuestionToSection]
	);

	useEffect(() => {
		const sessionKey = `${question.id}:${isOpen ? "open" : "closed"}`;
		if (draftSessionKeyRef.current === sessionKey) return;
		draftSessionKeyRef.current = sessionKey;
		setDraft(question);
		draftRef.current = question;
		setShowCreateSectionInput(false);
		setNewSectionTitle("");
		pendingQuestionUpdateRef.current = null;
		if (pendingQuestionUpdateTimerRef.current) {
			clearTimeout(pendingQuestionUpdateTimerRef.current);
			pendingQuestionUpdateTimerRef.current = null;
		}
	}, [question, isOpen]);

	useEffect(
		() => () => {
			if (pendingQuestionUpdateTimerRef.current) {
				clearTimeout(pendingQuestionUpdateTimerRef.current);
				pendingQuestionUpdateTimerRef.current = null;
			}
			pendingQuestionUpdateRef.current = null;
		},
		[]
	);

	const handleImageUpload = useCallback(
		async (file: File, questionId: string, optionIndex: number) => {
			if (!file.type.startsWith("image/")) return;
			const uploadKey = `${questionId}-${optionIndex}`;
			setUploadingImageKey(uploadKey);
			try {
				const formData = new FormData();
				formData.append("file", file);
				const response = await fetch("/api/upload-image?category=survey-images", { method: "POST", body: formData });
				const result = await response.json();
				if (!response.ok || !result.success) throw new Error(result.error || "Upload failed");
				const currentImageOptions = draftRef.current.imageOptions;
				if (currentImageOptions) {
					const nextOptions = [...currentImageOptions];
					nextOptions[optionIndex] = {
						...nextOptions[optionIndex],
						imageUrl: result.url,
					};
					applyDraftUpdates({ imageOptions: nextOptions });
				}
			} catch (err) {
				console.error("Image upload failed:", err);
			} finally {
				setUploadingImageKey(null);
			}
		},
		[applyDraftUpdates]
	);

	// Get the effective media URL (prefer mediaUrl, fall back to videoUrl)
	const effectiveMediaUrl = draft.mediaUrl ?? draft.videoUrl ?? null;

	return (
		<Sheet
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) {
					flushPendingQuestionUpdates();
					onClose();
				}
			}}
		>
			<SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
				<SheetHeader>
					<SheetTitle className="flex items-center gap-2">
						<span className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 font-semibold text-primary text-xs tabular-nums">
							{index + 1}
						</span>
						Question Settings
					</SheetTitle>
					<SheetDescription>Configure type, options, media, and branching logic.</SheetDescription>
				</SheetHeader>

				<div className="space-y-5 px-4 pb-6">
					{/* Response Insights section */}
					{(responseCount ?? 0) > 0 && (
						<DrawerInsightsSection
							aiInsight={aiInsight}
							responseCount={responseCount ?? 0}
							newSinceAnalysis={newSinceAnalysis ?? 0}
							listId={listId}
							onDetailedAnalysis={onDetailedAnalysis}
						/>
					)}

					{/* Coaching flag — shown when AI coaching flagged this question */}
					{coachingFlag && (
						<div
							className={cn(
								"rounded-lg border px-3 py-2.5",
								["leading", "double_barreled", "closed_ended"].includes(coachingFlag.issue)
									? "border-red-500/20 bg-red-500/5"
									: "border-amber-500/20 bg-amber-500/5"
							)}
						>
							<div className="flex items-start justify-between gap-2">
								<div className="space-y-1">
									<span
										className={cn(
											"font-medium text-xs",
											["leading", "double_barreled", "closed_ended"].includes(coachingFlag.issue)
												? "text-red-600 dark:text-red-400"
												: "text-amber-600 dark:text-amber-400"
										)}
									>
										{coachingFlag.issue.replace(/_/g, " ")}
									</span>
									<p className="text-[11px] text-foreground/70">{coachingFlag.summary}</p>
								</div>
							</div>
							{coachingFlag.alternatives.length > 0 && (
								<div className="mt-2 space-y-1">
									<span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
										Suggested alternatives
									</span>
									{coachingFlag.alternatives.map((alt: string, i: number) => (
										<button
											key={i}
											type="button"
											className="flex w-full items-center gap-2 rounded border border-border/40 bg-background px-2 py-1.5 text-left text-[11px] text-foreground/80 transition-colors hover:border-primary/30 hover:bg-primary/5"
											onClick={() => applyDraftUpdates({ prompt: alt })}
										>
											<Sparkles className="h-3 w-3 shrink-0 text-violet-500" />
											<span className="flex-1">{alt}</span>
											<span className="shrink-0 text-[9px] text-primary">Apply</span>
										</button>
									))}
								</div>
							)}
						</div>
					)}

					{/* Question text */}
					<div className="space-y-1.5">
						<Label className="text-xs">Question text</Label>
						<Textarea
							value={draft.prompt}
							placeholder="What would you like to ask?"
							onChange={(e) => {
								const next = e.target.value;
								applyDraftUpdates({ prompt: next }, "debounced");
							}}
							onBlur={() => flushPendingQuestionUpdates()}
							onInput={(e) => {
								const target = e.target as HTMLTextAreaElement;
								target.style.height = "auto";
								target.style.height = `${target.scrollHeight}px`;
							}}
							rows={2}
							className="resize-none text-sm"
						/>
					</div>

					{/* Journey block assignment */}
					<div className="space-y-1.5">
						<Label className="text-xs">Journey block</Label>
						<Select
							value={draft.sectionId?.trim() || DEFAULT_SECTION_ID}
							onValueChange={(value) => {
								if (value === "__create__") {
									setShowCreateSectionInput(true);
									return;
								}
								const target =
									sectionOptions.find((section) => section.id === value) ??
									sectionOptions.find((section) => section.id === DEFAULT_SECTION_ID) ??
									null;
								if (!target) return;
								assignSection({ id: target.id, title: target.title });
							}}
						>
							<SelectTrigger className="h-9 text-xs">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{sectionOptions.map((section) => (
									<SelectItem key={section.id} value={section.id}>
										{section.title}
									</SelectItem>
								))}
								<SelectItem value="__create__">Create new block…</SelectItem>
							</SelectContent>
						</Select>
						{showCreateSectionInput && (
							<div className="flex items-center gap-2">
								<Input
									value={newSectionTitle}
									onChange={(event) => setNewSectionTitle(event.target.value)}
									onKeyDown={(event) => {
										if (event.key === "Escape") {
											setShowCreateSectionInput(false);
											setNewSectionTitle("");
										}
										if (event.key !== "Enter") return;
										event.preventDefault();
										const nextTitle = normalizeSectionTitleInput(newSectionTitle);
										if (!nextTitle) return;
										const nextId = buildSectionIdFromTitle(nextTitle, new Set(sectionOptions.map((s) => s.id)));
										assignSection({ id: nextId, title: nextTitle });
										setShowCreateSectionInput(false);
										setNewSectionTitle("");
										toast.success(`Created block "${nextTitle}"`);
									}}
									placeholder="Block name (e.g., Shared close)"
									className="h-8 text-xs"
								/>
								<Button
									type="button"
									size="sm"
									className="h-8"
									onClick={() => {
										const nextTitle = normalizeSectionTitleInput(newSectionTitle);
										if (!nextTitle) return;
										const nextId = buildSectionIdFromTitle(nextTitle, new Set(sectionOptions.map((s) => s.id)));
										assignSection({ id: nextId, title: nextTitle });
										setShowCreateSectionInput(false);
										setNewSectionTitle("");
										toast.success(`Created block "${nextTitle}"`);
									}}
								>
									Create
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-8"
									onClick={() => {
										setShowCreateSectionInput(false);
										setNewSectionTitle("");
									}}
								>
									Cancel
								</Button>
							</div>
						)}
					</div>

					{/* Type + Required */}
					<div className="flex items-center gap-3">
						<div className="flex-1 space-y-1.5">
							<Label className="text-xs">Type</Label>
							<Select
								value={draft.type}
								onValueChange={(value: ResearchLinkQuestion["type"]) => {
									// Preserve existing field values when switching types so
									// options survive a round-trip (e.g. select one → likert → select one).
									// Only initialize defaults for fields the new type needs if empty.
									const updates: Partial<ResearchLinkQuestion> = {
										type: value,
									};
									if (value === "single_select" || value === "multi_select") {
										updates.options = draft.options ?? [];
									} else if (value === "likert") {
										updates.likertScale = draft.likertScale ?? 5;
										updates.likertLabels = draft.likertLabels ?? {
											low: "Strongly disagree",
											high: "Strongly agree",
										};
									} else if (value === "image_select") {
										updates.imageOptions = draft.imageOptions ?? [{ label: "", imageUrl: "" }];
									}
									applyDraftUpdates(updates);
								}}
							>
								<SelectTrigger className="h-9 text-xs">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="auto">Auto</SelectItem>
									<SelectItem value="short_text">Short text</SelectItem>
									<SelectItem value="long_text">Long text</SelectItem>
									<SelectItem value="single_select">Select one</SelectItem>
									<SelectItem value="multi_select">Select many</SelectItem>
									<SelectItem value="likert">Likert scale</SelectItem>
									<SelectItem value="image_select">Image select</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs">Required</Label>
							<div className="flex h-9 items-center">
								<Switch
									checked={draft.required}
									onCheckedChange={(checked) => applyDraftUpdates({ required: checked })}
								/>
							</div>
						</div>
					</div>

					{/* Select options */}
					{(draft.type === "single_select" || draft.type === "multi_select") && (
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<Label className="text-xs">Options</Label>
								<div className="flex cursor-pointer items-center gap-1.5 text-muted-foreground text-xs">
									<Switch
										checked={Boolean(draft.imageOptions?.length)}
										onCheckedChange={(checked) => {
											if (checked) {
												const existingOptions = draft.options ?? [];
												applyDraftUpdates({
													imageOptions:
														existingOptions.length > 0
															? existingOptions.map((label) => ({
																	label,
																	imageUrl: "",
																}))
															: [{ label: "", imageUrl: "" }],
													options: null,
												});
											} else {
												const existingImageOptions = draft.imageOptions ?? [];
												applyDraftUpdates({
													options:
														existingImageOptions.length > 0
															? existingImageOptions.map((o) => o.label).filter(Boolean)
															: null,
													imageOptions: null,
												});
											}
										}}
										className="scale-75"
									/>
									<Image className="h-3 w-3" />
									With images
								</div>
							</div>
							{draft.imageOptions?.length ? (
								<div className="space-y-2">
									{draft.imageOptions.map((option, optionIndex) => {
										const uploadKey = `${draft.id}-${optionIndex}`;
										const isUploading = uploadingImageKey === uploadKey;
										return (
											<div key={optionIndex} className="flex items-center gap-2">
												<button
													type="button"
													onClick={() => {
														pendingUploadRef.current = {
															questionId: draft.id,
															optionIndex,
														};
														imageInputRef.current?.click();
													}}
													disabled={isUploading}
													className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded border border-border/50 bg-muted/30 transition-colors hover:border-border hover:bg-muted/50"
													title="Click to upload image"
												>
													{isUploading ? (
														<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
													) : option.imageUrl ? (
														<img
															src={option.imageUrl}
															alt={option.label || "Option"}
															className="h-full w-full object-cover"
														/>
													) : (
														<Upload className="h-4 w-4 text-muted-foreground/50" />
													)}
												</button>
												<Input
													value={option.label}
													onChange={(e) => {
														const nextOptions = [...(draft.imageOptions ?? [])];
														nextOptions[optionIndex] = {
															...nextOptions[optionIndex],
															label: e.target.value,
														};
														applyDraftUpdates({ imageOptions: nextOptions }, "debounced");
													}}
													onBlur={() => flushPendingQuestionUpdates()}
													placeholder="Label"
													className="h-8 flex-1 text-xs"
												/>
												<Input
													value={option.imageUrl}
													onChange={(e) => {
														const nextOptions = [...(draft.imageOptions ?? [])];
														nextOptions[optionIndex] = {
															...nextOptions[optionIndex],
															imageUrl: e.target.value,
														};
														applyDraftUpdates({ imageOptions: nextOptions }, "debounced");
													}}
													onBlur={() => flushPendingQuestionUpdates()}
													placeholder="Image URL or click thumbnail"
													className="h-8 flex-[2] text-xs"
												/>
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="h-7 w-7 shrink-0 opacity-60 hover:text-destructive hover:opacity-100"
													onClick={() => {
														const nextOptions = (draft.imageOptions ?? []).filter((_, i) => i !== optionIndex);
														applyDraftUpdates({
															imageOptions: nextOptions.length > 0 ? nextOptions : [{ label: "", imageUrl: "" }],
														});
													}}
												>
													<X className="h-3.5 w-3.5" />
												</Button>
											</div>
										);
									})}
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="h-7 text-muted-foreground text-xs hover:text-foreground"
										onClick={() => {
											const nextOptions = [...(draft.imageOptions ?? []), { label: "", imageUrl: "" }];
											applyDraftUpdates({
												imageOptions: nextOptions,
											});
										}}
									>
										<Plus className="mr-1 h-3 w-3" /> Add option
									</Button>
								</div>
							) : (
								<OptionsInput options={draft.options ?? null} onChange={(options) => applyDraftUpdates({ options })} />
							)}

							{/* Allow "Other" write-in toggle */}
							<div className="flex cursor-pointer items-center gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2">
								<Switch
									checked={Boolean(draft.allowOther)}
									onCheckedChange={(checked) => applyDraftUpdates({ allowOther: checked })}
									className="scale-75"
								/>
								<div>
									<span className="font-medium text-sm">Allow &quot;Other&quot;</span>
									<span className="block text-muted-foreground text-xs">
										Show a write-in text field for custom responses
									</span>
								</div>
							</div>
						</div>
					)}

					{/* Likert scale config */}
					{draft.type === "likert" && (
						<div className="space-y-3">
							<div className="flex items-center gap-2">
								<Label className="text-xs">Scale</Label>
								<Select
									value={String(draft.likertScale ?? 5)}
									onValueChange={(value) => applyDraftUpdates({ likertScale: Number(value) })}
								>
									<SelectTrigger className="h-8 w-20 text-xs">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="3">1-3</SelectItem>
										<SelectItem value="5">1-5</SelectItem>
										<SelectItem value="7">1-7</SelectItem>
										<SelectItem value="10">1-10</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="flex gap-2">
								<Input
									value={draft.likertLabels?.low ?? ""}
									onChange={(e) =>
										applyDraftUpdates(
											{
												likertLabels: {
													...draft.likertLabels,
													low: e.target.value || undefined,
												},
											},
											"debounced"
										)
									}
									onBlur={() => flushPendingQuestionUpdates()}
									placeholder="Low label (e.g., Strongly disagree)"
									className="h-8 text-xs"
								/>
								<Input
									value={draft.likertLabels?.high ?? ""}
									onChange={(e) =>
										applyDraftUpdates(
											{
												likertLabels: {
													...draft.likertLabels,
													high: e.target.value || undefined,
												},
											},
											"debounced"
										)
									}
									onBlur={() => flushPendingQuestionUpdates()}
									placeholder="High label (e.g., Strongly agree)"
									className="h-8 text-xs"
								/>
							</div>
						</div>
					)}

					{/* Image select config */}
					{draft.type === "image_select" && (
						<div className="space-y-2">
							<Label className="text-xs">Image options</Label>
							{(draft.imageOptions ?? []).map((option, optionIndex) => {
								const uploadKey = `${draft.id}-${optionIndex}`;
								const isUploading = uploadingImageKey === uploadKey;
								return (
									<div key={optionIndex} className="flex items-center gap-2">
										<button
											type="button"
											onClick={() => {
												pendingUploadRef.current = {
													questionId: draft.id,
													optionIndex,
												};
												imageInputRef.current?.click();
											}}
											disabled={isUploading}
											className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded border border-border/50 bg-muted/30 transition-colors hover:border-border hover:bg-muted/50"
											title="Click to upload image"
										>
											{isUploading ? (
												<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
											) : option.imageUrl ? (
												<img
													src={option.imageUrl}
													alt={option.label || "Option"}
													className="h-full w-full object-cover"
												/>
											) : (
												<Upload className="h-4 w-4 text-muted-foreground/50" />
											)}
										</button>
										<Input
											value={option.label}
											onChange={(e) => {
												const nextOptions = [...(draft.imageOptions ?? [])];
												nextOptions[optionIndex] = {
													...nextOptions[optionIndex],
													label: e.target.value,
												};
												applyDraftUpdates({ imageOptions: nextOptions }, "debounced");
											}}
											onBlur={() => flushPendingQuestionUpdates()}
											placeholder="Label"
											className="h-8 flex-1 text-xs"
										/>
										<Input
											value={option.imageUrl}
											onChange={(e) => {
												const nextOptions = [...(draft.imageOptions ?? [])];
												nextOptions[optionIndex] = {
													...nextOptions[optionIndex],
													imageUrl: e.target.value,
												};
												applyDraftUpdates({ imageOptions: nextOptions }, "debounced");
											}}
											onBlur={() => flushPendingQuestionUpdates()}
											placeholder="Image URL or click thumbnail"
											className="h-8 flex-[2] text-xs"
										/>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											className="h-7 w-7 shrink-0 opacity-60 hover:text-destructive hover:opacity-100"
											onClick={() => {
												const nextOptions = (draft.imageOptions ?? []).filter((_, i) => i !== optionIndex);
												applyDraftUpdates({
													imageOptions: nextOptions.length > 0 ? nextOptions : null,
												});
											}}
										>
											<X className="h-3.5 w-3.5" />
										</Button>
									</div>
								);
							})}
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-7 text-muted-foreground text-xs hover:text-foreground"
								onClick={() => {
									const nextOptions = [...(draft.imageOptions ?? []), { label: "", imageUrl: "" }];
									applyDraftUpdates({ imageOptions: nextOptions });
								}}
							>
								<Plus className="mr-1 h-3 w-3" /> Add image option
							</Button>
						</div>
					)}

					{/* Helper text */}
					<div className="space-y-1.5">
						<Label className="text-xs">Helper text</Label>
						<Input
							value={draft.helperText ?? ""}
							onChange={(e) => {
								const next = e.target.value;
								applyDraftUpdates({ helperText: next || null }, "debounced");
							}}
							onBlur={() => {
								const trimmed = (draft.helperText ?? "").trim();
								applyDraftUpdates({ helperText: trimmed || null });
							}}
							placeholder="Optional hint shown below the question"
							className="h-8 text-xs"
						/>
					</div>

					{/* Media attachment (generalized from video-only) */}
					<div className="space-y-1.5">
						<Label className="text-xs">Media attachment</Label>
						{listId ? (
							<QuestionMediaEditor
								listId={listId}
								questionId={draft.id}
								existingMediaUrl={effectiveMediaUrl}
								onMediaChange={(url) =>
									applyDraftUpdates({
										mediaUrl: url,
										videoUrl: url,
									})
								}
							/>
						) : (
							<div className="flex items-center gap-2">
								<Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
								<Input
									value={effectiveMediaUrl ?? ""}
									onChange={(e) => {
										const next = e.target.value;
										applyDraftUpdates(
											{
												mediaUrl: next || null,
												videoUrl: next || null,
											},
											"debounced"
										);
									}}
									onBlur={() => {
										const trimmed = (effectiveMediaUrl ?? "").trim();
										applyDraftUpdates({
											mediaUrl: trimmed || null,
											videoUrl: trimmed || null,
										});
									}}
									placeholder="Media URL (image, video, or audio)"
									className="h-8 text-xs"
								/>
							</div>
						)}
					</div>

					{/* Branching */}
					<div className="space-y-1.5">
						<QuestionBranchingEditor
							question={draft}
							allQuestions={questions}
							questionIndex={index}
							onChange={(branching) => applyDraftUpdates({ branching })}
						/>
					</div>

					{/* Actions bar */}
					<div className="flex items-center justify-between border-t pt-4">
						<div className="flex items-center gap-1">
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={index === 0}
								onClick={() => moveQuestion(draft.id, -1)}
							>
								<ArrowUp className="mr-1 h-3.5 w-3.5" />
								Move up
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={index === questions.length - 1}
								onClick={() => moveQuestion(draft.id, 1)}
							>
								<ArrowDown className="mr-1 h-3.5 w-3.5" />
								Move down
							</Button>
						</div>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="text-destructive hover:bg-destructive/10 hover:text-destructive"
							onClick={() => {
								pendingQuestionUpdateRef.current = null;
								if (pendingQuestionUpdateTimerRef.current) {
									clearTimeout(pendingQuestionUpdateTimerRef.current);
									pendingQuestionUpdateTimerRef.current = null;
								}
								removeQuestion(draft.id);
								onClose();
							}}
						>
							<Trash2 className="mr-1 h-3.5 w-3.5" />
							Delete
						</Button>
					</div>
				</div>

				{/* Hidden file input for image uploads */}
				<input
					ref={imageInputRef}
					type="file"
					accept="image/*"
					className="hidden"
					onChange={(e) => {
						const file = e.target.files?.[0];
						const pending = pendingUploadRef.current;
						if (file && pending) {
							handleImageUpload(file, pending.questionId, pending.optionIndex);
						}
						e.target.value = "";
						pendingUploadRef.current = null;
					}}
				/>
			</SheetContent>
		</Sheet>
	);
}

/** Per-question AI insight from BAML analysis */
interface AiQuestionInsight {
	question: string;
	summary: string;
	answer_distribution?: Array<{
		answer: string;
		count: number;
		percentage: number;
	}>;
	key_findings: string[];
	common_answers?: string[];
	notable_outliers: string[];
	questionId?: string | null;
}

/** Parsed shape of the saved ai_analysis JSONB */
interface SavedAiAnalysis {
	mode?: string;
	updatedAt?: string;
	result?: {
		executive_summary?: string;
		question_insights?: AiQuestionInsight[];
		top_themes?: Array<{ theme: string; description: string }>;
	};
	responseCountAtAnalysis?: number;
	questionDropoff?: Record<string, { answered: number; total: number; completionPct: number }>;
}

interface QuestionListEditorProps {
	questions: ResearchLinkQuestion[];
	onChange: (next: ResearchLinkQuestion[] | ((previous: ResearchLinkQuestion[]) => ResearchLinkQuestion[])) => void;
	/** Required for media recording/upload functionality */
	listId?: string;
	/** Survey context to improve coaching quality */
	coachingContext?: string;
	/** Saved AI analysis data from loader */
	aiAnalysis?: SavedAiAnalysis | null;
	/** Current total response count */
	responseCount?: number;
}

export function QuestionListEditor({
	questions,
	onChange,
	listId,
	coachingContext,
	aiAnalysis,
	responseCount,
}: QuestionListEditorProps) {
	const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
	const [expandedBranchingQuestionId, setExpandedBranchingQuestionId] = useState<string | null>(null);
	const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
	const [editingSectionTitle, setEditingSectionTitle] = useState("");
	const [highlightedTargetQuestionId, setHighlightedTargetQuestionId] = useState<string | null>(null);
	const [collapsedSectionIds, setCollapsedSectionIds] = useState<Set<string>>(new Set());
	const [hoveredQuestionId, setHoveredQuestionId] = useState<string | null>(null);
	const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [localDetailedResult, setLocalDetailedResult] = useState<SavedAiAnalysis["result"] | null>(null);

	// AI analysis helpers
	const parsedAnalysis = aiAnalysis as SavedAiAnalysis | null | undefined;
	const effectiveResult = localDetailedResult ?? parsedAnalysis?.result;
	const questionInsights = effectiveResult?.question_insights;
	const questionDropoff = parsedAnalysis?.questionDropoff;
	const analysisResponseCount = parsedAnalysis?.responseCountAtAnalysis ?? 0;
	const newSinceAnalysis = (responseCount ?? 0) - analysisResponseCount;

	useEffect(() => {
		setLocalDetailedResult(null);
	}, [parsedAnalysis?.updatedAt]);

	/** Match a question to its AI insight by id/text/index with defensive fallback */
	const getQuestionInsight = (question: ResearchLinkQuestion, questionIndex: number) => {
		if (!questionInsights || questionInsights.length === 0) return undefined;
		const normalizedPrompt = normalizeInsightText(question.prompt);
		const byId = questionInsights.find((qi) => qi.questionId === question.id);
		const byExactText = normalizedPrompt
			? questionInsights.find((qi) => normalizeInsightText(qi.question) === normalizedPrompt)
			: undefined;
		const byContainsText = normalizedPrompt
			? questionInsights.find((qi) => {
					const normalizedInsight = normalizeInsightText(qi.question);
					return normalizedInsight.includes(normalizedPrompt) || normalizedPrompt.includes(normalizedInsight);
				})
			: undefined;
		const byIndex = questionInsights[questionIndex];
		return sanitizeInsight(byId ?? byExactText ?? byContainsText ?? byIndex, responseCount ?? 0);
	};

	// Coaching state
	const [isCoaching, setIsCoaching] = useState(false);
	const [coachingFlags, setCoachingFlags] = useState<
		Map<number, { issue: string; summary: string; alternatives: string[] }>
	>(new Map());
	const [coachingNote, setCoachingNote] = useState<string | null>(null);

	/** Delayed hover — prevents flicker during drag and fast mouse sweeps */
	const handleMouseEnter = useCallback((questionId: string) => {
		if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
		hoverTimerRef.current = setTimeout(() => {
			setHoveredQuestionId(questionId);
		}, 300);
	}, []);

	const handleMouseLeave = useCallback(() => {
		if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
		hoverTimerRef.current = null;
		setHoveredQuestionId(null);
		setHighlightedTargetQuestionId(null);
	}, []);

	const dispatchQuestionAction = useCallback(
		(action: QuestionEditorAction) => {
			onChange((previousQuestions) => applyQuestionEditorAction(previousQuestions, action));
		},
		[onChange]
	);

	const updateQuestion = useCallback(
		(id: string, updates: Partial<ResearchLinkQuestion>) => {
			dispatchQuestionAction({ type: "update", id, updates });
		},
		[dispatchQuestionAction]
	);

	const removeQuestion = useCallback(
		(id: string) => {
			dispatchQuestionAction({ type: "remove", id });
		},
		[dispatchQuestionAction]
	);

	const moveQuestion = useCallback(
		(id: string, direction: -1 | 1) => {
			dispatchQuestionAction({ type: "move", id, direction });
		},
		[dispatchQuestionAction]
	);

	const reassignQuestionToSection = useCallback(
		(questionId: string, section: { id: string; title: string }) => {
			const sectionId = section.id?.trim() || DEFAULT_SECTION_ID;
			const sectionTitle = normalizeSectionTitleInput(section.title) || "Shared block";
			onChange((previousQuestions) => {
				const currentIndex = previousQuestions.findIndex((q) => q.id === questionId);
				if (currentIndex < 0) return previousQuestions;

				const nextQuestions = [...previousQuestions];
				const [movingQuestion] = nextQuestions.splice(currentIndex, 1);
				if (!movingQuestion) return previousQuestions;

				const updatedQuestion: ResearchLinkQuestion = {
					...movingQuestion,
					sectionId: sectionId === DEFAULT_SECTION_ID ? null : sectionId,
					sectionTitle,
				};

				let insertAt = nextQuestions.length;
				for (let idx = 0; idx < nextQuestions.length; idx += 1) {
					const candidateSectionId = nextQuestions[idx]?.sectionId?.trim() || DEFAULT_SECTION_ID;
					if (candidateSectionId === sectionId) {
						insertAt = idx + 1;
					}
				}

				nextQuestions.splice(insertAt, 0, updatedQuestion);
				return nextQuestions;
			});
		},
		[onChange]
	);

	const updateBranchTargetForRuleGroup = useCallback(
		(
			sourceQuestionId: string,
			groupRuleIds: string[],
			target: { action: "skip_to" | "end_survey"; targetQuestionId?: string; targetSectionId?: string }
		) => {
			if (groupRuleIds.length === 0) return;
			const groupRuleIdSet = new Set(groupRuleIds);
			onChange((previousQuestions) =>
				previousQuestions.map((candidate) => {
					if (candidate.id !== sourceQuestionId || !candidate.branching) return candidate;
					const nextRules = candidate.branching.rules.map((rule) => {
						if (!groupRuleIdSet.has(rule.id)) return rule;
						if (target.action === "end_survey") {
							return {
								...rule,
								action: "end_survey" as const,
								targetQuestionId: undefined,
								targetSectionId: undefined,
							};
						}
						return {
							...rule,
							action: "skip_to" as const,
							targetQuestionId: target.targetQuestionId,
							targetSectionId: target.targetSectionId,
						};
					});
					return {
						...candidate,
						branching: {
							...candidate.branching,
							rules: nextRules,
						},
					};
				})
			);
			toast.success("Updated branch destination");
		},
		[onChange]
	);

	const renameSection = useCallback(
		(sectionId: string, nextTitleRaw: string) => {
			const nextTitle = nextTitleRaw.trim();
			if (!nextTitle) return;
			onChange((previousQuestions) =>
				previousQuestions.map((candidate) => {
					const candidateSectionId = candidate.sectionId?.trim() || DEFAULT_SECTION_ID;
					if (candidateSectionId !== sectionId) return candidate;
					return {
						...candidate,
						sectionId,
						sectionTitle: nextTitle,
					};
				})
			);
			setEditingSectionId(null);
			setEditingSectionTitle("");
			toast.success(`Renamed section to "${nextTitle}"`);
		},
		[onChange]
	);

	const addQuestion = useCallback(() => {
		const newQ = createEmptyQuestion();
		dispatchQuestionAction({ type: "add", question: newQ });
		// Auto-open the new question for editing
		setSelectedQuestionId(newQ.id);
	}, [dispatchQuestionAction]);

	const selectedIndex = questions.findIndex((q) => q.id === selectedQuestionId);
	const selectedQuestion = selectedIndex >= 0 ? questions[selectedIndex] : null;

	const questionTypes = useMemo(() => questions.map((q) => q.type), [questions]);
	const flowSummary = useMemo(() => summarizeSurveyFlow(questions), [questions]);
	const flowEstimateLabel = useMemo(() => {
		if (!flowSummary.hasBranching || flowSummary.paths.length < 2) return undefined;
		return formatFlowAverageLabel(flowSummary);
	}, [flowSummary]);
	const flowEstimateIsLong = flowSummary.hasBranching && flowSummary.maxSeconds > SURVEY_LENGTH_WARN_SECONDS;
	const flowEstimateDebug = useMemo(() => {
		if (!flowSummary.hasBranching || flowSummary.paths.length < 2) return null;
		return formatPathBreakdown(flowSummary);
	}, [flowSummary]);

	const branchingDebugSnapshot = useMemo(
		() =>
			questions
				.map((question, index) => {
					const rules = question.branching?.rules ?? [];
					if (rules.length === 0) return null;
					const targets = new Set<string>();
					for (const rule of rules) {
						if (rule.action === "end_survey") {
							targets.add("end");
							continue;
						}
						const targetIdx = rule.targetQuestionId
							? questions.findIndex((q) => q.id === rule.targetQuestionId) + 1
							: 0;
						targets.add(targetIdx > 0 ? `Q${targetIdx}` : "?");
					}
					return {
						index: index + 1,
						id: question.id,
						ruleCount: rules.length,
						targets: [...targets],
					};
				})
				.filter(Boolean),
		[questions]
	);

	useEffect(() => {
		if (!import.meta.env.DEV) return;
		console.debug("[QuestionListEditor] branching snapshot", branchingDebugSnapshot);
	}, [branchingDebugSnapshot]);

	useEffect(() => {
		if (!import.meta.env.DEV || !flowEstimateDebug) return;
		console.debug("[QuestionListEditor] path-aware estimate", {
			label: flowEstimateLabel,
			paths: flowEstimateDebug,
		});
	}, [flowEstimateDebug, flowEstimateLabel]);

	const handleCoach = useCallback(async () => {
		const questionTexts = questions.filter((q) => !q.hidden && q.prompt.trim()).map((q) => q.prompt);
		if (questionTexts.length === 0) {
			toast.error("Add some questions first");
			return;
		}
		setIsCoaching(true);
		setCoachingFlags(new Map());
		setCoachingNote(null);
		try {
			const res = await fetch("/api/coach-questions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					questions: questionTexts,
					context: coachingContext ?? "General research",
					mode: "survey",
				}),
			});
			if (!res.ok) throw new Error("Coaching failed");
			const result = await res.json();
			const flags = new Map<number, { issue: string; summary: string; alternatives: string[] }>();
			for (const nudge of result.nudges ?? []) {
				flags.set(nudge.questionIndex, {
					issue: nudge.issue,
					summary: nudge.summary,
					alternatives: nudge.alternatives ?? [],
				});
			}
			setCoachingFlags(flags);
			setCoachingNote(result.overallNote ?? result.totalTimeWarning ?? null);
			if (flags.size === 0) {
				toast.success("All questions look good!");
			} else {
				toast(`${flags.size} question${flags.size > 1 ? "s" : ""} flagged`);
			}
		} catch {
			toast.error("Coaching failed — try again");
		} finally {
			setIsCoaching(false);
		}
	}, [questions, coachingContext]);

	const handleCopy = useCallback(() => {
		const text = formatQuestionsForClipboard(questions);
		navigator.clipboard.writeText(text).then(
			() => toast.success("Questions copied to clipboard"),
			() => toast.error("Failed to copy")
		);
	}, [questions]);

	const sectionSummaries = useMemo(() => {
		const sections = deriveSurveySections(questions);
		return sections.map((section) => {
			const sectionQuestions = questions.filter(
				(question) => (question.sectionId?.trim() || DEFAULT_SECTION_ID) === section.id && !question.hidden
			);
			const totalSeconds = sectionQuestions.reduce((acc, question) => acc + estimateQuestionSeconds(question), 0);
			return {
				...section,
				questionCount: sectionQuestions.length,
				estimatedMinutes: formatEstimatedMinutes(totalSeconds),
			};
		});
	}, [questions]);

	const sectionGraph = useMemo(() => buildSurveySectionGraph(questions), [questions]);

	const journeyBlockSummaries = useMemo(() => {
		const inboundPairs = new Map<string, Set<string>>();
		const outboundPairs = new Map<string, Set<string>>();
		for (const edge of sectionGraph.edges) {
			if (!edge.targetSectionId || edge.targetSectionId === edge.fromSectionId) continue;
			const outbound = outboundPairs.get(edge.fromSectionId) ?? new Set<string>();
			outbound.add(edge.targetSectionId);
			outboundPairs.set(edge.fromSectionId, outbound);

			const inbound = inboundPairs.get(edge.targetSectionId) ?? new Set<string>();
			inbound.add(edge.fromSectionId);
			inboundPairs.set(edge.targetSectionId, inbound);
		}

		return sectionSummaries.map((section) => {
			const inboundCount = inboundPairs.get(section.id)?.size ?? 0;
			const outboundCount = outboundPairs.get(section.id)?.size ?? 0;
			let roleLabel = "Path";
			if (section.id === sectionGraph.entrySectionId) {
				roleLabel = "Entry";
			} else if (outboundCount > 1) {
				roleLabel = "Branch";
			} else if (inboundCount > 1) {
				roleLabel = "Shared";
			}
			return {
				...section,
				roleLabel,
			};
		});
	}, [sectionGraph, sectionSummaries]);

	const sectionSummaryById = useMemo(
		() => new Map(sectionSummaries.map((section) => [section.id, section] as const)),
		[sectionSummaries]
	);

	useEffect(() => {
		setCollapsedSectionIds((current) => {
			const next = new Set<string>();
			for (const section of sectionSummaries) {
				if (current.has(section.id)) next.add(section.id);
			}
			return next;
		});
	}, [sectionSummaries]);

	const toggleSectionCollapse = useCallback((sectionId: string) => {
		setCollapsedSectionIds((current) => {
			const next = new Set(current);
			if (next.has(sectionId)) {
				next.delete(sectionId);
			} else {
				next.add(sectionId);
			}
			return next;
		});
	}, []);

	return (
		<UnifiedQuestionList
			count={questions.length}
			questionTypes={questionTypes}
			timeLabelOverride={flowEstimateLabel}
			timeIsLongOverride={flowEstimateLabel ? flowEstimateIsLong : undefined}
			showTimeBar
			onAdd={addQuestion}
			onCopy={handleCopy}
			onCoach={handleCoach}
			isCoaching={isCoaching}
			hasBeenCoached={coachingFlags.size > 0 || coachingNote !== null}
			footer={
				coachingNote ? (
					<div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-amber-700 text-xs dark:text-amber-400">
						{coachingNote}
					</div>
				) : undefined
			}
		>
			{journeyBlockSummaries.length > 1 && (
				<div className="mb-2 rounded-md border border-violet-500/20 bg-violet-500/[0.03]">
					<div className="border-violet-500/15 border-b px-2 py-1 font-medium text-[10px] text-violet-600 uppercase tracking-wide dark:text-violet-300">
						Journey blocks
					</div>
					<div className="flex flex-wrap gap-1.5 p-2">
						{journeyBlockSummaries.map((block) => (
							<button
								key={`journey-${block.id}`}
								type="button"
								className="flex items-center gap-1 rounded-full border border-violet-500/30 bg-background/70 px-2 py-1 text-[10px] text-foreground transition-colors hover:border-violet-500/60 hover:bg-violet-500/[0.06]"
								onClick={() => {
									setCollapsedSectionIds((current) => {
										const next = new Set(current);
										next.delete(block.id);
										return next;
									});
									setSelectedQuestionId(block.startQuestionId);
								}}
								title={`Open ${block.title}`}
							>
								<span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 font-medium text-violet-700 dark:text-violet-200">
									{block.roleLabel}
								</span>
								<span className="max-w-[170px] truncate">{block.title}</span>
								<span className="text-muted-foreground">
									{block.questionCount}q • {block.estimatedMinutes}
								</span>
							</button>
						))}
					</div>
				</div>
			)}

			{/* Question rows */}
			<AnimatePresence initial={false}>
				{questions.map((question, index) => {
					const sections = sectionSummaries;
					const sectionId = question.sectionId?.trim() || DEFAULT_SECTION_ID;
					const sectionSummary = sectionSummaryById.get(sectionId) ?? null;
					const isSectionStart = sectionSummary?.startQuestionId === question.id;
					const isSectionCollapsed = collapsedSectionIds.has(sectionId);
					if (isSectionCollapsed && !isSectionStart) {
						return null;
					}
					const hasBranching = Boolean(question.branching?.rules?.length);
					const hasMedia = Boolean(question.mediaUrl ?? question.videoUrl);
					const effectiveMediaUrl = question.mediaUrl ?? question.videoUrl ?? null;
					const branchRules = question.branching?.rules ?? [];
					const branchRuleRows = branchRules.map((rule) => {
						const targetMeta = getBranchTargetMeta(rule, questions, sections);
						return {
							rule,
							targetLabel: targetMeta.targetLabel,
							targetQuestionId: targetMeta.targetQuestionId,
							targetPrompt: targetMeta.targetPrompt,
						};
					});
					const groupedTargets = groupRulesByTarget(branchRuleRows);
					const branchTargets = groupedTargets.map((group) => group.targetLabel);
					const isBranchingExpanded = expandedBranchingQuestionId === question.id;
					const branchSummaryLabel =
						groupedTargets.length === 1
							? `Branch: to ${branchTargets[0]}`
							: `Branch: to ${branchTargets.slice(0, 3).join(", ")}${branchTargets.length > 3 ? ` +${branchTargets.length - 3} more` : ""}`;
					const coaching = coachingFlags.get(index + 1);
					const flagColor = coaching
						? ["leading", "double_barreled", "closed_ended"].includes(coaching.issue)
							? ("red" as const)
							: ("amber" as const)
						: undefined;

					return (
						<Fragment key={question.id}>
							{isSectionStart && sectionSummary && (
								<div className="mt-2 mb-1 ml-1 flex items-center justify-between rounded-md border border-border/50 bg-muted/25 px-2 py-1">
									<div className="flex min-w-0 items-center gap-1.5">
										<button
											type="button"
											className="flex items-center gap-1.5 text-left text-xs"
											onClick={() => toggleSectionCollapse(sectionSummary.id)}
										>
											<ChevronDownIcon
												className={cn("h-3 w-3 transition-transform", isSectionCollapsed ? "-rotate-90" : "")}
											/>
										</button>
										{editingSectionId === sectionSummary.id ? (
											<div className="flex items-center gap-1">
												<Input
													autoFocus
													value={editingSectionTitle}
													onChange={(event) => setEditingSectionTitle(event.target.value)}
													onKeyDown={(event) => {
														if (event.key === "Enter") {
															event.preventDefault();
															renameSection(sectionSummary.id, editingSectionTitle);
														}
														if (event.key === "Escape") {
															event.preventDefault();
															setEditingSectionId(null);
															setEditingSectionTitle("");
														}
													}}
													className="h-6 min-w-[180px] text-xs"
												/>
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="h-5 w-5"
													onClick={() => renameSection(sectionSummary.id, editingSectionTitle)}
												>
													<Check className="h-3 w-3" />
												</Button>
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="h-5 w-5"
													onClick={() => {
														setEditingSectionId(null);
														setEditingSectionTitle("");
													}}
												>
													<X className="h-3 w-3" />
												</Button>
											</div>
										) : (
											<>
												<span className="truncate font-medium text-xs">{sectionSummary.title}</span>
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="h-5 w-5 text-muted-foreground hover:text-foreground"
													title="Rename section"
													onClick={() => {
														setEditingSectionId(sectionSummary.id);
														setEditingSectionTitle(sectionSummary.title);
													}}
												>
													<Pencil className="h-3 w-3" />
												</Button>
											</>
										)}
									</div>
									<span className="text-[10px] text-muted-foreground">
										{sectionSummary.questionCount} questions • {sectionSummary.estimatedMinutes}
									</span>
								</div>
							)}
							{isSectionCollapsed ? null : (
								<motion.div
									layout
									initial={{ opacity: 0, y: 4 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: -4 }}
									transition={{ duration: 0.15 }}
									onMouseEnter={() => handleMouseEnter(question.id)}
									onMouseLeave={handleMouseLeave}
								>
									<UnifiedQuestionRow
										index={index + 1}
										text={question.prompt}
										isSelected={selectedQuestionId === question.id}
										onClick={() => setSelectedQuestionId(question.id)}
										className={cn(
											highlightedTargetQuestionId === question.id &&
												"border-violet-500/60 bg-violet-500/[0.06] ring-1 ring-violet-500/30"
										)}
										flag={flagColor}
										dropoff={
											questionDropoff?.[question.id]
												? {
														completionPct: questionDropoff[question.id].completionPct,
													}
												: undefined
										}
									>
										{question.required && <span className="text-destructive text-xs">*</span>}
										<QuestionTypeBadge type={question.type} />
										{hasBranching && <GitBranch className="h-3.5 w-3.5 text-violet-500" />}
										{hasMedia && effectiveMediaUrl && <QuestionMediaThumbnail url={effectiveMediaUrl} />}
									</UnifiedQuestionRow>

									{coaching && (
										<div className="ml-12 flex items-start gap-2 py-1 text-[11px]">
											<span className={flagColor === "red" ? "text-red-500" : "text-amber-500"}>
												{coaching.summary}
											</span>
											{coaching.alternatives.length > 0 && (
												<button
													type="button"
													className="text-primary hover:underline"
													onClick={() =>
														updateQuestion(question.id, {
															prompt: coaching.alternatives[0],
														})
													}
												>
													Apply fix
												</button>
											)}
										</div>
									)}

									{hasBranching && (
										<div className="ml-12 py-1">
											<button
												type="button"
												className="group/branch flex items-center gap-2 rounded-md px-1 py-0.5 text-[11px] text-foreground transition-colors hover:bg-violet-500/10"
												onClick={() =>
													setExpandedBranchingQuestionId((current) => (current === question.id ? null : question.id))
												}
												title="View and edit branching"
											>
												<span className="rounded-full border border-violet-500/40 bg-violet-500/15 px-1.5 py-0.5 font-medium text-violet-700 dark:text-violet-200">
													{branchSummaryLabel}
												</span>
												<span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-1 py-0.5 font-medium text-[9px] text-violet-700 uppercase tracking-wide dark:text-violet-200">
													Edit branch
												</span>
												<ChevronDownIcon
													className={cn(
														"h-3 w-3 transition-transform",
														isBranchingExpanded ? "rotate-180" : "",
														"group-hover/branch:scale-110"
													)}
												/>
											</button>

											{isBranchingExpanded && (
												<div className="mt-1 space-y-2 rounded-md border border-violet-500/20 bg-violet-500/[0.03] p-2">
													<div className="flex items-center justify-between">
														<div className="text-[11px] text-foreground/70">Quick branch editor</div>
														<Button
															type="button"
															variant="link"
															size="sm"
															className="h-6 px-0 text-[11px] text-violet-600 dark:text-violet-300"
															onClick={() => setSelectedQuestionId(question.id)}
														>
															Open full branch editor
														</Button>
													</div>
													{groupedTargets.map((group, rowIndex) => (
														<div
															key={`${group.targetLabel}-${rowIndex}`}
															className="group/rule space-y-1 rounded-md border border-violet-500/20 bg-background/40 px-2 py-1.5 text-[11px]"
															onMouseEnter={() => setHighlightedTargetQuestionId(group.targetQuestionId)}
															onMouseLeave={() => setHighlightedTargetQuestionId(null)}
														>
															<div className="flex items-start gap-1">
																<span className="min-w-[76px] font-medium text-muted-foreground">Branch:</span>
																<span className="truncate text-foreground">to {group.targetLabel}</span>
															</div>
															<div className="flex items-start gap-1">
																<span className="min-w-[76px] font-medium text-muted-foreground">Condition:</span>
																<span className="truncate text-foreground/90">
																	{group.conditionSummary === "otherwise"
																		? "otherwise"
																		: `if ${group.conditionSummary}`}
																	{group.ruleCount > 1 ? ` (${group.ruleCount} rules)` : ""}
																</span>
															</div>
															<div className="flex flex-wrap items-center gap-2">
																<span className="min-w-[76px] font-medium text-muted-foreground">Destination:</span>
																<Select
																	value={
																		group.rules[0]?.action === "end_survey"
																			? "__end__"
																			: group.rules[0]?.targetSectionId
																				? `section:${group.rules[0].targetSectionId}`
																				: (group.rules[0]?.targetQuestionId ?? "__end__")
																	}
																	onValueChange={(value) => {
																		if (value === "__end__") {
																			updateBranchTargetForRuleGroup(question.id, group.ruleIds, {
																				action: "end_survey",
																			});
																			return;
																		}
																		if (value.startsWith("section:")) {
																			updateBranchTargetForRuleGroup(question.id, group.ruleIds, {
																				action: "skip_to",
																				targetSectionId: value.slice("section:".length),
																			});
																			return;
																		}
																		updateBranchTargetForRuleGroup(question.id, group.ruleIds, {
																			action: "skip_to",
																			targetQuestionId: value,
																		});
																	}}
																>
																	<SelectTrigger className="h-6 min-w-[210px] border-violet-500/30 bg-background text-[11px]">
																		<SelectValue />
																	</SelectTrigger>
																	<SelectContent>
																		<SelectItem value="__end__">End survey</SelectItem>
																		{sections
																			.filter((section) => {
																				const startIndex = questions.findIndex((q) => q.id === section.startQuestionId);
																				return startIndex > index;
																			})
																			.map((section) => {
																				const startIndex = questions.findIndex((q) => q.id === section.startQuestionId);
																				return (
																					<SelectItem
																						key={`inline-section-${section.id}`}
																						value={`section:${section.id}`}
																					>
																						Section: {section.title} (Q{startIndex + 1})
																					</SelectItem>
																				);
																			})}
																		{questions.slice(index + 1).map((candidate, candidateOffset) => (
																			<SelectItem key={`inline-question-${candidate.id}`} value={candidate.id}>
																				Q{index + candidateOffset + 2}
																			</SelectItem>
																		))}
																	</SelectContent>
																</Select>
															</div>
														</div>
													))}
												</div>
											)}
										</div>
									)}

									{listId && (
										<QuestionHoverResults
											questionId={question.id}
											questionType={question.type}
											listId={listId}
											isVisible={hoveredQuestionId === question.id}
											aiInsight={getQuestionInsight(question, index)}
										/>
									)}
								</motion.div>
							)}
						</Fragment>
					);
				})}
			</AnimatePresence>

			{/* Side drawer for editing */}
			{selectedQuestion && (
				<QuestionEditDrawer
					key={selectedQuestionId}
					question={selectedQuestion}
					questions={questions}
					index={selectedIndex}
					listId={listId}
					isOpen={selectedQuestionId !== null}
					onClose={() => setSelectedQuestionId(null)}
					updateQuestion={updateQuestion}
					reassignQuestionToSection={reassignQuestionToSection}
					removeQuestion={removeQuestion}
					moveQuestion={moveQuestion}
					aiInsight={getQuestionInsight(selectedQuestion, selectedIndex)}
					responseCount={responseCount}
					newSinceAnalysis={newSinceAnalysis}
					coachingFlag={coachingFlags.get(selectedIndex + 1)}
					onDetailedAnalysis={(result) => setLocalDetailedResult(result ?? null)}
				/>
			)}
		</UnifiedQuestionList>
	);
}
