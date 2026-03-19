import type { BranchRule, ResponseRecord } from "./branching";
import { getNextQuestionId, hasResponseValue } from "./branching";
import type { ResearchLinkQuestion } from "./schemas";
import { deriveSurveySections, resolveSectionStartQuestionId } from "./sections";

const QUESTION_SECONDS_BY_TYPE: Record<string, number> = {
	auto: 16,
	short_text: 16,
	long_text: 28,
	single_select: 9,
	multi_select: 14,
	likert: 9,
	matrix: 20,
	image_select: 14,
};

export type SurveyPathSummary = {
	label: string;
	questionIds: string[];
	questionCount: number;
	estimatedSeconds: number;
	estimatedMinutesLabel: string;
};

export type SurveyFlowSummary = {
	hasBranching: boolean;
	decisionQuestionId: string | null;
	decisionQuestionIndex: number | null;
	paths: SurveyPathSummary[];
	minQuestions: number;
	maxQuestions: number;
	minSeconds: number;
	maxSeconds: number;
};

function estimateQuestionSeconds(question: ResearchLinkQuestion): number {
	return QUESTION_SECONDS_BY_TYPE[question.type] ?? QUESTION_SECONDS_BY_TYPE.auto;
}

export function formatEstimatedMinutesFromSeconds(totalSeconds: number): string {
	if (totalSeconds <= 0) return "~0 min";
	return `~${Math.max(1, Math.round(totalSeconds / 60))} min`;
}

type PathTransition = {
	label: string;
	nextQuestionId: string | null;
	responses: ResponseRecord;
};

type LegacyRuleCondition = {
	questionId: string;
	operator: string;
	value?: string | string[];
};

type LegacyBranchRule = BranchRule & {
	if?: LegacyRuleCondition;
	conditions?: BranchRule["conditions"];
};

function getRuleConditions(rule: BranchRule): BranchRule["conditions"] {
	const candidate = rule as LegacyBranchRule;
	if (candidate.conditions?.conditions?.length) {
		return candidate.conditions;
	}

	if (candidate.if?.questionId && candidate.if.operator) {
		return {
			logic: "or",
			conditions: [
				{
					questionId: candidate.if.questionId,
					operator: candidate.if.operator as BranchRule["conditions"]["conditions"][number]["operator"],
					value: candidate.if.value,
				},
			],
		};
	}

	return {
		logic: "or",
		conditions: [],
	};
}

function createAnsweredPlaceholder(question: ResearchLinkQuestion): ResponseRecord[string] {
	if (question.type === "multi_select") return ["__simulated__"];
	return "__simulated__";
}

function valuesConflict(existing: ResponseRecord[string], nextValue: string): boolean {
	if (!hasResponseValue(existing)) return false;
	if (Array.isArray(existing)) return !existing.includes(nextValue);
	return String(existing) !== nextValue;
}

function mergeRuleResponses(
	rule: BranchRule,
	questionsById: Map<string, ResearchLinkQuestion>,
	visitedQuestionIds: Set<string>,
	currentQuestionId: string,
	assumedResponses: ResponseRecord
): ResponseRecord | null {
	const merged: ResponseRecord = { ...assumedResponses };
	const conditions = getRuleConditions(rule);

	for (const condition of conditions.conditions) {
		const conditionQuestion = questionsById.get(condition.questionId);
		const existingValue = merged[condition.questionId];
		const conditionTouchesAnsweredQuestion =
			visitedQuestionIds.has(condition.questionId) || condition.questionId === currentQuestionId;

		switch (condition.operator) {
			case "equals":
			case "contains": {
				if (typeof condition.value !== "string" || condition.value.trim().length === 0) return null;
				if (valuesConflict(existingValue, condition.value)) return null;
				merged[condition.questionId] = condition.value;
				break;
			}
			case "selected": {
				if (typeof condition.value !== "string" || condition.value.trim().length === 0) return null;
				if (existingValue && !Array.isArray(existingValue)) return null;
				const selected = Array.isArray(existingValue) ? [...existingValue] : [];
				if (!selected.includes(condition.value)) selected.push(condition.value);
				merged[condition.questionId] = selected;
				break;
			}
			case "not_equals":
			case "not_contains": {
				if (typeof condition.value !== "string" || condition.value.trim().length === 0) break;
				if (hasResponseValue(existingValue) && String(existingValue) === condition.value) return null;
				break;
			}
			case "not_selected": {
				if (typeof condition.value !== "string" || condition.value.trim().length === 0) break;
				if (Array.isArray(existingValue) && existingValue.includes(condition.value)) return null;
				break;
			}
			case "answered": {
				if (hasResponseValue(existingValue) || conditionTouchesAnsweredQuestion) {
					if (!hasResponseValue(existingValue) && conditionQuestion) {
						merged[condition.questionId] = createAnsweredPlaceholder(conditionQuestion);
					}
					break;
				}
				return null;
			}
			case "not_answered": {
				if (hasResponseValue(existingValue) || conditionTouchesAnsweredQuestion) return null;
				break;
			}
			default:
				return null;
		}
	}

	return merged;
}

function ruleDefinitelyMatches(
	rule: BranchRule,
	visitedQuestionIds: Set<string>,
	currentQuestionId: string,
	assumedResponses: ResponseRecord
): boolean {
	const conditions = getRuleConditions(rule);
	const evaluateKnownCondition = (condition: BranchRule["conditions"]["conditions"][number]) => {
		const existingValue = assumedResponses[condition.questionId];
		const isAnsweredContext =
			visitedQuestionIds.has(condition.questionId) || condition.questionId === currentQuestionId;

		switch (condition.operator) {
			case "equals":
				return (
					typeof condition.value === "string" &&
					hasResponseValue(existingValue) &&
					String(existingValue) === condition.value
				);
			case "contains":
				return (
					typeof condition.value === "string" &&
					hasResponseValue(existingValue) &&
					String(existingValue).toLowerCase().includes(condition.value.toLowerCase())
				);
			case "selected":
				return (
					typeof condition.value === "string" && Array.isArray(existingValue) && existingValue.includes(condition.value)
				);
			case "not_equals":
				return (
					typeof condition.value === "string" &&
					hasResponseValue(existingValue) &&
					String(existingValue) !== condition.value
				);
			case "not_contains":
				return (
					typeof condition.value === "string" &&
					hasResponseValue(existingValue) &&
					!String(existingValue).toLowerCase().includes(condition.value.toLowerCase())
				);
			case "not_selected":
				return (
					typeof condition.value === "string" &&
					Array.isArray(existingValue) &&
					!existingValue.includes(condition.value)
				);
			case "answered":
				return hasResponseValue(existingValue) || isAnsweredContext;
			case "not_answered":
				return !hasResponseValue(existingValue) && !isAnsweredContext;
			default:
				return false;
		}
	};

	if (conditions.logic === "and") {
		return conditions.conditions.every((condition) => evaluateKnownCondition(condition));
	}

	return conditions.conditions.some((condition) => evaluateKnownCondition(condition));
}

function inferFallbackResponses(
	question: ResearchLinkQuestion,
	rules: BranchRule[],
	assumedResponses: ResponseRecord
): ResponseRecord {
	if (hasResponseValue(assumedResponses[question.id])) {
		return { ...assumedResponses };
	}

	if ((question.type !== "single_select" && question.type !== "multi_select") || !question.options?.length) {
		return { ...assumedResponses };
	}

	const claimedValues = new Set<string>();
	for (const rule of rules) {
		for (const condition of getRuleConditions(rule).conditions) {
			if (
				condition.questionId === question.id &&
				(condition.operator === "equals" || condition.operator === "selected") &&
				typeof condition.value === "string"
			) {
				claimedValues.add(condition.value);
			}
		}
	}

	const fallbackOption = question.options.find((option) => !claimedValues.has(option));
	if (!fallbackOption) return { ...assumedResponses };

	return {
		...assumedResponses,
		[question.id]: question.type === "multi_select" ? [fallbackOption] : fallbackOption,
	};
}

function hasExhaustiveBranchCoverage(rules: BranchRule[], questionsById: Map<string, ResearchLinkQuestion>): boolean {
	const conditionsByQuestion = new Map<string, Set<string>>();

	for (const rule of rules) {
		for (const condition of getRuleConditions(rule).conditions) {
			if (
				(condition.operator !== "equals" && condition.operator !== "selected") ||
				typeof condition.value !== "string" ||
				condition.value.trim().length === 0
			) {
				continue;
			}

			const values = conditionsByQuestion.get(condition.questionId) ?? new Set<string>();
			values.add(condition.value);
			conditionsByQuestion.set(condition.questionId, values);
		}
	}

	for (const [questionId, claimedValues] of conditionsByQuestion.entries()) {
		const question = questionsById.get(questionId);
		if (!question) continue;

		const supportedTypes = new Set(["single_select", "multi_select", "image_select"]);
		if (!supportedTypes.has(question.type)) continue;

		const allOptions =
			question.type === "image_select"
				? (question.imageOptions?.map((option) => option.label).filter(Boolean) ?? [])
				: (question.options?.filter(Boolean) ?? []);

		if (allOptions.length === 0) continue;
		if (allOptions.every((option) => claimedValues.has(option))) {
			return true;
		}
	}

	return false;
}

function getPossibleTransitions(
	question: ResearchLinkQuestion,
	questions: ResearchLinkQuestion[],
	visitedQuestionIds: Set<string>,
	assumedResponses: ResponseRecord
): PathTransition[] {
	const rules = question.branching?.rules ?? [];

	const sectionMap = new Map(deriveSurveySections(questions).map((section) => [section.id, section] as const));
	const questionIndexById = new Map(questions.map((question, index) => [question.id, index] as const));
	const questionById = new Map(questions.map((candidate) => [candidate.id, candidate] as const));
	const transitions = new Map<string, PathTransition>();
	const currentIndex = questionIndexById.get(question.id) ?? -1;
	const linearNextQuestionId =
		currentIndex >= 0 && currentIndex < questions.length - 1 ? (questions[currentIndex + 1]?.id ?? null) : null;
	const guaranteedRuleMatch = rules.some((rule) =>
		ruleDefinitelyMatches(rule, visitedQuestionIds, question.id, assumedResponses)
	);

	for (const rule of rules) {
		const nextResponses = mergeRuleResponses(rule, questionById, visitedQuestionIds, question.id, assumedResponses);
		if (!nextResponses) continue;

		let targetQuestionId: string | null = null;
		let targetLabel = "End survey";

		if (rule.action === "skip_to") {
			targetQuestionId =
				rule.targetSectionId && rule.targetSectionId.trim().length > 0
					? resolveSectionStartQuestionId(questions, rule.targetSectionId, question.id)
					: (rule.targetQuestionId ?? null);
			if (rule.targetSectionId && sectionMap.has(rule.targetSectionId)) {
				targetLabel = sectionMap.get(rule.targetSectionId)?.title ?? "Section";
			} else if (targetQuestionId) {
				const targetIndex = questionIndexById.get(targetQuestionId);
				targetLabel = targetIndex !== undefined ? `Q${targetIndex + 1}` : "Target";
			}
		}

		const key = `${rule.id}:${targetQuestionId ?? "end"}`;
		transitions.set(key, {
			label: targetLabel,
			nextQuestionId: targetQuestionId,
			responses: nextResponses,
		});
	}

	const fallbackTargetQuestionId =
		question.branching?.defaultNext ??
		(rules.length === 0 ? getNextQuestionId(question, questions, assumedResponses) : linearNextQuestionId);
	const allowFallbackPath =
		Boolean(fallbackTargetQuestionId) &&
		!guaranteedRuleMatch &&
		(question.branching?.defaultNext || !hasExhaustiveBranchCoverage(rules, questionById));
	if (fallbackTargetQuestionId && allowFallbackPath) {
		const defaultTargetQuestionId = fallbackTargetQuestionId;
		const targetIndex = questionIndexById.get(defaultTargetQuestionId);
		const targetQuestion = questions.find((question) => question.id === defaultTargetQuestionId) ?? null;
		const defaultLabel =
			targetQuestion?.sectionId && sectionMap.has(targetQuestion.sectionId)
				? (sectionMap.get(targetQuestion.sectionId)?.title ?? "Default path")
				: targetIndex !== undefined
					? `Q${targetIndex + 1}`
					: "Default path";
		const key = `default:${defaultTargetQuestionId}:${defaultLabel}`;
		if (!transitions.has(key)) {
			const fallbackResponses =
				rules.length > 0 ? inferFallbackResponses(question, rules, assumedResponses) : { ...assumedResponses };
			transitions.set(key, {
				label: defaultLabel,
				nextQuestionId: defaultTargetQuestionId,
				responses: fallbackResponses,
			});
		}
	}

	if (rules.length > 0 && !question.branching?.defaultNext && !guaranteedRuleMatch) {
		const linearNextId = linearNextQuestionId;
		if (!linearNextId) {
			transitions.set("default:end", {
				label: "End survey",
				nextQuestionId: null,
				responses: { ...assumedResponses },
			});
		}
	}

	return Array.from(transitions.values());
}

export function summarizeSurveyFlow(questions: ResearchLinkQuestion[]): SurveyFlowSummary {
	const activeQuestions = questions.filter((question) => !question.hidden && Boolean(question.id));
	if (activeQuestions.length === 0) {
		return {
			hasBranching: false,
			decisionQuestionId: null,
			decisionQuestionIndex: null,
			paths: [],
			minQuestions: 0,
			maxQuestions: 0,
			minSeconds: 0,
			maxSeconds: 0,
		};
	}

	const decisionQuestionIndex = activeQuestions.findIndex((question) => {
		const targets = new Set<string>();
		for (const rule of question.branching?.rules ?? []) {
			targets.add(rule.action === "end_survey" ? "end" : rule.targetSectionId || rule.targetQuestionId || "unknown");
		}
		if (question.branching?.defaultNext) targets.add(`default:${question.branching.defaultNext}`);
		return targets.size > 1;
	});
	const decisionQuestion = decisionQuestionIndex >= 0 ? activeQuestions[decisionQuestionIndex] : null;
	const questionById = new Map(activeQuestions.map((question) => [question.id, question] as const));
	const paths: SurveyPathSummary[] = [];

	function walk(
		questionId: string | null,
		assumedResponses: ResponseRecord,
		visitedQuestionIds: string[],
		labels: string[]
	) {
		if (!questionId) {
			const estimatedSeconds = visitedQuestionIds.reduce((acc, visitedId) => {
				const question = questionById.get(visitedId);
				return question ? acc + estimateQuestionSeconds(question) : acc;
			}, 0);
			paths.push({
				label: labels.filter(Boolean).join(" → ") || "Default path",
				questionIds: visitedQuestionIds,
				questionCount: visitedQuestionIds.length,
				estimatedSeconds,
				estimatedMinutesLabel: formatEstimatedMinutesFromSeconds(estimatedSeconds),
			});
			return;
		}

		const question = questionById.get(questionId);
		if (!question) return;
		if (visitedQuestionIds.includes(questionId)) return;

		const nextVisited = [...visitedQuestionIds, questionId];
		const nextResponses = { ...assumedResponses };
		const transitions = getPossibleTransitions(question, activeQuestions, new Set(nextVisited), nextResponses);

		if (transitions.length === 0) {
			walk(null, nextResponses, nextVisited, labels);
			return;
		}

		for (const transition of transitions) {
			walk(
				transition.nextQuestionId,
				{ ...nextResponses, ...transition.responses },
				nextVisited,
				transition.label && transition.label !== "Default path" ? [...labels, transition.label] : labels
			);
		}
	}

	walk(activeQuestions[0]?.id ?? null, {}, [], []);

	const deduped = new Map<string, SurveyPathSummary>();
	for (const path of paths) {
		const key = path.questionIds.join(">");
		if (!key || deduped.has(key)) continue;
		deduped.set(key, path);
	}
	const uniquePaths = Array.from(deduped.values());

	const questionCounts = uniquePaths.map((path) => path.questionCount);
	const seconds = uniquePaths.map((path) => path.estimatedSeconds);
	const minQuestions = Math.min(...questionCounts);
	const maxQuestions = Math.max(...questionCounts);
	const minSeconds = Math.min(...seconds);
	const maxSeconds = Math.max(...seconds);

	return {
		hasBranching: Boolean(decisionQuestion),
		decisionQuestionId: decisionQuestion?.id ?? null,
		decisionQuestionIndex: decisionQuestion
			? activeQuestions.findIndex((question) => question.id === decisionQuestion.id)
			: null,
		paths: uniquePaths,
		minQuestions,
		maxQuestions,
		minSeconds,
		maxSeconds,
	};
}

export function formatFlowRangeLabel(summary: SurveyFlowSummary): string {
	if (summary.paths.length === 0) return "~0 min · 0 questions";
	return `${formatFlowMinutesLabel(summary)} · ${formatFlowQuestionCountLabel(summary)}`;
}

export function formatFlowAverageLabel(summary: SurveyFlowSummary): string {
	if (summary.paths.length === 0) return "Avg path ~0 min · 0 questions/path";
	const totalSeconds = summary.paths.reduce((sum, path) => sum + path.estimatedSeconds, 0);
	const totalQuestions = summary.paths.reduce((sum, path) => sum + path.questionCount, 0);
	const avgSeconds = Math.round(totalSeconds / summary.paths.length);
	const avgQuestions = Math.round(totalQuestions / summary.paths.length);
	return `Avg path ${formatEstimatedMinutesFromSeconds(avgSeconds)} · ${avgQuestions} questions/path`;
}

export function formatPathBreakdown(summary: SurveyFlowSummary): string {
	if (summary.paths.length <= 1) return "";
	return summary.paths
		.map((path) => `${path.label}: ${path.questionCount}q (${path.estimatedMinutesLabel})`)
		.join(" • ");
}

export function formatFlowMinutesLabel(summary: SurveyFlowSummary): string {
	if (summary.paths.length === 0) return "~0 min";
	const minMinuteLabel = formatEstimatedMinutesFromSeconds(summary.minSeconds);
	const maxMinuteLabel = formatEstimatedMinutesFromSeconds(summary.maxSeconds);
	return minMinuteLabel === maxMinuteLabel ? minMinuteLabel : `${minMinuteLabel}-${maxMinuteLabel.replace(/^~/, "")}`;
}

export function formatFlowQuestionCountLabel(summary: SurveyFlowSummary): string {
	if (summary.paths.length === 0) return "0 questions";
	return summary.minQuestions === summary.maxQuestions
		? `${summary.minQuestions} questions`
		: `${summary.minQuestions}-${summary.maxQuestions} questions`;
}
