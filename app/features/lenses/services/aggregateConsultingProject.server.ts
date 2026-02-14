/**
 * Consulting Project Lens Aggregation Service
 *
 * Aggregates Consulting Project lens analyses across all interviews in a project,
 * surfacing alignment, gaps, risks, and commitments across stakeholder conversations.
 *
 * Key aggregations:
 * - Goals alignment across stakeholders
 * - Conflicts and ambiguities to resolve
 * - Risk patterns across interviews
 * - Consolidated next steps and commitments
 */

import consola from "consola";
import type { SupabaseClient } from "~/types";

// ============================================================================
// Types
// ============================================================================

type LensFieldValue = {
	field_key: string;
	value: string;
	confidence: number;
	evidence_ids: string[];
};

type LensSectionResult = {
	section_key: string;
	fields: LensFieldValue[];
};

type LensStakeholderItem = {
	name: string;
	role?: string | null;
	influence?: "low" | "medium" | "high" | null;
	labels?: string[];
	email?: string | null;
	organization?: string | null;
	confidence: number;
	evidence_ids: string[];
	person_id?: string | null;
};

type LensNextStepItem = {
	description: string;
	owner?: string | null;
	due_date?: string | null;
	status?: "pending" | "in_progress" | "completed" | null;
	priority?: "high" | "medium" | "low" | null;
	confidence: number;
	evidence_ids: string[];
	task_id?: string | null;
};

type LensEntityResult = {
	entity_type: "stakeholders" | "next_steps" | "objections" | "other";
	stakeholders?: LensStakeholderItem[];
	next_steps?: LensNextStepItem[];
};

type LensRecommendation = {
	type: string;
	description: string;
	priority: "high" | "medium" | "low";
	rationale?: string | null;
	evidence_ids: string[];
};

type LensHygieneItem = {
	code: string;
	severity: "info" | "warning" | "critical";
	message: string;
	field_key?: string | null;
};

type ConversationLensAnalysisData = {
	sections?: LensSectionResult[];
	entities?: LensEntityResult[];
	recommendations?: LensRecommendation[];
	hygiene?: LensHygieneItem[];
	overall_confidence?: number;
	processing_notes?: string;
};

// ============================================================================
// Output Types
// ============================================================================

export type InterviewWithConsultingAnalysis = {
	interview_id: string;
	interview_title: string;
	interviewee_name: string | null;
	interview_date: string | null;
	analysis_data: ConversationLensAnalysisData;
	confidence_score: number | null;
	processed_at: string | null;
};

export type AggregatedFieldValue = {
	field_key: string;
	field_name: string;
	values: Array<{
		value: string;
		interview_id: string;
		interview_title: string;
		interviewee_name: string | null;
		confidence: number;
	}>;
};

export type AggregatedItem = {
	item: string;
	count: number;
	interviews: Array<{ id: string; title: string; interviewee_name: string | null }>;
};

export type AggregatedStakeholder = {
	name: string;
	role: string | null;
	influence: string | null;
	labels: string[];
	person_id: string | null;
	interview_count: number;
	interviews: Array<{ id: string; title: string; interviewee_name: string | null }>;
};

export type AggregatedNextStep = {
	description: string;
	owner: string | null;
	due_date: string | null;
	status: string | null;
	priority: string | null;
	task_id: string | null;
	interview_id: string;
	interview_title: string;
	interviewee_name: string | null;
};

export type HygieneGap = {
	code: string;
	severity: string;
	message: string;
	count: number;
	interviews: Array<{ id: string; title: string; interviewee_name: string | null }>;
};

export type AggregatedConsultingProject = {
	// Field values by section
	context_brief_fields: AggregatedFieldValue[];
	stakeholder_inputs_fields: AggregatedFieldValue[];
	alignment_gaps_fields: AggregatedFieldValue[];
	plan_milestones_fields: AggregatedFieldValue[];
	risks_mitigations_fields: AggregatedFieldValue[];
	commitments_next_steps_fields: AggregatedFieldValue[];

	// Aggregated patterns
	all_goals: AggregatedItem[];
	all_concerns: AggregatedItem[];
	all_conflicts: AggregatedItem[];
	all_risks: AggregatedItem[];
	all_open_questions: AggregatedItem[];

	// Entities
	stakeholders: AggregatedStakeholder[];
	next_steps: AggregatedNextStep[];

	// Recommendations
	recommendations: Array<{
		type: string;
		description: string;
		priority: string;
		interview_id: string;
		interview_title: string;
		interviewee_name: string | null;
	}>;

	// Hygiene gaps
	hygiene_gaps: HygieneGap[];

	// Source interviews
	interviews: InterviewWithConsultingAnalysis[];

	// Summary stats
	summary: {
		total_interviews: number;
		avg_confidence: number;
		last_updated: string | null;
		fields_captured: number;
		fields_missing: number;
		total_stakeholders: number;
		total_next_steps: number;
		unresolved_conflicts: number;
	};
};

// ============================================================================
// Helpers
// ============================================================================

const FIELD_DISPLAY_NAMES: Record<string, string> = {
	// Context & Brief
	client_problem: "Client Problem",
	stated_goals: "Stated Goals",
	success_measures: "Success Measures",
	scope_boundaries: "Scope Boundaries",
	constraints: "Constraints",
	key_dates: "Key Dates",
	// Stakeholder Inputs
	stakeholder_goals: "Stakeholder Goals",
	expectations: "Expectations",
	concerns: "Concerns",
	decision_criteria: "Decision Criteria",
	success_definition: "What Success Looks Like",
	failure_definition: "What Would Make It Fail",
	// Alignment & Gaps
	agreements: "Agreements",
	conflicts: "Conflicts/Disagreements",
	ambiguities: "Ambiguities",
	dependencies: "Dependencies",
	// Plan & Milestones
	phases: "Phases",
	deliverables: "Deliverables",
	owners: "Owners",
	checkpoints: "Checkpoints/Decision Gates",
	assumptions: "Assumptions",
	// Risks & Mitigations
	scope_risks: "Scope Risks",
	timeline_risks: "Timeline Risks",
	adoption_risks: "Adoption Risks",
	resource_risks: "Resource Risks",
	mitigations: "Mitigations",
	contingency_triggers: "Contingency Triggers",
	// Commitments & Next Steps
	confirmed_expectations: "Confirmed Expectations",
	open_questions: "Open Questions",
	immediate_actions: "Immediate Actions",
	communication_cadence: "Communication Cadence",
};

/**
 * Extract patterns from text array fields
 */
function extractItems(
	values: Array<{ value: string; interview_id: string; interview_title: string; interviewee_name: string | null }>
): AggregatedItem[] {
	const itemMap = new Map<string, AggregatedItem>();

	for (const v of values) {
		// Handle both single values and arrays
		const items = v.value
			.split(/[,\n]/)
			.map((s) => s.trim())
			.filter((s) => s.length > 0);

		for (const item of items) {
			const normalized = item.toLowerCase();
			const existing = itemMap.get(normalized);
			if (existing) {
				existing.count++;
				if (!existing.interviews.find((i) => i.id === v.interview_id)) {
					existing.interviews.push({
						id: v.interview_id,
						title: v.interview_title,
						interviewee_name: v.interviewee_name,
					});
				}
			} else {
				itemMap.set(normalized, {
					item, // Keep original case
					count: 1,
					interviews: [{ id: v.interview_id, title: v.interview_title, interviewee_name: v.interviewee_name }],
				});
			}
		}
	}

	return Array.from(itemMap.values()).sort((a, b) => b.count - a.count);
}

// ============================================================================
// Aggregation Function
// ============================================================================

export async function aggregateConsultingProject(opts: {
	supabase: SupabaseClient;
	projectId: string;
}): Promise<AggregatedConsultingProject> {
	const { supabase, projectId } = opts;

	consola.info(`[aggregateConsultingProject] Starting aggregation for project ${projectId}`);

	// Fetch all people in this project for name matching
	const { data: projectPeople } = await supabase.from("people").select("id, name").eq("project_id", projectId);

	const peopleByName = new Map<string, { id: string; name: string }>();
	for (const person of projectPeople || []) {
		if (person.name) {
			peopleByName.set(person.name.toLowerCase().trim(), { id: person.id, name: person.name });
		}
	}

	// Fetch all completed consulting-project analyses for this project
	const { data: analyses, error: analysesError } = await supabase
		.from("conversation_lens_analyses")
		.select(
			`
			id,
			interview_id,
			analysis_data,
			confidence_score,
			processed_at,
			interviews!inner(
				id,
				title,
				participant_pseudonym,
				interview_date,
				person_id,
				people:person_id(id, name)
			)
		`
		)
		.eq("project_id", projectId)
		.eq("template_key", "consulting-project")
		.eq("status", "completed");

	if (analysesError) {
		consola.error("[aggregateConsultingProject] Error fetching analyses:", analysesError);
		throw analysesError;
	}

	consola.info(`[aggregateConsultingProject] Found ${analyses?.length || 0} completed consulting-project analyses`);

	// Initialize containers
	const contextFieldsMap = new Map<string, AggregatedFieldValue>();
	const stakeholderInputsFieldsMap = new Map<string, AggregatedFieldValue>();
	const alignmentFieldsMap = new Map<string, AggregatedFieldValue>();
	const planFieldsMap = new Map<string, AggregatedFieldValue>();
	const risksFieldsMap = new Map<string, AggregatedFieldValue>();
	const commitmentsFieldsMap = new Map<string, AggregatedFieldValue>();

	const stakeholderMap = new Map<string, AggregatedStakeholder>();
	const nextSteps: AggregatedNextStep[] = [];
	const recommendations: AggregatedConsultingProject["recommendations"] = [];
	const hygieneMap = new Map<string, HygieneGap>();
	const interviews: InterviewWithConsultingAnalysis[] = [];

	// For pattern extraction
	const goalsValues: Array<{
		value: string;
		interview_id: string;
		interview_title: string;
		interviewee_name: string | null;
	}> = [];
	const concernsValues: Array<{
		value: string;
		interview_id: string;
		interview_title: string;
		interviewee_name: string | null;
	}> = [];
	const conflictsValues: Array<{
		value: string;
		interview_id: string;
		interview_title: string;
		interviewee_name: string | null;
	}> = [];
	const risksValues: Array<{
		value: string;
		interview_id: string;
		interview_title: string;
		interviewee_name: string | null;
	}> = [];
	const openQuestionsValues: Array<{
		value: string;
		interview_id: string;
		interview_title: string;
		interviewee_name: string | null;
	}> = [];

	let totalConfidence = 0;
	let confidenceCount = 0;
	let lastUpdated: string | null = null;
	let fieldsCaptured = 0;
	let fieldsMissing = 0;

	// Process each analysis
	for (const analysis of analyses || []) {
		const interview = analysis.interviews as any;
		const data = analysis.analysis_data as ConversationLensAnalysisData;

		if (!data) continue;

		const person = interview?.people as any;
		const intervieweeName = person?.name || interview?.participant_pseudonym || null;

		const interviewInfo = {
			id: analysis.interview_id,
			title: interview?.title || "Untitled",
			interviewee_name: intervieweeName,
		};

		interviews.push({
			interview_id: analysis.interview_id,
			interview_title: interview?.title || "Untitled",
			interviewee_name: intervieweeName,
			interview_date: interview?.interview_date || null,
			analysis_data: data,
			confidence_score: analysis.confidence_score,
			processed_at: analysis.processed_at,
		});

		// Process sections
		for (const section of data.sections || []) {
			let targetMap: Map<string, AggregatedFieldValue>;

			switch (section.section_key) {
				case "context_brief":
					targetMap = contextFieldsMap;
					break;
				case "stakeholder_inputs":
					targetMap = stakeholderInputsFieldsMap;
					break;
				case "alignment_gaps":
					targetMap = alignmentFieldsMap;
					break;
				case "plan_milestones":
					targetMap = planFieldsMap;
					break;
				case "risks_mitigations":
					targetMap = risksFieldsMap;
					break;
				case "commitments_next_steps":
					targetMap = commitmentsFieldsMap;
					break;
				default:
					continue;
			}

			for (const field of section.fields || []) {
				if (!field.value || field.value.trim() === "") {
					fieldsMissing++;
					continue;
				}

				fieldsCaptured++;

				// Collect for pattern extraction
				if (field.field_key === "stated_goals" || field.field_key === "stakeholder_goals") {
					goalsValues.push({
						value: field.value,
						interview_id: analysis.interview_id,
						interview_title: interviewInfo.title,
						interviewee_name: intervieweeName,
					});
				}
				if (field.field_key === "concerns") {
					concernsValues.push({
						value: field.value,
						interview_id: analysis.interview_id,
						interview_title: interviewInfo.title,
						interviewee_name: intervieweeName,
					});
				}
				if (field.field_key === "conflicts") {
					conflictsValues.push({
						value: field.value,
						interview_id: analysis.interview_id,
						interview_title: interviewInfo.title,
						interviewee_name: intervieweeName,
					});
				}
				if (
					field.field_key === "scope_risks" ||
					field.field_key === "timeline_risks" ||
					field.field_key === "adoption_risks" ||
					field.field_key === "resource_risks"
				) {
					risksValues.push({
						value: field.value,
						interview_id: analysis.interview_id,
						interview_title: interviewInfo.title,
						interviewee_name: intervieweeName,
					});
				}
				if (field.field_key === "open_questions") {
					openQuestionsValues.push({
						value: field.value,
						interview_id: analysis.interview_id,
						interview_title: interviewInfo.title,
						interviewee_name: intervieweeName,
					});
				}

				const existing = targetMap.get(field.field_key);
				if (existing) {
					existing.values.push({
						value: field.value,
						interview_id: analysis.interview_id,
						interview_title: interviewInfo.title,
						interviewee_name: intervieweeName,
						confidence: field.confidence,
					});
				} else {
					targetMap.set(field.field_key, {
						field_key: field.field_key,
						field_name: FIELD_DISPLAY_NAMES[field.field_key] || field.field_key,
						values: [
							{
								value: field.value,
								interview_id: analysis.interview_id,
								interview_title: interviewInfo.title,
								interviewee_name: intervieweeName,
								confidence: field.confidence,
							},
						],
					});
				}
			}
		}

		// Process entities
		for (const entity of data.entities || []) {
			if (entity.entity_type === "stakeholders" && entity.stakeholders) {
				for (const stakeholder of entity.stakeholders) {
					const key = stakeholder.name.toLowerCase().trim();
					const existing = stakeholderMap.get(key);
					const matchedPerson = peopleByName.get(key);
					const personId = stakeholder.person_id || matchedPerson?.id || null;

					if (existing) {
						existing.interview_count++;
						existing.interviews.push(interviewInfo);
						for (const label of stakeholder.labels || []) {
							if (!existing.labels.includes(label)) {
								existing.labels.push(label);
							}
						}
						if (!existing.person_id && personId) {
							existing.person_id = personId;
						}
					} else {
						stakeholderMap.set(key, {
							name: stakeholder.name,
							role: stakeholder.role || null,
							influence: stakeholder.influence || null,
							labels: stakeholder.labels || [],
							person_id: personId,
							interview_count: 1,
							interviews: [interviewInfo],
						});
					}
				}
			}

			if (entity.entity_type === "next_steps" && entity.next_steps) {
				for (const step of entity.next_steps) {
					nextSteps.push({
						description: step.description,
						owner: step.owner || null,
						due_date: step.due_date || null,
						status: step.status || null,
						priority: step.priority || null,
						task_id: step.task_id || null,
						interview_id: analysis.interview_id,
						interview_title: interviewInfo.title,
						interviewee_name: intervieweeName,
					});
				}
			}
		}

		// Process recommendations
		for (const rec of data.recommendations || []) {
			recommendations.push({
				type: rec.type,
				description: rec.description,
				priority: rec.priority,
				interview_id: analysis.interview_id,
				interview_title: interviewInfo.title,
				interviewee_name: intervieweeName,
			});
		}

		// Process hygiene gaps
		for (const gap of data.hygiene || []) {
			const existing = hygieneMap.get(gap.code);
			if (existing) {
				existing.count++;
				existing.interviews.push(interviewInfo);
			} else {
				hygieneMap.set(gap.code, {
					code: gap.code,
					severity: gap.severity,
					message: gap.message,
					count: 1,
					interviews: [interviewInfo],
				});
			}
		}

		if (analysis.confidence_score != null) {
			totalConfidence += analysis.confidence_score;
			confidenceCount++;
		}

		if (analysis.processed_at && (!lastUpdated || analysis.processed_at > lastUpdated)) {
			lastUpdated = analysis.processed_at;
		}
	}

	// Convert maps to arrays
	const contextFields = Array.from(contextFieldsMap.values());
	const stakeholderInputsFields = Array.from(stakeholderInputsFieldsMap.values());
	const alignmentFields = Array.from(alignmentFieldsMap.values());
	const planFields = Array.from(planFieldsMap.values());
	const risksFields = Array.from(risksFieldsMap.values());
	const commitmentsFields = Array.from(commitmentsFieldsMap.values());
	const stakeholders = Array.from(stakeholderMap.values()).sort((a, b) => b.interview_count - a.interview_count);
	const hygieneGaps = Array.from(hygieneMap.values()).sort((a, b) => b.count - a.count);

	// Extract patterns
	const allGoals = extractItems(goalsValues);
	const allConcerns = extractItems(concernsValues);
	const allConflicts = extractItems(conflictsValues);
	const allRisks = extractItems(risksValues);
	const allOpenQuestions = extractItems(openQuestionsValues);

	consola.success(
		`[aggregateConsultingProject] Aggregated ${interviews.length} interviews, ` +
			`${stakeholders.length} stakeholders, ${nextSteps.length} next steps, ` +
			`${allConflicts.length} conflicts to resolve`
	);

	return {
		context_brief_fields: contextFields,
		stakeholder_inputs_fields: stakeholderInputsFields,
		alignment_gaps_fields: alignmentFields,
		plan_milestones_fields: planFields,
		risks_mitigations_fields: risksFields,
		commitments_next_steps_fields: commitmentsFields,
		all_goals: allGoals,
		all_concerns: allConcerns,
		all_conflicts: allConflicts,
		all_risks: allRisks,
		all_open_questions: allOpenQuestions,
		stakeholders,
		next_steps: nextSteps,
		recommendations,
		hygiene_gaps: hygieneGaps,
		interviews,
		summary: {
			total_interviews: interviews.length,
			avg_confidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
			last_updated: lastUpdated,
			fields_captured: fieldsCaptured,
			fields_missing: fieldsMissing,
			total_stakeholders: stakeholders.length,
			total_next_steps: nextSteps.length,
			unresolved_conflicts: allConflicts.length,
		},
	};
}
