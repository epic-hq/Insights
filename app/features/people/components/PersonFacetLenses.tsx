import type { LucideIcon } from "lucide-react"
import { AlignLeft, BarChart3, Heart, Layers, Sparkles, Target, Users } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion"
import { Badge } from "~/components/ui/badge"
import { cn } from "~/lib/utils"

type FacetEntry = {
  facet_account_id: number
  label: string
  source: string | null
  confidence: number | null
  kind_slug: string
}

type FacetGroupLens = {
  kind_slug: string
  label: string
  summary?: string | null
  facets: FacetEntry[]
}

type PersonFacetLensesProps = {
  groups: FacetGroupLens[]
  isGenerating?: boolean
}

const KIND_ICON_MAP: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  pain: { icon: Heart, color: "text-rose-600", bg: "bg-rose-50" },
  goal: { icon: Target, color: "text-emerald-700", bg: "bg-emerald-50" },
  workflow: { icon: Layers, color: "text-amber-700", bg: "bg-amber-50" },
  task: { icon: BarChart3, color: "text-blue-700", bg: "bg-blue-50" },
  demographic: { icon: Users, color: "text-slate-700", bg: "bg-slate-100" },
  preference: { icon: AlignLeft, color: "text-indigo-700", bg: "bg-indigo-50" },
}

function getIcon(kindSlug: string) {
  return KIND_ICON_MAP[kindSlug] ?? { icon: Sparkles, color: "text-slate-700", bg: "bg-slate-100" }
}

function confidenceBadge(confidence: number | null) {
  if (confidence === null || confidence === undefined) return null
  if (confidence >= 0.7) {
    return (
      <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[0.65rem] text-emerald-700">
        High
      </span>
    )
  }
  if (confidence >= 0.4) {
    return (
      <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[0.65rem] text-amber-700">
        Medium
      </span>
    )
  }
  return (
    <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[0.65rem] text-rose-700">
      Low
    </span>
  )
}

function fallbackSummary(facets: FacetEntry[]) {
  if (!facets?.length) return "No attributes captured yet."
  const labels = facets
    .map((facet) => facet.label)
    .filter(Boolean)
    .slice(0, 3)
  return labels.join(" • ") || "No attributes captured yet."
}

export function PersonFacetLenses({ groups, isGenerating }: PersonFacetLensesProps) {
  if (!groups.length) return null

  const defaultAccordionValue = groups[0]?.kind_slug

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-1">
          <h2 className="font-semibold text-foreground text-lg">Attribute lenses</h2>
          <p className="text-muted-foreground text-sm">Headline takeaways per facet group, details inside.</p>
        </div>
        {isGenerating ? (
          <Badge variant="outline" className="text-[0.65rem] uppercase">
            Refreshing
          </Badge>
        ) : null}
      </div>

      <Accordion type="single" collapsible defaultValue={defaultAccordionValue} className="space-y-3">
        {groups.map((group) => {
          const iconConfig = getIcon(group.kind_slug)
          const summaryText = group.summary?.trim() || fallbackSummary(group.facets)

          return (
            <AccordionItem
              value={group.kind_slug}
              key={group.kind_slug}
              className="overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm"
            >
              <AccordionTrigger className="flex w-full items-center gap-3 px-4 py-3 text-left hover:no-underline">
                <div className={cn("flex h-9 w-9 items-center justify-center rounded-full", iconConfig.bg)}>
                  <iconConfig.icon className={cn("h-4 w-4", iconConfig.color)} />
                </div>
                <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                  <span className="font-semibold text-foreground text-sm capitalize">{group.label}</span>
                  <p className="flex-1 text-left text-sm text-muted-foreground line-clamp-2">{summaryText}</p>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 px-4 pb-4">
                <div className="rounded-lg border border-border/60 border-dashed bg-muted/10 p-3">
                  <p className="mb-2 text-muted-foreground text-xs uppercase tracking-wide">Signals</p>
                  <div className="flex flex-wrap gap-2">
                    {group.facets.map((facet) => (
                      <Badge
                        key={facet.facet_account_id}
                        variant="secondary"
                        className="flex items-center gap-2 text-xs leading-tight"
                      >
                        <span>{facet.label}</span>
                        {confidenceBadge(facet.confidence)}
                      </Badge>
                    ))}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </section>
  )
}
