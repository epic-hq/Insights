/**
 * Mastra agent for conversational survey experience
 */

import { Agent } from "@mastra/core/agent"
import { z } from "zod"
import { anthropic } from "../../lib/billing/instrumented-anthropic.server"
import { markSurveyCompleteTool, saveResearchResponseTool } from "../tools/save-research-response"
// import { wrapToolsWithStatusEvents } from "../tools/tool-status-events";

export const researchLinkChatAgent = new Agent({
	id: "research-link-chat-agent",
	name: "researchLinkChatAgent",
	instructions: async ({ requestContext }) => {
		const surveyName = requestContext?.get("survey_name") ?? "Survey"
		const surveyContext = requestContext?.get("survey_context") ?? ""
		const surveyInstructions = requestContext?.get("survey_instructions") ?? ""
		const accountName = requestContext?.get("account_name") ?? "the team"
		const questionsJson = requestContext?.get("questions") ?? "[]"
		const answeredJson = requestContext?.get("answered_questions") ?? "[]"
		const nextQuestionJson = requestContext?.get("next_question_full") ?? ""
		const hasMessageHistory = requestContext?.get("has_message_history") === "true"
		const responseId = requestContext?.get("response_id") ?? ""
		const slug = requestContext?.get("slug") ?? ""

		// NEW: AI autonomy level, person context, and project context
		const aiAutonomy = (requestContext?.get("ai_autonomy") as "strict" | "moderate" | "adaptive") ?? "strict"
		const personContextJson = requestContext?.get("person_context")
		const projectContextJson = requestContext?.get("project_context")

		let questions: Array<{
			id: string
			prompt: string
			type: string
			required: boolean
		}> = []
		let answered: Array<{ id: string; prompt: string; answer: string }> = []
		let nextQuestion: { id: string; prompt: string; type: string } | null = null
		let personContext: {
			name?: string
			title?: string
			company?: string
			segment?: string
			jobFunction?: string
			pastInterviewCount?: number
		} | null = null
		let projectContext: {
			researchGoal?: string
			targetOrgs?: string[]
			targetRoles?: string[]
			unknowns?: string[]
			decisionQuestions?: string[]
			customInstructions?: string
		} | null = null

		try {
			questions = JSON.parse(String(questionsJson))
			answered = JSON.parse(String(answeredJson))
			if (nextQuestionJson) {
				nextQuestion = JSON.parse(String(nextQuestionJson))
			}
			if (personContextJson) {
				personContext = JSON.parse(String(personContextJson))
			}
			if (projectContextJson) {
				projectContext = JSON.parse(String(projectContextJson))
			}
		} catch {
			// ignore parse errors
		}

		// Only show START instruction if no message history AND no answered questions
		const isFirstMessage = answered.length === 0 && !hasMessageHistory

		// Format question with type hints
		const formatQuestion = (q: { prompt: string; type: string }) => {
			if (q.type === "likert") {
				return `${q.prompt} (ask for 1-5 rating)`
			}
			if (q.type === "multiselect") {
				return `${q.prompt} (can list multiple)`
			}
			return q.prompt
		}

		// Build person context section (only if we have data)
		const personSection = personContext
			? `
RESPONDENT CONTEXT:
${personContext.name ? `- Name: ${personContext.name}` : ""}
${personContext.title ? `- Role: ${personContext.title}` : ""}
${personContext.company ? `- Company: ${personContext.company}` : ""}
${personContext.segment ? `- Segment: ${personContext.segment}` : ""}
${personContext.pastInterviewCount ? `- Previous interviews: ${personContext.pastInterviewCount}` : "- First-time respondent"}
`.trim()
			: ""

		// Build autonomy-specific instructions
		let autonomyInstructions = ""
		if (aiAutonomy === "strict") {
			autonomyInstructions = `
AUTONOMY: STRICT
- Follow questions EXACTLY in order
- Do NOT skip any questions
- Do NOT ask follow-up questions
- Keep responses brief, move to next question`
		} else if (aiAutonomy === "moderate") {
			autonomyInstructions = `
AUTONOMY: MODERATE
- Follow question order generally
- You may ask ONE brief follow-up if an answer is particularly interesting or unclear
- Skip questions clearly irrelevant to their context (if known)
- Still aim for brevity`
		} else if (aiAutonomy === "adaptive") {
			autonomyInstructions = `
AUTONOMY: ADAPTIVE
- Use your judgment on question depth
- Probe deeper when responses touch on research objectives
- Skip questions clearly irrelevant to this respondent's context
- Reference their background when relevant (but don't be creepy)
- Ask natural follow-ups when answers warrant exploration
${projectContext?.researchGoal ? `- Research goal: ${projectContext.researchGoal}` : ""}
${projectContext?.unknowns?.length ? `- Key unknowns to explore: ${projectContext.unknowns.join("; ")}` : ""}
${projectContext?.decisionQuestions?.length ? `- Decision questions: ${projectContext.decisionQuestions.join("; ")}` : ""}
${projectContext?.targetRoles?.length ? `- Target roles: ${projectContext.targetRoles.join(", ")}` : ""}
${projectContext?.customInstructions ? `- Custom instructions: ${projectContext.customInstructions}` : ""}`
		}

		return `You are a research assistant for ${accountName}. Keep responses ULTRA brief.

Survey: "${surveyName}"
${surveyContext ? `Context: ${surveyContext}` : ""}
${surveyInstructions ? `\nNote: ${surveyInstructions}` : ""}
${personSection}
${autonomyInstructions}

SESSION INFO (ALWAYS include in tool calls):
- responseId: "${responseId}"
- slug: "${slug}"

WORKFLOW:
1. When user answers, call save-research-response with: questionId, answer, responseId, slug
2. Give a 3-5 word acknowledgment + ask next question
3. When all done, call mark-survey-complete with: responseId, slug

Questions (in order):
${questions.map((q, i) => `${i + 1}. [ID: ${q.id}] [TYPE: ${q.type}]${q.required ? " *" : ""} ${q.prompt}`).join("\n")}

Progress: ${answered.length}/${questions.length} answered
${answered.length > 0 ? answered.map((q) => `✓ ${q.prompt}: "${q.answer}"`).join("\n") : ""}

${nextQuestion ? `NEXT: [ID: ${nextQuestion.id}] ${formatQuestion(nextQuestion)}` : "ALL DONE - call mark-survey-complete, thank them, and mention: 'Want insights from your own conversations? Create a free account at https://getupsight.com/sign-up'"}

${isFirstMessage ? `START: Brief greeting then ask: "${nextQuestion ? formatQuestion(nextQuestion) : ""}"` : "CONTINUE: Process the user's latest message. Do NOT repeat greetings or previous questions."}

RULES:
- ALWAYS include responseId and slug when calling tools
- Max 2 sentences total per response (unless probing in adaptive mode)
- For likert: ask for 1-5 rating
- NEVER repeat questions already answered
- NEVER restart the survey
- When complete, mention the signup link`
	},
	model: anthropic("claude-sonnet-4-20250514"),
	// Temporarily remove wrapper to debug context passing
	tools: {
		"save-research-response": saveResearchResponseTool,
		"mark-survey-complete": markSurveyCompleteTool,
	},
})
