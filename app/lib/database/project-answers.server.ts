import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "~/types"

type Tables = Database["public"]["Tables"]

type QuestionPlanItem = {
  id: string
  text: string
  categoryId: string | null
  estimatedMinutes: number | null
  orderIndex: number
}

export async function getProjectQuestionPlan(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<QuestionPlanItem[]> {
  const { data, error } = await supabase
    .from("project_sections")
    .select("meta")
    .eq("project_id", projectId)
    .eq("kind", "questions")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error

  const meta = (data?.meta as any) || {}
  const questions: QuestionPlanItem[] = []

  if (Array.isArray(meta?.questions)) {
    meta.questions.forEach((raw: any, idx: number) => {
      const id = typeof raw?.id === "string" ? raw.id : typeof raw?.question_id === "string" ? raw.question_id : null
      const text = typeof raw?.text === "string" && raw.text.trim()
        ? raw.text.trim()
        : typeof raw?.question === "string"
          ? raw.question.trim()
          : ""
      if (!id || !text) return
      const categoryId = typeof raw?.categoryId === "string" ? raw.categoryId : typeof raw?.category === "string" ? raw.category : null
      const estimated = Number.isFinite(raw?.estimatedMinutes) ? Number(raw.estimatedMinutes) : null
      const orderIndex = Number.isFinite(raw?.selectedOrder)
        ? Number(raw.selectedOrder)
        : Number.isFinite(raw?.order_index)
          ? Number(raw.order_index)
          : idx + 1

      questions.push({ id, text, categoryId, estimatedMinutes: estimated, orderIndex })
    })
  }

  return questions
}

export async function createPlannedAnswersForInterview(
  supabase: SupabaseClient<Database>,
  params: { projectId: string; interviewId: string }
) {
  const { projectId, interviewId } = params
  const plan = await getProjectQuestionPlan(supabase, projectId)
  if (!plan.length) return

  const { data: existingRows, error: existingError } = await supabase
    .from("project_answers")
    .select("id, question_id, order_index")
    .eq("project_id", projectId)
    .eq("interview_id", interviewId)

  if (existingError) throw existingError

  const existingByQuestionId = new Map<string, { id: string; order_index: number | null }>()
  existingRows?.forEach((row) => {
    if (row.question_id) existingByQuestionId.set(row.question_id, { id: row.id, order_index: row.order_index })
  })

  const inserts: Tables["project_answers"]["Insert"][] = []
  const updates: { id: string; payload: Tables["project_answers"]["Update"] }[] = []

  plan.forEach((item, idx) => {
    const orderIndex = item.orderIndex ?? idx + 1
    const insertPayload: Tables["project_answers"]["Insert"] = {
      project_id: projectId,
      interview_id: interviewId,
      question_id: item.id,
      question_text: item.text,
      question_category: item.categoryId,
      estimated_time_minutes: item.estimatedMinutes ?? undefined,
      order_index: orderIndex,
      status: "planned",
      origin: "scripted",
    }

    const existing = existingByQuestionId.get(item.id)
    if (existing) {
      const payload: Tables["project_answers"]["Update"] = {}
      if (!existing.order_index || existing.order_index !== orderIndex) {
        payload.order_index = orderIndex
      }
      if (Object.keys(payload).length) {
        updates.push({ id: existing.id, payload })
      }
    } else {
      inserts.push(insertPayload)
    }
  })

  if (inserts.length) {
    const { error: insertError } = await supabase.from("project_answers").insert(inserts)
    if (insertError) throw insertError
  }

  for (const update of updates) {
    const { error: updateError } = await supabase
      .from("project_answers")
      .update(update.payload)
      .eq("id", update.id)
    if (updateError) throw updateError
  }
}

export async function getInterviewQuestions(
  supabase: SupabaseClient<Database>,
  params: { projectId: string; interviewId: string }
) {
  const { projectId, interviewId } = params
  const { data, error } = await supabase
    .from("project_answers")
    .select(
      "id, question_id, question_text, question_category, status, order_index, answered_at, skipped_at"
    )
    .eq("project_id", projectId)
    .eq("interview_id", interviewId)
    .order("order_index", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true })

  if (error) throw error
  return data ?? []
}
