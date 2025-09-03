import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import QuestionEvaluator from "./QuestionEvaluator"

export default function QuestionQualityDemo() {
  const [currentQuestion, setCurrentQuestion] = useState("")
  const [showEvaluator, setShowEvaluator] = useState(false)

  const sampleQuestions = [
    {
      question: "Don't you think our new feature is better than the old one?",
      label: "Leading Question (RED)",
      context: "Product validation research for a mobile app"
    },
    {
      question: "How do you feel about our product?",
      label: "Vague Question (YELLOW)",
      context: "User experience research for SaaS platform"
    },
    {
      question: "Tell me about the last time you had to collaborate on a design project. What was frustrating about it?",
      label: "Good Question (GREEN)",
      context: "Design collaboration tool research"
    }
  ]

  const handleQuestionSelect = (question: string) => {
    setCurrentQuestion(question)
    setShowEvaluator(true)
  }

  const handleProceed = () => {
    setShowEvaluator(false)
    setCurrentQuestion("")
    // In real implementation, this would add the question to the interview
    console.log("Proceeding with question:", currentQuestion)
  }

  const handleQuestionChange = (newQuestion: string) => {
    setCurrentQuestion(newQuestion)
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Question Quality Evaluator Demo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Test the question quality evaluator with sample questions or enter your own.
          </p>
          
          {!showEvaluator ? (
            <div className="space-y-4">
              <h3 className="font-medium">Try these sample questions:</h3>
              <div className="grid gap-3">
                {sampleQuestions.map((sample, index) => (
                  <div
                    key={index}
                    className="p-3 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => handleQuestionSelect(sample.question)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{sample.label}</p>
                        <p className="text-sm text-muted-foreground italic">
                          "{sample.question}"
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Context: {sample.context}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="pt-4 border-t">
                <button
                  className="text-sm text-blue-600 hover:text-blue-700 underline"
                  onClick={() => {
                    setCurrentQuestion("")
                    setShowEvaluator(true)
                  }}
                >
                  Or evaluate a custom question →
                </button>
              </div>
            </div>
          ) : (
            <QuestionEvaluator
              question={currentQuestion}
              researchContext="General user research interview"
              onQuestionChange={handleQuestionChange}
              onProceed={handleProceed}
              onCancel={() => setShowEvaluator(false)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}