import type { BranchRule, ResponseRecord } from "./branching";
import { getNextQuestionId } from "./branching";
import type { ResearchLinkQuestion } from "./schemas";
import { deriveSurveySections, resolveSectionStartQuestionId } from "./sections";

const QUESTION_SECONDS_BY_TYPE: Record<string, number> = {
	auto: 16,
	short_text: 16,
	long_text: 28,
	single_select: 9,
	multi_select: 14,
	likert: 9,
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

function seedResponsesFromRule(rule: BranchRule): ResponseRecord {
	const responses: ResponseRecord = {};
	for (const condition of rule.conditions.conditions) {
		if (typeof condition.value !== "string" || condition.value.trim().length === 0) continue;
		if (condition.operator === "equals" || condition.operator === "contains") {
			responses[condition.questionId] = condition.value;
			continue;
		}
		if (condition.operator === "selected") {
			const current = responses[condition.questionId];
			if (Array.isArray(current)) {
				if (!current.includes(condition.value)) current.push(condition.value);
			} else {
				responses[condition.questionId] = [condition.value];
			}
		}
	}
	return responses;
}

function simulatePath(
	questions: ResearchLinkQuestion[],
	seedResponses: ResponseRecord
): { questionIds: string[]; questionCount: number; estimatedSeconds: number; estimatedMinutesLabel: string } {
	const activeQuestions = questions.filter(
		(question): question is ResearchLinkQuestion & { id: string } => !question.hidden && Boolean(question.id)
	);
	if (activeQuestions.length === 0) {
		return { questionIds: [], questionCount: 0, estimatedSeconds: 0, estimatedMinutesLabel: "~0 min" };
	}

	const questionById = new Map(activeQuestions.map((question) => [question.id, question]));
	const visited: string[] = [];
	const seen = new Set<string>();
	let currentQuestion = activeQuestions[0] ?? null;
	let guard = 0;

	while (currentQuestion && guard < activeQuestions.length * 4) {
		visited.push(currentQuestion.id);
		seen.add(currentQuestion.id);
		const nextId = getNextQuestionId(currentQuestion, activeQuestions, seedResponses);
		if (!nextId) break;
		if (seen.has(nextId)) break;
		currentQuestion = questionById.get(nextId) ?? null;
		guard += 1;
	}

	const estimatedSeconds = visited.reduce((acc, questionId) => {
		const question = questionById.get(questionId);
		return question ? acc + estimateQuestionSeconds(question) : acc;
	}, 0);

	return {
		questionIds: visited,
		questionCount: visited.length,
		estimatedSeconds,
		estimatedMinutesLabel: formatEstimatedMinutesFromSeconds(estimatedSeconds),
	};
}

type DecisionTargetGroup = {
	label: string;
	seedResponses: ResponseRecord;
};

function getDecisionTargetGroups(
	decisionQuestion: ResearchLinkQuestion,
	questions: ResearchLinkQuestion[]
): DecisionTargetGroup[] {
	const rules = decisionQuestion.branching?.rules ?? [];
	if (rules.length === 0) return [];

	const sectionMap = new Map(deriveSurveySections(questions).map((section) => [section.id, section] as const));
	const questionIndexById = new Map(questions.map((question, index) => [question.id, index] as const));
	const groups = new Map<string, DecisionTargetGroup>();

	for (const rule of rules) {
		let targetQuestionId: string | null = null;
		let targetLabel = "End survey";

		if (rule.action === "skip_to") {
			targetQuestionId =
				rule.targetSectionId && rule.targetSectionId.trim().length > 0
					? resolveSectionStartQuestionId(questions, rule.targetSectionId, decisionQuestion.id)
					: (rule.targetQuestionId ?? null);

			if (rule.targetSectionId && sectionMap.has(rule.targetSectionId)) {
				targetLabel = sectionMap.get(rule.targetSectionId)?.title ?? "Section";
			} else if (targetQuestionId) {
				const targetIndex = questionIndexById.get(targetQuestionId);
				targetLabel = targetIndex !== undefined ? `Q${targetIndex + 1}` : "Target";
			} else {
				targetLabel = "Target";
			}
		}

		const key = `${rule.action}:${targetQuestionId ?? "end"}:${targetLabel}`;
		const seed = seedResponsesFromRule(rule);
		const existing = groups.get(key);
		if (!existing) {
			groups.set(key, {
				label: targetLabel,
				seedResponses: seed,
			});
			continue;
		}

		for (const [questionId, value] of Object.entries(seed)) {
			if (!(questionId in existing.seedResponses)) {
				existing.seedResponses[questionId] = value;
			}
		}
	}

	return Array.from(groups.values());
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
		const rules = question.branching?.rules ?? [];
		if (rules.length < 2) return false;
		const targetKeys = new Set(
			rules.map((rule) =>
				rule.action === "end_survey" ? "end" : rule.targetSectionId || rule.targetQuestionId || "unknown"
			)
		);
		return targetKeys.size > 1;
	});
	const decisionQuestion = decisionQuestionIndex >= 0 ? activeQuestions[decisionQuestionIndex] : null;

	let rawPaths: SurveyPathSummary[] = [];
	if (!decisionQuestion) {
		const linearPath = simulatePath(activeQuestions, {});
		rawPaths = [{ label: "Default path", ...linearPath }];
	} else {
		const groups = getDecisionTargetGroups(decisionQuestion, activeQuestions);
		rawPaths = groups.map((group) => ({
			label: group.label,
			...simulatePath(activeQuestions, group.seedResponses),
		}));
		if (rawPaths.length === 0) {
			rawPaths = [{ label: "Default path", ...simulatePath(activeQuestions, {}) }];
		}
	}

	const deduped = new Map<string, SurveyPathSummary>();
	for (const path of rawPaths) {
		const key = path.questionIds.join(">");
		if (!key) continue;
		if (!deduped.has(key)) {
			deduped.set(key, path);
		}
	}
	const paths = Array.from(deduped.values());

	const questionCounts = paths.map((path) => path.questionCount);
	const seconds = paths.map((path) => path.estimatedSeconds);
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
		paths,
		minQuestions,
		maxQuestions,
		minSeconds,
		maxSeconds,
	};
}

export function formatFlowRangeLabel(summary: SurveyFlowSummary): string {
	if (summary.paths.length === 0) return "~0 min";
	const minMinuteLabel = formatEstimatedMinutesFromSeconds(summary.minSeconds);
	const maxMinuteLabel = formatEstimatedMinutesFromSeconds(summary.maxSeconds);
	const minuteRange =
		minMinuteLabel === maxMinuteLabel ? minMinuteLabel : `${minMinuteLabel}-${maxMinuteLabel.replace(/^~/, "")}`;
	const questionRange =
		summary.minQuestions === summary.maxQuestions
			? `${summary.minQuestions} questions/path`
			: `${summary.minQuestions}-${summary.maxQuestions} questions/path`;
	return `${minuteRange} · ${questionRange}`;
}

export function formatPathBreakdown(summary: SurveyFlowSummary): string {
	if (summary.paths.length <= 1) return "";
	return summary.paths
		.map((path) => `${path.label}: ${path.questionCount}q (${path.estimatedMinutesLabel})`)
		.join(" • ");
}
