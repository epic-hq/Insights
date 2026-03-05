import type { ResearchLinkQuestion } from "./schemas";

export const DEFAULT_SECTION_ID = "section-default";
export const DEFAULT_SECTION_TITLE = "Section";

export type SurveySection = {
	id: string;
	title: string;
	order: number;
	startQuestionId: string;
	questionIds: string[];
};

function normalizeSectionId(question: ResearchLinkQuestion): string {
	const raw = question.sectionId?.trim();
	return raw && raw.length > 0 ? raw : DEFAULT_SECTION_ID;
}

function normalizeSectionTitle(question: ResearchLinkQuestion, sectionId: string, order: number): string {
	const raw = question.sectionTitle?.trim();
	if (raw && raw.length > 0) return raw;
	if (sectionId === DEFAULT_SECTION_ID) return "Shared block";
	return `${DEFAULT_SECTION_TITLE} ${order + 1}`;
}

export function deriveSurveySections(questions: ResearchLinkQuestion[]): SurveySection[] {
	const sectionMap = new Map<string, SurveySection>();

	for (const question of questions) {
		const questionId = question.id;
		if (!questionId) continue;
		const sectionId = normalizeSectionId(question);
		const existing = sectionMap.get(sectionId);
		if (!existing) {
			const order = sectionMap.size;
			sectionMap.set(sectionId, {
				id: sectionId,
				title: normalizeSectionTitle(question, sectionId, order),
				order,
				startQuestionId: questionId,
				questionIds: [questionId],
			});
			continue;
		}
		existing.questionIds.push(questionId);
		if (
			(!existing.title || existing.title === `${DEFAULT_SECTION_TITLE} ${existing.order + 1}`) &&
			question.sectionTitle
		) {
			existing.title = question.sectionTitle;
		}
	}

	return Array.from(sectionMap.values()).sort((a, b) => a.order - b.order);
}

export function resolveSectionStartQuestionId(
	questions: Array<{ id: string; sectionId?: string | null }>,
	sectionId: string,
	currentQuestionId?: string
): string | null {
	if (!sectionId) return null;
	const currentIndex = currentQuestionId ? questions.findIndex((q) => q.id === currentQuestionId) : -1;
	const forwardMatch = questions.find((q, index) => {
		if ((q.sectionId ?? DEFAULT_SECTION_ID) !== sectionId) return false;
		if (currentIndex < 0) return true;
		return index > currentIndex;
	});
	if (forwardMatch) return forwardMatch.id;
	const firstMatch = questions.find((q) => (q.sectionId ?? DEFAULT_SECTION_ID) === sectionId);
	return firstMatch?.id ?? null;
}
