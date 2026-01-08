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

const RequestSchema = z.object({
  listId: z.string().uuid(),
  mode: z.enum(["quick", "detailed"]).default("quick"),
  customInstructions: z.string().optional(),
});

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const { accountId } = params;
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
      return Response.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 },
      );
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
      return Response.json(
        { error: listResult.error.message },
        { status: 500 },
      );
    }
    if (!listResult.data) {
      return Response.json({ error: "Ask link not found" }, { status: 404 });
    }
    if (responsesResult.error) {
      return Response.json(
        { error: responsesResult.error.message },
        { status: 500 },
      );
    }

    const list = listResult.data;
    const responses = responsesResult.data ?? [];

    if (responses.length === 0) {
      return Response.json(
        { error: "No responses to analyze" },
        { status: 400 },
      );
    }

    // Parse questions
    const questionsResult = ResearchLinkQuestionSchema.array().safeParse(
      list.questions,
    );
    const questions = questionsResult.success ? questionsResult.data : [];

    // Format questions for prompt
    const questionsText = questions
      .map((q, i) => `${i + 1}. ${q.prompt}`)
      .join("\n");

    // Format responses for prompt
    let responsesText = responses
      .map((response, idx) => {
        const status = response.completed ? "Completed" : "In Progress";
        const answers = questions
          .map((q) => {
            const answer = extractAnswer(response, q);
            return `Q${questions.indexOf(q) + 1}: ${answer || "—"}`;
          })
          .join("\n");
        return `## Response ${idx + 1} (${response.email}) - ${status}\n${answers}`;
      })
      .join("\n\n");

    // Append custom instructions if provided
    if (customInstructions?.trim()) {
      responsesText += `\n\n## Additional Analysis Instructions\n${customInstructions.trim()}`;
    }

    // Call BAML function
    if (mode === "quick") {
      const result = await b.SummarizeAskLinkResponses(
        list.name,
        questionsText,
        responsesText,
      );
      return Response.json({ mode: "quick", result });
    }

    const result = await b.AnalyzeAskLinkResponses(
      list.name,
      questionsText,
      responsesText,
      list.description || "No additional context provided.",
    );
    return Response.json({ mode: "detailed", result });
  } catch (error) {
    consola.error("Failed to analyze responses:", error);
    return Response.json(
      { error: "Failed to analyze responses. Please try again." },
      { status: 500 },
    );
  }
}
