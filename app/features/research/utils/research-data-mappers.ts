import type {
	ResearchAnswerNode,
	ResearchAnswersData,
	ResearchQuestionNode,
} from "~/features/research/components/ResearchAnswers";

const ANSWERED_STATUSES = new Set(["answered", "ad_hoc"]);
const OPEN_STATUSES = new Set(["planned", "asked"]);

/**
 * Helper functions to map ResearchAnswersData to UI shapes expected by ProjectStatusScreen
 */

interface AnsweredQuestionSummary {
	id: string;
	text: string;
	answer_text: string | null;
	respondent_name: string | null;
	interview_title: string | null;
	evidence_count: number;
	answered_at: string | null;
}

interface OpenQuestionSummary {
	id: string;
	text: string;
	status: string;
	category: string | null;
	interview_count: number;
	evidence_count: number;
}

interface ResearchMetrics {
	answered: number;
	open: number;
	total: number;
	evidence_count: number;
	interview_count: number;
	persona_count: number;
}

/**
 * Extract answered questions from research rollup data
 */
export function getAnsweredQuestions(data: ResearchAnswersData | null): AnsweredQuestionSummary[] {
	if (!data) return [];

	const answeredAnswers: ResearchAnswerNode[] = [];

	// Collect from decision questions
	data.decision_questions.forEach((decision) => {
		decision.research_questions.forEach((rq) => {
			rq.answers.forEach((answer) => {
				if (ANSWERED_STATUSES.has(answer.status)) {
					answeredAnswers.push(answer);
				}
			});
		});
	});

	// Collect from standalone research questions
	data.research_questions_without_decision.forEach((rq) => {
		rq.answers.forEach((answer) => {
			if (ANSWERED_STATUSES.has(answer.status)) {
				answeredAnswers.push(answer);
			}
		});
	});

	// Collect from orphan answers
	data.orphan_answers.forEach((answer) => {
		if (ANSWERED_STATUSES.has(answer.status)) {
			answeredAnswers.push(answer);
		}
	});

	return answeredAnswers.map((answer) => ({
		id: answer.id,
		text: answer.question_text,
		answer_text: answer.answer_text,
		respondent_name: answer.respondent.name,
		interview_title: answer.interview.title,
		evidence_count: answer.metrics.evidence_count,
		answered_at: answer.answered_at,
	}));
}

/**
 * Extract open questions from research rollup data
 */
export function getOpenQuestions(data: ResearchAnswersData | null): OpenQuestionSummary[] {
	if (!data) return [];

	const openAnswers: ResearchAnswerNode[] = [];

	// Collect from decision questions
	data.decision_questions.forEach((decision) => {
		decision.research_questions.forEach((rq) => {
			rq.answers.forEach((answer) => {
				if (OPEN_STATUSES.has(answer.status)) {
					openAnswers.push(answer);
				}
			});
		});
	});

	// Collect from standalone research questions
	data.research_questions_without_decision.forEach((rq) => {
		rq.answers.forEach((answer) => {
			if (OPEN_STATUSES.has(answer.status)) {
				openAnswers.push(answer);
			}
		});
	});

	// Collect from orphan answers
	data.orphan_answers.forEach((answer) => {
		if (OPEN_STATUSES.has(answer.status)) {
			openAnswers.push(answer);
		}
	});

	return openAnswers.map((answer) => ({
		id: answer.id,
		text: answer.question_text,
		status: answer.status,
		category: answer.question_category,
		interview_count: answer.metrics.interview_count,
		evidence_count: answer.metrics.evidence_count,
	}));
}

/**
 * Calculate comprehensive research metrics from rollup data
 */
export function calculateResearchMetrics(data: ResearchAnswersData | null): ResearchMetrics {
	if (!data) {
		return {
			answered: 0,
			open: 0,
			total: 0,
			evidence_count: 0,
			interview_count: 0,
			persona_count: 0,
		};
	}

	const research_map = new Map<string, ResearchQuestionNode>();

	// Collect all unique research questions
	data.decision_questions.forEach((decision) => {
		decision.research_questions.forEach((rq) => {
			if (!research_map.has(rq.id)) research_map.set(rq.id, rq);
		});
	});

	data.research_questions_without_decision.forEach((rq) => {
		if (!research_map.has(rq.id)) research_map.set(rq.id, rq);
	});

	let answered = 0;
	let open = 0;
	let total_evidence = 0;
	let total_interviews = 0;
	let total_personas = 0;

	// Sum metrics from research questions
	research_map.forEach((rq) => {
		answered += rq.metrics.answered_answer_count ?? 0;
		open += rq.metrics.open_answer_count ?? 0;
		total_evidence += rq.metrics.evidence_count ?? 0;
		total_interviews += rq.metrics.interview_count ?? 0;
		total_personas += rq.metrics.persona_count ?? 0;
	});

	// Add orphan answers
	const orphan_answered = data.orphan_answers.filter((ans) => ANSWERED_STATUSES.has(ans.status)).length;
	const orphan_open = data.orphan_answers.filter((ans) => OPEN_STATUSES.has(ans.status)).length;

	answered += orphan_answered;
	open += orphan_open;

	// Add orphan metrics
	data.orphan_answers.forEach((answer) => {
		total_evidence += answer.metrics.evidence_count ?? 0;
		total_interviews += answer.metrics.interview_count ?? 0;
		total_personas += answer.metrics.persona_count ?? 0;
	});

	return {
		answered,
		open,
		total: answered + open,
		evidence_count: total_evidence,
		interview_count: total_interviews,
		persona_count: total_personas,
	};
}

/**
 * Get top research questions by activity (answered + open answers)
 */
function _getTopResearchQuestions(
	data: ResearchAnswersData | null,
	limit = 5
): Array<{
	id: string;
	text: string;
	answered_count: number;
	open_count: number;
	total_activity: number;
	decision_text?: string;
}> {
	if (!data) return [];

	const questions: Array<{
		id: string;
		text: string;
		answered_count: number;
		open_count: number;
		total_activity: number;
		decision_text?: string;
	}> = [];

	// From decision questions
	data.decision_questions.forEach((decision) => {
		decision.research_questions.forEach((rq) => {
			const answered_count = rq.metrics.answered_answer_count ?? 0;
			const open_count = rq.metrics.open_answer_count ?? 0;
			const total_activity = answered_count + open_count;

			if (total_activity > 0) {
				questions.push({
					id: rq.id,
					text: rq.text,
					answered_count,
					open_count,
					total_activity,
					decision_text: decision.text,
				});
			}
		});
	});

	// From standalone research questions
	data.research_questions_without_decision.forEach((rq) => {
		const answered_count = rq.metrics.answered_answer_count ?? 0;
		const open_count = rq.metrics.open_answer_count ?? 0;
		const total_activity = answered_count + open_count;

		if (total_activity > 0) {
			questions.push({
				id: rq.id,
				text: rq.text,
				answered_count,
				open_count,
				total_activity,
			});
		}
	});

	return questions.sort((a, b) => b.total_activity - a.total_activity).slice(0, limit);
}
