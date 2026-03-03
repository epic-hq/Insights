/**
 * API endpoint to aggregate response stats for a single survey question.
 * Returns answer distribution, skip rate, avg time, etc. for the hover results UI.
 *
 * GET /a/:accountId/:projectId/ask/api/question-stats?listId=xxx&questionId=yyy
 */
import type { LoaderFunctionArgs } from "react-router";
import { getServerClient } from "~/lib/supabase/client.server";
import { ResearchLinkQuestionSchema } from "../schemas";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { accountId } = params;
  if (!accountId) {
    return Response.json({ error: "Missing accountId" }, { status: 400 });
  }

  const { client: supabase } = getServerClient(request);

  const url = new URL(request.url);
  const listId = url.searchParams.get("listId");
  const questionId = url.searchParams.get("questionId");

  if (!listId || !questionId) {
    return Response.json(
      { error: "listId and questionId are required" },
      { status: 400 },
    );
  }

  // Fetch survey (for question metadata) and responses in parallel
  const [listResult, responsesResult] = await Promise.all([
    supabase
      .from("research_links")
      .select("questions")
      .eq("id", listId)
      .eq("account_id", accountId)
      .maybeSingle(),
    supabase
      .from("research_link_responses")
      .select("responses, completed")
      .eq("research_link_id", listId),
  ]);

  if (listResult.error || !listResult.data) {
    return Response.json({ error: "Survey not found" }, { status: 404 });
  }

  // Find the question to determine type
  const questions = Array.isArray(listResult.data.questions)
    ? listResult.data.questions
    : [];
  const rawQuestion = questions.find(
    (q: Record<string, unknown>) => q.id === questionId,
  );
  if (!rawQuestion) {
    return Response.json({ error: "Question not found" }, { status: 404 });
  }

  const question = ResearchLinkQuestionSchema.parse(rawQuestion);
  const responses = responsesResult.data ?? [];

  // Count answered vs skipped
  let answered = 0;
  let skipped = 0;
  const answerValues: unknown[] = [];

  for (const row of responses) {
    const map = (row.responses ?? {}) as Record<string, unknown>;
    const val = map[questionId];
    if (val === null || val === undefined || val === "") {
      skipped++;
    } else {
      answered++;
      answerValues.push(val);
    }
  }

  const total = answered + skipped;
  const skipRate = total > 0 ? Math.round((skipped / total) * 100) : 0;

  const stats: Record<string, unknown> = {
    questionId,
    answered,
    skipped,
    skipRate,
  };

  // Type-specific aggregation
  if (
    question.type === "single_select" ||
    question.type === "multi_select" ||
    question.type === "image_select"
  ) {
    // Count each answer option
    const counts = new Map<string, number>();
    for (const val of answerValues) {
      const selections = Array.isArray(val) ? val : [String(val)];
      for (const s of selections) {
        counts.set(s, (counts.get(s) ?? 0) + 1);
      }
    }
    // Sort by count descending, calculate percentages
    const distribution = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({
        label,
        pct: answered > 0 ? Math.round((count / answered) * 100) : 0,
      }));
    stats.distribution = distribution;
  } else if (question.type === "likert") {
    // Build distribution by scale value and compute average
    const scale = question.likertScale ?? 5;
    const buckets = new Map<number, number>();
    let sum = 0;
    let likertCount = 0;
    for (const val of answerValues) {
      const num = Number(val);
      if (!Number.isNaN(num)) {
        buckets.set(num, (buckets.get(num) ?? 0) + 1);
        sum += num;
        likertCount++;
      }
    }
    const likertDistribution = [];
    for (let i = 1; i <= scale; i++) {
      likertDistribution.push({ value: i, count: buckets.get(i) ?? 0 });
    }
    stats.likertDistribution = likertDistribution;
    stats.likertAvg =
      likertCount > 0 ? Math.round((sum / likertCount) * 10) / 10 : null;
  } else {
    // Text-based (short_text, long_text, auto)
    let totalWords = 0;
    for (const val of answerValues) {
      const text = String(val).trim();
      if (text) {
        totalWords += text.split(/\s+/).length;
      }
    }
    stats.avgWordCount =
      answered > 0 ? Math.round(totalWords / answered) : null;
  }

  return Response.json(stats);
}
