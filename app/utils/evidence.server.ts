import type { Database } from "~/supabase/types"

export type EvidenceUnit = {
  verbatim: string
  support: "supports" | "refutes" | "neutral"
  kind_tags: { problem?: string[]; goal?: string[]; behavior?: string[]; emotion?: any; context?: string[]; artifact?: string[] }
  personas?: string[]
  segments?: string[]
  journey_stage?: string
  anchors: any[]
  confidence: "low" | "medium" | "high"
}

export async function persistEvidence(
  supabase: any,
  account_id: string,
  project_id: string,
  interview_id: string | null,
  units: EvidenceUnit[]
) {
  if (!units?.length) return []
  const rows = units.map((u) => ({
    account_id,
    project_id,
    interview_id,
    verbatim: u.verbatim,
    support: u.support,
    kind_tags: [
      ...(u.kind_tags.problem ?? []),
      ...(u.kind_tags.goal ?? []),
      ...(u.kind_tags.behavior ?? []),
      ...(Array.isArray(u.kind_tags.emotion) ? u.kind_tags.emotion : u.kind_tags.emotion ? [String(u.kind_tags.emotion)] : []),
      ...(u.kind_tags.context ?? []),
      ...(u.kind_tags.artifact ?? []),
    ],
    personas: u.personas ?? [],
    segments: u.segments ?? [],
    journey_stage: u.journey_stage ?? null,
    anchors: u.anchors,
    confidence: u.confidence,
  }))
  const { data, error } = await supabase.from("evidence").insert(rows).select("id")
  if (error) throw new Error(`persistEvidence insert failed: ${error.message}`)
  return data
}
