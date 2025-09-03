import type { MetaFunction } from "react-router"
import QuestionQualityDemo from "~/components/questions/QuestionQualityDemo"

export const meta: MetaFunction = () => {
  return [
    { title: "Question Quality Evaluator - Test" },
    { name: "description", content: "Test the question quality evaluation functionality" },
  ]
}

export default function TestQuestionQuality() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Question Quality Evaluator</h1>
          <p className="text-muted-foreground mt-2">
            Test the AI-powered question quality evaluation system for interview questions.
          </p>
        </div>
        <QuestionQualityDemo />
      </div>
    </div>
  )
}