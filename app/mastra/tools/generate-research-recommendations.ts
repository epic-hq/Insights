/**
 * Cross-lens recommendation engine for research follow-ups.
 * Synthesizes data from multiple lenses to generate prioritized, actionable recommendations.
 *
 * North Star: Close the loop from evidence → insights → confidence → recommendation → action → verification
 *
 * This tool reads from:
 * - Research Coverage data (question coverage, participant coverage, staleness)
 * - ICP Match scores (person_scale)
 * - Value Priorities (themes with confidence)
 * - Existing project context
 *
 * And generates cross-lens synthesized recommendations like:
 * "Your 'Pricing' insight has HIGH confidence but only from Enterprise segment -
 *  interview 3 more SMB users to validate pricing doesn't vary by segment."
 */

import { createTool } from "@mastra/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import { z } from "zod";

const RecommendationSchema = z.object({
	id: z.string(),
	priority: z.number().describe("1 = highest priority"),
	category: z.enum(["research_coverage", "icp_validation", "insight_validation", "follow_up"]),
	title: z.string().describe("Short action-oriented title"),
	description: z.string().describe("Detailed explanation of what to do"),
	reasoning: z.string().describe("Why this recommendation is important, with evidence context"),
	confidence_current: z.number().nullish().describe("Current confidence score 0-1"),
	confidence_target: z.number().nullish().describe("Target confidence score 0-1"),
	evidence_refs: z
		.array(
			z.object({
				interview_id: z.string(),
				evidence_id: z.string().nullish(),
				quote_snippet: z.string().nullish(),
				timestamp: z.string().nullish(),
			})
		)
		.nullish()
		.describe("Supporting evidence with traceability"),
	action_type: z.enum(["schedule_interview", "create_survey", "validate_theme", "follow_up_contact", "review_data"]),
	action_data: z.record(z.unknown()).nullish().describe("Data needed to execute action"),
	navigateTo: z.string().nullish().describe("Route to navigate user to"),
});

const OutputSchema = z.object({
	success: z.boolean(),
	message: z.string(),
	recommendations: z.array(RecommendationSchema),
	metadata: z.object({
		total_potential_recommendations: z.number(),
		returned_top_n: z.number(),
		computation_timestamp: z.string(),
	}),
});

export const generateResearchRecommendationsTool = createTool({
	id: "generate-research-recommendations",
	description: `Generate cross-lens synthesized recommendations for research follow-ups.
Combines data from Research Coverage, ICP Match, and Value Priorities lenses to create
3 prioritized, actionable recommendations with evidence traceability.

Use this tool to answer:
- "Who should I talk to next?"
- "What insights need validation?"
- "Where are my research gaps?"
- "Which contacts are getting stale?"

Returns recommendations sorted by priority (1 = highest) with full reasoning and evidence links.`,
	inputSchema: z.object({
		projectId: z.string().describe("Project ID to generate recommendations for"),
		accountId: z.string().nullish().describe("Account ID (can be extracted from context)"),
		maxRecommendations: z.number().default(3).describe("Maximum number of recommendations to return"),
	}),
	outputSchema: OutputSchema,
	execute: async (input, context?) => {
		// Dynamic imports to avoid static ~/  imports (Mastra pattern)
		const { supabaseAdmin } = await import("../../lib/supabase/client.server");
		const { Database } = await import("../../types");

		const supabase = supabaseAdmin as SupabaseClient<Database>;
		const projectId = input.projectId;
		const accountId = input.accountId ?? context?.requestContext?.get?.("account_id");

		consola.debug("generate-research-recommendations: execute start", {
			projectId,
			accountId,
			maxRecommendations: input.maxRecommendations,
		});

		if (!projectId) {
			return {
				success: false,
				message: "Missing projectId parameter",
				recommendations: [],
				metadata: {
					total_potential_recommendations: 0,
					returned_top_n: 0,
					computation_timestamp: new Date().toISOString(),
				},
			};
		}

		try {
			const recommendations: z.infer<typeof RecommendationSchema>[] = [];

			// ======================================================================
			// STEP 1: Fetch Research Coverage Data
			// ======================================================================

			// Query research questions with low answer coverage
			const { data: unansweredQuestions, error: questionsError } = await supabase
				.from("research_question_summary")
				.select("*")
				.eq("project_id", projectId)
				.gt("open_answer_count", 0)
				.order("open_answer_count", { ascending: false })
				.limit(5);

			if (questionsError) {
				consola.warn("Failed to fetch unanswered questions:", questionsError);
			}

			// Query stale contacts (14+ days since last interview)
			const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
			const { data: recentInterviewPeople, error: interviewPeopleError } = await supabase
				.from("interview_people")
				.select(
					`
					person_id,
					created_at,
					people (
						id,
						firstname,
						lastname,
						title,
						default_organization:organizations!default_organization_id(name)
					)
				`
				)
				.eq("project_id", projectId)
				.order("created_at", { ascending: false });

			if (interviewPeopleError) {
				consola.warn("Failed to fetch interview people:", interviewPeopleError);
			}

			// Find stale contacts (people with last interview > 14 days ago)
			const staleContacts: Array<{
				person_id: string;
				name: string;
				title?: string;
				company?: string;
				days_since: number;
				last_interview_date: string;
			}> = [];

			if (recentInterviewPeople) {
				const personLastInterviewMap = new Map<string, Date>();

				for (const ip of recentInterviewPeople) {
					const personId = ip.person_id;
					const interviewDate = new Date(ip.created_at);

					if (!personLastInterviewMap.has(personId) || interviewDate > personLastInterviewMap.get(personId)!) {
						personLastInterviewMap.set(personId, interviewDate);
					}
				}

				const now = new Date();
				for (const [personId, lastDate] of personLastInterviewMap.entries()) {
					const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

					if (daysSince >= 14) {
						const personData = recentInterviewPeople.find((ip) => ip.person_id === personId)?.people;
						if (personData) {
							staleContacts.push({
								person_id: personId,
								name: `${personData.firstname} ${personData.lastname}`.trim(),
								title: personData.title || undefined,
								company: (personData as any).default_organization?.name || undefined,
								days_since: daysSince,
								last_interview_date: lastDate.toISOString(),
							});
						}
					}
				}
			}

			// ======================================================================
			// STEP 2: Fetch ICP Match Data
			// ======================================================================

			const { data: icpScores, error: icpError } = await supabase
				.from("person_scale")
				.select(
					`
					person_id,
					score,
					confidence,
					people (
						id,
						firstname,
						lastname,
						title,
						company
					)
				`
				)
				.eq("account_id", accountId)
				.eq("kind_slug", "icp_match")
				.gte("score", 0.8) // High ICP matches (80%+)
				.order("score", { ascending: false })
				.limit(10);

			if (icpError) {
				consola.warn("Failed to fetch ICP scores:", icpError);
			}

			// ======================================================================
			// STEP 3: Fetch Theme/Insight Data (Value Priorities)
			// ======================================================================

			const { data: themes, error: themesError } = await supabase
				.from("themes")
				.select(
					`
					id,
					name,
					priority,
					confidence,
					theme_evidence (
						evidence_id
					)
				`
				)
				.eq("project_id", projectId)
				.limit(20);

			if (themesError) {
				consola.warn("Failed to fetch themes:", themesError);
			}

			// Calculate confidence for themes (evidence_count from junction table)
			const themesWithConfidence = (themes || [])
				.map((theme) => {
					const evidence_count = theme.theme_evidence?.length || 0;

					let confidence = 0;
					if (evidence_count >= 5)
						confidence = 0.85; // HIGH
					else if (evidence_count >= 3)
						confidence = 0.65; // MEDIUM
					else confidence = 0.45; // LOW

					return {
						...theme,
						evidence_count,
						confidence,
						confidence_label: confidence >= 0.8 ? "HIGH" : confidence >= 0.6 ? "MEDIUM" : "LOW",
					};
				})
				.sort((a, b) => a.evidence_count - b.evidence_count); // Sort by evidence count ascending

			const lowConfidenceThemes = themesWithConfidence.filter((t) => t.confidence < 0.8 && t.evidence_count < 10);

			// ======================================================================
			// STEP 4: Generate Recommendations (Deterministic Rules)
			// ======================================================================

			// RULE 1: Unanswered Questions (Priority 1 - Critical)
			if (unansweredQuestions && unansweredQuestions.length > 0) {
				const topQuestion = unansweredQuestions[0];

				recommendations.push({
					id: `rec-unanswered-${topQuestion.id}`,
					priority: 1,
					category: "research_coverage",
					title: `Answer research question with ${topQuestion.open_answer_count} gaps`,
					description: `This research question has ${topQuestion.open_answer_count} unanswered sub-questions. Interview people who can provide these insights.`,
					reasoning: `Decision questions without answers block confident decisions. This question needs ${topQuestion.open_answer_count} more responses to be fully covered.`,
					action_type: "schedule_interview",
					action_data: {
						question_id: topQuestion.id,
						needed_responses: topQuestion.open_answer_count,
					},
					navigateTo: `/questions/${topQuestion.id}`,
				});
			}

			// RULE 2: Low-Confidence Themes (Priority 2 - Important)
			if (lowConfidenceThemes.length > 0) {
				const topTheme = lowConfidenceThemes[0];
				const targetEvidence = 5;
				const gap = targetEvidence - topTheme.evidence_count;

				recommendations.push({
					id: `rec-validate-theme-${topTheme.id}`,
					priority: 2,
					category: "insight_validation",
					title: `Validate "${topTheme.name}" theme (${topTheme.confidence_label} confidence)`,
					description: `This theme has only ${topTheme.evidence_count} mentions. Interview ${gap} more people to reach HIGH confidence (5+ mentions).`,
					reasoning: `Theme confidence is ${topTheme.confidence_label} (${Math.round(topTheme.confidence * 100)}%). Need ${gap} more evidence pieces to reach HIGH confidence (85%+) and make decisions confidently.`,
					confidence_current: topTheme.confidence,
					confidence_target: 0.85,
					action_type: "validate_theme",
					action_data: {
						theme_id: topTheme.id,
						theme_name: topTheme.name,
						current_evidence: topTheme.evidence_count,
						target_evidence: targetEvidence,
						gap: gap,
					},
					navigateTo: `/insights/${topTheme.id}`,
				});
			}

			// RULE 3: Stale High-ICP Contacts (Priority 2 - Re-engagement)
			const staleHighICPContacts = staleContacts.filter((contact) => {
				const icpScore = icpScores?.find((s) => s.person_id === contact.person_id);
				return icpScore && icpScore.score >= 0.8;
			});

			if (staleHighICPContacts.length > 0) {
				const topStaleContact = staleHighICPContacts[0];
				const icpScore = icpScores?.find((s) => s.person_id === topStaleContact.person_id);

				recommendations.push({
					id: `rec-follow-up-${topStaleContact.person_id}`,
					priority: 2,
					category: "follow_up",
					title: `Follow up with ${topStaleContact.name} (${topStaleContact.days_since} days since last contact)`,
					description: `${topStaleContact.name} is a high ICP match (${Math.round((icpScore?.score || 0) * 100)}%) but hasn't been contacted in ${topStaleContact.days_since} days. Re-engage to maintain relationship.`,
					reasoning:
						"High-value contacts should be engaged at least every 14 days. This contact matches your ICP well but conversation has gone stale.",
					action_type: "follow_up_contact",
					action_data: {
						person_id: topStaleContact.person_id,
						person_name: topStaleContact.name,
						days_since: topStaleContact.days_since,
						icp_score: icpScore?.score,
						last_contact: topStaleContact.last_interview_date,
					},
					navigateTo: `/people/${topStaleContact.person_id}`,
				});
			}

			// RULE 4: High ICP Matches Never Interviewed (Priority 3 - Opportunity)
			if (icpScores && icpScores.length > 0) {
				// Find ICP matches that have NO interview_people records
				const neverInterviewedHighICP = icpScores.filter((icp) => {
					const hasInterview = recentInterviewPeople?.some((ip) => ip.person_id === icp.person_id);
					return !hasInterview;
				});

				if (neverInterviewedHighICP.length > 0) {
					const topMatch = neverInterviewedHighICP[0];
					const person = topMatch.people;

					recommendations.push({
						id: `rec-icp-match-${topMatch.person_id}`,
						priority: 3,
						category: "icp_validation",
						title: `Interview ${person?.firstname} ${person?.lastname} (${Math.round(topMatch.score * 100)}% ICP match)`,
						description: `This person is a strong ICP match but hasn't been interviewed yet. Great opportunity to validate your assumptions.`,
						reasoning:
							"High ICP scores indicate this person fits your target profile. Interviewing them can validate product-market fit and generate high-quality insights.",
						action_type: "schedule_interview",
						action_data: {
							person_id: topMatch.person_id,
							person_name: `${person?.firstname} ${person?.lastname}`,
							icp_score: topMatch.score,
							icp_confidence: topMatch.confidence,
						},
						navigateTo: `/people/${topMatch.person_id}`,
					});
				}
			}

			// ======================================================================
			// STEP 5: Sort and Return Top N
			// ======================================================================

			const sortedRecommendations = recommendations
				.sort((a, b) => a.priority - b.priority)
				.slice(0, input.maxRecommendations);

			consola.debug("generate-research-recommendations: generated", {
				projectId,
				total_generated: recommendations.length,
				returned: sortedRecommendations.length,
			});

			return {
				success: true,
				message: `Generated ${sortedRecommendations.length} recommendations`,
				recommendations: sortedRecommendations,
				metadata: {
					total_potential_recommendations: recommendations.length,
					returned_top_n: sortedRecommendations.length,
					computation_timestamp: new Date().toISOString(),
				},
			};
		} catch (error) {
			consola.error("generate-research-recommendations: error", error);
			return {
				success: false,
				message: `Error generating recommendations: ${error instanceof Error ? error.message : "Unknown error"}`,
				recommendations: [],
				metadata: {
					total_potential_recommendations: 0,
					returned_top_n: 0,
					computation_timestamp: new Date().toISOString(),
				},
			};
		}
	},
});
