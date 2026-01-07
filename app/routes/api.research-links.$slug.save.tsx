import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { ResearchLinkResponseSaveSchema } from "~/features/research-links/schemas";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import type { Database } from "~/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const loader = () =>
  Response.json({ message: "Method not allowed" }, { status: 405 });

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ message: "Method not allowed" }, { status: 405 });
  }

  const slug = params.slug;
  if (!slug) {
    return Response.json({ message: "Missing slug" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = ResearchLinkResponseSaveSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ message: "Invalid request" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: list, error: listError } = await supabase
    .from("research_links")
    .select("id, name, account_id, project_id, questions")
    .eq("slug", slug)
    .maybeSingle();

  if (listError) {
    return Response.json({ message: listError.message }, { status: 500 });
  }

  if (!list) {
    return Response.json(
      { message: "Research link not found" },
      { status: 404 },
    );
  }

  const { responseId, responses, completed } = parsed.data;
  const { data: existing, error: existingError } = await supabase
    .from("research_link_responses")
    .select("id, email, evidence_id")
    .eq("id", responseId)
    .eq("research_link_id", list.id)
    .maybeSingle();

  if (existingError) {
    return Response.json({ message: existingError.message }, { status: 500 });
  }

  if (!existing) {
    return Response.json({ message: "Response not found" }, { status: 404 });
  }

  const nextResponses = responses ?? {};
  const { error: updateError } = await supabase
    .from("research_link_responses")
    .update({
      responses: nextResponses,
      completed: completed ?? false,
    })
    .eq("id", responseId);

  if (updateError) {
    return Response.json({ message: updateError.message }, { status: 500 });
  }

  if (completed) {
    // Find or create person record for this respondent
    const personId = await findOrCreatePerson({
      supabase,
      accountId: list.account_id,
      projectId: list.project_id,
      email: existing.email,
    });

    if (personId) {
      await supabase
        .from("research_link_responses")
        .update({ person_id: personId })
        .eq("id", responseId);
    }

    const questions = Array.isArray(list.questions) ? list.questions : [];
    const summary = buildEvidenceSummary({
      linkName: list.name,
      email: existing.email,
      questions,
      responses: nextResponses,
    });

    if (existing.evidence_id) {
      const { error: evidenceError } = await supabase
        .from("evidence")
        .update({
          verbatim: summary,
          context_summary: `Research link response: ${list.name}`,
          method: "survey",
          modality: "qual",
        })
        .eq("id", existing.evidence_id);
      if (evidenceError) {
        return Response.json(
          { message: evidenceError.message },
          { status: 500 },
        );
      }
    } else {
      const { data: evidence, error: evidenceError } = await supabase
        .from("evidence")
        .insert({
          account_id: list.account_id,
          project_id: list.project_id,
          method: "survey",
          modality: "qual",
          verbatim: summary,
          context_summary: `Research link response: ${list.name}`,
          anchors: [
            {
              type: "survey_response",
              target: responseId,
            },
          ],
        })
        .select("id")
        .maybeSingle();
      if (evidenceError) {
        return Response.json(
          { message: evidenceError.message },
          { status: 500 },
        );
      }
      if (evidence?.id) {
        const { error: linkError } = await supabase
          .from("research_link_responses")
          .update({ evidence_id: evidence.id })
          .eq("id", responseId);
        if (linkError) {
          return Response.json({ message: linkError.message }, { status: 500 });
        }
      }
    }
  }

  return { ok: true };
}

function buildEvidenceSummary({
  linkName,
  email,
  questions,
  responses,
}: {
  linkName: string;
  email: string;
  questions: Array<{ id?: string; prompt?: string }>;
  responses: Record<string, unknown>;
}) {
  const questionMap = new Map(
    questions.map((question) => [question.id, question.prompt]),
  );
  const lines = Object.entries(responses)
    .map(([questionId, answer]) => {
      const label = questionMap.get(questionId) ?? "Question";
      const formatted = formatAnswer(answer);
      if (!formatted) return null;
      return `${label}: ${formatted}`;
    })
    .filter(Boolean);
  const header = `Research link response (${linkName}) — ${email}`;
  return [header, ...lines].filter(Boolean).join("\n");
}

function formatAnswer(answer: unknown) {
  if (Array.isArray(answer)) {
    return answer.join(", ");
  }
  if (typeof answer === "boolean") {
    return answer ? "Yes" : "No";
  }
  if (answer == null) return "";
  return String(answer);
}

/**
 * Find an existing person by email or create a new person record
 */
async function findOrCreatePerson({
  supabase,
  accountId,
  projectId,
  email,
}: {
  supabase: SupabaseClient<Database>;
  accountId: string;
  projectId: string | null;
  email: string;
}): Promise<string | null> {
  const normalizedEmail = email.toLowerCase().trim();

  // Try to find existing person by email
  const { data: existingPerson } = await supabase
    .from("people")
    .select("id")
    .eq("account_id", accountId)
    .eq("primary_email", normalizedEmail)
    .maybeSingle();

  if (existingPerson?.id) {
    return existingPerson.id;
  }

  // Parse name from email (use part before @)
  const emailName = normalizedEmail.split("@")[0] || "Unknown";
  const nameParts = emailName.replace(/[._-]/g, " ").split(/\s+/);
  const firstname =
    nameParts[0]?.charAt(0).toUpperCase() + (nameParts[0]?.slice(1) || "");
  const lastname =
    nameParts.length > 1
      ? nameParts
          .slice(1)
          .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
          .join(" ")
      : null;

  // Create new person
  const { data: newPerson, error: createError } = await supabase
    .from("people")
    .insert({
      account_id: accountId,
      project_id: projectId,
      primary_email: normalizedEmail,
      firstname,
      lastname,
      person_type: "respondent",
    })
    .select("id")
    .maybeSingle();

  if (createError) {
    // Handle unique constraint violation - person may have been created concurrently
    if (createError.code === "23505") {
      const { data: retryPerson } = await supabase
        .from("people")
        .select("id")
        .eq("account_id", accountId)
        .eq("primary_email", normalizedEmail)
        .maybeSingle();
      return retryPerson?.id ?? null;
    }
    consola.error("Failed to create person for response", createError);
    return null;
  }

  return newPerson?.id ?? null;
}
