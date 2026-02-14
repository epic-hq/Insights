import type { SupabaseClient } from "@supabase/supabase-js";
import { b } from "baml_client";
import consola from "consola";
import type { Database } from "~/types";
import type { ResearchMode } from "~/types/research";

const DEFAULT_MIN_CONFIDENCE = 0.6;
const PROJECT_RESEARCH_ANALYSIS_RUNS_TABLE = "project_research_analysis_runs";
const PROJECT_QUESTION_ANALYSIS_TABLE = "project_question_analysis";
const VALIDATION_GATE_LABELS: Record<string, string> = {
	pain_exists: "Pain Exists",
	awareness: "Awareness",
	quantified: "Quantified Impact",
	acting: "Taking Action",
};

type QuestionKind = "decision" | "research";

type ExistingAnswer = {
	id: string;
	interview_id: string | null;
	research_question_id: string | null;
	decision_question_id: string | null;
	question_text: string;
	origin: string | null;
	analysis_run_metadata: Record<string, any> | null;
	analysis_summary: string | null;
	analysis_rationale: string | null;
	analysis_next_steps: string | null;
	answer_text: string | null;
	confidence: number | null;
	respondent_person_id: string | null;
};

interface EvidenceLinkAggregate {
	key: string;
	questionKind: QuestionKind;
	researchQuestionId: string | null;
	decisionQuestionId: string | null;
	interviewId: string | null;
	personId: string | null;
	questionText: string;
	existing?: ExistingAnswer;
	evidenceLinks: Array<{
		evidenceId: string;
		confidence: number;
		relationship: "supports" | "refutes" | "neutral";
		answerSummary: string;
		rationale: string;
		nextSteps: string | null | undefined;
	}>;
	answerId?: string;
}

interface BamlEvidenceLink {
	evidence_id: string;
	links: Array<{
		question_id: string;
		question_kind: QuestionKind;
		decision_question_id?: string | null;
		relationship: "supports" | "refutes" | "neutral";
		confidence: number;
		answer_summary: string;
		rationale: string;
		next_steps?: string | null;
	}>;
}

interface BamlResearchQuestionAnswer {
	research_question_id: string;
	findings: string[];
	evidence_ids: string[];
	confidence: number;
	reasoning: string;
}

interface BamlDecisionQuestionAnswer {
	decision_question_id: string;
	strategic_insight: string;
	supporting_findings: string[];
	research_question_ids: string[];
	confidence: number;
	reasoning: string;
	recommended_actions: string[];
}

interface BamlQuestionSummary {
	question_id: string;
	question_kind: QuestionKind;
	decision_question_id?: string | null;
	confidence: number;
	summary: string;
	goal_achievement_summary?: string | null;
	next_steps?: string | null;
}

interface BamlAnalysisResponse {
	evidence_results?: BamlEvidenceLink[];
	research_question_answers?: BamlResearchQuestionAnswer[];
	decision_question_answers?: BamlDecisionQuestionAnswer[];
	global_goal_summary?: string | null;
	recommended_actions?: string[] | null;
}

interface EvidenceAnalysisResult {
	success: boolean;
	runId?: string;
	globalGoalSummary: string | null;
	recommendedActions: string[];
	summary: {
		evidenceAnalyzed: number;
		evidenceLinked: number;
		answersCreated: number;
		answersUpdated: number;
	};
	questionSummaries: BamlQuestionSummary[];
}

interface RunEvidenceAnalysisArgs {
	supabase: SupabaseClient<Database>;
	projectId: string;
	interviewId?: string | null;
	customInstructions?: string;
	minConfidence?: number;
}

function buildAnswerKey(params: {
	questionKind: QuestionKind;
	researchQuestionId?: string | null;
	decisionQuestionId?: string | null;
	interviewId?: string | null;
}) {
	return [
		`kind:${params.questionKind}`,
		`rq:${params.researchQuestionId ?? "null"}`,
		`dq:${params.decisionQuestionId ?? "null"}`,
		`interview:${params.interviewId ?? "null"}`,
	].join("|");
}

function clampConfidence(value: number | null | undefined): number {
	if (typeof value !== "number" || Number.isNaN(value)) return 0;
	return Math.min(1, Math.max(0, value));
}

function _safeNumber(value: number | null | undefined): number | null {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	return null;
}

function isObject(value: unknown): value is Record<string, any> {
	return typeof value === "object" && value !== null;
}

export async function runEvidenceAnalysis({
	supabase,
	projectId,
	interviewId,
	customInstructions,
	minConfidence = DEFAULT_MIN_CONFIDENCE,
}: RunEvidenceAnalysisArgs): Promise<EvidenceAnalysisResult> {
	const [
		{ data: decisionQuestions, error: decisionError },
		{ data: researchQuestions, error: researchError },
		{ data: questionSection, error: questionSectionError },
	] = await Promise.all([
		supabase.from("decision_questions").select("id, text, rationale").eq("project_id", projectId),
		supabase.from("research_questions").select("id, text, rationale, decision_question_id").eq("project_id", projectId),
		supabase
			.from("project_sections")
			.select("meta")
			.eq("project_id", projectId)
			.eq("kind", "questions")
			.limit(1)
			.maybeSingle(),
	]);

	if (decisionError) throw decisionError;
	if (researchError) throw researchError;
	if (questionSectionError && questionSectionError.code !== "PGRST116") throw questionSectionError;

	const questionSectionMeta = (questionSection?.meta as Record<string, any> | null) ?? null;
	const researchMode = (questionSectionMeta?.settings?.research_mode as ResearchMode | undefined) ?? "exploratory";
	const validationGateMeta = questionSectionMeta?.validation_gate_map as
		| Record<
				string,
				{
					research_question_id?: string;
					research_question_text?: string;
				}
		  >
		| undefined;

	const _decisionMap = new Map(decisionQuestions?.map((dq) => [dq.id, dq]) ?? []);
	const researchMap = new Map(researchQuestions?.map((rq) => [rq.id, rq]) ?? []);
	const gateByResearchQuestionId = new Map<string, { slug: string; label: string }>();
	if (validationGateMeta) {
		for (const [slug, meta] of Object.entries(validationGateMeta)) {
			const rqId = meta?.research_question_id;
			if (rqId) {
				gateByResearchQuestionId.set(rqId, {
					slug,
					label: VALIDATION_GATE_LABELS[slug] ?? slug,
				});
			}
		}
	}

	const evidenceQuery = supabase
		.from("evidence")
		.select("id, verbatim, support, interview_id, context_summary, project_answer_id")
		.eq("project_id", projectId);

	const { data: evidenceRows, error: evidenceError } = interviewId
		? await evidenceQuery.eq("interview_id", interviewId)
		: await evidenceQuery;

	if (evidenceError) throw evidenceError;

	if (!evidenceRows || evidenceRows.length === 0) {
		return {
			success: true,
			runId: undefined,
			globalGoalSummary: null,
			recommendedActions: [],
			summary: {
				evidenceAnalyzed: 0,
				evidenceLinked: 0,
				answersCreated: 0,
				answersUpdated: 0,
			},
			questionSummaries: [],
		};
	}

	const evidencePayload = evidenceRows.map((row) => ({
		id: row.id,
		verbatim: row.verbatim,
		support: (row.support ?? "supports") as "supports" | "refutes" | "neutral",
		interview_id: row.interview_id ?? undefined,
		context_summary: row.context_summary ?? undefined,
	}));

	const interviewIds = Array.from(
		new Set(
			evidenceRows
				.map((row) => row.interview_id)
				.filter((value): value is string => typeof value === "string" && value.length > 0)
		)
	);
	const interviewPersonMap = new Map<string, string>();
	if (interviewIds.length > 0) {
		const { data: interviewPeopleRows, error: interviewPeopleError } = await supabase
			.from("interview_people")
			.select("interview_id, person_id")
			.in("interview_id", interviewIds);

		if (interviewPeopleError) throw interviewPeopleError;

		for (const row of interviewPeopleRows ?? []) {
			if (!interviewPersonMap.has(row.interview_id)) {
				interviewPersonMap.set(row.interview_id, row.person_id);
			}
		}
	}

	const questionPayload = [
		...(decisionQuestions ?? []).map((dq) => ({
			id: dq.id,
			kind: "decision" as const,
			text: dq.text,
			rationale: dq.rationale ?? undefined,
			decision_question_id: dq.id,
		})),
		...(researchQuestions ?? []).map((rq) => ({
			id: rq.id,
			kind: "research" as const,
			text: rq.text,
			rationale: (() => {
				const gate = gateByResearchQuestionId.get(rq.id);
				const parts = [] as string[];
				if (rq.rationale) parts.push(rq.rationale);
				if (gate) parts.push(`Validation gate: ${gate.label}`);
				return parts.length > 0 ? parts.join(" | ") : undefined;
			})(),
			decision_question_id: rq.decision_question_id ?? undefined,
		})),
	];

	consola.info("[research-analysis] Calling BAML evidence linker", {
		projectId,
		evidenceCount: evidencePayload.length,
		questionCount: questionPayload.length,
		minConfidence,
	});

	const instructionParts: string[] = [];
	if (customInstructions && customInstructions.trim().length > 0) {
		instructionParts.push(customInstructions.trim());
	}
	if (researchMode === "validation" && validationGateMeta && Object.keys(validationGateMeta).length > 0) {
		const gateLines = Object.entries(validationGateMeta)
			.map(([slug, meta]) => {
				const label = VALIDATION_GATE_LABELS[slug] ?? slug;
				const rqText = meta?.research_question_text || researchMap.get(meta?.research_question_id ?? "")?.text || "";
				return `- ${label} (${slug}) → research_question_id=${meta?.research_question_id ?? "unknown"} :: ${rqText}`;
			})
			.filter(Boolean);
		instructionParts.push(
			`Validation study: treat each research question as a gate. Maintain the mapping below when synthesizing findings. Explicitly note when a gate lacks sufficient evidence or confidence.\n${gateLines.join("\n")}`
		);
	}
	const combinedInstructions = instructionParts.filter(Boolean).join("\n\n");

	const bamlResponse = (await b.LinkEvidenceToResearchStructure(
		evidencePayload,
		questionPayload,
		combinedInstructions
	)) as BamlAnalysisResponse;

	const evidenceResults = bamlResponse.evidence_results ?? [];
	const researchQuestionAnswers = bamlResponse.research_question_answers ?? [];
	const decisionQuestionAnswers = bamlResponse.decision_question_answers ?? [];

	// Build question summaries from the new hierarchical structure
	const questionSummaries: BamlQuestionSummary[] = [
		...researchQuestionAnswers.map((rqa) => ({
			question_id: rqa.research_question_id,
			question_kind: "research" as const,
			decision_question_id: researchMap.get(rqa.research_question_id)?.decision_question_id ?? null,
			confidence: rqa.confidence,
			summary: rqa.findings.join("\n• "),
			goal_achievement_summary: null,
			next_steps: null,
		})),
		...decisionQuestionAnswers.map((dqa) => ({
			question_id: dqa.decision_question_id,
			question_kind: "decision" as const,
			decision_question_id: dqa.decision_question_id,
			confidence: dqa.confidence,
			summary: dqa.strategic_insight,
			goal_achievement_summary: dqa.reasoning,
			next_steps: dqa.recommended_actions.join("\n• "),
		})),
	];

	const { data: runRow, error: runError } = await supabase
		.from(PROJECT_RESEARCH_ANALYSIS_RUNS_TABLE)
		.insert({
			project_id: projectId,
			custom_instructions: customInstructions || null,
			min_confidence: minConfidence,
			run_summary: bamlResponse.global_goal_summary ?? null,
			recommended_actions: (bamlResponse.recommended_actions ?? []).filter(Boolean),
		})
		.select("id")
		.single();

	if (runError || !runRow) throw runError;
	const runId = runRow.id;

	const { data: existingAnswers, error: existingError } = await supabase
		.from("project_answers")
		.select(
			"id, interview_id, research_question_id, decision_question_id, question_text, origin, analysis_run_metadata, analysis_summary, analysis_rationale, analysis_next_steps, answer_text, confidence, respondent_person_id"
		)
		.eq("project_id", projectId);

	if (existingError) throw existingError;

	const existingAnswerMap = new Map<string, ExistingAnswer>();
	for (const answer of existingAnswers ?? []) {
		const questionKind: QuestionKind = answer.research_question_id ? "research" : "decision";
		const key = buildAnswerKey({
			questionKind,
			researchQuestionId: answer.research_question_id,
			decisionQuestionId: answer.decision_question_id,
			interviewId: answer.interview_id,
		});
		existingAnswerMap.set(key, {
			...answer,
			analysis_run_metadata: isObject(answer.analysis_run_metadata)
				? (answer.analysis_run_metadata as Record<string, any>)
				: null,
		});
	}

	const evidenceMap = new Map(evidenceRows.map((row) => [row.id, row]));
	const answerAggregates = new Map<string, EvidenceLinkAggregate>();
	let totalLinksConsidered = 0;
	let totalLinksAccepted = 0;

	for (const result of evidenceResults) {
		const evidenceItem = evidenceMap.get(result.evidence_id);
		if (!evidenceItem) {
			consola.warn("[research-analysis] Skipping link for unknown evidence", result.evidence_id);
			continue;
		}

		for (const link of result.links) {
			const confidence = clampConfidence(link.confidence);
			totalLinksConsidered += 1;
			if (confidence < minConfidence) continue;

			// Evidence should only link to research questions, not decision questions directly
			const questionKind = link.question_kind;
			if (questionKind === "decision") {
				consola.warn("[research-analysis] Evidence linked directly to decision question - skipping", link.question_id);
				continue;
			}
			if (!researchMap.has(link.question_id)) continue;

			const researchQuestionId = link.question_id;
			const decisionQuestionId = researchMap.get(link.question_id)?.decision_question_id ?? null;
			const questionText = researchMap.get(link.question_id)?.text ?? "Untitled research question";
			const personId = evidenceItem.interview_id ? (interviewPersonMap.get(evidenceItem.interview_id) ?? null) : null;

			const aggregateKey = buildAnswerKey({
				questionKind,
				researchQuestionId,
				decisionQuestionId,
				interviewId: evidenceItem.interview_id ?? null,
			});

			if (!answerAggregates.has(aggregateKey)) {
				answerAggregates.set(aggregateKey, {
					key: aggregateKey,
					questionKind,
					researchQuestionId,
					decisionQuestionId,
					interviewId: evidenceItem.interview_id ?? null,
					personId,
					questionText,
					existing: existingAnswerMap.get(aggregateKey),
					evidenceLinks: [],
				});
			}

			const aggregate = answerAggregates.get(aggregateKey)!;
			if (!aggregate.personId && personId) {
				aggregate.personId = personId;
			}

			aggregate.evidenceLinks.push({
				evidenceId: result.evidence_id,
				confidence,
				relationship: link.relationship,
				answerSummary: link.answer_summary,
				rationale: link.rationale,
				nextSteps: link.next_steps,
			});

			totalLinksAccepted += 1;
		}
	}

	const now = new Date().toISOString();
	let answersCreated = 0;
	let answersUpdated = 0;
	const evidenceLinkRows: Array<{
		project_id: string;
		answer_id: string;
		evidence_id: string;
		interview_id: string | null;
		source: string;
		text: string | null;
		payload: Record<string, any>;
	}> = [];

	const primaryAnswerForEvidence = new Map<string, { answerId: string; confidence: number }>();

	for (const aggregate of answerAggregates.values()) {
		const confidenceMax = aggregate.evidenceLinks.reduce((max, link) => Math.max(max, link.confidence), 0);
		const answerSummaries = Array.from(
			new Set(aggregate.evidenceLinks.map((link) => link.answerSummary.trim()).filter(Boolean))
		);
		const rationales = Array.from(
			new Set(aggregate.evidenceLinks.map((link) => link.rationale.trim()).filter(Boolean))
		);
		const nextStepsSet = new Set(
			aggregate.evidenceLinks.map((link) => link.nextSteps?.trim()).filter((step): step is string => Boolean(step))
		);

		const analysisSummary = answerSummaries.map((summary) => `• ${summary}`).join("\n") || null;
		const analysisRationale = rationales.join("\n") || null;
		const analysisNextSteps =
			nextStepsSet.size > 0
				? Array.from(nextStepsSet)
						.map((step) => `• ${step}`)
						.join("\n")
				: null;

		const metadata: Record<string, any> = isObject(aggregate.existing?.analysis_run_metadata)
			? { ...aggregate.existing?.analysis_run_metadata }
			: {};

		const evidenceMetadata = isObject(metadata.evidence_links) ? { ...metadata.evidence_links } : {};

		for (const link of aggregate.evidenceLinks) {
			evidenceMetadata[link.evidenceId] = {
				run_id: runId,
				relationship: link.relationship,
				confidence: link.confidence,
				updated_at: now,
			};
		}

		metadata.last_run_id = runId;
		metadata.updated_at = now;
		metadata.evidence_links = evidenceMetadata;

		const payload = {
			project_id: projectId,
			interview_id: aggregate.interviewId,
			research_question_id: aggregate.researchQuestionId,
			decision_question_id: aggregate.decisionQuestionId,
			question_text: aggregate.existing?.question_text ?? aggregate.questionText,
			status: "answered" as const,
			answered_at: now,
			origin: aggregate.existing?.origin ?? "analysis",
			answer_text: analysisSummary ?? aggregate.existing?.answer_text ?? null,
			analysis_summary: analysisSummary,
			analysis_rationale: analysisRationale ?? aggregate.existing?.analysis_rationale ?? null,
			analysis_next_steps: analysisNextSteps ?? aggregate.existing?.analysis_next_steps ?? null,
			analysis_run_metadata: metadata,
			confidence: confidenceMax,
			respondent_person_id: aggregate.personId ?? aggregate.existing?.respondent_person_id ?? null,
		};

		let answerId = aggregate.existing?.id ?? null;
		const allowAnswerTextUpdate = !aggregate.existing || aggregate.existing.origin === "analysis";

		if (aggregate.existing) {
			const updatePayload = {
				analysis_summary: payload.analysis_summary,
				analysis_rationale: payload.analysis_rationale,
				analysis_next_steps: payload.analysis_next_steps,
				analysis_run_metadata: payload.analysis_run_metadata,
				confidence: payload.confidence,
				answered_at: payload.answered_at,
			} as Record<string, any>;

			if (payload.respondent_person_id && payload.respondent_person_id !== aggregate.existing.respondent_person_id) {
				updatePayload.respondent_person_id = payload.respondent_person_id;
			}

			if (allowAnswerTextUpdate) {
				updatePayload.answer_text = payload.answer_text;
				updatePayload.origin = "analysis";
			}

			const { data: updateResult, error: updateError } = await supabase
				.from("project_answers")
				.update(updatePayload)
				.eq("id", aggregate.existing.id)
				.select("id")
				.single();

			if (updateError) throw updateError;
			answerId = updateResult?.id ?? aggregate.existing.id;
			answersUpdated += 1;
		} else {
			const insertPayload = {
				project_id: payload.project_id,
				interview_id: payload.interview_id,
				question_text: payload.question_text,
				status: payload.status,
				answered_at: payload.answered_at,
				origin: "analysis" as const,
				answer_text: payload.answer_text,
				research_question_id: payload.research_question_id,
				decision_question_id: payload.decision_question_id,
				analysis_summary: payload.analysis_summary,
				analysis_rationale: payload.analysis_rationale,
				analysis_next_steps: payload.analysis_next_steps,
				analysis_run_metadata: payload.analysis_run_metadata,
				confidence: payload.confidence,
				respondent_person_id: payload.respondent_person_id,
			};

			const { data: insertResult, error: insertError } = await supabase
				.from("project_answers")
				.insert(insertPayload)
				.select("id")
				.single();

			if (insertError || !insertResult) throw insertError;
			answerId = insertResult.id;
			answersCreated += 1;

			const newAnswer: ExistingAnswer = {
				id: answerId,
				interview_id: payload.interview_id,
				research_question_id: payload.research_question_id,
				decision_question_id: payload.decision_question_id,
				question_text: payload.question_text,
				origin: "analysis",
				analysis_run_metadata: payload.analysis_run_metadata,
				analysis_summary: payload.analysis_summary,
				analysis_rationale: payload.analysis_rationale,
				analysis_next_steps: payload.analysis_next_steps,
				answer_text: payload.answer_text,
				confidence: payload.confidence,
				respondent_person_id: payload.respondent_person_id,
			};

			existingAnswerMap.set(aggregate.key, newAnswer);
		}

		if (answerId) aggregate.answerId = answerId;

		for (const link of aggregate.evidenceLinks) {
			const evidence = evidenceMap.get(link.evidenceId);
			if (!evidence || !aggregate.answerId) continue;

			evidenceLinkRows.push({
				project_id: projectId,
				answer_id: aggregate.answerId,
				evidence_id: evidence.id,
				interview_id: evidence.interview_id ?? null,
				source: "analysis",
				text: evidence.verbatim ?? null,
				payload: {
					run_id: runId,
					relationship: link.relationship,
					confidence: link.confidence,
					rationale: link.rationale,
					analysis_summary: link.answerSummary,
				},
			});

			const currentBest = primaryAnswerForEvidence.get(evidence.id);
			if (!currentBest || link.confidence > currentBest.confidence) {
				primaryAnswerForEvidence.set(evidence.id, {
					answerId: aggregate.answerId,
					confidence: link.confidence,
				});
			}
		}
	}

	if (evidenceLinkRows.length > 0) {
		const { error: linkError } = await supabase
			.from("project_answer_evidence")
			.upsert(evidenceLinkRows, { onConflict: "project_id,answer_id,evidence_id" });

		if (linkError) throw linkError;
	}

	for (const [evidenceId, best] of primaryAnswerForEvidence.entries()) {
		await supabase.from("evidence").update({ project_answer_id: best.answerId }).eq("id", evidenceId);
	}

	if (questionSummaries.length > 0) {
		const questionRows = questionSummaries.map((summary) => ({
			run_id: runId,
			project_id: projectId,
			question_type: summary.question_kind,
			question_id: summary.question_id,
			summary: summary.summary,
			confidence: clampConfidence(summary.confidence),
			next_steps: summary.next_steps ?? null,
			goal_achievement_summary: summary.goal_achievement_summary ?? null,
		}));

		const { error: questionInsertError } = await supabase.from(PROJECT_QUESTION_ANALYSIS_TABLE).insert(questionRows);

		if (questionInsertError) throw questionInsertError;
	}

	consola.info("[research-analysis] Analysis complete", {
		projectId,
		runId,
		evidenceAnalyzed: evidenceRows.length,
		totalLinksConsidered,
		totalLinksAccepted,
		answersCreated,
		answersUpdated,
	});

	return {
		success: true,
		runId,
		globalGoalSummary: bamlResponse.global_goal_summary ?? null,
		recommendedActions: bamlResponse.recommended_actions ?? [],
		summary: {
			evidenceAnalyzed: evidenceRows.length,
			evidenceLinked: totalLinksAccepted,
			answersCreated,
			answersUpdated,
		},
		questionSummaries,
	};
}
