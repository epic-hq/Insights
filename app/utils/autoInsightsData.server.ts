import { getServerClient } from "~/lib/supabase/client.server";

// Type definitions for aggregated data
interface AutoInsightsData {
	summary: DataSummary;
	insights: InsightSummary[];
	personas: PersonaSummary[];
	opportunities: OpportunitySummary[];
	tags: TagSummary[];
	interviews: InterviewSummary[];
}

interface DataSummary {
	total_insights: number;
	total_interviews: number;
	total_people: number;
	total_opportunities: number;
	date_range: string;
	account_id: string;
}

interface InsightSummary {
	id: string;
	name: string;
	category: string;
	pain: string | null;
	desired_outcome: string | null;
	evidence: string | null;
	impact: number | null;
	novelty: number | null;
	jtbd: string | null;
	emotional_response: string | null;
	journey_stage: string | null;
	confidence: string | null;
	priority: number; // Sum of votes
	tags: string[];
	personas: string[];
}

interface PersonaSummary {
	id: string;
	name: string;
	description: string | null;
	percentage: number | null;
	insight_count: number;
	top_pain_points: string[];
	top_desired_outcomes: string[];
}

interface OpportunitySummary {
	id: string;
	title: string;
	kanban_status: string | null;
	insight_count: number;
	supporting_insights: string[];
}

interface TagSummary {
	tag: string;
	insight_count: number;
	interview_count: number;
	categories: string[];
}

interface InterviewSummary {
	id: string;
	title: string | null;
	segment: string | null;
	high_impact_themes: string[] | null;
	interview_date: string | null;
	insight_count: number;
}

type InsightRow = {
	id: string;
	name: string;
	category: string;
	pain: string | null;
	desired_outcome: string | null;
	evidence: string | null;
	impact: number | null;
	novelty: number | null;
	jtbd: string | null;
	emotional_response: string | null;
	journey_stage: string | null;
	confidence: string | null;
	priority: number | null;
};

type InsightTagRow = {
	insight_id: string | null;
	tags: { tag?: string | null } | null;
};

type InsightPersonaRow = {
	insight_id: string | null;
	personas: { name?: string | null } | null;
};

type PersonaRow = {
	id: string;
	name: string;
	description: string | null;
	percentage: number | null;
};

type PersonaInsightLinkRow = {
	insight_id: string | null;
};

type ThemeDetailRow = {
	id: string;
	pain: string | null;
	desired_outcome: string | null;
};

type OpportunityRow = {
	id: string;
	title: string;
	kanban_status: string | null;
};

type OpportunityInsightRow = {
	insight_id: string | null;
};

type ThemeNameRow = {
	id: string;
	name: string | null;
};

type TagFrequencyRow = {
	tag: string;
	insight_tags: unknown[] | null;
	interview_tags: unknown[] | null;
};

type TagCategoryLinkRow = {
	tag_id: string | null;
	insight_id: string | null;
};

type ThemeCategoryRow = {
	id: string;
	category: string | null;
};

type InterviewRow = {
	id: string;
	title: string | null;
	segment: string | null;
	high_impact_themes: string[] | null;
	interview_date: string | null;
};

/**
 * Aggregates and summarizes all user research data for Auto-Insights generation
 * Optimized for LLM context window (~8k tokens) with strategic data selection
 */
export async function aggregateAutoInsightsData(request: Request, accountId: string): Promise<AutoInsightsData> {
	const { client: db } = getServerClient(request);
	const queryDb = db as any;

	// 1. Get data summary statistics
	const [insightsCount, interviewsCount, peopleCount, opportunitiesCount] = await Promise.all([
		db.from("themes").select("id", { count: "exact" }).eq("account_id", accountId),
		db.from("interviews").select("id", { count: "exact" }).eq("account_id", accountId),
		db.from("people").select("id", { count: "exact" }).eq("account_id", accountId),
		db.from("opportunities").select("id", { count: "exact" }).eq("account_id", accountId),
	]);

	// Get date range from interviews
	const { data: dateRange } = await db
		.from("interviews")
		.select("interview_date")
		.eq("account_id", accountId)
		.order("interview_date", { ascending: true })
		.limit(1);

	const { data: latestDate } = await db
		.from("interviews")
		.select("interview_date")
		.eq("account_id", accountId)
		.order("interview_date", { ascending: false })
		.limit(1);

	const summary: DataSummary = {
		total_insights: insightsCount.count || 0,
		total_interviews: interviewsCount.count || 0,
		total_people: peopleCount.count || 0,
		total_opportunities: opportunitiesCount.count || 0,
		date_range: `${dateRange?.[0]?.interview_date || "N/A"} to ${latestDate?.[0]?.interview_date || "N/A"}`,
		account_id: accountId,
	};

	// 2. Get high-impact insights with tags and personas
	const { data: rawInsightsData, error: insightsError } = await queryDb
		.from("insights_with_priority")
		.select(`
	     id,
	     name,
	     category,
	     pain,
	     desired_outcome,
	     evidence,
	     impact,
	     novelty,
	     jtbd,
	     emotional_response,
	     journey_stage,
	     confidence,
	     priority
	   `)
		.eq("account_id", accountId)
		.order("impact", { ascending: false })
		.order("novelty", { ascending: false })
		.limit(50); // Focus on top insights to fit context window

	if (insightsError) {
		throw new Error(`Failed to fetch insights: ${insightsError.message}`);
	}

	// Get tags for insights via junction table
	const insightsData = (rawInsightsData ?? []) as InsightRow[];
	const insightIds = insightsData.map((i) => i.id);
	const { data: rawInsightTagsData } = await queryDb
		.from("insight_tags")
		.select(`
      insight_id,
      tags!inner(tag)
    `)
		.in("insight_id", insightIds);

	// Get personas for insights via junction table
	const insightTagsData = (rawInsightTagsData ?? []) as InsightTagRow[];
	const { data: rawInsightPersonasData } = await queryDb
		.from("persona_insights")
		.select(`
      insight_id,
      personas!inner(name)
    `)
		.in("insight_id", insightIds);

	// Build insight summaries with tags and personas
	const insightPersonasData = (rawInsightPersonasData ?? []) as InsightPersonaRow[];
	const insights: InsightSummary[] = insightsData.map((insight) => {
		const tags =
			insightTagsData
				?.filter((it) => it.insight_id === insight.id)
				.map((it) => (it.tags as any)?.tag)
				.filter(Boolean) || [];

		const personas =
			insightPersonasData
				?.filter((ip) => ip.insight_id === insight.id)
				.map((ip) => (ip.personas as any)?.name)
				.filter(Boolean) || [];

		return {
			id: insight.id,
			name: insight.name,
			category: insight.category,
			pain: insight.pain,
			desired_outcome: insight.desired_outcome,
			evidence: insight.evidence,
			impact: insight.impact,
			novelty: insight.novelty,
			jtbd: insight.jtbd,
			emotional_response: insight.emotional_response,
			journey_stage: insight.journey_stage,
			confidence: insight.confidence,
			priority: insight.priority ?? 0,
			tags,
			personas,
		};
	});

	// 3. Get persona summaries with insight statistics
	const { data: rawPersonasData, error: personasError } = await queryDb
		.from("personas")
		.select(`
      id,
      name,
      description,
      percentage
    `)
		.eq("account_id", accountId);

	if (personasError) {
		throw new Error(`Failed to fetch personas: ${personasError.message}`);
	}

	// Get persona insight counts and top pain points
	const personasData = (rawPersonasData ?? []) as PersonaRow[];
	const personas: PersonaSummary[] = await Promise.all(
		personasData.map(async (persona) => {
			const { data: personaInsights } = await db
				.from("persona_insights")
				.select("insight_id")
				.eq("persona_id", persona.id);

			const personaInsightRows = (personaInsights ?? []) as PersonaInsightLinkRow[];
			const insightIds =
				personaInsightRows.map((pi) => pi.insight_id).filter((id): id is string => typeof id === "string") || [];
			let insightCount = insightIds.length;
			let topPainPoints: string[] = [];
			let topDesiredOutcomes: string[] = [];

			if (insightIds.length) {
					const { data: themeDetails } = await db.from("themes").select("id, pain, desired_outcome").in("id", insightIds);
					const typedThemeDetails = (themeDetails ?? []) as ThemeDetailRow[];
					const themeMap = new Map(typedThemeDetails.map((row) => [row.id, row]));

					const orderedDetails = insightIds
						.map((id) => themeMap.get(id) ?? null)
						.filter((value): value is ThemeDetailRow => value !== null);

				insightCount = orderedDetails.length;
				topPainPoints = orderedDetails
					.map((detail) => detail.pain)
					.filter((pain): pain is string => Boolean(pain))
					.slice(0, 3);

				topDesiredOutcomes = orderedDetails
					.map((detail) => detail.desired_outcome)
					.filter((outcome): outcome is string => Boolean(outcome))
					.slice(0, 3);
			}

			return {
				id: persona.id,
				name: persona.name,
				description: persona.description,
				percentage: persona.percentage,
				insight_count: insightCount,
				top_pain_points: topPainPoints,
				top_desired_outcomes: topDesiredOutcomes,
			};
		})
	);

	// 4. Get opportunity summaries with supporting insights
	const { data: rawOpportunitiesData, error: opportunitiesError } = await queryDb
		.from("opportunities")
		.select(`
      id,
      title,
      kanban_status
    `)
		.eq("account_id", accountId);

	if (opportunitiesError) {
		throw new Error(`Failed to fetch opportunities: ${opportunitiesError.message}`);
	}

	const opportunitiesData = (rawOpportunitiesData ?? []) as OpportunityRow[];
	const opportunities: OpportunitySummary[] = await Promise.all(
		opportunitiesData.map(async (opportunity) => {
			const { data: supportingRows } = await db
				.from("opportunity_insights")
				.select("insight_id")
				.eq("opportunity_id", opportunity.id);

				const supportingIds =
					((supportingRows ?? []) as OpportunityInsightRow[])
						.map((row) => row.insight_id)
						.filter((id): id is string => typeof id === "string") || [];
				let supportingNames: string[] = [];

				if (supportingIds.length) {
					const { data: themeNames } = await db.from("themes").select("id, name").in("id", supportingIds);
					const typedThemeNames = (themeNames ?? []) as ThemeNameRow[];
					const nameMap = new Map(typedThemeNames.map((row) => [row.id, row.name || ""]));
					supportingNames = supportingIds.map((id) => nameMap.get(id) || "").filter((name) => name.length > 0);
				}

			return {
				id: opportunity.id,
				title: opportunity.title,
				kanban_status: opportunity.kanban_status,
				insight_count: supportingIds.length,
				supporting_insights: supportingNames,
			};
		})
	);

	// 5. Get tag frequency analysis
	const { data: rawTagFrequency } = await queryDb
		.from("tags")
		.select(`
      tag,
      insight_tags!inner(insight_id),
      interview_tags!inner(interview_id)
    `)
		.eq("account_id", accountId);

	const tagFrequency = (rawTagFrequency ?? []) as TagFrequencyRow[];
	const tagIds = tagFrequency.map((t) => t.tag);
	const { data: tagCategoryLinks } = tagIds.length
		? await db.from("insight_tags").select("tag_id, insight_id").in("tag_id", tagIds)
		: { data: [] };

	const insightIdsForTags = Array.from(
		new Set(
			((tagCategoryLinks ?? []) as TagCategoryLinkRow[])
				.map((link) => link.insight_id)
				.filter((id): id is string => typeof id === "string")
		)
	);

	const { data: themeCategoryRows } = insightIdsForTags.length
		? await db.from("themes").select("id, category").in("id", insightIdsForTags)
		: { data: [] };

	const typedThemeCategoryRows = (themeCategoryRows ?? []) as ThemeCategoryRow[];
	const categoryMap = new Map(typedThemeCategoryRows.map((row) => [row.id, row.category || null]));

	const tagToInsightIds = new Map<string, string[]>();
	((tagCategoryLinks ?? []) as TagCategoryLinkRow[]).forEach((link) => {
		if (!link.tag_id || !link.insight_id) return;
		tagToInsightIds.set(link.tag_id, [...(tagToInsightIds.get(link.tag_id) || []), link.insight_id]);
	});

	const tags: TagSummary[] = tagFrequency
		.map((tag) => {
			const insightCount = (tag.insight_tags as any[])?.length || 0;
			const interviewCount = (tag.interview_tags as any[])?.length || 0;

			const categories =
				tagToInsightIds
					.get(tag.tag)
					?.map((insightId) => categoryMap.get(insightId))
					.filter((category): category is string => Boolean(category)) || [];

			return {
				tag: tag.tag,
				insight_count: insightCount,
				interview_count: interviewCount,
				categories: [...new Set(categories)], // Remove duplicates
			};
		})
		.sort((a, b) => b.insight_count + b.interview_count - (a.insight_count + a.interview_count))
		.slice(0, 20); // Top 20 tags

	// 6. Get recent interview summaries
	const { data: rawInterviewsData, error: interviewsError } = await queryDb
		.from("interviews")
		.select(`
      id,
      title,
      segment,
      high_impact_themes,
      interview_date
    `)
		.eq("account_id", accountId)
		.order("interview_date", { ascending: false })
		.limit(20); // Recent interviews

	if (interviewsError) {
		throw new Error(`Failed to fetch interviews: ${interviewsError.message}`);
	}

	const interviewsData = (rawInterviewsData ?? []) as InterviewRow[];
	const interviews: InterviewSummary[] = await Promise.all(
		interviewsData.map(async (interview) => {
			// Get insight count for this interview
			const { data: interviewInsights } = await db
				.from("themes")
				.select("id", { count: "exact" })
				.eq("interview_id", interview.id);

				return {
				id: interview.id,
				title: interview.title,
				segment: interview.segment,
				high_impact_themes: interview.high_impact_themes,
				interview_date: interview.interview_date,
					insight_count: interviewInsights?.length || 0,
				};
			})
	);

	return {
		summary,
		insights,
		personas,
		opportunities,
		tags,
		interviews,
	};
}

/**
 * Formats aggregated data into a structured prompt for the LLM
 * Optimized for executive-level analysis and strategic insights
 */
export function formatDataForLLM(data: AutoInsightsData): string {
	const { summary, insights, personas, opportunities, tags, interviews } = data;

	return `
# User Research Data Summary

## Overview
- **Total Insights**: ${summary.total_insights}
- **Total Interviews**: ${summary.total_interviews}
- **Total People**: ${summary.total_people}
- **Total Opportunities**: ${summary.total_opportunities}
- **Date Range**: ${summary.date_range}

## Top Insights (by Impact & Novelty)
${insights
	.slice(0, 20)
	.map(
		(insight) => `
### ${insight.name} (Category: ${insight.category})
- **Pain**: ${insight.pain || "N/A"}
- **Desired Outcome**: ${insight.desired_outcome || "N/A"}
- **Evidence**: ${insight.evidence || "N/A"}
- **Impact**: ${insight.impact}/5, **Novelty**: ${insight.novelty}/5
- **Journey Stage**: ${insight.journey_stage || "N/A"}
- **JTBD**: ${insight.jtbd || "N/A"}
- **Emotional Response**: ${insight.emotional_response || "N/A"}
- **Tags**: ${insight.tags.join(", ") || "None"}
- **Personas**: ${insight.personas.join(", ") || "None"}
`
	)
	.join("\n")}

## Personas & Segments
${personas
	.map(
		(persona) => `
### ${persona.name} (${persona.percentage || 0}% of users)
- **Description**: ${persona.description || "N/A"}
- **Insights**: ${persona.insight_count} insights
- **Top Pain Points**: ${persona.top_pain_points.join("; ") || "None identified"}
- **Top Desired Outcomes**: ${persona.top_desired_outcomes.join("; ") || "None identified"}
`
	)
	.join("\n")}

## Current Opportunities Pipeline
${opportunities
	.map(
		(opp) => `
### ${opp.title} (Status: ${opp.kanban_status || "Unknown"})
- **Supporting Insights**: ${opp.insight_count} insights
- **Key Supporting Evidence**: ${opp.supporting_insights.join(", ") || "None"}
`
	)
	.join("\n")}

## Trending Tags & Themes
${tags
	.slice(0, 10)
	.map(
		(tag) => `
- **${tag.tag}**: ${tag.insight_count} insights, ${tag.interview_count} interviews (Categories: ${tag.categories.join(", ")})
`
	)
	.join("\n")}

## Recent Interview Themes
${interviews
	.slice(0, 10)
	.map(
		(interview) => `
### ${interview.title || "Untitled"} (${interview.interview_date || "No date"})
- **Segment**: ${interview.segment || "N/A"}
- **Insights Generated**: ${interview.insight_count}
- **High Impact Themes**: ${interview.high_impact_themes?.join(", ") || "None identified"}
`
	)
	.join("\n")}
`.trim();
}
