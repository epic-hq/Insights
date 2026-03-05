import type { BranchRule } from "./branching";
import type { ResearchLinkQuestion } from "./schemas";
import { DEFAULT_SECTION_ID, DEFAULT_SECTION_TITLE, deriveSurveySections } from "./sections";

export interface SurveySectionNode {
	id: string;
	title: string;
	startQuestionId: string;
	questionIds: string[];
	order: number;
}

export interface SurveySectionEdge {
	fromSectionId: string;
	fromQuestionId: string;
	action: "skip_to" | "end_survey" | "linear";
	conditionSummary: string;
	targetSectionId: string | null;
	targetQuestionId: string | null;
}

export interface SurveySectionGraph {
	entrySectionId: string | null;
	nodes: SurveySectionNode[];
	edges: SurveySectionEdge[];
}

function summarizeRuleCondition(rule: BranchRule): string {
	if (rule.conditions.conditions.length === 0) return "otherwise";
	const parts = rule.conditions.conditions.map((condition) => {
		const raw = Array.isArray(condition.value) ? condition.value.join(", ") : (condition.value ?? "");
		const value = String(raw).trim();
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

function getQuestionSectionId(question: ResearchLinkQuestion): string {
	return question.sectionId?.trim() || DEFAULT_SECTION_ID;
}

/**
 * Compile survey questions into a section-level graph:
 * - Nodes are visible sections
 * - Edges are explicit branching rules and implicit linear section transitions
 */
export function buildSurveySectionGraph(questions: ResearchLinkQuestion[]): SurveySectionGraph {
	const visibleQuestions = questions.filter((question) => !question.hidden);
	if (visibleQuestions.length === 0) {
		return { entrySectionId: null, nodes: [], edges: [] };
	}

	const sections = deriveSurveySections(visibleQuestions);
	const questionById = new Map(visibleQuestions.map((q) => [q.id, q]));
	const questionIndexById = new Map(visibleQuestions.map((q, idx) => [q.id, idx]));

	const nodes: SurveySectionNode[] = sections.map((section) => {
		const questionIds = visibleQuestions
			.filter((question) => getQuestionSectionId(question) === section.id)
			.map((question) => question.id);
		return {
			id: section.id,
			title: section.title || (section.id === DEFAULT_SECTION_ID ? DEFAULT_SECTION_TITLE : section.id),
			startQuestionId: section.startQuestionId,
			questionIds,
			order: section.order,
		};
	});

	const edges: SurveySectionEdge[] = [];
	const edgeSeen = new Set<string>();

	for (const question of visibleQuestions) {
		const rules = question.branching?.rules ?? [];
		for (const rule of rules) {
			const fromSectionId = getQuestionSectionId(question);
			const fromQuestionId = question.id;
			const targetQuestionId =
				rule.action === "skip_to"
					? (rule.targetQuestionId ??
						(rule.targetSectionId
							? (visibleQuestions.find((candidate) => getQuestionSectionId(candidate) === rule.targetSectionId)?.id ??
								null)
							: null))
					: null;
			const targetQuestion = targetQuestionId ? questionById.get(targetQuestionId) : undefined;
			const targetSectionId =
				rule.action === "end_survey" ? null : targetQuestion ? getQuestionSectionId(targetQuestion) : null;
			const conditionSummary = summarizeRuleCondition(rule);
			const key = `${fromQuestionId}|${rule.id}|${rule.action}|${targetSectionId ?? "end"}|${targetQuestionId ?? "none"}`;
			if (edgeSeen.has(key)) continue;
			edgeSeen.add(key);
			edges.push({
				fromSectionId,
				fromQuestionId,
				action: rule.action,
				conditionSummary,
				targetSectionId,
				targetQuestionId,
			});
		}

		// Add linear section transition edges when a question naturally crosses into next section.
		const currentIndex = questionIndexById.get(question.id) ?? -1;
		if (currentIndex < 0) continue;
		const nextQuestion = visibleQuestions[currentIndex + 1];
		if (!nextQuestion) continue;
		const fromSectionId = getQuestionSectionId(question);
		const nextSectionId = getQuestionSectionId(nextQuestion);
		if (fromSectionId === nextSectionId) continue;
		const linearKey = `${question.id}|linear|${nextSectionId}|${nextQuestion.id}`;
		if (edgeSeen.has(linearKey)) continue;
		edgeSeen.add(linearKey);
		edges.push({
			fromSectionId,
			fromQuestionId: question.id,
			action: "linear",
			conditionSummary: "default flow",
			targetSectionId: nextSectionId,
			targetQuestionId: nextQuestion.id,
		});
	}

	return {
		entrySectionId: nodes[0]?.id ?? null,
		nodes,
		edges,
	};
}
