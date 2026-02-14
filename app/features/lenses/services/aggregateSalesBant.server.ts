/**
 * Sales BANT Lens Aggregation Service
 *
 * Aggregates Sales BANT lens analyses across all interviews in a project,
 * providing summary metrics, common patterns, and insights.
 *
 * Expected analysis_data structure (from ConversationLensResult):
 * - sections[]: { section_key, fields[]: { field_key, value, confidence, evidence_ids } }
 * - entities[]: { entity_type, stakeholders[], next_steps[], objections[] }
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
	next_steps?: LensNextStepItem[];
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
		organization_id: string | null;
		organization_name: string | null;
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
	interviews: Array<{ id: string; title: string; organization_name: string | null }>;
};

export type AggregatedObjection = {
	objection: string;
	type: string;
	status: string | null;
	count: number;
	interviews: Array<{ id: string; title: string; organization_name: string | null }>;
};

export type AggregatedNextStep = {
	description: string;
	owner: string | null;
	priority: string | null;
	status: string | null;
	task_id: string | null;
	interview_id: string;
	interview_title: string;
	organization_name: string | null;
};

export type HygieneGap = {
	code: string;
	severity: string;
	message: string;
	count: number;
	interviews: Array<{
		id: string;
		title: string;
		organization_id: string | null;
		organization_name: string | null;
	}>;
};

export type AggregatedSalesBant = {
	// BANT field values aggregated
	bant_fields: AggregatedFieldValue[];
	opportunity_fields: AggregatedFieldValue[];
	// Entities
	stakeholders: AggregatedStakeholder[];
	next_steps: AggregatedNextStep[];
	objections: AggregatedObjection[];
	// Recommendations aggregated
	recommendations: Array<{
		type: string;
		description: string;
		priority: string;
		interview_id: string;
		interview_title: string;
		organization_name: string | null;
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
	};
};

// ============================================================================
// Helper to get field display name
// ============================================================================

const FIELD_DISPLAY_NAMES: Record<string, string> = {
	budget: "Budget",
	authority: "Authority",
	need: "Need",
	timeline: "Timeline",
	deal_size: "Deal Size",
	competition: "Competition",
	success_criteria: "Success Criteria",
	blockers: "Blockers/Risks",
};

/**
 * Extract organization info from interview people relationships
 * Tries multiple paths:
 * 1. interview_people -> people -> organizations (linked stakeholders)
 * 2. person_id -> people -> organizations (direct person link)
 */
function extractOrganizationInfo(interview: any): { id: string | null; name: string | null } {
	// Path 1: Try interview_people -> people -> organizations
	const interviewPeople = interview?.interview_people as any[] | null;
	if (interviewPeople?.length) {
		for (const ip of interviewPeople) {
			const org = ip?.people?.organizations;
			if (org?.id && org?.name) return { id: org.id, name: org.name };
		}
	}

	// Path 2: Try direct person link -> organization
	const directPerson = interview?.people;
	if (directPerson?.organizations?.id && directPerson?.organizations?.name) {
		return { id: directPerson.organizations.id, name: directPerson.organizations.name };
	}

	return { id: null, name: null };
}

/**
 * Extract organization name from stakeholders in the analysis data
 * Used as fallback when interview doesn't have linked people with organizations
 */
function extractOrgFromAnalysisStakeholders(analysisData: ConversationLensAnalysisData): string | null {
	const entities = analysisData?.entities || [];
	for (const entity of entities) {
		if (entity.entity_type === "stakeholders" && entity.stakeholders) {
			for (const stakeholder of entity.stakeholders) {
				if (stakeholder.organization) {
					return stakeholder.organization;
				}
			}
		}
	}
	return null;
}

// ============================================================================
// Aggregation Function
// ============================================================================

export async function aggregateSalesBant(opts: {
	supabase: SupabaseClient;
	projectId: string;
}): Promise<AggregatedSalesBant> {
	const { supabase, projectId } = opts;

	consola.info(`[aggregateSalesBant] Starting aggregation for project ${projectId}`);

	// Fetch all people in this project for name matching
	const { data: projectPeople } = await supabase
		.from("people")
		.select("id, name, default_organization_id, organizations:default_organization_id(id, name)")
		.eq("project_id", projectId);

	// Build a map of lowercase name -> person for quick lookup
	const peopleByName = new Map<string, { id: string; name: string; org_id: string | null; org_name: string | null }>();
	for (const person of projectPeople || []) {
		if (person.name) {
			const key = person.name.toLowerCase().trim();
			const org = person.organizations as any;
			peopleByName.set(key, {
				id: person.id,
				name: person.name,
				org_id: org?.id || null,
				org_name: org?.name || null,
			});
		}
	}
	consola.info(`[aggregateSalesBant] Loaded ${peopleByName.size} people for name matching`);

	// Fetch all organizations in this project for name -> ID lookup
	const { data: projectOrgs } = await supabase.from("organizations").select("id, name").eq("project_id", projectId);

	// Build a map of lowercase org name -> org for quick lookup
	const orgsByName = new Map<string, { id: string; name: string }>();
	for (const org of projectOrgs || []) {
		if (org.name) {
			const key = org.name.toLowerCase().trim();
			orgsByName.set(key, { id: org.id, name: org.name });
		}
	}
	consola.info(`[aggregateSalesBant] Loaded ${orgsByName.size} organizations for name matching`);

	// Fetch all completed sales-bant analyses for this project
	// Include organization through multiple paths:
	// 1. interview_people -> people -> organizations (linked stakeholders)
	// 2. person_id -> people -> organizations (direct person link)
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
					default_organization_id,
					organizations:default_organization_id(
						id,
						name
					)
				),
				interview_people(
					people(
						default_organization_id,
						organizations:default_organization_id(
							id,
							name
						)
					)
				)
			)
		`
		)
		.eq("project_id", projectId)
		.eq("template_key", "sales-bant")
		.eq("status", "completed");

	if (analysesError) {
		consola.error("[aggregateSalesBant] Error fetching analyses:", analysesError);
		throw analysesError;
	}

	consola.info(`[aggregateSalesBant] Found ${analyses?.length || 0} completed sales-bant analyses`);

	// Initialize aggregation containers
	const bantFieldsMap = new Map<string, AggregatedFieldValue>();
	const opportunityFieldsMap = new Map<string, AggregatedFieldValue>();
	const stakeholderMap = new Map<string, AggregatedStakeholder>();
	const objectionMap = new Map<string, AggregatedObjection>();
	const nextSteps: AggregatedNextStep[] = [];
	const recommendations: AggregatedSalesBant["recommendations"] = [];
	const hygieneMap = new Map<string, HygieneGap>();
	const interviews: InterviewWithLensAnalysis[] = [];

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

		// Try to get organization from interview's linked people
		const orgInfo = extractOrganizationInfo(interview);

		// Fallback: If no org from interview, try to get from stakeholders in the analysis
		let orgName = orgInfo.name;
		let orgId = orgInfo.id;
		if (!orgName) {
			orgName = extractOrgFromAnalysisStakeholders(data);
		}

		// If we have org name but no ID, try to look up the ID from project orgs
		if (orgName && !orgId) {
			const matchedOrg = orgsByName.get(orgName.toLowerCase().trim());
			if (matchedOrg) {
				orgId = matchedOrg.id;
			}
		}

		const interviewInfo = {
			id: analysis.interview_id,
			title: interview?.title || "Untitled",
			organization_id: orgId,
			organization_name: orgName,
		};

		// Track interview
		interviews.push({
			interview_id: analysis.interview_id,
			interview_title: interview?.title || "Untitled",
			interviewee_name: interview?.participant_pseudonym || null,
			interview_date: interview?.interview_date || null,
			organization_name: orgName,
			analysis_data: data,
			confidence_score: analysis.confidence_score,
			processed_at: analysis.processed_at,
		});

		// Process sections (BANT fields)
		for (const section of data.sections || []) {
			const isBANT = section.section_key === "bant";
			const targetMap = isBANT ? bantFieldsMap : opportunityFieldsMap;

			for (const field of section.fields || []) {
				if (!field.value || field.value.trim() === "") {
					fieldsMissing++;
					continue;
				}

				fieldsCaptured++;
				const existing = targetMap.get(field.field_key);
				if (existing) {
					existing.values.push({
						value: field.value,
						interview_id: analysis.interview_id,
						interview_title: interviewInfo.title,
						organization_id: orgId,
						organization_name: orgName,
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
								organization_id: orgId,
								organization_name: orgName,
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
						// Keep the person_id if we found one
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

			// Next Steps
			if (entity.entity_type === "next_steps" && entity.next_steps) {
				for (const step of entity.next_steps) {
					nextSteps.push({
						description: step.description,
						owner: step.owner || null,
						priority: step.priority || null,
						status: step.status || null,
						task_id: step.task_id || null,
						interview_id: analysis.interview_id,
						interview_title: interviewInfo.title,
						organization_name: orgInfo.name,
					});
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
				organization_name: orgInfo.name,
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
	const bantFields = Array.from(bantFieldsMap.values());
	const opportunityFields = Array.from(opportunityFieldsMap.values());
	const stakeholders = Array.from(stakeholderMap.values()).sort((a, b) => b.interview_count - a.interview_count);
	const objections = Array.from(objectionMap.values()).sort((a, b) => b.count - a.count);
	const hygieneGaps = Array.from(hygieneMap.values()).sort((a, b) => b.count - a.count);

	consola.success(
		`[aggregateSalesBant] Aggregated ${interviews.length} interviews, ` +
			`${stakeholders.length} stakeholders, ${objections.length} objections`
	);

	return {
		bant_fields: bantFields,
		opportunity_fields: opportunityFields,
		stakeholders,
		next_steps: nextSteps,
		objections,
		recommendations,
		hygiene_gaps: hygieneGaps,
		interviews,
		summary: {
			total_interviews: interviews.length,
			avg_confidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
			last_updated: lastUpdated,
			fields_captured: fieldsCaptured,
			fields_missing: fieldsMissing,
		},
	};
}
