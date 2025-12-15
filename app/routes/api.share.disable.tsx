/**
 * API endpoint to disable public sharing for an interview.
 * Keeps the token for potential re-enable but sets share_enabled to false.
 */
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { userContext } from "~/server/user-context";

const DisableShareSchema = z.object({
  interviewId: z.string().uuid(),
});

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const ctx = context.get(userContext);
  const supabase = ctx.supabase;

  if (!supabase) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const parsed = DisableShareSchema.safeParse({
    interviewId: formData.get("interviewId"),
  });

  if (!parsed.success) {
    consola.warn("[share.disable] Invalid payload", parsed.error.flatten());
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { interviewId } = parsed.data;

  try {
    // Verify user has access to this interview via RLS
    const { data: interview, error: fetchError } = await supabase
      .from("interviews")
      .select("id")
      .eq("id", interviewId)
      .single();

    if (fetchError || !interview) {
      consola.warn("[share.disable] Interview not found or no access", {
        interviewId,
        error: fetchError,
      });
      return Response.json({ error: "Interview not found" }, { status: 404 });
    }

    // Disable sharing but keep the token for potential re-enable
    const { error: updateError } = await supabase
      .from("interviews")
      .update({
        share_enabled: false,
      })
      .eq("id", interviewId);

    if (updateError) {
      consola.error("[share.disable] Failed to disable sharing", {
        interviewId,
        error: updateError,
      });
      return Response.json(
        { error: "Failed to disable sharing" },
        { status: 500 },
      );
    }

    consola.info("[share.disable] Sharing disabled", { interviewId });

    return Response.json({ ok: true });
  } catch (error) {
    consola.error("[share.disable] Unexpected error", { error });
    return Response.json(
      { error: "Failed to disable sharing" },
      { status: 500 },
    );
  }
}
