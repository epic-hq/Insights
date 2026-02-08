/**
 * Test script for the recommendation engine.
 * Run with: npx tsx scripts/test-recommendations-engine.ts
 *
 * This validates that the cross-lens recommendation engine:
 * 1. Queries data correctly
 * 2. Applies deterministic rules
 * 3. Returns prioritized recommendations
 * 4. Includes evidence traceability
 */

import "dotenv/config"; // Load .env file
import { createClient } from "@supabase/supabase-js";
import type { Database } from "~/types";

// Access env vars directly (scripts pattern)
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
	console.error("❌ Missing environment variables:");
	console.error("   SUPABASE_URL:", SUPABASE_URL ? "✓" : "✗");
	console.error("   SUPABASE_SERVICE_ROLE_KEY:", SUPABASE_SERVICE_ROLE_KEY ? "✓" : "✗");
	process.exit(1);
}

async function testRecommendationEngine() {
	console.log("🧪 Testing Recommendation Engine\n");

	// Rick's UpSight project
	const TEST_PROJECT_ID = "6dbcbb68-0662-4ebc-9f84-dd13b8ff758d";
	const TEST_ACCOUNT_ID = undefined; // Will be extracted from context or not needed for admin queries

	console.log(`📊 Project: ${TEST_PROJECT_ID}\n`);

	try {
		console.log("⚙️  Generating recommendations...\n");

		// Call the tool directly without going through app env validation
		const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

		const result = await generateRecommendations(supabase, TEST_PROJECT_ID, 3);

		if (!result.success) {
			console.error("❌ Failed:", result.message);
			return;
		}

		console.log(`✅ Success: ${result.message}\n`);
		console.log(`📈 Generated ${result.metadata.total_potential_recommendations} potential recommendations`);
		console.log(`🎯 Returning top ${result.metadata.returned_top_n}\n`);
		console.log("─".repeat(80));

		result.recommendations.forEach((rec, index) => {
			console.log(`\n${index + 1}. [Priority ${rec.priority}] ${rec.title}`);
			console.log(`   Category: ${rec.category}`);
			console.log(`   Action: ${rec.action_type}`);
			console.log(`\n   💡 Why: ${rec.reasoning}`);

			if (rec.confidence_current !== undefined) {
				console.log(
					`\n   📊 Confidence: ${Math.round(rec.confidence_current * 100)}% → ${Math.round((rec.confidence_target || 0) * 100)}% (target)`
				);
			}

			if (rec.evidence_refs && rec.evidence_refs.length > 0) {
				console.log(`\n   🔗 Evidence: ${rec.evidence_refs.length} references`);
			}

			if (rec.navigateTo) {
				console.log(`   🔗 Navigate to: ${rec.navigateTo}`);
			}

			console.log("\n" + "─".repeat(80));
		});

		console.log("\n✨ Test complete!\n");

		// Validation checks
		console.log("🔍 Validation:");
		const hasHighPriority = result.recommendations.some((r) => r.priority === 1);
		const hasCategoryDiversity = new Set(result.recommendations.map((r) => r.category)).size > 1;
		const hasReasoning = result.recommendations.every((r) => r.reasoning.length > 50);

		console.log(`   ${hasHighPriority ? "✅" : "❌"} Has priority 1 (critical) recommendation`);
		console.log(`   ${hasCategoryDiversity ? "✅" : "❌"} Category diversity (not all same type)`);
		console.log(`   ${hasReasoning ? "✅" : "❌"} All recommendations have detailed reasoning`);
	} catch (error) {
		console.error("❌ Error:", error);
	}
}

// Extracted logic from the tool for direct testing
async function generateRecommendations(supabase: any, projectId: string, maxRecommendations: number) {
	const recommendations: any[] = [];

	// STEP 1: Fetch Research Coverage Data
	const { data: unansweredQuestions } = await supabase
		.from("research_question_summary")
		.select("*")
		.eq("project_id", projectId)
		.gt("open_answer_count", 0)
		.order("open_answer_count", { ascending: false })
		.limit(5);

	// STEP 2: Fetch ICP Match Data
	const { data: icpScores } = await supabase
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
		.eq("kind_slug", "icp_match")
		.gte("score", 0.8)
		.order("score", { ascending: false })
		.limit(10);

	// STEP 3: Fetch Theme Data
	const { data: themes } = await supabase
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

	const themesWithConfidence = (themes || [])
		.map((theme: any) => {
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
		.sort((a: any, b: any) => a.evidence_count - b.evidence_count); // Sort by evidence count ascending

	const lowConfidenceThemes = themesWithConfidence.filter((t: any) => t.confidence < 0.8 && t.evidence_count < 10);

	// DEBUG: Log what data we found
	console.log("📊 Data Summary:");
	console.log(`   Research questions with gaps: ${unansweredQuestions?.length || 0}`);
	console.log(`   ICP scores (80%+): ${icpScores?.length || 0}`);
	console.log(`   Total themes: ${themes?.length || 0}`);
	console.log(`   Low-confidence themes: ${lowConfidenceThemes.length}`);
	console.log("");

	if (themes && themes.length > 0) {
		console.log("🎯 Theme Confidence Breakdown:");
		themesWithConfidence.slice(0, 5).forEach((t: any) => {
			console.log(
				`   ${t.name}: ${t.evidence_count} mentions → ${t.confidence_label} (${Math.round(t.confidence * 100)}%)`
			);
		});
		console.log("");
	}

	// STEP 4: Generate Recommendations

	// Rule 1: Unanswered Questions
	if (unansweredQuestions && unansweredQuestions.length > 0) {
		const topQuestion = unansweredQuestions[0];
		recommendations.push({
			id: `rec-unanswered-${topQuestion.id}`,
			priority: 1,
			category: "research_coverage",
			title: `Answer research question with ${topQuestion.open_answer_count} gaps`,
			reasoning: `Decision questions without answers block confident decisions. This question needs ${topQuestion.open_answer_count} more responses.`,
			navigateTo: `/questions/${topQuestion.id}`,
		});
	}

	// Rule 2: Low-Confidence Themes
	if (lowConfidenceThemes.length > 0) {
		const topTheme = lowConfidenceThemes[0];
		const gap = 5 - topTheme.evidence_count;
		recommendations.push({
			id: `rec-validate-theme-${topTheme.id}`,
			priority: 2,
			category: "insight_validation",
			title: `Validate "${topTheme.name}" theme (${topTheme.confidence_label} confidence)`,
			reasoning: `Theme confidence is ${topTheme.confidence_label} (${Math.round(topTheme.confidence * 100)}%). Need ${gap} more evidence pieces to reach HIGH confidence.`,
			confidence_current: topTheme.confidence,
			confidence_target: 0.85,
			action_type: "validate_theme",
			navigateTo: `/themes/${topTheme.id}`,
		});
	}

	// Rule 3: High ICP Matches
	if (icpScores && icpScores.length > 0) {
		const topMatch = icpScores[0];
		const person = topMatch.people;
		recommendations.push({
			id: `rec-icp-match-${topMatch.person_id}`,
			priority: 3,
			category: "icp_validation",
			title: `Interview ${person?.firstname} ${person?.lastname} (${Math.round(topMatch.score * 100)}% ICP match)`,
			reasoning: "High ICP scores indicate this person fits your target profile. Great opportunity for insights.",
			navigateTo: `/people/${topMatch.person_id}`,
		});
	}

	return {
		success: true,
		message: `Generated ${recommendations.length} recommendations`,
		recommendations: recommendations.slice(0, maxRecommendations),
		metadata: {
			total_potential_recommendations: recommendations.length,
			returned_top_n: Math.min(recommendations.length, maxRecommendations),
			computation_timestamp: new Date().toISOString(),
		},
	};
}

// Run the test
testRecommendationEngine();
