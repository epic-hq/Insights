/**
 * Customer Discovery Lens Aggregation Service
 *
 * Aggregates Customer Discovery lens analyses across all interviews in a project,
 * providing summary metrics, common patterns, and insights for product development.
 *
 * Expected analysis_data structure (from ConversationLensResult):
 * - sections[]: { section_key, fields[]: { field_key, value, confidence, evidence_ids } }
 * - entities[]: { entity_type, stakeholders[], objections[] }
 * - recommendations[]
 * - hygiene[]
 */

import consola from "consola";
import type { SupabaseClient } from "~/types";

// ============================================================================
// Types matching BAML ConversationLensResult
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

type LensObjectionItem = {
	objection: string;
	type: string;
	status?: "raised" | "addressed" | "unresolved" | null;
	response?: string | null;
	confidence: number;
	evidence_ids: string[];
};

type LensEntityResult = {
	entity_type: "stakeholders" | "next_steps" | "objections" | "other";
	stakeholders?: LensStakeholderItem[];
	objections?: LensObjectionItem[];
};

type LensHygieneItem = {
	code: string;
	severity: "info" | "warning" | "critical";
	message: string;
	field_key?: string | null;
};

type LensRecommendation = {
	type: string;
	description: string;
	priority: "high" | "medium" | "low";
	rationale?: string | null;
	evidence_ids: string[];
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

export type InterviewWithLensAnalysis = {
	interview_id: string;
	interview_title: string;
	interviewee_name: string | null;
	interview_date: string | null;
	organization_name: string | null;
	segment: string | null;
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
		segment: string | null;
		confidence: number;
	}>;
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

export type AggregatedObjection = {
	objection: string;
	type: string;
	status: string | null;
	response: string | null;
	count: number;
	interviews: Array<{ id: string; title: string; interviewee_name: string | null }>;
};

export type HygieneGap = {
	code: string;
	severity: string;
	message: string;
	count: number;
	interviews: Array<{
		id: string;
		title: string;
		interviewee_name: string | null;
		segment: string | null;
	}>;
};

// Aggregated patterns for discovery insights
export type AggregatedPattern = {
	pattern: string;
	count: number;
	interviews: Array<{ id: string; title: string; interviewee_name: string | null }>;
};

export type AggregatedCustomerDiscovery = {
	// Field values by section
	problem_validation_fields: AggregatedFieldValue[];
	solution_validation_fields: AggregatedFieldValue[];
	market_insights_fields: AggregatedFieldValue[];
	// Entities
	stakeholders: AggregatedStakeholder[];
	objections: AggregatedObjection[];
	// Aggregated patterns (common problems, solutions, competitors)
	common_problems: AggregatedPattern[];
	current_solutions: AggregatedPattern[];
	competitive_alternatives: AggregatedPattern[];
	// Recommendations aggregated
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
	interviews: InterviewWithLensAnalysis[];
	// Summary stats
	summary: {
		total_interviews: number;
		avg_confidence: number;
		last_updated: string | null;
		fields_captured: number;
		fields_missing: number;
		unique_segments: string[];
	};
};

// ============================================================================
// Helper to get field display name
// ============================================================================

const FIELD_DISPLAY_NAMES: Record<string, string> = {
	// Problem Validation
	problem_statement: "Primary Problem",
	problem_frequency: "Problem Frequency",
	current_solutions: "Current Solutions",
	pain_severity: "Pain Severity",
	// Solution Validation
	proposed_solution_reaction: "Solution Reaction",
	value_proposition_resonance: "Value Prop Resonance",
	concerns_objections: "Concerns/Objections",
	// Market Insights
	competitive_alternatives: "Competitive Alternatives",
	switching_costs: "Switching Costs",
	willingness_to_pay: "Willingness to Pay",
};

/**
 * Extract patterns from text array fields
 */
function extractPatterns(
	values: Array<{ value: string; interview_id: string; interview_title: string; interviewee_name: string | null }>
): AggregatedPattern[] {
	const patternMap = new Map<string, AggregatedPattern>();

	for (const v of values) {
		// Handle both single values and arrays (text_array fields store as comma-separated or newline-separated)
		const items = v.value
			.split(/[,\n]/)
			.map((s) => s.trim())
			.filter((s) => s.length > 0);

		for (const item of items) {
			const normalized = item.toLowerCase();
			const existing = patternMap.get(normalized);
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
				patternMap.set(normalized, {
					pattern: item, // Keep original case
					count: 1,
					interviews: [{ id: v.interview_id, title: v.interview_title, interviewee_name: v.interviewee_name }],
				});
			}
		}
	}

	return Array.from(patternMap.values()).sort((a, b) => b.count - a.count);
}

// ============================================================================
// Aggregation Function
// ============================================================================

export async function aggregateCustomerDiscovery(opts: {
	supabase: SupabaseClient;
	projectId: string;
}): Promise<AggregatedCustomerDiscovery> {
	const { supabase, projectId } = opts;

	consola.info(`[aggregateCustomerDiscovery] Starting aggregation for project ${projectId}`);

	// Fetch all people in this project for name matching
	const { data: projectPeople } = await supabase.from("people").select("id, name, segment").eq("project_id", projectId);

	// Build a map of lowercase name -> person for quick lookup
	const peopleByName = new Map<string, { id: string; name: string; segment: string | null }>();
	for (const person of projectPeople || []) {
		if (person.name) {
			const key = person.name.toLowerCase().trim();
			peopleByName.set(key, {
				id: person.id,
				name: person.name,
				segment: person.segment,
			});
		}
	}
	consola.info(`[aggregateCustomerDiscovery] Loaded ${peopleByName.size} people for name matching`);

	// Fetch all completed customer-discovery analyses for this project
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
				people:person_id(
					id,
					name,
					segment
				)
			)
		`
		)
		.eq("project_id", projectId)
		.eq("template_key", "customer-discovery")
		.eq("status", "completed");

	if (analysesError) {
		consola.error("[aggregateCustomerDiscovery] Error fetching analyses:", analysesError);
		throw analysesError;
	}

	consola.info(`[aggregateCustomerDiscovery] Found ${analyses?.length || 0} completed customer-discovery analyses`);

	// Initialize aggregation containers
	const problemFieldsMap = new Map<string, AggregatedFieldValue>();
	const solutionFieldsMap = new Map<string, AggregatedFieldValue>();
	const marketFieldsMap = new Map<string, AggregatedFieldValue>();
	const stakeholderMap = new Map<string, AggregatedStakeholder>();
	const objectionMap = new Map<string, AggregatedObjection>();
	const recommendations: AggregatedCustomerDiscovery["recommendations"] = [];
	const hygieneMap = new Map<string, HygieneGap>();
	const interviews: InterviewWithLensAnalysis[] = [];
	const segmentSet = new Set<string>();

	// For pattern extraction
	const problemStatements: Array<{
		value: string;
		interview_id: string;
		interview_title: string;
		interviewee_name: string | null;
	}> = [];
	const currentSolutions: Array<{
		value: string;
		interview_id: string;
		interview_title: string;
		interviewee_name: string | null;
	}> = [];
	const competitiveAlternatives: Array<{
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

		// Get person info
		const person = interview?.people as any;
		const intervieweeName = person?.name || interview?.participant_pseudonym || null;
		const segment = person?.segment || null;

		if (segment) {
			segmentSet.add(segment);
		}

		const interviewInfo = {
			id: analysis.interview_id,
			title: interview?.title || "Untitled",
			interviewee_name: intervieweeName,
			segment,
		};

		// Track interview
		interviews.push({
			interview_id: analysis.interview_id,
			interview_title: interview?.title || "Untitled",
			interviewee_name: intervieweeName,
			interview_date: interview?.interview_date || null,
			organization_name: null,
			segment,
			analysis_data: data,
			confidence_score: analysis.confidence_score,
			processed_at: analysis.processed_at,
		});

		// Process sections
		for (const section of data.sections || []) {
			let targetMap: Map<string, AggregatedFieldValue>;

			if (section.section_key === "problem_validation") {
				targetMap = problemFieldsMap;
			} else if (section.section_key === "solution_validation") {
				targetMap = solutionFieldsMap;
			} else if (section.section_key === "market_insights") {
				targetMap = marketFieldsMap;
			} else {
				continue;
			}

			for (const field of section.fields || []) {
				if (!field.value || field.value.trim() === "") {
					fieldsMissing++;
					continue;
				}

				fieldsCaptured++;

				// Collect for pattern extraction
				if (field.field_key === "problem_statement") {
					problemStatements.push({
						value: field.value,
						interview_id: analysis.interview_id,
						interview_title: interviewInfo.title,
						interviewee_name: intervieweeName,
					});
				} else if (field.field_key === "current_solutions") {
					currentSolutions.push({
						value: field.value,
						interview_id: analysis.interview_id,
						interview_title: interviewInfo.title,
						interviewee_name: intervieweeName,
					});
				} else if (field.field_key === "competitive_alternatives") {
					competitiveAlternatives.push({
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
						segment,
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
								segment,
								confidence: field.confidence,
							},
						],
					});
				}
			}
		}

		// Process entities
		for (const entity of data.entities || []) {
			// Stakeholders
			if (entity.entity_type === "stakeholders" && entity.stakeholders) {
				for (const stakeholder of entity.stakeholders) {
					const key = stakeholder.name.toLowerCase().trim();
					const existing = stakeholderMap.get(key);

					// Try to find matching person in project
					const matchedPerson = peopleByName.get(key);
					const personId = stakeholder.person_id || matchedPerson?.id || null;

					if (existing) {
						existing.interview_count++;
						existing.interviews.push(interviewInfo);
						// Merge labels
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

			// Objections
			if (entity.entity_type === "objections" && entity.objections) {
				for (const objection of entity.objections) {
					const key = objection.objection.toLowerCase().trim();
					const existing = objectionMap.get(key);
					if (existing) {
						existing.count++;
						existing.interviews.push(interviewInfo);
					} else {
						objectionMap.set(key, {
							objection: objection.objection,
							type: objection.type,
							status: objection.status || null,
							response: objection.response || null,
							count: 1,
							interviews: [interviewInfo],
						});
					}
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

		// Confidence tracking
		if (analysis.confidence_score != null) {
			totalConfidence += analysis.confidence_score;
			confidenceCount++;
		}

		// Last updated tracking
		if (analysis.processed_at && (!lastUpdated || analysis.processed_at > lastUpdated)) {
			lastUpdated = analysis.processed_at;
		}
	}

	// Convert maps to sorted arrays
	const problemFields = Array.from(problemFieldsMap.values());
	const solutionFields = Array.from(solutionFieldsMap.values());
	const marketFields = Array.from(marketFieldsMap.values());
	const stakeholders = Array.from(stakeholderMap.values()).sort((a, b) => b.interview_count - a.interview_count);
	const objections = Array.from(objectionMap.values()).sort((a, b) => b.count - a.count);
	const hygieneGaps = Array.from(hygieneMap.values()).sort((a, b) => b.count - a.count);

	// Extract patterns
	const commonProblems = extractPatterns(problemStatements);
	const commonSolutions = extractPatterns(currentSolutions);
	const commonCompetitors = extractPatterns(competitiveAlternatives);

	consola.success(
		`[aggregateCustomerDiscovery] Aggregated ${interviews.length} interviews, ` +
			`${stakeholders.length} stakeholders, ${objections.length} objections, ` +
			`${commonProblems.length} problem patterns`
	);

	return {
		problem_validation_fields: problemFields,
		solution_validation_fields: solutionFields,
		market_insights_fields: marketFields,
		stakeholders,
		objections,
		common_problems: commonProblems,
		current_solutions: commonSolutions,
		competitive_alternatives: commonCompetitors,
		recommendations,
		hygiene_gaps: hygieneGaps,
		interviews,
		summary: {
			total_interviews: interviews.length,
			avg_confidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
			last_updated: lastUpdated,
			fields_captured: fieldsCaptured,
			fields_missing: fieldsMissing,
			unique_segments: Array.from(segmentSet),
		},
	};
}
