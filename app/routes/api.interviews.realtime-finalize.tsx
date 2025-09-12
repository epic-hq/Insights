import type { ActionFunctionArgs } from "react-router"
import consola from "consola"
import { userContext } from "~/server/user-context"

export async function action({ request, context, params }: ActionFunctionArgs) {
  try {
    const ctx = context.get(userContext)
    const supabase = ctx.supabase
    const { projectId } = params
    if (!projectId) {
      return new Response(JSON.stringify({ error: "Missing projectId in URL" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const { interviewId, transcript, transcriptFormatted, mediaUrl } = await request.json()
    if (!interviewId || typeof interviewId !== "string") {
      return new Response(JSON.stringify({ error: "interviewId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const update: Record<string, any> = {
      status: "transcribed",
      updated_at: new Date().toISOString(),
    }
    if (typeof transcript === "string") update.transcript = transcript
    if (transcriptFormatted) update.transcript_formatted = transcriptFormatted
    if (typeof mediaUrl === "string" && mediaUrl) update.media_url = mediaUrl

    const { error } = await supabase
      .from("interviews")
      .update(update)
      .eq("id", interviewId)
      .eq("project_id", projectId)

    if (error) {
      consola.error("Failed to finalize interview:", error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (e: any) {
    consola.error("Unexpected error in realtime-finalize:", e)
    return new Response(JSON.stringify({ error: e?.message || "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}

