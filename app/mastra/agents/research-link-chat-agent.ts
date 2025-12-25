/**
 * Mastra agent for conversational survey experience
 */
import { anthropic } from "@ai-sdk/anthropic"
import { Agent } from "@mastra/core/agent"
import { z } from "zod"
import { markSurveyCompleteTool, saveResearchResponseTool } from "../tools/save-research-response"
import { wrapToolsWithStatusEvents } from "../tools/tool-status-events"

export const researchLinkChatAgent = new Agent({
	id: "research-link-chat-agent",
	name: "researchLinkChatAgent",
	instructions: async ({ requestContext }) => {
		const surveyName = requestContext?.get("survey_name") ?? "Survey"
		const surveyContext = requestContext?.get("survey_context") ?? ""
		const accountName = requestContext?.get("account_name") ?? "the team"
		const questionsJson = requestContext?.get("questions") ?? "[]"
		const answeredJson = requestContext?.get("answered_questions") ?? "[]"
		const nextQuestion = requestContext?.get("next_question") ?? ""

		let questions: Array<{ id: string; prompt: string; required: boolean }> = []
		let answered: Array<{ id: string; prompt: string; answer: string }> = []

		try {
			questions = JSON.parse(String(questionsJson))
			answered = JSON.parse(String(answeredJson))
		} catch {
			// ignore parse errors
		}

		return `You are a friendly research assistant helping ${accountName} gather feedback through a conversational survey.

Survey: "${surveyName}"
${surveyContext ? `Context: ${surveyContext}` : ""}

Your job is to:
1. Ask survey questions one at a time in a natural, conversational way
2. After each user response, IMMEDIATELY call save-research-response with the questionId and answer
3. Acknowledge answers briefly (1 sentence) then ask the next question
4. When all questions are answered, call mark-survey-complete and thank them

Questions to ask (in order):
${questions.map((q, i) => `${i + 1}. [ID: ${q.id}] ${q.prompt}${q.required ? " (required)" : " (optional)"}`).join("\n")}

Current progress:
- Answered: ${answered.length}/${questions.length}
${answered.map((q) => `  ✓ "${q.prompt}": "${q.answer}"`).join("\n")}
${nextQuestion ? `- Next question: "${nextQuestion}"` : "- All questions answered! Call mark-survey-complete."}

CRITICAL RULES:
- ALWAYS call save-research-response immediately after user answers (don't wait)
- Use the exact question ID from the list above
- Keep responses short - 1-2 sentences max
- Don't number questions or make it feel like a form
- Be warm but efficient`
	},
	model: anthropic("claude-sonnet-4-20250514"),
	tools: wrapToolsWithStatusEvents({
		"save-research-response": saveResearchResponseTool,
		"mark-survey-complete": markSurveyCompleteTool,
	}),
})
