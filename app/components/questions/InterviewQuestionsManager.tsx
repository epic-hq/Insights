import React, { useCallback, useEffect, useMemo, useState } from "react"
import consola from "consola"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import { toast } from "sonner"
import { createClient } from "~/lib/supabase/client"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Slider } from "~/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Textarea } from "~/components/ui/textarea"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion"
import { Switch } from "~/components/ui/switch"
import { Brain, Clock, GripVertical, MoreHorizontal, Trash2, Settings, ChevronDown } from "lucide-react"

export type Purpose = "exploratory" | "validation" | "followup"
export type Familiarity = "cold" | "warm"

export interface InterviewQuestionsManagerProps {
  projectId?: string
  target_orgs?: string[]
  target_roles?: string[]
  research_goal?: string
  research_goal_details?: string
  assumptions?: string[]
  unknowns?: string[]
  defaultTimeMinutes?: 15 | 30 | 45 | 60
  defaultPurpose?: Purpose
  defaultFamiliarity?: Familiarity
  defaultGoDeep?: boolean
  onSelectionChange?: (ids: string[]) => void
  onComplete?: (questions: { id: string; text: string }) => void | ((questions: { id: string; text: string }[]) => void)
  onSelectedQuestionsChange?: (questions: { id: string; text: string }[]) => void
}

interface Question {
  id: string
  text: string
  categoryId: string
  scores: { importance: number; goalMatch: number; novelty: number }
  rationale?: string
  status: "proposed" | "asked" | "answered" | "skipped"
  timesAnswered: number
}

const questionCategories = [
  { id: "context", name: "Context & Background", weight: 1.0 },
  { id: "pain", name: "Pain Points & Problems", weight: 1.2 },
  { id: "workflow", name: "Workflow & Behavior", weight: 1.1 },
  { id: "goals", name: "Goals & Motivations", weight: 1.0 },
  { id: "constraints", name: "Constraints & Barriers", weight: 0.9 },
  { id: "willingness", name: "Willingness to Pay", weight: 0.8 },
]

export function InterviewQuestionsManager(props: InterviewQuestionsManagerProps) {
  const {
    projectId,
    target_orgs,
    target_roles,
    research_goal,
    research_goal_details,
    assumptions,
    unknowns,
    defaultTimeMinutes = 30,
    defaultPurpose = "exploratory",
    defaultFamiliarity = "cold",
    defaultGoDeep = false,
    onSelectionChange,
    onSelectedQuestionsChange,
  } = props

  const [timeMinutes, setTimeMinutes] = useState<number>(defaultTimeMinutes)
  const [purpose, setPurpose] = useState<Purpose>(defaultPurpose)
  const [familiarity, setFamiliarity] = useState<Familiarity>(defaultFamiliarity)
  const [goDeepMode, setGoDeepMode] = useState<boolean>(defaultGoDeep)
  const [customInstructions, setCustomInstructions] = useState("")
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([])
  const [hasInitialized, setHasInitialized] = useState(false)
  const [showAllQuestions, setShowAllQuestions] = useState(false)
  const [isDesktopSettingsOpen, setIsDesktopSettingsOpen] = useState(false)
  const [showCustomInstructions, setShowCustomInstructions] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    onSelectionChange?.(selectedQuestionIds)
  }, [selectedQuestionIds, onSelectionChange])

  // Load questions from project_sections when projectId is provided
  useEffect(() => {
    const loadQuestions = async () => {
      if (!projectId) {
        setLoading(false)
        return
      }
      try {
        const { data: questionsSection, error: sectionError } = await supabase
          .from("project_sections")
          .select("*")
          .eq("project_id", projectId)
          .eq("kind", "questions")
          .order("created_at", { ascending: false })
          .limit(1)
          .single()

        if (sectionError && sectionError.code !== "PGRST116") throw sectionError

        const { data: answerCounts, error: countsError } = await supabase
          .from("project_answers")
          .select("question_id, status")
          .eq("project_id", projectId)

        if (countsError) throw countsError

        const answerCountMap = new Map<string, number>()
        answerCounts?.forEach((answer) => {
          if (answer.status === "answered") {
            const count = answerCountMap.get(answer.question_id || "") || 0
            answerCountMap.set(answer.question_id || "", count + 1)
          }
        })

        const meta = (questionsSection?.meta as any) || {}
        const questionsData = meta.questions || []
        const settings = meta.settings || {}
        
        // Load saved settings if they exist
        if (settings.timeMinutes) setTimeMinutes(settings.timeMinutes)
        if (settings.purpose) setPurpose(settings.purpose)
        if (settings.familiarity) setFamiliarity(settings.familiarity)
        if (settings.goDeepMode !== undefined) setGoDeepMode(settings.goDeepMode)
        if (settings.customInstructions) setCustomInstructions(settings.customInstructions)
        
        const formattedQuestions: Question[] = questionsData.map((q: any, index: number) => ({
          id: q.id || `q_${index}`,
          text: q.text || q.question,
          categoryId: q.categoryId || q.category || "context",
          scores: q.scores || {
            importance: q.importance || 0.5,
            goalMatch: q.goalMatch || 0.5,
            novelty: q.novelty || 0.5,
          },
          rationale: q.rationale || "",
          status: (q.status as Question["status"]) || "proposed",
          timesAnswered: answerCountMap.get(q.id || `q_${index}`) || 0,
        }))

        const selectedQuestionsWithOrder = questionsData
          .filter((q: any) => q.isSelected === true)
          .sort((a: any, b: any) => (a.selectedOrder || 0) - (b.selectedOrder || 0))
          .map((q: any) => q.id as string)

        setQuestions(formattedQuestions)
        if (selectedQuestionsWithOrder.length > 0) {
          setSelectedQuestionIds(selectedQuestionsWithOrder)
          setHasInitialized(true)
        }
      } catch (error) {
        consola.error("Error loading questions:", error)
      } finally {
        setLoading(false)
      }
    }

    loadQuestions()
  }, [projectId, supabase])

  const estimateMinutesPerQuestion = useCallback((q: Question, p: Purpose, f: Familiarity): number => {
    const baseTimes = { exploratory: 6.5, validation: 4.5, followup: 3.5 }
    const categoryAdjustments: Record<string, number> = {
      pain: 0.5,
      workflow: 0.5,
      goals: 0.25,
      willingness: 0.25,
      constraints: 0,
      context: 0,
    }
    const familiarityAdjustment = f === "warm" ? -0.5 : f === "cold" ? 0.5 : 0
    const baseTime = baseTimes[p]
    const categoryAdj = categoryAdjustments[q.categoryId] || 0
    return Math.max(2.5, baseTime + categoryAdj + familiarityAdjustment)
  }, [])

  const calculateCompositeScore = useCallback((q: Question): number => {
    const categoryWeight = questionCategories.find((c) => c.id === q.categoryId)?.weight || 1
    const s = q.scores
    return 0.5 * (s.importance || 0) + 0.35 * (s.goalMatch || 0) + 0.15 * (s.novelty || 0) * categoryWeight
  }, [])

  const questionPack = useMemo(() => {
    const targetCounts: Record<number, { base: number; validation: number; cold: number }> = {
      15: { base: 3, validation: +1, cold: -1 },
      30: { base: 5, validation: +1, cold: -1 },
      45: { base: 7, validation: +1, cold: -1 },
      60: { base: 9, validation: +1, cold: -1 },
    }

    const tc = targetCounts[timeMinutes]
    const targetCount = Math.max(2, tc.base + (purpose === "validation" ? tc.validation : 0) + (familiarity === "cold" ? tc.cold : 0))

    const allQuestionsWithScores = questions
      .filter((q) => q.status === "proposed")
      .map((q) => ({
        ...q,
        compositeScore: calculateCompositeScore(q),
        estimatedMinutes: estimateMinutesPerQuestion(q, purpose, familiarity),
      }))

    let autoSelectedIds: string[] = []
    if (selectedQuestionIds.length === 0) {
      let selected: typeof allQuestionsWithScores = []

      if (goDeepMode) {
        selected = [...allQuestionsWithScores].sort((a, b) => b.compositeScore - a.compositeScore).slice(0, Math.min(3, targetCount))
      }

      const categoryMap = new Map<string, typeof allQuestionsWithScores>()
      for (const q of allQuestionsWithScores) {
        if (!categoryMap.has(q.categoryId)) categoryMap.set(q.categoryId, [])
        categoryMap.get(q.categoryId)!.push(q)
      }
      for (const arr of categoryMap.values()) arr.sort((a, b) => b.compositeScore - a.compositeScore)

      for (const categoryId of ["context", "pain", "workflow"]) {
        const arr = categoryMap.get(categoryId) || []
        const already = selected.find((q) => q.categoryId === categoryId)
        if (!already && arr.length > 0 && selected.length < targetCount) {
          const best = arr[0]
          if (!selected.find((q) => q.id === best.id)) selected.push(best)
        }
      }

      const remaining = allQuestionsWithScores
        .filter((q) => !selected.find((s) => s.id === q.id))
        .sort((a, b) => b.compositeScore - a.compositeScore)

      let budget = timeMinutes
      for (const q of selected) budget -= q.estimatedMinutes
      for (const q of remaining) {
        if (selected.length >= targetCount) break
        if (budget - q.estimatedMinutes < 0) continue
        selected.push(q)
        budget -= q.estimatedMinutes
      }

      autoSelectedIds = selected.map((q) => q.id)
    }

    const idsToUse = selectedQuestionIds.length > 0 ? selectedQuestionIds : autoSelectedIds
    // Ensure uniqueness in the selected order to prevent duplicate rendering/markers
    const seen = new Set<string>()
    const orderedSelectedQuestions = idsToUse
      .map((id) => allQuestionsWithScores.find((q) => q.id === id))
      .filter((q): q is (Question & { compositeScore: number; estimatedMinutes: number }) => Boolean(q))
      .filter((q) => {
        if (seen.has(q.id)) return false
        seen.add(q.id)
        return true
      })

    const totalEstimatedTime = orderedSelectedQuestions.reduce((sum, q) => sum + q.estimatedMinutes, 0)

    // Compute overflow index (first index where cumulative time exceeds target)
    let overflowIndex = -1
    let running = 0
    for (let i = 0; i < orderedSelectedQuestions.length; i++) {
      running += orderedSelectedQuestions[i].estimatedMinutes
      if (overflowIndex === -1 && running > timeMinutes) {
        overflowIndex = i
        break
      }
    }
    const belowCount = overflowIndex >= 0 ? orderedSelectedQuestions.length - overflowIndex : 0

    return {
      questions: orderedSelectedQuestions,
      totalEstimatedTime,
      targetTime: timeMinutes,
      remainingQuestions: allQuestionsWithScores.filter((q) => !orderedSelectedQuestions.find((s) => s.id === q.id)),
      overflowIndex,
      belowCount,
    }
  }, [timeMinutes, purpose, familiarity, goDeepMode, questions, selectedQuestionIds, hasInitialized, calculateCompositeScore, estimateMinutesPerQuestion])

  // Initialize selected questions once after computing the pack (no state changes inside useMemo)
  useEffect(() => {
    if (!hasInitialized && selectedQuestionIds.length === 0 && questionPack.questions.length > 0) {
      const ids = questionPack.questions.map((q) => q.id)
      setSelectedQuestionIds(ids)
      setHasInitialized(true)
    }
  }, [hasInitialized, selectedQuestionIds.length, questionPack.questions])

  // Notify parent when the selected questions (with text) change
  useEffect(() => {
    if (!onSelectedQuestionsChange) return
    const minimal = questionPack.questions.map((q) => ({ id: q.id, text: q.text }))
    onSelectedQuestionsChange(minimal)
  }, [questionPack.questions, onSelectedQuestionsChange])

  const saveQuestionsToDatabase = useCallback(
    async (questionsToSave: Question[], selectedIds: string[]) => {
      if (!projectId) return
      try {
        const withOrder = questionsToSave.map((q) => {
          const selectedIndex = selectedIds.indexOf(q.id)
          return { ...q, status: "proposed", selectedOrder: selectedIndex >= 0 ? selectedIndex : null, isSelected: selectedIndex >= 0 }
        })
        const { error } = await supabase.from("project_sections").upsert(
          {
            project_id: projectId,
            kind: "questions",
            content_md: `# Interview Questions\n\nManaged ${withOrder.length} questions for interview planning.`,
            meta: { 
              questions: withOrder,
              settings: {
                timeMinutes,
                purpose,
                familiarity,
                goDeepMode,
                customInstructions
              }
            },
          },
          { onConflict: "project_id,kind", ignoreDuplicates: false },
        )
        if (error) consola.error("Error saving questions:", error)
      } catch (e) {
        consola.error("Error saving questions to database:", e)
      }
    },
    [projectId, supabase, timeMinutes, purpose, familiarity, goDeepMode, customInstructions],
  )

  // Save settings changes to database (separate from question changes)
  useEffect(() => {
    if (!projectId || !hasInitialized) return
    const timeoutId = setTimeout(() => {
      saveQuestionsToDatabase(questions, selectedQuestionIds)
    }, 1000) // Debounce saves - longer timeout for settings
    return () => clearTimeout(timeoutId)
  }, [timeMinutes, purpose, familiarity, goDeepMode, customInstructions, projectId, hasInitialized, questions, selectedQuestionIds, saveQuestionsToDatabase])

  const removeQuestion = useCallback(
    async (id: string) => {
      const newIds = selectedQuestionIds.filter((qId) => qId !== id)
      setSelectedQuestionIds(newIds)
      await saveQuestionsToDatabase(questions, newIds)
    },
    [selectedQuestionIds, questions, saveQuestionsToDatabase],
  )

  const moveQuestion = useCallback(
    async (fromIndex: number, toIndex: number) => {
      const currentIds = selectedQuestionIds.length > 0 ? selectedQuestionIds : questionPack.questions.map((q) => q.id)
      const newIds = [...currentIds]
      const [removed] = newIds.splice(fromIndex, 1)
      newIds.splice(toIndex, 0, removed)
      setSelectedQuestionIds(newIds)
      setHasInitialized(true)
      await saveQuestionsToDatabase(questions, newIds)
    },
    [selectedQuestionIds, questionPack.questions, questions, saveQuestionsToDatabase],
  )

  const onDragEnd = (result: any) => {
    if (!result.destination) return
    const { source, destination } = result
    if (source.index !== destination.index) moveQuestion(source.index, destination.index)
  }

  const addQuestionFromReserve = useCallback(
    async (question: Question) => {
      if (selectedQuestionIds.includes(question.id)) return
      const baseIds = selectedQuestionIds.length > 0 ? selectedQuestionIds : questionPack.questions.map((q) => q.id)
      const newIds = [...baseIds, question.id]
      setSelectedQuestionIds(newIds)
      setHasInitialized(true)
      await saveQuestionsToDatabase(questions, newIds)
    },
    [selectedQuestionIds, questionPack.questions, questions, saveQuestionsToDatabase],
  )

  const getCategoryColor = (categoryId: string) => {
    const colors: Record<string, string> = {
      context: "bg-blue-100 text-blue-800",
      pain: "bg-red-100 text-red-800",
      workflow: "bg-purple-100 text-purple-800",
      goals: "bg-green-100 text-green-800",
      constraints: "bg-yellow-100 text-yellow-800",
      willingness: "bg-orange-100 text-orange-800",
    }
    return colors[categoryId] || "bg-gray-100 text-gray-800"
  }

  const getAnsweredCountColor = (count: number) => {
    if (count === 0) return "bg-transparent text-gray-600"
    if (count <= 3) return "bg-transparent text-yellow-600"
    if (count <= 10) return "bg-transparent text-green-600"
    return "bg-transparent text-blue-600"
  }

  const generateQuestions = async () => {
    if (generating) return
    setGenerating(true)
    try {
      // Create FormData for remix-style API
      const formData = new FormData()
      formData.append("project_id", projectId || "")
      formData.append("custom_instructions", customInstructions || "")
      formData.append("questionCount", "10")
      formData.append("interview_time_limit", timeMinutes.toString())
      
      // Add optional fields from props (for onboarding flow)
      if (target_orgs?.length) formData.append("target_orgs", target_orgs.join(", "))
      if (target_roles?.length) formData.append("target_roles", target_roles.join(", "))
      if (research_goal) formData.append("research_goal", research_goal)
      if (research_goal_details) formData.append("research_goal_details", research_goal_details)
      if (assumptions?.length) formData.append("assumptions", assumptions.join(", "))
      if (unknowns?.length) formData.append("unknowns", unknowns.join(", "))

      const response = await fetch("/api/generate-questions", {
        method: "POST",
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.questionSet?.questions) {
          const newQuestions = data.questionSet.questions
          if (projectId) {
            const existingQuestions = questions.map((q) => {
              const idx = selectedQuestionIds.indexOf(q.id)
              return { id: q.id, text: q.text, categoryId: q.categoryId, scores: q.scores, rationale: q.rationale, status: "proposed", selectedOrder: idx >= 0 ? idx : null, isSelected: idx >= 0 }
            })
            const allQuestions = [...existingQuestions, ...newQuestions]
            await supabase.from("project_sections").upsert(
              {
                project_id: projectId,
                kind: "questions",
                content_md: `# Interview Questions\n\nGenerated ${allQuestions.length} questions for interview planning.`,
                meta: { questions: allQuestions },
              },
              { onConflict: "project_id,kind", ignoreDuplicates: false },
            )
          }

          const formattedNewQuestions: Question[] = newQuestions.map((q: any) => ({
            id: q.id || crypto.randomUUID(),
            text: q.text,
            categoryId: q.categoryId || "context",
            scores: q.scores || { importance: 0.5, goalMatch: 0.5, novelty: 0.5 },
            rationale: q.rationale || "",
            status: "proposed",
            timesAnswered: 0,
          }))
          setQuestions((prev) => [...prev, ...formattedNewQuestions])
          toast.success(`Added ${formattedNewQuestions.length} new questions to the bottom of your available list`, {
            description: "You can now select them to add to your question pack",
            duration: 4000,
          })
        } else {
          toast.error("Failed to generate questions", {
            description: "The response was successful but contained no questions",
          })
        }
      } else {
        // Handle API error response
        try {
          const errorData = await response.json()
          toast.error("Failed to generate questions", {
            description: errorData.error || `Server error: ${response.status}`,
          })
        } catch {
          toast.error("Failed to generate questions", {
            description: `Server error: ${response.status}`,
          })
        }
      }
    } catch (e) {
      consola.error("Error generating questions:", e)
      toast.error("Failed to generate questions", {
        description: "An unexpected error occurred. Please try again.",
      })
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-8"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column: Settings & AI Generation */}
      <div className="space-y-6">
        <Card>
          <Accordion type="single" collapsible value={isDesktopSettingsOpen ? "settings" : ""} onValueChange={(v) => setIsDesktopSettingsOpen(v === "settings")}>
            <AccordionItem value="settings">
              <AccordionTrigger className="hover:no-underline px-3 py-3">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  {isDesktopSettingsOpen ? (
                    <span>Interview Settings</span>
                  ) : (
                    <span>{timeMinutes}m {purpose.charAt(0).toUpperCase() + purpose.slice(1)}</span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm mb-3">Available Time: {timeMinutes} minutes</label>
                      <Slider value={[timeMinutes]} onValueChange={(v) => setTimeMinutes(v[0])} max={60} min={15} step={15} className="w-full" />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>15m</span>
                        <span>30m</span>
                        <span>45m</span>
                        <span>60m</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm mb-2">Interview Purpose</label>
                      <Select value={purpose} onValueChange={(v: Purpose) => setPurpose(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="exploratory">Exploratory (open-ended)</SelectItem>
                          <SelectItem value="validation">Validation (hypothesis testing)</SelectItem>
                          <SelectItem value="followup">Follow-up (specific topics)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm mb-2">Participant Familiarity</label>
                      <Select value={familiarity} onValueChange={(v: Familiarity) => setFamiliarity(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cold">Cold (first interaction)</SelectItem>
                          <SelectItem value="warm">Warm (established rapport)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-sm">Go Deep Quick Mode</label>
                      <Switch checked={goDeepMode} onCheckedChange={setGoDeepMode} />
                    </div>
                  </div>
                </CardContent>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>

        <Card>
          <CardContent className="p-3 space-y-3">
            {showCustomInstructions && (
              <Textarea placeholder="Modify questions" value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)} rows={3} />
            )}
            <div className="flex gap-2">
              <Button onClick={generateQuestions} disabled={generating} variant="outline" className="flex-1">
                {generating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" /> Generating Questions...
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4 mr-2" /> Generate New Questions
                  </>
                )}
              </Button>
              <Button 
                onClick={() => setShowCustomInstructions(!showCustomInstructions)} 
                variant="outline" 
                size="icon"
                className="shrink-0"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${showCustomInstructions ? 'rotate-180' : ''}`} />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Question Pack */}
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>Your Question Pack ({questionPack.questions.length})</span>
              </div>
              <div className="text-right">
                <div className={`text-sm font-medium ${questionPack.totalEstimatedTime > questionPack.targetTime ? "text-red-600" : "text-green-600"}`}>
                  {Math.round(questionPack.totalEstimatedTime)}m / {questionPack.targetTime}m
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="question-pack">
                {(provided) => (
                  <div className="space-y-4" {...provided.droppableProps} ref={provided.innerRef}>
                    {questionPack.questions.map((question, index) => {
                      const isFirstOverflow = index === questionPack.overflowIndex
                      const runningTime = questionPack.questions.slice(0, index + 1).reduce((sum, q) => sum + q.estimatedMinutes, 0)
                      const fitsInTime = runningTime <= timeMinutes

                      return (
                        <React.Fragment key={question.id}>
                          {isFirstOverflow && (
                            <div className="border-t-2 border-dashed border-orange-300 pt-4 mt-6">
                              <div className="flex items-center gap-2 mb-4">
                                <Clock className="w-4 h-4 text-orange-600" />
                                <span className="text-sm font-medium text-orange-600">Questions below may not fit in your {timeMinutes}-minute time limit ({questionPack.belowCount} below)</span>
                              </div>
                            </div>
                          )}
                          <Draggable draggableId={question.id} index={index}>
                            {(provided, snapshot) => (
                              <div ref={provided.innerRef} {...provided.draggableProps} className={`${snapshot.isDragging ? "opacity-50" : ""}`}>
                                <Card className={`border-l-4 ${fitsInTime ? "border-l-blue-500" : "border-l-orange-500 bg-orange-50/30 dark:bg-orange-950/30"}`}>
                                  <CardContent className="px-3">
                                    <div className="flex items-start gap-3">
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <div {...provided.dragHandleProps}>
                                          <GripVertical className="w-4 h-4 text-gray-400 cursor-grab active:cursor-grabbing" />
                                        </div>
                                        <Badge variant="outline" className="text-xs">#{index + 1}</Badge>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium leading-relaxed mb-2" title={question.rationale ? `Why: ${question.rationale}` : undefined}>{question.text}</p>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <Badge className={getCategoryColor(question.categoryId)}>{questionCategories.find((c) => c.id === question.categoryId)?.name}</Badge>
                                          <Badge variant="outline" className="text-xs">~{Math.round(question.estimatedMinutes)}m</Badge>
                                          <Badge className={getAnsweredCountColor(question.timesAnswered)} variant="outline">{question.timesAnswered}x answered</Badge>
                                        </div>
                                      </div>
                                      <Button variant="ghost" size="sm" onClick={() => removeQuestion(question.id)} className="text-red-500 hover:text-red-700">
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            )}
                          </Draggable>
                        </React.Fragment>
                      )
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            {questionPack.remainingQuestions.length > 0 && (
              <div className="mt-6">
                <div className="border-t pt-4">
                  <Button variant="outline" onClick={() => setShowAllQuestions(!showAllQuestions)} className="w-full mb-4">
                    <MoreHorizontal className="w-4 h-4 mr-2" /> {showAllQuestions ? "Hide" : "Show"} Additional Questions ({questionPack.remainingQuestions.length})
                  </Button>

                  {showAllQuestions && (
                    <div className="mt-4 space-y-3">
                      <p className="text-sm text-gray-600">Additional questions below the line - click to include in your pack:</p>
                      {questionPack.remainingQuestions.map((question) => (
                        <Card key={question.id} className="border-dashed border-gray-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors py-2" onClick={() => addQuestionFromReserve(question as any)}>
                          <CardContent className="p-3">
                            <div className="flex items-start gap-3">
                              <div className="flex items-center gap-2 mt-1">
                                <GripVertical className="w-4 h-4 text-gray-400" />
                                <MoreHorizontal className="w-4 h-4 text-gray-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm leading-relaxed" title={question.rationale ? `Why: ${question.rationale}` : undefined}>{question.text}</p>
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <Badge className={getCategoryColor((question as any).categoryId)} variant="outline">{questionCategories.find((c) => c.id === (question as any).categoryId)?.name}</Badge>
                                  <Badge variant="outline" className="text-xs">~{Math.round((question as any).estimatedMinutes)}</Badge>
                                  <Badge className={getAnsweredCountColor((question as any).timesAnswered)} variant="outline">{(question as any).timesAnswered}x answered</Badge>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default InterviewQuestionsManager
