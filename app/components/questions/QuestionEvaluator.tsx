import { AlertTriangle, CheckCircle, Edit, XCircle } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Textarea } from "~/components/ui/textarea"

type QualityIndicator = "green" | "yellow" | "red"

interface QuestionEvaluation {
  overall_quality: QualityIndicator
  score: number
  strengths: string[]
  issues: {
    type: string
    description: string
    severity: "high" | "medium" | "low"
  }[]
  improvement?: {
    original_question: string
    suggested_rewrite: string
    explanation: string
  }
  recommendation: "proceed" | "revise"
  quick_feedback: string
}

interface QuestionEvaluatorProps {
  question: string
  researchContext: string
  onQuestionChange: (newQuestion: string) => void
  onProceed: () => void
  onCancel?: () => void
}

export default function QuestionEvaluator({
  question,
  researchContext,
  onQuestionChange,
  onProceed,
  onCancel,
}: QuestionEvaluatorProps) {
  const [evaluation, setEvaluation] = useState<QuestionEvaluation | null>(null)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedQuestion, setEditedQuestion] = useState(question)

  const evaluateQuestion = async () => {
    setIsEvaluating(true)
    try {
      const response = await fetch("/api/evaluate-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: editedQuestion,
          research_context: researchContext,
        }),
      })

      if (!response.ok) throw new Error("Evaluation failed")
      
      const result = await response.json()
      setEvaluation(result)
    } catch (error) {
      toast.error("Failed to evaluate question")
      console.error("Question evaluation error:", error)
    } finally {
      setIsEvaluating(false)
    }
  }

  const handleAcceptSuggestion = () => {
    if (evaluation?.improvement?.suggested_rewrite) {
      setEditedQuestion(evaluation.improvement.suggested_rewrite)
      setIsEditing(false)
      // Re-evaluate the improved question
      setTimeout(evaluateQuestion, 100)
    }
  }

  const handleProceed = () => {
    onQuestionChange(editedQuestion)
    onProceed()
  }

  const getQualityIcon = (quality: QualityIndicator) => {
    switch (quality) {
      case "green":
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case "yellow":
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      case "red":
        return <XCircle className="h-5 w-5 text-red-600" />
    }
  }

  const getQualityColor = (quality: QualityIndicator) => {
    switch (quality) {
      case "green":
        return "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20"
      case "yellow":
        return "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20"
      case "red":
        return "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Question Quality Check
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Question Input */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Your Question
            </label>
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={editedQuestion}
                  onChange={(e) => setEditedQuestion(e.target.value)}
                  placeholder="Enter your interview question..."
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setIsEditing(false)}>
                    Save Changes
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditedQuestion(question)
                      setIsEditing(false)
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="group relative">
                <div className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {editedQuestion}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Evaluate Button */}
          <Button
            onClick={evaluateQuestion}
            disabled={isEvaluating || !editedQuestion.trim()}
            className="w-full"
          >
            {isEvaluating ? "Evaluating..." : "Check Question Quality"}
          </Button>
        </CardContent>
      </Card>

      {/* Evaluation Results */}
      {evaluation && (
        <Card className={getQualityColor(evaluation.overall_quality)}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3 mb-4">
              {getQualityIcon(evaluation.overall_quality)}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-lg">
                    Quality Score: {evaluation.score}/100
                  </span>
                  <Badge variant={evaluation.overall_quality === "green" ? "default" : "secondary"}>
                    {evaluation.overall_quality.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {evaluation.quick_feedback}
                </p>
              </div>
            </div>

            {/* Strengths */}
            {evaluation.strengths.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium text-sm text-green-800 dark:text-green-200 mb-2">
                  ✓ Strengths
                </h4>
                <ul className="text-sm space-y-1">
                  {evaluation.strengths.map((strength, index) => (
                    <li key={index} className="text-green-700 dark:text-green-300">
                      • {strength}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Issues */}
            {evaluation.issues.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium text-sm text-red-800 dark:text-red-200 mb-2">
                  ⚠ Issues Found
                </h4>
                <div className="space-y-2">
                  {evaluation.issues.map((issue, index) => (
                    <div key={index} className="text-sm">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={issue.severity === "high" ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {issue.severity}
                        </Badge>
                        <span className="font-medium capitalize">{issue.type.replace("_", " ")}</span>
                      </div>
                      <p className="text-muted-foreground mt-1 ml-2">
                        {issue.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Improvement Suggestion */}
            {evaluation.improvement && (
              <div className="mb-4">
                <h4 className="font-medium text-sm text-blue-800 dark:text-blue-200 mb-2">
                  💡 Suggested Improvement
                </h4>
                <div className="space-y-3 p-3 rounded-md bg-blue-100/50 dark:bg-blue-950/30">
                  <div>
                    <p className="text-sm font-medium">Suggested rewrite:</p>
                    <p className="text-sm italic mt-1">"{evaluation.improvement.suggested_rewrite}"</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Why this is better:</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {evaluation.improvement.explanation}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={handleAcceptSuggestion}>
                    Use This Version
                  </Button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4 border-t">
              <Button
                onClick={handleProceed}
                className={
                  evaluation.overall_quality === "green"
                    ? "bg-green-600 hover:bg-green-700"
                    : evaluation.overall_quality === "yellow"
                    ? "bg-yellow-600 hover:bg-yellow-700"
                    : "bg-red-600 hover:bg-red-700"
                }
              >
                {evaluation.recommendation === "proceed" ? "Proceed with Question" : "Use Despite Issues"}
              </Button>
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                Revise Question
              </Button>
              {onCancel && (
                <Button variant="ghost" onClick={onCancel}>
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}