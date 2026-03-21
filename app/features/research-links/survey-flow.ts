import type { BranchRule } from "./branching";
import { getNextQuestionId } from "./branching";
import type { PersonAttributeRecord, ResponseRecord } from "./branching-context";
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
	triggerLabel?: string;
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

type SeedContext = {
	responses: ResponseRecord;
	personAttributes: PersonAttributeRecord;
};

function formatConditionTriggerLabel(rule: BranchRule): string {
	if (rule.conditions.conditions.length === 0) return "otherwise";
	return rule.conditions.conditions
		.map((condition) => {
			const sourceLabel =
				condition.sourceType === "person_attribute" ? condition.attributeKey.replaceAll("_", " ") : "answer";
			const valueLabel =
				typeof condition.value === "string"
					? condition.value
					: Array.isArray(condition.value)
						? condition.value.join(", ")
						: "";
			switch (condition.operator) {
				case "equals":
				case "selected":
					return `${sourceLabel} is ${valueLabel}`;
				case "not_equals":
				case "not_selected":
					return `${sourceLabel} is not ${valueLabel}`;
				case "contains":
					return `${sourceLabel} contains ${valueLabel}`;
				case "not_contains":
					return `${sourceLabel} does not contain ${valueLabel}`;
				case "answered":
					return `${sourceLabel} is answered`;
				case "not_answered":
					return `${sourceLabel} is blank`;
				default:
					return sourceLabel;
			}
		})
		.join(rule.conditions.logic === "or" ? " OR " : " AND ");
}

function seedContextFromRule(rule: BranchRule): SeedContext {
	const responses: ResponseRecord = {};
	const personAttributes: PersonAttributeRecord = {};
	for (const condition of rule.conditions.conditions) {
		if (typeof condition.value !== "string" || condition.value.trim().length === 0) continue;

		if (condition.sourceType === "person_attribute") {
			if (condition.operator === "equals" || condition.operator === "contains") {
				personAttributes[condition.attributeKey] = condition.value;
			}
			continue;
		}

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
	return { responses, personAttributes };
}

function simulatePath(
	questions: ResearchLinkQuestion[],
	seedContext: SeedContext
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
	const simulatedResponses: ResponseRecord = { ...seedContext.responses };
	let currentQuestion = activeQuestions[0] ?? null;
	let guard = 0;

	while (currentQuestion && guard < activeQuestions.length * 4) {
		visited.push(currentQuestion.id);
		seen.add(currentQuestion.id);
		if (!(currentQuestion.id in simulatedResponses)) {
			simulatedResponses[currentQuestion.id] =
				currentQuestion.type === "multi_select" ? ["__simulated__"] : "__simulated__";
		}
		const nextId = getNextQuestionId(currentQuestion, activeQuestions, {
			responses: simulatedResponses,
			personAttributes: seedContext.personAttributes,
		});
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
	triggerLabel: string;
	seedContext: SeedContext;
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
		const seed = seedContextFromRule(rule);
		const existing = groups.get(key);
		if (!existing) {
			groups.set(key, {
				label: targetLabel,
				triggerLabel: formatConditionTriggerLabel(rule),
				seedContext: seed,
			});
			continue;
		}

		for (const [questionId, value] of Object.entries(seed.responses)) {
			if (!(questionId in existing.seedContext.responses)) {
				existing.seedContext.responses[questionId] = value;
			}
		}
		for (const [attributeKey, value] of Object.entries(seed.personAttributes)) {
			if (!(attributeKey in existing.seedContext.personAttributes)) {
				existing.seedContext.personAttributes[attributeKey] = value;
			}
		}
	}

	if (decisionQuestion.branching?.defaultNext) {
		const defaultTargetQuestionId = decisionQuestion.branching.defaultNext;
		const targetIndex = questionIndexById.get(defaultTargetQuestionId);
		const targetQuestion = questions.find((question) => question.id === defaultTargetQuestionId) ?? null;
		const defaultLabel =
			targetQuestion?.sectionId && sectionMap.has(targetQuestion.sectionId)
				? (sectionMap.get(targetQuestion.sectionId)?.title ?? "Default path")
				: targetIndex !== undefined
					? `Q${targetIndex + 1}`
					: "Default path";
		const key = `default:${defaultTargetQuestionId}:${defaultLabel}`;
		if (!groups.has(key)) {
			groups.set(key, {
				label: defaultLabel,
				triggerLabel: "otherwise",
				seedContext: { responses: {}, personAttributes: {} },
			});
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
		const targets = new Set<string>();
		for (const rule of rules) {
			targets.add(rule.action === "end_survey" ? "end" : rule.targetSectionId || rule.targetQuestionId || "unknown");
		}
		if (question.branching?.defaultNext) {
			targets.add(`default:${question.branching.defaultNext}`);
		}
		if (targets.size < 2) return false;
		const targetKeys = new Set([...targets]);
		return targetKeys.size > 1;
	});
	const decisionQuestion = decisionQuestionIndex >= 0 ? activeQuestions[decisionQuestionIndex] : null;

	let rawPaths: SurveyPathSummary[] = [];
	if (!decisionQuestion) {
		const linearPath = simulatePath(activeQuestions, { responses: {}, personAttributes: {} });
		rawPaths = [{ label: "Default path", ...linearPath }];
	} else {
		const groups = getDecisionTargetGroups(decisionQuestion, activeQuestions);
		rawPaths = groups.map((group) => ({
			label: group.label,
			triggerLabel: group.triggerLabel,
			...simulatePath(activeQuestions, group.seedContext),
		}));
		if (rawPaths.length === 0) {
			rawPaths = [{ label: "Default path", ...simulatePath(activeQuestions, { responses: {}, personAttributes: {} }) }];
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
		.map((path) =>
			path.triggerLabel
				? `${path.label} [${path.triggerLabel}]: ${path.questionCount}q (${path.estimatedMinutesLabel})`
				: `${path.label}: ${path.questionCount}q (${path.estimatedMinutesLabel})`
		)
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
