import consola from "consola"
import { Check, Forward, SkipForward } from "lucide-react"
import { useEffect, useMemo, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { createClient } from "~/lib/supabase/client"

type MinimalQuestion = {
  id: string
  text: string
  status?: "proposed" | "asked" | "answered" | "skipped" | "rejected"
}

interface MinimalQuestionViewProps {
  projectId: string
}

export function MinimalQuestionView({ projectId }: MinimalQuestionViewProps) {
  const supabase = createClient()
  const [allQuestions, setAllQuestions] = useState<MinimalQuestion[]>([])
  const [rawMeta, setRawMeta] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Local ordering queue; store ids to manage defers
  const [queue, setQueue] = useState<string[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from("project_sections")
          .select("meta")
          .eq("project_id", projectId)
          .eq("kind", "questions")
          .maybeSingle()
        if (error) throw error
        setRawMeta(data?.meta || {})
        const q = (data?.meta?.questions || []) as any[]
        const normalizedRaw = q.map((x) => ({ id: x.id, text: (x as any).question || x.text || "", status: x.status || "proposed", selectedOrder: (x as any).selectedOrder ?? null, isSelected: (x as any).isSelected ?? false }))
        // Dedupe by id while preserving order
        const seen = new Set<string>()
        const deduped: (MinimalQuestion & { selectedOrder: number | null; isSelected: boolean })[] = []
        for (const item of normalizedRaw) {
          if (!item.id) continue
          if (seen.has(item.id)) continue
          seen.add(item.id)
          deduped.push(item)
        }
        // Build ordered list: prefer selected (by selectedOrder), fallback to remaining in original order
        const selected = deduped
          .filter((q) => q.isSelected || typeof q.selectedOrder === 'number')
          .sort((a, b) => (a.selectedOrder ?? 1e9) - (b.selectedOrder ?? 1e9))
        const selectedIds = new Set(selected.map((q) => q.id))
        const remaining = deduped.filter((q) => !selectedIds.has(q.id))
        const ordered = [...selected, ...remaining].map(({ id, text, status }) => ({ id, text, status }))
        setAllQuestions(ordered)
        setQueue(ordered.map((q) => q.id))
      } catch (e) {
        consola.error("MinimalQuestionView load error", e)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [projectId, supabase])

  const activeQuestions = useMemo(() => {
    const byId = new Map(allQuestions.map((q) => [q.id, q]))
    const seen = new Set<string>()
    const openIds = [] as string[]
    for (const id of queue) {
      if (seen.has(id)) continue
      const q = byId.get(id)
      if (!q) continue
      if (q.status === "answered" || q.status === "skipped") continue
      seen.add(id)
      openIds.push(id)
      if (openIds.length >= 2) break
    }
    return openIds.map((id) => byId.get(id)!).filter(Boolean)
  }, [allQuestions, queue])

  const persist = useCallback(async (next: MinimalQuestion[]) => {
    try {
      setSaving(true)
      const merged = { ...(rawMeta || {}), questions: next }
      await supabase
        .from("project_sections")
        .update({ meta: merged })
        .eq("project_id", projectId)
        .eq("kind", "questions")
    } catch (e) {
      consola.warn("MinimalQuestionView persist error", e)
    } finally {
      setSaving(false)
    }
  }, [projectId, rawMeta, supabase])

  const markDone = useCallback((id: string) => {
    setAllQuestions((prev) => {
      const next = prev.map((q) => (q.id === id ? { ...q, status: "answered" } : q))
      void persist(next)
      return next
    })
  }, [persist])

  const skip = useCallback((id: string) => {
    setAllQuestions((prev) => {
      const next = prev.map((q) => (q.id === id ? { ...q, status: "skipped" } : q))
      void persist(next)
      return next
    })
  }, [persist])

  const defer = useCallback((id: string) => {
    // Move to end of queue; keep status as-is (typically proposed), keep unique
    setQueue((prev) => {
      const rest = prev.filter((x) => x !== id)
      const next = [...rest, id]
      return Array.from(new Set(next))
    })
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Interview Questions</span>
          {saving && <span className="text-muted-foreground text-xs">Saving…</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && <div className="text-muted-foreground text-sm">Loading…</div>}
        {!loading && allQuestions.length === 0 && (
          <div className="text-muted-foreground text-sm">No questions configured for this project.</div>
        )}
        {!loading && allQuestions.length > 0 && activeQuestions.length === 0 && (
          <div className="text-muted-foreground text-sm">All questions completed. Great job!</div>
        )}
        {activeQuestions.map((q, idx) => (
          <div key={q.id} className={`rounded-md border p-3 ${idx === 0 ? 'border-green-200' : ''}`}>
            <div className="mb-1 text-muted-foreground text-xs uppercase tracking-wide">
              {idx === 0 ? 'Current Question' : 'Next Up'}
            </div>
            <div className="mb-3 text-sm">{q.text}</div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-green-600 text-green-700 hover:bg-green-50"
                onClick={() => markDone(q.id)}
              >
                <Check className="mr-1 h-4 w-4" /> Done
              </Button>
              <Button size="sm" variant="outline" onClick={() => skip(q.id)}>
                <SkipForward className="mr-1 h-4 w-4" /> Skip
              </Button>
              <Button size="sm" variant="secondary" onClick={() => defer(q.id)}>
                <Forward className="mr-1 h-4 w-4" /> Defer
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default MinimalQuestionView
