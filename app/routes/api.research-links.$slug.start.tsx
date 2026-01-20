/**
 * Start endpoint for Research Links (Ask links)
 * Handles person lookup by email and creates/links responses
 */
import type { ActionFunctionArgs } from "react-router";
import {
  ResearchLinkCreatePersonSchema,
  ResearchLinkResponseStartSchema,
} from "~/features/research-links/schemas";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";

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

  const supabase = createSupabaseAdminClient();

  // Fetch the research link with account_id for person lookup
  const { data: list, error: listError } = await supabase
    .from("research_links")
    .select(
      "id, is_live, allow_chat, default_response_mode, account_id, project_id",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (listError) {
    return Response.json({ message: listError.message }, { status: 500 });
  }

  if (!list || !list.is_live) {
    return Response.json(
      { message: "Research link not found" },
      { status: 404 },
    );
  }

  // Check if this is a "create person" request (has firstName)
  const createPersonParsed = ResearchLinkCreatePersonSchema.safeParse(payload);
  if (createPersonParsed.success) {
    return handleCreatePersonAndContinue(
      supabase,
      list,
      createPersonParsed.data,
    );
  }

  // Otherwise, this is a standard start request
  const parsed = ResearchLinkResponseStartSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      {
        message:
          parsed.error.flatten().fieldErrors.email?.[0] ?? "Invalid request",
      },
      { status: 400 },
    );
  }

  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  const existingResponseId = parsed.data.responseId;
  const responseMode =
    list.allow_chat && parsed.data.responseMode
      ? parsed.data.responseMode
      : (list.default_response_mode ?? "form");

  // If we have an existing response ID, try to resume it
  if (existingResponseId) {
    const { data: existingById } = await supabase
      .from("research_link_responses")
      .select("id, responses, completed, person_id")
      .eq("id", existingResponseId)
      .eq("research_link_id", list.id)
      .maybeSingle();
    if (existingById) {
      await supabase
        .from("research_link_responses")
        .update({
          email: normalizedEmail,
          response_mode: responseMode,
        })
        .eq("id", existingById.id);
      return Response.json({
        responseId: existingById.id,
        responses: existingById.responses ?? {},
        completed: existingById.completed ?? false,
        personId: existingById.person_id,
      });
    }
  }

  // Check if a response already exists for this email on this research link
  const { data: existing, error: existingError } = await supabase
    .from("research_link_responses")
    .select("id, responses, completed, person_id")
    .eq("research_link_id", list.id)
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingError) {
    return Response.json({ message: existingError.message }, { status: 500 });
  }

  if (existing) {
    await supabase
      .from("research_link_responses")
      .update({
        updated_at: new Date().toISOString(),
        response_mode: responseMode,
      })
      .eq("id", existing.id);
    return Response.json({
      responseId: existing.id,
      responses: existing.responses ?? {},
      completed: existing.completed ?? false,
      personId: existing.person_id,
    });
  }

  // Look up person by email in the people table for this account
  const { data: existingPerson } = await supabase
    .from("people")
    .select("id, name, firstname, lastname")
    .eq("account_id", list.account_id)
    .eq("primary_email", normalizedEmail)
    .maybeSingle();

  if (existingPerson) {
    // Person exists - create response linked to them
    const { data: inserted, error: insertError } = await supabase
      .from("research_link_responses")
      .insert({
        research_link_id: list.id,
        email: normalizedEmail,
        person_id: existingPerson.id,
        responses: {},
        completed: false,
        response_mode: responseMode,
      })
      .select("id")
      .maybeSingle();

    if (insertError || !inserted) {
      return Response.json(
        { message: insertError?.message ?? "Unable to start response" },
        { status: 500 },
      );
    }

    return Response.json({
      responseId: inserted.id,
      responses: {},
      completed: false,
      personId: existingPerson.id,
    });
  }

  // No person found - create response without person_id and signal frontend needs name
  const { data: inserted, error: insertError } = await supabase
    .from("research_link_responses")
    .insert({
      research_link_id: list.id,
      email: normalizedEmail,
      responses: {},
      completed: false,
      response_mode: responseMode,
    })
    .select("id")
    .maybeSingle();

  if (insertError || !inserted) {
    return Response.json(
      { message: insertError?.message ?? "Unable to start response" },
      { status: 500 },
    );
  }

  return Response.json({
    responseId: inserted.id,
    responses: {},
    completed: false,
    personId: null,
  });
}

/**
 * Handle creating a person and linking them to the response
 */
async function handleCreatePersonAndContinue(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  list: {
    id: string;
    account_id: string;
    project_id: string | null;
    allow_chat: boolean;
    default_response_mode: string | null;
  },
  data: {
    email: string;
    firstName: string;
    lastName?: string | null;
    responseId: string;
    responseMode?: "form" | "chat";
  },
) {
  const normalizedEmail = data.email.trim().toLowerCase();
  const firstName = data.firstName.trim();
  const lastName = data.lastName?.trim() || null;
  const responseMode =
    list.allow_chat && data.responseMode
      ? data.responseMode
      : (list.default_response_mode ?? "form");

  // Check if person already exists by email (race condition check)
  const { data: existingByEmail } = await supabase
    .from("people")
    .select("id")
    .eq("account_id", list.account_id)
    .eq("primary_email", normalizedEmail)
    .maybeSingle();

  let personId = existingByEmail?.id;

  // If not found by email, check by name (to handle existing people with different/no email)
  if (!personId) {
    const fullName = lastName ? `${firstName} ${lastName}` : firstName;
    const { data: existingByName } = await supabase
      .from("people")
      .select("id, primary_email")
      .eq("account_id", list.account_id)
      .eq("name", fullName)
      .maybeSingle();

    if (existingByName) {
      personId = existingByName.id;
      // Update their email if they didn't have one
      if (!existingByName.primary_email && normalizedEmail) {
        await supabase
          .from("people")
          .update({ primary_email: normalizedEmail })
          .eq("id", personId);
      }
    }
  }

  if (!personId) {
    // Create the person record (name is auto-generated from firstname/lastname)
    const { data: newPerson, error: personError } = await supabase
      .from("people")
      .insert({
        account_id: list.account_id,
        project_id: list.project_id,
        primary_email: normalizedEmail,
        firstname: firstName,
        lastname: lastName,
        company: "",
        person_type: "external",
      })
      .select("id")
      .single();

    if (personError || !newPerson) {
      return Response.json(
        { message: personError?.message ?? "Unable to create person" },
        { status: 500 },
      );
    }

    personId = newPerson.id;
  }

  // Update the response with the person_id
  const { data: response, error: updateError } = await supabase
    .from("research_link_responses")
    .update({
      person_id: personId,
      response_mode: responseMode,
    })
    .eq("id", data.responseId)
    .select("id, responses, completed")
    .single();

  if (updateError || !response) {
    return Response.json(
      { message: updateError?.message ?? "Unable to link person to response" },
      { status: 500 },
    );
  }

  return Response.json({
    responseId: response.id,
    responses: response.responses ?? {},
    completed: response.completed ?? false,
    personId,
  });
}
