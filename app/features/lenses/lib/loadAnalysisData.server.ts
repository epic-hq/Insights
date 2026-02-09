/**
 * Server-side loaders for the redesigned Analysis page
 *
 * Loads aggregated data for the Overview, By Person, and By Lens tabs.
 * Efficient: uses batch queries then assembles in JS rather than N+1.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import { type AccountSettingsMetadata, PLATFORM_DEFAULT_LENS_KEYS } from "~/features/opportunities/stage-config";
import type { Database } from "~/types/supabase.types";
import { getImageUrl } from "~/utils/storeImage.server";
import type { LensTemplate } from "./loadLensAnalyses.server";

// ============================================================================
// Types
// ============================================================================

export type AnalysisOverview = {
	interviewCount: number;
	surveyCount: number;
	surveyResponseCount: number;
	peopleCount: number;
	enabledLenses: string[];
	templates: LensTemplate[];
	lensStats: LensStat[];
	crossLensSynthesis: CrossLensSynthesis | null;
};

export type LensStat = {
	templateKey: string;
	templateName: string;
	category: string | null;
	completedCount: number;
	totalInterviews: number;
	synthesis: LensSynthesisSummary | null;
};

export type LensSynthesisSummary = {
	id: string;
	status: string;
	executiveSummary: string | null;
	keyTakeaways: KeyTakeaway[];
	recommendations: string[];
	conflictsToReview: string[];
	overallConfidence: number | null;
	interviewCount: number;
	processedAt: string | null;
};

export type KeyTakeaway = {
	title: string;
	insight: string;
	supporting_interviews: string[];
	confidence: number;
	category: "consensus" | "pattern" | "discrepancy" | "recommendation";
};

export type CrossLensSynthesis = {
	id: string;
	status: string;
	executiveSummary: string | null;
	keyFindings: CrossLensFinding[];
	recommendedActions: RecommendedAction[];
	overallConfidence: number | null;
	processedAt: string | null;
	analysisCount: number;
};

export type CrossLensFinding = {
	title: string;
	description: string;
	severity: "critical" | "important" | "notable";
	peopleCount: number;
	mentionCount: number;
	category: string;
	supportingLenses: string[];
};

export type RecommendedAction = {
	title: string;
	description: string;
	priority: "high" | "medium" | "low";
	category: string;
};

export type PersonAnalysisSummary = {
	id: string;
	name: string;
	firstname: string | null;
	lastname: string | null;
	title: string | null;
	company: string;
	imageUrl: string | null;
	interviewCount: number;
	surveyResponseCount: number;
	keyPains: string[];
	keyGoals: string[];
	sentiment: string | null;
	lensHighlights: PersonLensHighlight[];
	surveyHighlights: string[]; // Top gists from survey evidence
	lastActivityAt: string | null;
};

export type PersonLensHighlight = {
	templateKey: string;
	templateName: string;
	executiveSummary: string | null;
	fields: Array<{ key: string; name: string; value: string }>;
};

// ============================================================================
// Main loader
// ============================================================================

/**
 * Load all data needed for the Analysis page in efficient batch queries
 */
export async function loadAnalysisPageData(
	db: SupabaseClient<Database>,
	projectId: string,
	accountId: string
): Promise<{
	overview: AnalysisOverview;
	people: PersonAnalysisSummary[];
}> {
	// Run all queries in parallel
	const [
		templatesResult,
		enabledLenses,
		interviewCountResult,
		surveyCountResult,
		surveyResponseCountResult,
		peopleResult,
		analysesResult,
		summariesResult,
		crossLensSynthesisResult,
		interviewPeopleResult,
		surveyResponsesByPersonResult,
		surveyEvidenceResult,
	] = await Promise.all([
		// 1. All active lens templates
		db
			.from("conversation_lens_templates")
			.select("*")
			.eq("is_active", true)
			.order("display_order", { ascending: true }),

		// 2. Enabled lenses for this project
		loadEnabledLenses(db, projectId, accountId),

		// 3. Interview count
		db
			.from("interviews")
			.select("id", { count: "exact", head: true })
			.eq("project_id", projectId),

		// 4. Survey count
		db
			.from("research_links")
			.select("id", { count: "exact", head: true })
			.eq("project_id", projectId),

		// 5. Survey response count
		db
			.from("research_link_responses")
			.select("id, research_links!inner(project_id)", {
				count: "exact",
				head: true,
			})
			.eq("research_links.project_id", projectId)
			.eq("completed", true),

		// 6. People in project with basic info
		db
			.from("people")
			.select("id, firstname, lastname, name, title, image_url, created_at, default_organization:organizations!default_organization_id(name)")
			.eq("project_id", projectId)
			.order("created_at", { ascending: false }),

		// 7. All completed analyses for the project
		db
			.from("conversation_lens_analyses")
			.select("id, interview_id, template_key, analysis_data, confidence_score, processed_at")
			.eq("project_id", projectId)
			.eq("status", "completed"),

		// 8. All syntheses for the project
		db
			.from("conversation_lens_summaries")
			.select(
				"id, template_key, status, executive_summary, key_takeaways, recommendations, conflicts_to_review, overall_confidence, interview_count, processed_at"
			)
			.eq("project_id", projectId),

		// 9. Cross-lens synthesis (stored with special template_key)
		db
			.from("conversation_lens_summaries")
			.select(
				"id, status, executive_summary, key_takeaways, recommendations, overall_confidence, interview_count, processed_at"
			)
			.eq("project_id", projectId)
			.eq("template_key", "__cross_lens__")
			.maybeSingle(),

		// 10. Interview-people links for mapping people to interviews
		db
			.from("interview_people")
			.select("person_id, interview_id")
			.eq("project_id", projectId),

		// 11. Survey responses with person_id for counting per person
		db
			.from("research_link_responses")
			.select("id, person_id, research_links!inner(project_id)")
			.eq("research_links.project_id", projectId)
			.eq("completed", true)
			.not("person_id", "is", null),

		// 12. Survey evidence for enriching person data
		db
			.from("evidence")
			.select("id, research_link_response_id, gist, verbatim, pains, gains, feels")
			.eq("project_id", projectId)
			.not("research_link_response_id", "is", null),
	]);

	// Build template map
	const templates: LensTemplate[] = (templatesResult.data || []).map((t) => ({
		template_key: t.template_key,
		template_name: t.template_name,
		summary: t.summary,
		category: t.category,
		display_order: t.display_order ?? 100,
		template_definition: t.template_definition as LensTemplate["template_definition"],
		account_id: t.account_id,
		created_by: t.created_by,
		is_system: t.is_system ?? true,
		is_public: t.is_public ?? true,
		nlp_source: t.nlp_source,
	}));

	const templateMap = new Map(templates.map((t) => [t.template_key, t]));

	// Normalize person avatars:
	// - Convert R2 keys to presigned URLs for rendering
	// - Repair legacy "/a/.../images/..." values
	// - Remove broken image references from DB when assets are missing
	const normalizedPersonImages = await normalizePersonImageUrls(db, peopleResult.data || []);

	// Build synthesis map (per-lens)
	const synthesisMap = new Map<string, LensSynthesisSummary>();
	for (const s of summariesResult.data || []) {
		if (s.template_key === "__cross_lens__") continue;
		synthesisMap.set(s.template_key, {
			id: s.id,
			status: s.status,
			executiveSummary: s.executive_summary,
			keyTakeaways: (s.key_takeaways as KeyTakeaway[]) || [],
			recommendations: (s.recommendations as string[]) || [],
			conflictsToReview: (s.conflicts_to_review as string[]) || [],
			overallConfidence: s.overall_confidence,
			interviewCount: s.interview_count,
			processedAt: s.processed_at,
		});
	}

	// Build analyses by template_key
	const analysesByTemplate = new Map<string, number>();
	const analysesByInterview = new Map<string, Array<{ templateKey: string; data: any }>>();
	for (const a of analysesResult.data || []) {
		analysesByTemplate.set(a.template_key, (analysesByTemplate.get(a.template_key) || 0) + 1);
		if (!analysesByInterview.has(a.interview_id)) {
			analysesByInterview.set(a.interview_id, []);
		}
		analysesByInterview.get(a.interview_id)!.push({
			templateKey: a.template_key,
			data: a.analysis_data,
		});
	}

	// Build interview → people map
	const interviewsByPerson = new Map<string, Set<string>>();
	for (const link of interviewPeopleResult.data || []) {
		if (!interviewsByPerson.has(link.person_id)) {
			interviewsByPerson.set(link.person_id, new Set());
		}
		interviewsByPerson.get(link.person_id)!.add(link.interview_id);
	}

	// Count survey responses per person
	const surveyCountByPerson = new Map<string, number>();
	const surveyResponseIdsByPerson = new Map<string, Set<string>>();
	for (const sr of surveyResponsesByPersonResult.data || []) {
		if (sr.person_id) {
			surveyCountByPerson.set(sr.person_id, (surveyCountByPerson.get(sr.person_id) || 0) + 1);
			if (!surveyResponseIdsByPerson.has(sr.person_id)) {
				surveyResponseIdsByPerson.set(sr.person_id, new Set());
			}
			surveyResponseIdsByPerson.get(sr.person_id)!.add(sr.id);
		}
	}

	// Build survey evidence by response ID for enriching person data
	const evidenceByResponseId = new Map<
		string,
		Array<{
			gist: string | null;
			pains: string[];
			gains: string[];
			feels: string[];
		}>
	>();
	for (const ev of surveyEvidenceResult.data || []) {
		if (ev.research_link_response_id) {
			if (!evidenceByResponseId.has(ev.research_link_response_id)) {
				evidenceByResponseId.set(ev.research_link_response_id, []);
			}
			evidenceByResponseId.get(ev.research_link_response_id)!.push({
				gist: ev.gist,
				pains: ev.pains || [],
				gains: ev.gains || [],
				feels: ev.feels || [],
			});
		}
	}

	// Build lens stats
	const interviewCount = interviewCountResult.count || 0;
	const lensStats: LensStat[] = enabledLenses
		.map((key) => {
			const template = templateMap.get(key);
			if (!template) return null;
			return {
				templateKey: key,
				templateName: template.template_name,
				category: template.category,
				completedCount: analysesByTemplate.get(key) || 0,
				totalInterviews: interviewCount,
				synthesis: synthesisMap.get(key) || null,
			};
		})
		.filter((s): s is LensStat => s !== null);

	// Build cross-lens synthesis
	let crossLensSynthesis: CrossLensSynthesis | null = null;
	const clsData = crossLensSynthesisResult.data;
	if (clsData) {
		crossLensSynthesis = {
			id: clsData.id,
			status: clsData.status,
			executiveSummary: clsData.executive_summary,
			keyFindings: ((clsData.key_takeaways as any[]) || []).map((kt) => ({
				title: kt.title || "",
				description: kt.insight || kt.description || "",
				severity: kt.severity || (kt.confidence > 0.8 ? "critical" : kt.confidence > 0.5 ? "important" : "notable"),
				peopleCount: kt.people_count || kt.supporting_interviews?.length || 0,
				mentionCount: kt.mention_count || 0,
				category: kt.category || "pattern",
				supportingLenses: kt.supporting_lenses || [],
			})),
			recommendedActions: ((clsData.recommendations as any[]) || []).map((r) =>
				typeof r === "string"
					? {
							title: r,
							description: "",
							priority: "medium" as const,
							category: "general",
						}
					: {
							title: r.title || r,
							description: r.description || "",
							priority: r.priority || "medium",
							category: r.category || "general",
						}
			),
			overallConfidence: clsData.overall_confidence,
			processedAt: clsData.processed_at,
			analysisCount: clsData.interview_count,
		};
	}

	// Build people with analysis summaries
	const people: PersonAnalysisSummary[] = (peopleResult.data || []).map((p) => {
		const personInterviews = interviewsByPerson.get(p.id) || new Set();
		const personInterviewCount = personInterviews.size;

		// Gather lens highlights from this person's interviews
		const lensHighlights: PersonLensHighlight[] = [];
		const pains = new Set<string>();
		const goals = new Set<string>();
		let sentiment: string | null = null;
		let lastActivityAt: string | null = null;

		for (const interviewId of personInterviews) {
			const analyses = analysesByInterview.get(interviewId) || [];
			for (const analysis of analyses) {
				const template = templateMap.get(analysis.templateKey);
				if (!template) continue;

				const data = analysis.data as any;
				if (!data) continue;

				// Extract executive_summary if present
				const execSummary = data.executive_summary || null;

				// Extract key fields from sections
				const fields: Array<{ key: string; name: string; value: string }> = [];
				for (const section of data.sections || []) {
					for (const field of section.fields || []) {
						if (field.value && typeof field.value === "string" && field.value.length > 0) {
							const fieldKey = field.field_key || field.key || "";
							const fieldName = field.field_name || field.name || fieldKey;

							// Detect pains and goals from field keys/names
							const lowerKey = fieldKey.toLowerCase();
							const lowerName = fieldName.toLowerCase();
							if (
								lowerKey.includes("pain") ||
								lowerName.includes("pain") ||
								lowerKey.includes("challenge") ||
								lowerName.includes("frustrat")
							) {
								const items = field.value
									.split(/[,;]/)
									.map((s: string) => s.trim())
									.filter(Boolean);
								items.forEach((item: string) => pains.add(item.slice(0, 100)));
							}
							if (
								lowerKey.includes("goal") ||
								lowerName.includes("goal") ||
								lowerKey.includes("desire") ||
								lowerKey.includes("outcome")
							) {
								const items = field.value
									.split(/[,;]/)
									.map((s: string) => s.trim())
									.filter(Boolean);
								items.forEach((item: string) => goals.add(item.slice(0, 100)));
							}
							if (lowerKey.includes("sentiment") || lowerKey.includes("emotion")) {
								sentiment = field.value;
							}

							fields.push({
								key: fieldKey,
								name: fieldName,
								value: field.value,
							});
						}
					}
				}

				if (execSummary || fields.length > 0) {
					lensHighlights.push({
						templateKey: analysis.templateKey,
						templateName: template.template_name,
						executiveSummary: execSummary,
						fields: fields.slice(0, 6), // Limit to 6 key fields
					});
				}

				// Track latest activity
				if (data.processed_at) {
					if (!lastActivityAt || data.processed_at > lastActivityAt) {
						lastActivityAt = data.processed_at;
					}
				}
			}
		}

		// Enrich with survey evidence (pains, gains, feels → sentiment, gists)
		const personSurveyResponses = surveyResponseIdsByPerson.get(p.id) || new Set();
		const surveyGists: string[] = [];
		for (const responseId of personSurveyResponses) {
			const evidenceItems = evidenceByResponseId.get(responseId) || [];
			for (const ev of evidenceItems) {
				// Add pains from survey evidence
				for (const pain of ev.pains) {
					if (pain) pains.add(pain.slice(0, 100));
				}
				// Add gains as goals from survey evidence
				for (const gain of ev.gains) {
					if (gain) goals.add(gain.slice(0, 100));
				}
				// Use feels for sentiment if not already set
				if (!sentiment && ev.feels && ev.feels.length > 0) {
					sentiment = ev.feels.slice(0, 3).join(", ");
				}
				// Collect survey gists for highlights
				if (ev.gist) {
					surveyGists.push(ev.gist);
				}
			}
		}

		return {
			id: p.id,
			name: p.name || [p.firstname, p.lastname].filter(Boolean).join(" ") || "Unnamed",
			firstname: p.firstname,
			lastname: p.lastname,
			title: p.title,
			company: (p as any).default_organization?.name ?? null,
			imageUrl: normalizedPersonImages.get(p.id) ?? null,
			interviewCount: personInterviewCount,
			surveyResponseCount: surveyCountByPerson.get(p.id) || 0,
			keyPains: Array.from(pains).slice(0, 5),
			keyGoals: Array.from(goals).slice(0, 5),
			sentiment,
			lensHighlights: deduplicateHighlights(lensHighlights).slice(0, 4),
			surveyHighlights: surveyGists.slice(0, 3),
			lastActivityAt,
		};
	});

	// Sort people by total activity (interviews + surveys), then by name
	people.sort((a, b) => {
		const aActivity = a.interviewCount + a.surveyResponseCount;
		const bActivity = b.interviewCount + b.surveyResponseCount;
		if (bActivity !== aActivity) return bActivity - aActivity;
		return a.name.localeCompare(b.name);
	});

	const overview: AnalysisOverview = {
		interviewCount,
		surveyCount: surveyCountResult.count || 0,
		surveyResponseCount: surveyResponseCountResult.count || 0,
		peopleCount: people.length,
		enabledLenses,
		templates,
		lensStats,
		crossLensSynthesis,
	};

	return { overview, people };
}

/**
 * Deduplicate lens highlights by template key, keeping the one with more data
 */
function deduplicateHighlights(highlights: PersonLensHighlight[]): PersonLensHighlight[] {
	const byKey = new Map<string, PersonLensHighlight>();
	for (const h of highlights) {
		const existing = byKey.get(h.templateKey);
		if (!existing || h.fields.length > existing.fields.length) {
			byKey.set(h.templateKey, h);
		}
	}
	return Array.from(byKey.values());
}

/**
 * Load enabled lenses using the project → account → platform hierarchy
 */
async function loadEnabledLenses(
	db: SupabaseClient<Database>,
	projectId: string,
	accountId: string
): Promise<string[]> {
	let enabledLenses: string[] = [...PLATFORM_DEFAULT_LENS_KEYS];

	// Account defaults
	const { data: accountSettings } = await db
		.from("account_settings")
		.select("metadata")
		.eq("account_id", accountId)
		.maybeSingle();

	if (accountSettings?.metadata) {
		const metadata = accountSettings.metadata as AccountSettingsMetadata;
		if (Array.isArray(metadata.default_lens_keys) && metadata.default_lens_keys.length > 0) {
			enabledLenses = metadata.default_lens_keys;
		}
	}

	// Project overrides
	const { data: project } = await db.from("projects").select("project_settings").eq("id", projectId).single();

	if (project?.project_settings) {
		const settings = project.project_settings as Record<string, unknown>;
		if (Array.isArray(settings.enabled_lenses) && settings.enabled_lenses.length > 0) {
			enabledLenses = settings.enabled_lenses as string[];
		}
	}

	return enabledLenses;
}

function extractImageKey(rawValue: string): string | null {
	const trimmed = rawValue.trim();
	if (!trimmed) return null;

	if (trimmed.startsWith("images/")) return trimmed;

	const marker = "/images/";
	const markerIndex = trimmed.indexOf(marker);
	if (markerIndex >= 0) {
		return trimmed.slice(markerIndex + 1);
	}

	return null;
}

function isAbsoluteHttpUrl(value: string): boolean {
	return /^https?:\/\//i.test(value);
}

async function resolvePersonImageUrl(
	rawValue: string | null
): Promise<{ url: string | null; normalizedKey: string | null; shouldClear: boolean }> {
	if (!rawValue) {
		return { url: null, normalizedKey: null, shouldClear: false };
	}

	const trimmed = rawValue.trim();
	if (!trimmed) {
		return { url: null, normalizedKey: null, shouldClear: true };
	}

	if (isAbsoluteHttpUrl(trimmed)) {
		return { url: trimmed, normalizedKey: null, shouldClear: false };
	}

	const key = extractImageKey(trimmed);
	if (!key) {
		return { url: null, normalizedKey: null, shouldClear: true };
	}

	const presigned = getImageUrl(key);
	if (!presigned) {
		return { url: null, normalizedKey: key, shouldClear: false };
	}

	const assetExists = await checkR2ImageExists(presigned);
	if (assetExists === false) {
		return { url: null, normalizedKey: key, shouldClear: true };
	}

	// If existence cannot be confirmed, still return the signed URL for best-effort rendering.
	return { url: presigned, normalizedKey: key, shouldClear: false };
}

async function normalizePersonImageUrls(
	db: SupabaseClient<Database>,
	people: Array<{ id: string; image_url: string | null }>
): Promise<Map<string, string | null>> {
	const imageMap = new Map<string, string | null>();
	const idsToClear: string[] = [];
	const keysToRepair: Array<{ id: string; key: string }> = [];

	await Promise.all(
		people.map(async (person) => {
			const original = person.image_url;
			const resolved = await resolvePersonImageUrl(original);
			imageMap.set(person.id, resolved.url);

			if (!original) return;
			if (resolved.shouldClear) {
				idsToClear.push(person.id);
				return;
			}

			if (resolved.normalizedKey && original !== resolved.normalizedKey) {
				keysToRepair.push({ id: person.id, key: resolved.normalizedKey });
			}
		})
	);

	if (idsToClear.length > 0) {
		const { error } = await db.from("people").update({ image_url: null }).in("id", idsToClear);
		if (error) {
			consola.warn("[analysis] Failed to clear broken person image references", error.message);
		}
	}

	if (keysToRepair.length > 0) {
		const repairResults = await Promise.all(
			keysToRepair.map((repair) =>
				db.from("people").update({ image_url: repair.key }).eq("id", repair.id).select("id").single()
			)
		);
		const repairFailures = repairResults.filter((result) => result.error);
		if (repairFailures.length > 0) {
			consola.warn("[analysis] Failed to repair some legacy person image references", {
				count: repairFailures.length,
			});
		}
	}

	return imageMap;
}

async function checkR2ImageExists(presignedUrl: string): Promise<boolean | null> {
	try {
		const response = await fetch(presignedUrl, {
			method: "GET",
			headers: {
				Range: "bytes=0-0",
			},
		});

		if (response.status === 404) return false;
		if (response.ok || response.status === 206 || response.status === 304) return true;

		// Non-404 failures can be transient (network, auth edge cases, etc).
		return null;
	} catch {
		return null;
	}
}
