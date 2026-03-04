/**
 * API endpoint for analyzing Ask link responses using BAML
 * Returns AI-generated insights and summaries
 */
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { b } from "~/../baml_client";
import { getServerClient } from "~/lib/supabase/client.server";
import { ResearchLinkQuestionSchema } from "../schemas";
import { extractAnswer } from "../utils";

function normalizeText(value: string): string {
	return value
		.toLowerCase()
		.replace(/["'`]/g, "")
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

function hasNumericSignal(value: string): boolean {
	return /\b\d+(?:\.\d+)?%?\b/.test(value);
}

function sanitizeDetailedResult(result: unknown, questionIds: string[], totalResponses: number): unknown {
	if (!result || typeof result !== "object") return result;
	const raw = result as Record<string, unknown>;
	const rawInsights = Array.isArray(raw.question_insights) ? raw.question_insights : null;
	if (!rawInsights) return result;

	const sanitizedInsights = rawInsights.map((insight, index) => {
		const source = (insight ?? {}) as Record<string, unknown>;
		const distribution = Array.isArray(source.answer_distribution)
			? source.answer_distribution
					.map((item) => item as Record<string, unknown>)
					.filter((item) => typeof item.answer === "string")
					.map((item) => ({
						answer: String(item.answer),
						count: typeof item.count === "number" ? item.count : 0,
						percentage: typeof item.percentage === "number" ? item.percentage : 0,
					}))
			: [];

		const labelSet = new Set(distribution.map((item) => normalizeText(item.answer)));
		const findingsRaw = Array.isArray(source.key_findings) ? source.key_findings : [];
		const findings = findingsRaw
			.filter((f): f is string => typeof f === "string")
			.map((f) => f.trim())
			.filter(Boolean)
			.filter((finding) => {
				const normalized = normalizeText(finding);
				return normalized.length > 4 && !labelSet.has(normalized);
			});
		const dedupedFindings = [...new Set(findings)];

		if (dedupedFindings.length === 0 && distribution.length > 0) {
			const top = distribution[0];
			if (top) {
				dedupedFindings.push(
					`${top.count} of ${Math.max(totalResponses, top.count)} responses (${top.percentage}%) selected "${top.answer}".`
				);
			}
			const second = distribution[1];
			if (second) {
				dedupedFindings.push(
					`${second.count} of ${Math.max(totalResponses, second.count)} responses (${second.percentage}%) selected "${second.answer}".`
				);
			}
		}

		const currentSummary = typeof source.summary === "string" ? source.summary.trim() : "";
		let summary = currentSummary;
		if ((!summary || !hasNumericSignal(summary)) && distribution.length > 0) {
			const top = distribution[0];
			if (top) {
				summary = `Top response was "${top.answer}" at ${top.percentage}% (${top.count} of ${Math.max(totalResponses, top.count)} responses).`;
			}
		}

		return {
			...source,
			questionId: questionIds[index] ?? null,
			questionIndex: index,
			answer_distribution: distribution,
			key_findings: dedupedFindings,
			summary,
		};
	});

	return {
		...raw,
		question_insights: sanitizedInsights,
	};
}

const RequestSchema = z.object({
	listId: z.string().uuid(),
	mode: z.enum(["quick", "detailed"]).default("quick"),
	customInstructions: z.string().optional(),
});

export async function action({ request, params }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	// accountId is not in params due to route nesting - extract from URL
	// URL pattern: /a/:accountId/:projectId/ask/api/analyze-responses
	const url = new URL(request.url);
	const pathMatch = url.pathname.match(/\/a\/([^/]+)\//);
	const accountId = pathMatch?.[1] || params.accountId;
	if (!accountId) {
		return Response.json({ error: "Missing account id" }, { status: 400 });
	}

	try {
		const formData = await request.formData();
		const rawPayload = {
			listId: formData.get("listId") ?? "",
			mode: formData.get("mode") ?? "quick",
			customInstructions: formData.get("customInstructions") ?? undefined,
		};

		const parsed = RequestSchema.safeParse(rawPayload);
		if (!parsed.success) {
			return Response.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 });
		}

		const { listId, mode, customInstructions } = parsed.data;
		const { client: supabase } = getServerClient(request);

		// Fetch list and responses
		const [listResult, responsesResult] = await Promise.all([
			supabase
				.from("research_links")
				.select("id, name, description, questions")
				.eq("account_id", accountId)
				.eq("id", listId)
				.maybeSingle(),
			supabase
				.from("research_link_responses")
				.select("*")
				.eq("research_link_id", listId)
				.order("created_at", { ascending: false }),
		]);

		if (listResult.error) {
			return Response.json({ error: listResult.error.message }, { status: 500 });
		}
		if (!listResult.data) {
			return Response.json({ error: "Ask link not found" }, { status: 404 });
		}
		if (responsesResult.error) {
			return Response.json({ error: responsesResult.error.message }, { status: 500 });
		}

		const list = listResult.data;
		const responses = responsesResult.data ?? [];

		if (responses.length === 0) {
			return Response.json({ error: "No responses to analyze" }, { status: 400 });
		}

		// Parse questions
		const questionsResult = ResearchLinkQuestionSchema.array().safeParse(list.questions);
		const questions = questionsResult.success ? questionsResult.data : [];

		// Compute per-question drop-off stats (zero extra queries — data already in memory)
		const questionDropoff: Record<string, { answered: number; total: number; completionPct: number }> = {};
		for (const q of questions) {
			let answered = 0;
			for (const response of responses) {
				const val = (response.responses as Record<string, unknown> | null)?.[q.id];
				if (val !== null && val !== undefined && val !== "") {
					answered++;
				}
			}
			questionDropoff[q.id] = {
				answered,
				total: responses.length,
				completionPct: Math.round((answered / responses.length) * 100),
			};
		}

		// Format questions for prompt with IDs so post-processing can map insights robustly
		const questionsText = questions.map((q, i) => `${i + 1}. [${q.id}] ${q.prompt}`).join("\n");

		// Format responses for prompt
		let responsesText = responses
			.map((response, idx) => {
				const status = response.completed ? "Completed" : "In Progress";
				const answers = questions
					.map((q, qIdx) => {
						const answer = extractAnswer(response, q);
						return `Q${qIdx + 1}: ${answer || "—"}`;
					})
					.join("\n");
				return `## Response ${idx + 1} (${response.email}) - ${status}\n${answers}`;
			})
			.join("\n\n");

		responsesText += `

## Output Quality Bar (Mandatory)
- Synthesize patterns; do NOT repeat raw responses as findings.
- For each question, provide at least one actionable takeaway tied to counts/percentages.
- key_findings must be insights (implication statements), not just answer labels.
`;

		// Append custom instructions if provided
		if (customInstructions?.trim()) {
			responsesText += `\n\n## Additional Analysis Instructions\n${customInstructions.trim()}`;
		}

		// Call BAML function
		let result: unknown;
		if (mode === "quick") {
			result = await b.SummarizeAskLinkResponses(list.name, questionsText, responsesText);
		} else {
			result = await b.AnalyzeAskLinkResponses(
				list.name,
				questionsText,
				responsesText,
				list.description || "No additional context provided."
			);
			result = sanitizeDetailedResult(
				result,
				questions.map((q) => q.id),
				responses.length
			);
		}

		// Save analysis to database
		const aiAnalysis = {
			mode,
			updatedAt: new Date().toISOString(),
			customInstructions: customInstructions || null,
			result,
			responseCountAtAnalysis: responses.length,
			questionDropoff,
		};
		const { error: updateError } = await supabase
			.from("research_links")
			.update({
				ai_analysis: JSON.parse(JSON.stringify(aiAnalysis)),
				ai_analysis_updated_at: new Date().toISOString(),
			})
			.eq("id", listId);

		if (updateError) {
			consola.warn("Failed to save AI analysis:", updateError);
			// Still return the result even if save fails
		}

		return Response.json({ mode, result });
	} catch (error) {
		consola.error("Failed to analyze responses:", error);
		return Response.json({ error: "Failed to analyze responses. Please try again." }, { status: 500 });
	}
}
