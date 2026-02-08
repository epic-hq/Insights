import { createTool } from "@mastra/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import { z } from "zod";
import { supabaseAdmin } from "~/lib/supabase/client.server";
import { HOST } from "~/paths";
import type { Database } from "~/types";
import { getProjectStatusData } from "~/utils/project-status.server";
import { createRouteDefinitions } from "~/utils/route-definitions";

const DEFAULT_INSIGHT_LIMIT = 8;
const DEFAULT_EVIDENCE_LIMIT = 24;
const DEFAULT_PERSON_LIMIT = 12;
const DEFAULT_PERSONA_LIMIT = 8;
const DEFAULT_THEME_LIMIT = 12;
const DEFAULT_INTERVIEW_LIMIT = 12;
const DEFAULT_PERSON_EVIDENCE_LIMIT = 5;

const detailScopes = [
	"status",
	"sections",
	"insights",
	"evidence",
	"themes",
	"people",
	"personas",
	"interviews",
] as const;

type DetailScope = (typeof detailScopes)[number];

type ProjectSectionRow = Database["public"]["Tables"]["project_sections"]["Row"];
type InsightRow = Database["public"]["Tables"]["themes"]["Row"];
type EvidenceRow = Database["public"]["Tables"]["evidence"]["Row"];
type ThemeRow = Database["public"]["Tables"]["themes"]["Row"];
type ThemeEvidenceRow = Database["public"]["Tables"]["theme_evidence"]["Row"] & {
	evidence?: Pick<
		EvidenceRow,
		"id" | "gist" | "context_summary" | "verbatim" | "modality" | "created_at" | "interview_id"
	> | null;
};
type ProjectPeopleRow = Database["public"]["Tables"]["project_people"]["Row"] & {
	person?:
		| (Database["public"]["Tables"]["people"]["Row"] & {
				people_personas?: Array<{
					persona_id: string | null;
					personas?: Database["public"]["Tables"]["personas"]["Row"] | null;
				}> | null;
		  })
		| null;
};
type PersonaRow = Database["public"]["Tables"]["personas"]["Row"];
type PeoplePersonaRow = Database["public"]["Tables"]["people_personas"]["Row"] & {
	people?: Pick<Database["public"]["Tables"]["people"]["Row"], "id" | "name" | "segment" | "role"> | null;
};
type PersonaInsightsRow = Database["public"]["Tables"]["persona_insights"]["Row"];
type InterviewRow = Database["public"]["Tables"]["interviews"]["Row"] & {
	insights?: Array<{ id: string | null }> | null;
	evidence?: Array<{ id: string | null }> | null;
};
type InterviewPeopleRow = Database["public"]["Tables"]["interview_people"]["Row"] & {
	interview?: Pick<
		Database["public"]["Tables"]["interviews"]["Row"],
		"id" | "title" | "interview_date" | "status"
	> | null;
};

function normalizeDate(value: unknown) {
	if (!value) return null;
	if (value instanceof Date) return value.toISOString();
	if (typeof value === "string") return value;
	return null;
}

function toStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	const cleaned = value
		.map((item) => (typeof item === "string" ? item.trim() : ""))
		.filter((item): item is string => Boolean(item));
	return Array.from(new Set(cleaned));
}

const projectStatusSchema = z.object({
	projectName: z.string(),
	icp: z.string(),
	totalInterviews: z.number(),
	totalInsights: z.number(),
	totalPersonas: z.number(),
	totalThemes: z.number(),
	totalEvidence: z.number(),
	answeredQuestions: z.array(z.string()),
	openQuestions: z.array(z.string()),
	keyInsights: z.array(z.string()),
	completionScore: z.number(),
	lastUpdated: z.string().nullable(),
	analysisId: z.string().nullable().optional(),
	hasAnalysis: z.boolean(),
	nextSteps: z.array(z.string()),
	nextAction: z.string().nullable().optional(),
	keyDiscoveries: z.array(z.string()),
	confidenceScore: z.number().nullable().optional(),
	confidenceLevel: z.number().nullable().optional(),
	followUpRecommendations: z.array(z.string()),
	suggestedInterviewTopics: z.array(z.string()),
	answeredInsights: z.array(z.string()),
	unanticipatedDiscoveries: z.array(z.string()),
	criticalUnknowns: z.array(z.string()),
	questionAnswers: z.array(
		z.object({
			question: z.string(),
			answer_summary: z.string().nullable().optional(),
			evidence: z.array(z.string()).optional(),
			confidence: z.number().optional(),
			insights_found: z.array(z.string()).optional(),
			related_insight_ids: z.array(z.string()).optional(),
		})
	),
});

const sectionSchema = z.object({
	id: z.string(),
	kind: z.string(),
	content_md: z.string(),
	meta: z.unknown().nullable(),
	position: z.number().nullable(),
	created_at: z.string().nullable(),
	updated_at: z.string().nullable(),
});

const insightSchema = z.object({
	id: z.string(),
	name: z.string(),
	details: z.string().nullable(),
	category: z.string().nullable(),
	pain: z.string().nullable(),
	desired_outcome: z.string().nullable(),
	journey_stage: z.string().nullable(),
	emotional_response: z.string().nullable(),
	confidence: z.string().nullable(),
	impact: z.number().nullable(),
	novelty: z.number().nullable(),
	opportunity_ideas: z.array(z.string()).optional(),
	related_tags: z.array(z.string()).optional(),
	tags: z.array(z.string()).optional(),
	vote_count: z.number().nullable().optional(),
	priority: z.number().nullable().optional(),
	interview_id: z.string().nullable(),
	project_id: z.string().nullable(),
	created_at: z.string().nullable(),
	updated_at: z.string().nullable(),
	url: z.string().nullable(),
});

const evidenceSchema = z.object({
	id: z.string(),
	gist: z.string().nullable(),
	verbatim: z.string().nullable(),
	context_summary: z.string().nullable(),
	modality: z.string().nullable(),
	journey_stage: z.string().nullable(),
	topic: z.string().nullable(),
	support: z.string().nullable(),
	is_question: z.boolean().nullable(),
	interview_id: z.string().nullable(),
	project_id: z.string().nullable(),
	created_at: z.string().nullable(),
	updated_at: z.string().nullable(),
	says: z.array(z.string()).optional(),
	does: z.array(z.string()).optional(),
	thinks: z.array(z.string()).optional(),
	feels: z.array(z.string()).optional(),
	pains: z.array(z.string()).optional(),
	gains: z.array(z.string()).optional(),
	anchors: z.unknown().optional(),
	url: z.string().nullable(),
});

const themeSchema = z.object({
	id: z.string(),
	name: z.string(),
	statement: z.string().nullable(),
	inclusion_criteria: z.string().nullable(),
	exclusion_criteria: z.string().nullable(),
	synonyms: z.array(z.string()).optional(),
	anti_examples: z.array(z.string()).optional(),
	created_at: z.string().nullable(),
	updated_at: z.string().nullable(),
	evidenceCount: z.number().optional(),
	evidence: z
		.array(
			z.object({
				id: z.string(),
				gist: z.string().nullable(),
				context_summary: z.string().nullable(),
				verbatim: z.string().nullable(),
				modality: z.string().nullable(),
				created_at: z.string().nullable(),
				interview_id: z.string().nullable(),
				confidence: z.number().nullable(),
				rationale: z.string().nullable(),
			})
		)
		.optional(),
	url: z.string().nullable(),
});

const personEvidenceSchema = z.object({
	id: z.string(),
	gist: z.string().nullable(),
	verbatim: z.string().nullable(),
	context_summary: z.string().nullable(),
	modality: z.string().nullable(),
	created_at: z.string().nullable(),
	interview_id: z.string().nullable(),
	interviewTitle: z.string().nullable(),
	interviewDate: z.string().nullable(),
	interviewStatus: z.string().nullable(),
});

const personSchema = z.object({
	personId: z.string(),
	name: z.string().nullable(),
	segment: z.string().nullable(),
	role: z.string().nullable(),
	title: z.string().nullable(),
	company: z.string().nullable(),
	description: z.string().nullable(),
	location: z.string().nullable(),
	image_url: z.string().nullable(),
	firstSeenAt: z.string().nullable(),
	lastSeenAt: z.string().nullable(),
	interviewCount: z.number().nullable(),
	personas: z
		.array(
			z.object({
				id: z.string(),
				name: z.string().nullable(),
				color_hex: z.string().nullable(),
			})
		)
		.optional(),
	contactInfo: z.unknown().nullable().optional(),
	interviews: z
		.array(
			z.object({
				id: z.string(),
				title: z.string().nullable(),
				interview_date: z.string().nullable(),
				status: z.string().nullable(),
				evidenceCount: z.number(),
			})
		)
		.optional(),
	evidence: z.array(personEvidenceSchema).optional(),
	icpMatch: z
		.object({
			band: z.string().nullable(),
			score: z.number().nullable(),
			confidence: z.number().nullable(),
		})
		.nullable()
		.optional(),
	url: z.string().nullable(),
});

const personaSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	segment: z.string().nullable(),
	goals: z.array(z.string()).optional(),
	pains: z.array(z.string()).optional(),
	motivations: z.array(z.string()).optional(),
	roles: z.array(z.string()).optional(),
	values: z.array(z.string()).optional(),
	tags: z.array(z.string()).optional(),
	percentage: z.number().nullable(),
	primary_goal: z.string().nullable(),
	secondary_goals: z.array(z.string()).optional(),
	quotes: z.array(z.string()).optional(),
	color_hex: z.string().nullable(),
	behaviors: z.array(z.string()).optional(),
	differentiators: z.array(z.string()).optional(),
	frustrations: z.array(z.string()).optional(),
	tools_used: z.array(z.string()).optional(),
	sources: z.array(z.string()).optional(),
	created_at: z.string().nullable(),
	updated_at: z.string().nullable(),
	linkedInsights: z.array(z.string()).optional(),
	linkedPeople: z
		.array(
			z.object({
				id: z.string(),
				name: z.string().nullable(),
				segment: z.string().nullable(),
				role: z.string().nullable(),
			})
		)
		.optional(),
	url: z.string().nullable(),
});

const interviewSchema = z.object({
	id: z.string(),
	title: z.string().nullable(),
	participant_pseudonym: z.string().nullable(),
	segment: z.string().nullable(),
	status: z.string().nullable(),
	interview_date: z.string().nullable(),
	created_at: z.string().nullable(),
	updated_at: z.string().nullable(),
	evidenceCount: z.number(),
	insightCount: z.number(),
	url: z.string().nullable(),
});

type ProjectStatusPayload = z.infer<typeof projectStatusSchema>;
type SectionPayload = z.infer<typeof sectionSchema>;
type InsightPayload = z.infer<typeof insightSchema>;
type EvidencePayload = z.infer<typeof evidenceSchema>;
type ThemePayload = z.infer<typeof themeSchema>;
type PersonPayload = z.infer<typeof personSchema>;
type PersonEvidencePayload = z.infer<typeof personEvidenceSchema>;
type PersonaPayload = z.infer<typeof personaSchema>;
type InterviewPayload = z.infer<typeof interviewSchema>;

interface AccountContext {
	website_url?: string | null;
	company_description?: string | null;
	customer_problem?: string | null;
	offerings?: string[] | null;
	target_orgs?: string[] | null;
	target_roles?: string[] | null;
	competitors?: string[] | null;
	industry?: string | null;
}

interface IcpSummary {
	scored: number;
	total: number;
	distribution: {
		HIGH: number;
		MEDIUM: number;
		LOW: number;
		unscored: number;
	};
	missingDataCount: number;
}

interface ToolData {
	accountContext?: AccountContext;
	status?: ProjectStatusPayload;
	sections?: SectionPayload[];
	insights?: InsightPayload[];
	evidence?: EvidencePayload[];
	themes?: ThemePayload[];
	people?: PersonPayload[];
	personas?: PersonaPayload[];
	interviews?: InterviewPayload[];
	icpSummary?: IcpSummary;
}

export const fetchProjectStatusContextTool = createTool({
	id: "fetch-project-status-context",
	description:
		"Load project status context, including research sections, insights, evidence, people, and personas for accessible projects.",
	inputSchema: z.object({
		projectId: z.string().nullish().describe("Project ID to load. Defaults to the current project in context."),
		scopes: z.array(z.enum(detailScopes)).nullish().describe("Optional list of data groups to fetch."),
		insightLimit: z.number().int().min(1).max(50).nullish().describe("Maximum number of insights to return."),
		evidenceLimit: z.number().int().min(1).max(50).nullish().describe("Maximum number of evidence items to return."),
		themeLimit: z.number().int().min(1).max(50).nullish().describe("Maximum number of themes to return."),
		peopleLimit: z.number().int().min(1).max(100).nullish().describe("Maximum number of people to return."),
		personaLimit: z.number().int().min(1).max(50).nullish().describe("Maximum number of personas to return."),
		interviewLimit: z.number().int().min(1).max(100).nullish().describe("Maximum number of interviews to return."),
		peopleSearch: z
			.string()
			.nullish()
			.describe("Optional case-insensitive search string to match people by name or display name."),
		includePersonEvidence: z
			.boolean()
			.nullish()
			.describe("When true, include recent evidence snippets linked to the matched people."),
		personEvidenceLimit: z
			.number()
			.int()
			.min(1)
			.max(50)
			.nullish()
			.describe("Maximum number of evidence snippets to include per person when includePersonEvidence is true."),
		includeEvidence: z
			.boolean()
			.nullish()
			.describe("Set to false to omit detailed evidence and focus on higher-level insights and personas."),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		projectId: z.string().nullable().optional(),
		projectName: z.string().nullable().optional(),
		scopes: z.array(z.enum(detailScopes)),
		data: z
			.object({
				accountContext: z
					.object({
						website_url: z.string().nullable().optional(),
						company_description: z.string().nullable().optional(),
						customer_problem: z.string().nullable().optional(),
						offerings: z.array(z.string()).nullable().optional(),
						target_orgs: z.array(z.string()).nullable().optional(),
						target_roles: z.array(z.string()).nullable().optional(),
						competitors: z.array(z.string()).nullable().optional(),
						industry: z.string().nullable().optional(),
					})
					.optional(),
				status: projectStatusSchema.optional(),
				sections: z.array(sectionSchema).optional(),
				insights: z.array(insightSchema).optional(),
				evidence: z.array(evidenceSchema).optional(),
				themes: z.array(themeSchema).optional(),
				people: z.array(personSchema).optional(),
				personas: z.array(personaSchema).optional(),
				interviews: z.array(interviewSchema).optional(),
				icpSummary: z
					.object({
						scored: z.number(),
						total: z.number(),
						distribution: z.object({
							HIGH: z.number(),
							MEDIUM: z.number(),
							LOW: z.number(),
							unscored: z.number(),
						}),
						missingDataCount: z.number(),
					})
					.optional(),
			})
			.optional(),
	}),
	execute: async (input, context?) => {
		const supabase = supabaseAdmin as SupabaseClient<Database>;
		const runtimeProjectId = context?.requestContext?.get?.("project_id");
		const runtimeAccountId = context?.requestContext?.get?.("account_id");

		const projectId = (input.projectId ?? runtimeProjectId ?? "").trim();
		const runtimeAccountIdString = runtimeAccountId ? String(runtimeAccountId).trim() : undefined;
		const includeEvidence = input.includeEvidence !== false;
		const scopes = (input.scopes && input.scopes.length > 0 ? input.scopes : detailScopes) as DetailScope[];
		const scopeSet = new Set<DetailScope>(scopes);

		const insightLimit = input.insightLimit ?? DEFAULT_INSIGHT_LIMIT;
		const evidenceLimit = input.evidenceLimit ?? DEFAULT_EVIDENCE_LIMIT;
		const themeLimit = input.themeLimit ?? DEFAULT_THEME_LIMIT;
		const peopleLimit = input.peopleLimit ?? DEFAULT_PERSON_LIMIT;
		const personaLimit = input.personaLimit ?? DEFAULT_PERSONA_LIMIT;
		const interviewLimit = input.interviewLimit ?? DEFAULT_INTERVIEW_LIMIT;
		const personSearch = (input.peopleSearch ?? "").trim();
		const sanitizedPersonSearch = personSearch.replace(/[%*"'()]/g, "").trim();
		const includePersonEvidence = input.includePersonEvidence ?? sanitizedPersonSearch.length > 0;
		const personEvidenceLimit = input.personEvidenceLimit ?? DEFAULT_PERSON_EVIDENCE_LIMIT;

		consola.debug("fetch-project-status-context: execute start", {
			projectId,
			accountId: runtimeAccountIdString,
			scopes,
			includeEvidence,
			insightLimit,
			evidenceLimit,
			themeLimit,
			peopleLimit,
			personaLimit,
			interviewLimit,
			peopleSearch: sanitizedPersonSearch,
			includePersonEvidence,
			personEvidenceLimit,
		});

		if (!projectId) {
			consola.warn("fetch-project-status-context: missing projectId", {
				inputProjectId: input.projectId,
				runtimeProjectId,
			});
			return {
				success: false,
				message:
					"Missing projectId. Pass one explicitly or ensure the runtime context sets project_id before calling this tool.",
				projectId: null,
				projectName: null,
				scopes,
			};
		}

		try {
			const { data: project, error: projectError } = await supabase
				.from("projects")
				.select("id, account_id, name, description, created_at, updated_at")
				.eq("id", projectId)
				.maybeSingle();

			// Fetch account context for AI operations
			let accountContext: {
				website_url?: string | null;
				company_description?: string | null;
				customer_problem?: string | null;
				offerings?: string[] | null;
				target_orgs?: string[] | null;
				target_roles?: string[] | null;
				competitors?: string[] | null;
				industry?: string | null;
			} | null = null;

			if (project?.account_id) {
				const { data: account } = await supabase
					.schema("accounts")
					.from("accounts")
					.select(
						"website_url, company_description, customer_problem, offerings, target_orgs, target_roles, competitors, industry"
					)
					.eq("id", project.account_id)
					.maybeSingle();

				if (account) {
					accountContext = account;
				}
			}

			if (projectError) {
				consola.error("fetch-project-status-context: failed to load project metadata", projectError);
				return {
					success: false,
					message: "Failed to load project metadata.",
					projectId,
					projectName: null,
					scopes,
				};
			}

			if (!project) {
				consola.warn("fetch-project-status-context: project not found", {
					projectId,
				});
				return {
					success: false,
					message: `No project found for id ${projectId}.`,
					projectId,
					projectName: null,
					scopes,
				};
			}

			const resolvedAccountId = runtimeAccountIdString || project.account_id || undefined;

			if (runtimeAccountIdString && project.account_id && project.account_id !== runtimeAccountIdString) {
				consola.debug("fetch-project-status-context: runtime account differs from project account", {
					expectedAccountId: runtimeAccountIdString,
					projectAccountId: project.account_id,
				});
			}

			if (!runtimeAccountIdString && project.account_id) {
				consola.debug("fetch-project-status-context: using project.account_id as fallback for routes", {
					accountId: project.account_id,
				});
			}

			// Generate route definitions for URL generation
			const projectPath = resolvedAccountId && projectId ? `/a/${resolvedAccountId}/${projectId}` : "";
			const routes = createRouteDefinitions(projectPath);

			const data: ToolData = {};
			const scopeErrors: string[] = [];

			// Add account context if available
			if (accountContext) {
				data.accountContext = accountContext;
			}

			if (scopeSet.has("status")) {
				try {
					const status = await getProjectStatusData(projectId, supabase);
					if (status) {
						const serialized: ProjectStatusPayload = {
							...status,
							lastUpdated: normalizeDate(status.lastUpdated),
							analysisId: status.analysisId ?? null,
							nextAction: status.nextAction ?? null,
							confidenceScore: status.confidenceScore ?? null,
							confidenceLevel: status.confidenceLevel ?? null,
							questionAnswers: status.questionAnswers ?? [],
						};
						data.status = serialized;
					}
				} catch (error) {
					consola.error("fetch-project-status-context: failed to load status scope", error);
					scopeErrors.push("status");
				}
			}

			if (scopeSet.has("sections")) {
				try {
					const { data: sections, error } = await supabase
						.from("project_sections")
						.select("id, kind, content_md, meta, position, created_at, updated_at")
						.eq("project_id", projectId)
						.order("position", { ascending: true, nullsFirst: false })
						.order("updated_at", { ascending: false });

					if (error) throw error;

					const serialized: SectionPayload[] =
						sections?.map((section: ProjectSectionRow) => ({
							id: section.id,
							kind: section.kind,
							content_md: section.content_md,
							meta: section.meta ?? null,
							position: section.position ?? null,
							created_at: normalizeDate(section.created_at),
							updated_at: normalizeDate(section.updated_at),
						})) ?? [];

					data.sections = serialized;
				} catch (error) {
					consola.error("fetch-project-status-context: failed to load sections scope", error);
					scopeErrors.push("sections");
				}
			}

			if (scopeSet.has("insights")) {
				try {
					const { data: insights, error } = await supabase
						.from("themes")
						.select(
							"id, name, details, category, pain, desired_outcome, journey_stage, emotional_response, confidence, impact, novelty, opportunity_ideas, related_tags, interview_id, project_id, created_at, updated_at"
						)
						.eq("project_id", projectId)
						.order("updated_at", { ascending: false })
						.limit(insightLimit);

					if (error) throw error;

					const insightIds = insights?.map((insight) => insight.id) || [];
					const priorityMap = new Map<string, number>();
					if (insightIds.length) {
						const { data: priorityRows } = await supabase
							.from("insights_with_priority")
							.select("id, priority")
							.in("id", insightIds);
						priorityRows?.forEach((row) => priorityMap.set(row.id, row.priority ?? 0));
					}
					const { data: tagsRows } =
						insightIds.length > 0
							? await supabase.from("insight_tags").select("insight_id, tags(tag)").in("insight_id", insightIds)
							: { data: [], error: null };

					const tagsMap = new Map<string, string[]>();
					(tagsRows || []).forEach((row) => {
						if (!row.insight_id || !row.tags?.tag) return;
						tagsMap.set(row.insight_id, [...(tagsMap.get(row.insight_id) || []), row.tags.tag]);
					});

					const serialized: InsightPayload[] =
						insights?.map((insight: InsightRow) => {
							const tags = Array.from(new Set(tagsMap.get(insight.id) || []));
							return {
								id: insight.id,
								name: insight.name,
								details: insight.details ?? null,
								category: insight.category ?? null,
								pain: insight.pain ?? null,
								desired_outcome: insight.desired_outcome ?? null,
								journey_stage: insight.journey_stage ?? null,
								emotional_response: insight.emotional_response ?? null,
								confidence: insight.confidence ?? null,
								impact: insight.impact ?? null,
								novelty: insight.novelty ?? null,
								opportunity_ideas: Array.isArray(insight.opportunity_ideas)
									? insight.opportunity_ideas.filter((item): item is string => typeof item === "string")
									: undefined,
								related_tags: Array.isArray(insight.related_tags)
									? insight.related_tags.filter((item): item is string => typeof item === "string")
									: undefined,
								tags,
								vote_count: priorityMap.get(insight.id) ?? null,
								priority: priorityMap.get(insight.id) ?? null,
								interview_id: insight.interview_id,
								project_id: insight.project_id,
								created_at: normalizeDate(insight.created_at),
								updated_at: normalizeDate(insight.updated_at),
								url: projectPath ? `${HOST}${routes.insights.detail(insight.id)}` : null,
							};
						}) ?? [];

					data.insights = serialized;
				} catch (error) {
					consola.error("fetch-project-status-context: failed to load insights scope", error);
					scopeErrors.push("insights");
				}
			}

			if (scopeSet.has("evidence")) {
				if (!includeEvidence) {
					consola.debug("fetch-project-status-context: evidence scope skipped due to includeEvidence=false");
					data.evidence = [];
				} else {
					try {
						const { data: evidence, error } = await supabase
							.from("evidence")
							.select(
								"id, gist, verbatim, context_summary, modality, journey_stage, topic, support, is_question, interview_id, project_id, created_at, updated_at, says, does, thinks, feels, pains, gains, anchors"
							)
							.eq("project_id", projectId)
							.order("created_at", { ascending: false })
							.limit(evidenceLimit);

						if (error) throw error;

						const serialized: EvidencePayload[] =
							evidence?.map((item: EvidenceRow) => ({
								id: item.id,
								gist: item.gist ?? null,
								verbatim: item.verbatim ?? null,
								context_summary: item.context_summary ?? null,
								modality: item.modality ?? null,
								journey_stage: item.journey_stage ?? null,
								topic: item.topic ?? null,
								support: item.support ?? null,
								is_question: item.is_question ?? null,
								interview_id: item.interview_id,
								project_id: item.project_id,
								created_at: normalizeDate(item.created_at),
								updated_at: normalizeDate(item.updated_at),
								says: toStringArray(item.says),
								does: toStringArray(item.does),
								thinks: toStringArray(item.thinks),
								feels: toStringArray(item.feels),
								pains: toStringArray(item.pains),
								gains: toStringArray(item.gains),
								anchors: item.anchors ?? undefined,
								url: projectPath ? `${HOST}${routes.evidence.detail(item.id)}` : null,
							})) ?? [];

						data.evidence = serialized;
					} catch (error) {
						consola.error("fetch-project-status-context: failed to load evidence scope", error);
						scopeErrors.push("evidence");
					}
				}
			}

			if (scopeSet.has("themes")) {
				try {
					const { data: themes, error } = await supabase
						.from("themes")
						.select(
							"id, name, statement, inclusion_criteria, exclusion_criteria, synonyms, anti_examples, created_at, updated_at"
						)
						.eq("project_id", projectId)
						.order("updated_at", { ascending: false })
						.limit(themeLimit);

					if (error) throw error;

					const themeRows: ThemeRow[] = themes ?? [];
					const themeIds = themeRows.map((theme) => theme.id);
					const themeEvidenceMap = new Map<string, ThemePayload["evidence"]>();
					const themeEvidenceCount = new Map<string, number>();

					if (includeEvidence && themeIds.length > 0) {
						const { data: themeEvidence, error: themeEvidenceError } = await supabase
							.from("theme_evidence")
							.select(
								"theme_id, confidence, rationale, evidence:evidence_id(id, gist, context_summary, verbatim, modality, created_at, interview_id)"
							)
							.in("theme_id", themeIds);

						if (themeEvidenceError) {
							consola.warn("fetch-project-status-context: failed to load theme evidence details", themeEvidenceError);
						} else {
							const evidenceRows = themeEvidence as ThemeEvidenceRow[];
							for (const row of evidenceRows) {
								const evidence = row.evidence;
								if (!evidence) continue;
								const entry = {
									id: evidence.id,
									gist: evidence.gist ?? null,
									context_summary: evidence.context_summary ?? null,
									verbatim: evidence.verbatim ?? null,
									modality: evidence.modality ?? null,
									created_at: normalizeDate(evidence.created_at),
									interview_id: evidence.interview_id,
									confidence: row.confidence ?? null,
									rationale: row.rationale ?? null,
								};
								const existing = themeEvidenceMap.get(row.theme_id) ?? [];
								if (existing.length < evidenceLimit) {
									existing.push(entry);
									themeEvidenceMap.set(row.theme_id, existing);
								}
								themeEvidenceCount.set(row.theme_id, (themeEvidenceCount.get(row.theme_id) ?? 0) + 1);
							}
						}
					} else if (!includeEvidence) {
						consola.debug("fetch-project-status-context: skipping theme evidence details due to includeEvidence=false");
					}

					const serialized: ThemePayload[] = themeRows.map((theme) => ({
						id: theme.id,
						name: theme.name,
						statement: theme.statement ?? null,
						inclusion_criteria: theme.inclusion_criteria ?? null,
						exclusion_criteria: theme.exclusion_criteria ?? null,
						synonyms: toStringArray(theme.synonyms),
						anti_examples: toStringArray(theme.anti_examples),
						created_at: normalizeDate(theme.created_at),
						updated_at: normalizeDate(theme.updated_at),
						evidenceCount: themeEvidenceCount.get(theme.id),
						evidence: themeEvidenceMap.get(theme.id),
						url: projectPath ? `${HOST}${routes.themes.detail(theme.id)}` : null,
					}));

					data.themes = serialized;
				} catch (error) {
					consola.error("fetch-project-status-context: failed to load themes scope", error);
					scopeErrors.push("themes");
				}
			}

			if (scopeSet.has("people")) {
				try {
					let peopleQuery = supabase
						.from("project_people")
						.select(
							"id, person_id, role, interview_count, first_seen_at, last_seen_at, created_at, updated_at, person:person_id(id, name, segment, role, title, company, description, location, image_url, contact_info, people_personas(persona_id, personas(id, name, color_hex)))"
						)
						.eq("project_id", projectId);

					if (sanitizedPersonSearch) {
						const pattern = `*${sanitizedPersonSearch}*`;
						const orConditions = [`person.name.ilike.${pattern}`, `role.ilike.${pattern}`];
						peopleQuery = peopleQuery.or(orConditions.join(","));
					}

					const { data: projectPeople, error } = await peopleQuery
						.order("interview_count", { ascending: false, nullsFirst: false })
						.limit(peopleLimit);

					if (error) throw error;

					const peopleRows = (projectPeople as ProjectPeopleRow[] | null) ?? [];
					const personIds = peopleRows
						.map((row) => row.person?.id ?? row.person_id)
						.filter((id): id is string => Boolean(id));

					// Fetch ICP scores for all people in one query
					const { data: icpScores } =
						personIds.length > 0
							? await supabase
									.from("person_scale")
									.select("person_id, score, band, confidence")
									.eq("project_id", projectId)
									.eq("kind_slug", "icp_match")
									.in("person_id", personIds)
							: { data: null };

					const icpByPerson = new Map((icpScores ?? []).map((s) => [s.person_id, s]));

					const interviewPeopleMap = new Map<string, InterviewPeopleRow[]>();
					const interviewIds = new Set<string>();

					if (personIds.length > 0) {
						const { data: interviewPeople, error: interviewPeopleError } = await supabase
							.from("interview_people")
							.select("person_id, interview_id, interview:interview_id(id, title, interview_date, status)")
							.eq("project_id", projectId)
							.in("person_id", personIds)
							.order("created_at", { ascending: false });

						if (interviewPeopleError) {
							consola.warn(
								"fetch-project-status-context: failed to load interview_people for people scope",
								interviewPeopleError
							);
						} else {
							for (const row of (interviewPeople as InterviewPeopleRow[] | null) ?? []) {
								const existing = interviewPeopleMap.get(row.person_id) ?? [];
								existing.push(row);
								interviewPeopleMap.set(row.person_id, existing);
								const targetInterviewId = row.interview_id ?? row.interview?.id;
								if (targetInterviewId) {
									interviewIds.add(targetInterviewId);
								}
							}
						}
					}

					const evidenceByInterview = new Map<string, EvidenceRow[]>();

					if (includePersonEvidence && interviewIds.size > 0) {
						const totalEvidenceLimit = personEvidenceLimit * Math.max(peopleRows.length, 1);
						const { data: evidenceRows, error: evidenceError } = await supabase
							.from("evidence")
							.select("id, gist, verbatim, context_summary, modality, created_at, interview_id")
							.eq("project_id", projectId)
							.in("interview_id", Array.from(interviewIds))
							.order("created_at", { ascending: false })
							.limit(totalEvidenceLimit);

						if (evidenceError) {
							consola.warn("fetch-project-status-context: failed to load evidence for people scope", evidenceError);
						} else {
							for (const evidence of (evidenceRows as EvidenceRow[] | null) ?? []) {
								if (!evidence.interview_id) continue;
								const existing = evidenceByInterview.get(evidence.interview_id) ?? [];
								existing.push(evidence);
								evidenceByInterview.set(evidence.interview_id, existing);
							}
						}
					}

					const serialized: PersonPayload[] = peopleRows.map((row) => {
						const person = row.person;
						const personas =
							person?.people_personas
								?.map((entry) => entry?.personas)
								.filter((persona): persona is Database["public"]["Tables"]["personas"]["Row"] => Boolean(persona))
								.map((persona) => ({
									id: persona.id,
									name: persona.name ?? null,
									color_hex: (persona as { color_hex?: string | null })?.color_hex ?? null,
								})) ?? [];

						const personId = person?.id ?? row.person_id;
						const interviewsForPerson = (interviewPeopleMap.get(personId) ?? [])
							.map((entry) => {
								const interviewId = entry.interview_id ?? entry.interview?.id;
								if (!interviewId) return null;
								const interviewDate = normalizeDate(entry.interview?.interview_date);
								const evidenceGroup = evidenceByInterview.get(interviewId) ?? [];
								return {
									id: interviewId,
									title: entry.interview?.title ?? null,
									interview_date: interviewDate,
									status: entry.interview?.status ?? null,
									evidenceCount: evidenceGroup.length,
								};
							})
							.filter(
								(
									entry
								): entry is {
									id: string;
									title: string | null;
									interview_date: string | null;
									status: string | null;
									evidenceCount: number;
								} => Boolean(entry)
							);

						let evidenceSnippets: PersonEvidencePayload[] | undefined;
						if (includePersonEvidence && interviewsForPerson.length > 0) {
							const collected: PersonEvidencePayload[] = [];
							for (const interview of interviewsForPerson) {
								const evidenceGroup = evidenceByInterview.get(interview.id) ?? [];
								for (const snippet of evidenceGroup) {
									if (collected.length >= personEvidenceLimit) break;
									collected.push({
										id: snippet.id,
										gist: snippet.gist ?? null,
										verbatim: snippet.verbatim ?? null,
										context_summary: snippet.context_summary ?? null,
										modality: snippet.modality ?? null,
										created_at: normalizeDate(snippet.created_at),
										interview_id: snippet.interview_id,
										interviewTitle: interview.title ?? null,
										interviewDate: interview.interview_date ?? null,
										interviewStatus: interview.status ?? null,
									});
								}
								if (collected.length >= personEvidenceLimit) break;
							}
							if (collected.length > 0) {
								evidenceSnippets = collected;
							}
						}

						return {
							personId,
							name: person?.name ?? null,
							segment: person?.segment ?? null,
							role: row.role ?? person?.role ?? null,
							title: (person as { title?: string | null })?.title ?? null,
							company: (person as { company?: string | null })?.company ?? null,
							description: person?.description ?? null,
							location: person?.location ?? null,
							image_url: person?.image_url ?? null,
							firstSeenAt: normalizeDate(row.first_seen_at),
							lastSeenAt: normalizeDate(row.last_seen_at),
							interviewCount: row.interview_count ?? null,
							personas,
							contactInfo: person?.contact_info ?? null,
							interviews: interviewsForPerson.length > 0 ? interviewsForPerson : undefined,
							evidence: evidenceSnippets,
							icpMatch: icpByPerson.get(personId)
								? {
										band: icpByPerson.get(personId)!.band,
										score: icpByPerson.get(personId)!.score,
										confidence: icpByPerson.get(personId)!.confidence,
									}
								: null,
							url: projectPath ? `${HOST}${routes.people.detail(personId)}` : null,
						};
					});

					data.people = serialized;

					// Build ICP summary for the people scope
					const missingDataCount = serialized.filter((p) => !p.title || !p.company).length;
					data.icpSummary = {
						scored: icpScores?.length ?? 0,
						total: personIds.length,
						distribution: {
							HIGH: icpScores?.filter((s) => s.band === "HIGH").length ?? 0,
							MEDIUM: icpScores?.filter((s) => s.band === "MEDIUM").length ?? 0,
							LOW: icpScores?.filter((s) => s.band === "LOW").length ?? 0,
							unscored: personIds.length - (icpScores?.length ?? 0),
						},
						missingDataCount,
					};
				} catch (error) {
					consola.error("fetch-project-status-context: failed to load people scope", error);
					scopeErrors.push("people");
				}
			}

			if (scopeSet.has("personas")) {
				try {
					const { data: personas, error } = await supabase
						.from("personas")
						.select(
							"id, name, description, segment, goals, pains, motivations, roles, values, tags, percentage, primary_goal, secondary_goals, quotes, color_hex, behaviors, differentiators, frustrations, tools_used, sources, created_at, updated_at"
						)
						.eq("project_id", projectId)
						.order("percentage", { ascending: false, nullsFirst: false })
						.limit(personaLimit);

					if (error) throw error;

					const personaRows: PersonaRow[] = personas ?? [];
					const personaIds = personaRows.map((persona) => persona.id);
					const personaInsightMap = new Map<string, Set<string>>();
					const personaPeopleMap = new Map<
						string,
						Array<{
							id: string;
							name: string | null;
							segment: string | null;
							role: string | null;
						}>
					>();

					if (personaIds.length > 0) {
						const [personaInsightsResult, personaPeopleResult] = await Promise.all([
							supabase.from("persona_insights").select("persona_id, insight_id").in("persona_id", personaIds),
							supabase
								.from("people_personas")
								.select("persona_id, people:person_id(id, name, segment, role)")
								.in("persona_id", personaIds),
						]);

						if (!personaInsightsResult.error) {
							for (const row of (personaInsightsResult.data ?? []) as PersonaInsightsRow[]) {
								if (!row.persona_id || !row.insight_id) continue;
								const insights = personaInsightMap.get(row.persona_id) ?? new Set<string>();
								insights.add(row.insight_id);
								personaInsightMap.set(row.persona_id, insights);
							}
						} else {
							consola.warn(
								"fetch-project-status-context: failed to load persona_insights",
								personaInsightsResult.error
							);
						}

						if (!personaPeopleResult.error) {
							for (const row of (personaPeopleResult.data ?? []) as PeoplePersonaRow[]) {
								if (!row.persona_id) continue;
								const person = row.people;
								if (!person) continue;
								const existing = personaPeopleMap.get(row.persona_id) ?? [];
								if (!existing.some((entry) => entry.id === person.id)) {
									existing.push({
										id: person.id,
										name: person.name ?? null,
										segment: person.segment ?? null,
										role: person.role ?? null,
									});
									personaPeopleMap.set(row.persona_id, existing);
								}
							}
						} else {
							consola.warn("fetch-project-status-context: failed to load people_personas", personaPeopleResult.error);
						}
					}

					const serialized: PersonaPayload[] = personaRows.map((persona) => ({
						id: persona.id,
						name: persona.name,
						description: persona.description ?? null,
						segment: persona.segment ?? null,
						goals: toStringArray(persona.goals),
						pains: toStringArray(persona.pains),
						motivations: toStringArray(persona.motivations),
						roles: toStringArray(persona.roles),
						values: toStringArray(persona.values),
						tags: toStringArray(persona.tags),
						percentage: persona.percentage ?? null,
						primary_goal: persona.primary_goal ?? null,
						secondary_goals: toStringArray(persona.secondary_goals),
						quotes: toStringArray(persona.quotes),
						color_hex: persona.color_hex ?? null,
						behaviors: toStringArray(persona.behaviors),
						differentiators: toStringArray(persona.differentiators),
						frustrations: toStringArray(persona.frustrations),
						tools_used: toStringArray(persona.tools_used),
						sources: toStringArray(persona.sources),
						created_at: normalizeDate(persona.created_at),
						updated_at: normalizeDate(persona.updated_at),
						linkedInsights: personaInsightMap.has(persona.id)
							? Array.from(personaInsightMap.get(persona.id) ?? [])
							: undefined,
						linkedPeople: personaPeopleMap.has(persona.id)
							? personaPeopleMap.get(persona.id)?.slice(0, peopleLimit)
							: undefined,
						url: projectPath ? `${HOST}${routes.personas.detail(persona.id)}` : null,
					}));

					data.personas = serialized;
				} catch (error) {
					consola.error("fetch-project-status-context: failed to load personas scope", error);
					scopeErrors.push("personas");
				}
			}

			if (scopeSet.has("interviews")) {
				try {
					const { data: interviews, error } = await supabase
						.from("interviews")
						.select("id, title, participant_pseudonym, segment, status, interview_date, created_at, updated_at")
						.eq("project_id", projectId)
						.order("interview_date", { ascending: false, nullsFirst: false })
						.order("created_at", { ascending: false })
						.limit(interviewLimit);

					if (error) throw error;

					const interviewIds = interviews?.map((i) => i.id) || [];
					const [evidenceRows, insightRows] = interviewIds.length
						? await Promise.all([
								supabase.from("evidence").select("id, interview_id").in("interview_id", interviewIds),
								supabase.from("themes").select("id, interview_id").in("interview_id", interviewIds),
							])
						: [
								{ data: [], error: null },
								{ data: [], error: null },
							];

					const evidenceMap = new Map<string, number>();
					evidenceRows?.data?.forEach((row) => {
						if (!row.interview_id) return;
						evidenceMap.set(row.interview_id, (evidenceMap.get(row.interview_id) || 0) + 1);
					});

					const insightMap = new Map<string, number>();
					insightRows?.data?.forEach((row) => {
						if (!row.interview_id) return;
						insightMap.set(row.interview_id, (insightMap.get(row.interview_id) || 0) + 1);
					});

					const serialized: InterviewPayload[] =
						(interviews as InterviewRow[] | null)?.map((interview) => ({
							id: interview.id,
							title: interview.title ?? null,
							participant_pseudonym: interview.participant_pseudonym ?? null,
							segment: interview.segment ?? null,
							status: interview.status ?? null,
							interview_date: normalizeDate(interview.interview_date),
							created_at: normalizeDate(interview.created_at),
							updated_at: normalizeDate(interview.updated_at),
							evidenceCount: evidenceMap.get(interview.id) ?? 0,
							insightCount: insightMap.get(interview.id) ?? 0,
							url: projectPath ? `${HOST}${routes.interviews.detail(interview.id)}` : null,
						})) ?? [];

					data.interviews = serialized;
				} catch (error) {
					consola.error("fetch-project-status-context: failed to load interviews scope", error);
					scopeErrors.push("interviews");
				}
			}

			const loadedScopes = Object.keys(data) as DetailScope[];
			const missingScopes = scopes.filter((scope) => !loadedScopes.includes(scope));

			let message = `Loaded project status context for ${project.name}.`;
			if (missingScopes.length > 0) {
				message += ` Missing scopes: ${missingScopes.join(", ")}.`;
			}
			if (scopeErrors.length > 0) {
				message += ` Failed scopes: ${scopeErrors.join(", ")}.`;
			}
			if (!includeEvidence && scopeSet.has("evidence")) {
				message += " Evidence details omitted by includeEvidence=false.";
			}
			if (!includePersonEvidence && scopeSet.has("people")) {
				message += " Person evidence omitted by includePersonEvidence=false.";
			}

			return {
				success: true,
				message,
				projectId: project.id,
				projectName: project.name,
				scopes,
				data,
			};
		} catch (error) {
			consola.error("fetch-project-status-context: unexpected error", error);
			return {
				success: false,
				message: "Unexpected error loading project context.",
				projectId,
				projectName: null,
				scopes,
			};
		}
	},
});
