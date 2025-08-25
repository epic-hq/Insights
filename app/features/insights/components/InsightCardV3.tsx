import { useState } from "react"
import { StyledTag } from "~/components/TagDisplay"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent } from "~/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog"
import { EmotionBadge } from "~/components/ui/emotion-badge"
import { EntityInteractionPanel } from "~/components/EntityInteractionPanel"
import type { Insight } from "~/types"

interface InsightCardV3Props {
  insight: Insight
}

export function InsightCardV3({ insight }: InsightCardV3Props) {
  const [selected, setSelected] = useState<Insight | null>(null)

  return (
    <>
      <Card
        className="cursor-pointer transition-shadow hover:shadow-md"
        onClick={() => setSelected(insight)}
      >
        <CardContent className="p-4">
          <div className="pt-0 font-light text-gray-500 text-xs">Category: {insight.category}</div>
          <h3 className="mb-2 font-semibold text-gray-900">{insight.pain || "Untitled"}</h3>
          {insight.details && <p className="mb-4 line-clamp-4 text-gray-600 text-sm">{insight.details}</p>}
          <div className="flex flex-wrap items-center justify-between">
            <div className="flex items-center space-x-2">
              {insight.journey_stage && (
                <Badge variant="outline" className="text-xs">
                  {insight.journey_stage} stage
                </Badge>
              )}
            </div>
            {insight.emotional_response && <EmotionBadge emotion_string={insight.emotional_response} muted />}
          </div>
        </CardContent>
      </Card>

      {selected && (
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="mx-4 my-8 max-h-[90vh] w-[calc(100vw-2rem)] max-w-4xl overflow-hidden sm:mx-auto sm:w-full">
            <DialogHeader className="space-y-3 pb-4">
              <DialogTitle className="space-y-2">
                <div className="font-light text-gray-500 text-xs">{selected.name}</div>
                <div className="border-b pb-3 font-semibold text-lg">
                  {selected.pain}
                </div>
              </DialogTitle>
            </DialogHeader>
            
            <div className="max-h-[60vh] space-y-6 overflow-y-auto pr-2">
              {selected.category && (
                <Badge variant="outline" className="text-xs">
                  {selected.category}
                </Badge>
              )}
              
              {(selected.details || selected.evidence) && (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {selected.details && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-700 text-sm">Details</h4>
                      <p className="text-gray-600 text-sm leading-relaxed">{selected.details}</p>
                    </div>
                  )}
                  {selected.evidence && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-700 text-sm">Evidence</h4>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-gray-600 text-sm leading-relaxed">{selected.evidence}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selected.desired_outcome && (
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-700 text-sm">Desired Outcome</h4>
                  <p className="text-gray-600 text-sm leading-relaxed">{selected.desired_outcome}</p>
                </div>
              )}

              {selected.jtbd && (
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-700 text-sm">Job to be Done</h4>
                  <p className="text-gray-600 text-sm leading-relaxed">{selected.jtbd}</p>
                </div>
              )}
              
              {selected.insight_tags && (
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-700 text-sm">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {selected.insight_tags?.map((tag: any) => (
                      <StyledTag key={tag.tag} name={tag.tag} style={tag.style} frequency={tag.frequency} />
                    ))}
                  </div>
                </div>
              )}
              
              {selected.emotional_response && (
                <div className="flex items-center justify-end pt-2">
                  <EmotionBadge emotion_string={selected.emotional_response} muted />
                </div>
              )}
            </div>
            
            <DialogFooter className="mt-6 flex-row items-start justify-start pt-4 border-t">
              <EntityInteractionPanel entityType="insight" entityId={selected.id} />
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
