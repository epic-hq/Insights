import { motion } from "framer-motion"
import {
  Badge,
} from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu"
import { Textarea } from "~/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { Edit, MoreHorizontal, Trash2, TriangleAlert, X, Zap, Check, GripVertical } from "lucide-react"

export type QualityFlagType = {
  assessment: "red" | "yellow" | "green"
  score: number
  description: string
}

export interface QuestionCardProps {
  question: {
    id: string
    text: string
    categoryId: string
    estimatedMinutes?: number
    timesAnswered: number
    source?: "ai" | "user"
    isMustHave?: boolean
    qualityFlag?: QualityFlagType | null
  }
  index?: number
  categoryLabel: string
  categoryClass: string
  fitsInTime: boolean

  // Drag
  dragHandleProps?: any
  draggableProps?: any
  innerRef?: (el: HTMLElement | null) => void

  // Editing
  isEditing: boolean
  editingText: string
  onEditingTextChange: (v: string) => void
  onSaveEdit: () => void
  onCancelEdit: () => void

  // Menu actions
  onToggleMustHave: () => void
  onGenerateFollowups: () => void
  generatingFollowUp?: boolean
  onEditStart: () => void
  onRemove: () => void
}

function QualityFlag({ qualityFlag }: { qualityFlag?: QualityFlagType | null }) {
  if (!qualityFlag) return null
  const color =
    qualityFlag.assessment === "red"
      ? "bg-red-100 text-red-700 border-red-200"
      : qualityFlag.assessment === "yellow"
      ? "bg-yellow-100 text-yellow-700 border-yellow-200"
      : "bg-green-100 text-green-700 border-green-200"
  return (
    <div className={`inline-flex items-center rounded-full border px-2 py-1 text-xs ${color}`}>
      <TriangleAlert className="mr-1 h-3.5 w-3.5" />
      {qualityFlag.score}
    </div>
  )
}

import React from "react"

function QuestionCardComponent(props: QuestionCardProps) {
  const {
    question,
    categoryLabel,
    categoryClass,
    fitsInTime,
    dragHandleProps,
    draggableProps,
    innerRef,
    isEditing,
    editingText,
    onEditingTextChange,
    onSaveEdit,
    onCancelEdit,
    onToggleMustHave,
    onGenerateFollowups,
    generatingFollowUp,
    onEditStart,
    onRemove,
  } = props

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <Card className={`border-none sm:rounded-xl sm:border sm:border-gray-200 sm:border-l-4 sm:shadow-sm ${
        fitsInTime ? "sm:border-l-blue-500" : "bg-orange-50/30 sm:border-l-orange-500 dark:bg-orange-950/30"
      }`} ref={innerRef as any} {...draggableProps}>
        <CardContent className="p-2 sm:p-2">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex items-center gap-3">
              <div {...dragHandleProps}>
                <GripVertical className="h-4 w-4 cursor-grab text-gray-400 active:cursor-grabbing" />
              </div>
              {typeof props.index === "number" && (
                <div className="min-w-[1.5rem] text-foreground/60 text-sm font-medium">{(props.index ?? 0) + 1}</div>
              )}
              <Badge variant="outline" className={categoryClass}>{categoryLabel}</Badge>
              {typeof question.estimatedMinutes === "number" && (
                <Badge variant="outline" className="text-muted-foreground text-xs">~{Math.round(question.estimatedMinutes)}m</Badge>
              )}
              {question.source === "user" && (
                <Badge variant="outline" className="border-blue-200 text-blue-800">Custom</Badge>
              )}
              {question.timesAnswered > 0 && (
                <Badge variant="outline" className="text-green-700">{question.timesAnswered}</Badge>
              )}
              {question.isMustHave && (
                <Badge variant="outline" className="border-red-200 text-red-800"><TriangleAlert className="mr-1 h-3 w-3"/>Must-Have</Badge>
              )}
            </div>

            <div className="min-w-0 flex-1">
              {isEditing ? (
                <div className="mb-2 flex items-center gap-2">
                  <Textarea value={editingText} onChange={(e) => onEditingTextChange(e.target.value)} rows={2} className="resize-none" />
                  <Button variant="ghost" size="icon" onClick={onSaveEdit} className="text-green-600"><Check className="h-4 w-4"/></Button>
                  <Button variant="ghost" size="icon" onClick={onCancelEdit} className="text-gray-500"><X className="h-4 w-4"/></Button>
                </div>
              ) : (
                <p className="mb-2 font-medium text-sm leading-relaxed">{question.text}</p>
              )}
            </div>

            <div className="flex items-center gap-1">
              <QualityFlag qualityFlag={question.qualityFlag} />
              <DropdownMenu>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4"/></Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Refine & Manage questions</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onToggleMustHave}><TriangleAlert className="mr-2 h-4 w-4" /> {question.isMustHave ? "Remove Must-Have" : "Mark Must-Have"}</DropdownMenuItem>
                  <DropdownMenuItem onClick={onGenerateFollowups} disabled={!!generatingFollowUp}>{generatingFollowUp ? (<div className="mr-2 h-4 w-4 animate-spin rounded-full border-current border-b-2" />) : (<Zap className="mr-2 h-4 w-4" />)}Generate Follow-ups</DropdownMenuItem>
                  <DropdownMenuItem onClick={onEditStart}><Edit className="mr-2 h-4 w-4" /> Edit Question</DropdownMenuItem>
                  <DropdownMenuItem onClick={onRemove} className="text-red-600 focus:text-red-600"><Trash2 className="mr-2 h-4 w-4" /> Remove Question</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default React.memo(QuestionCardComponent)
