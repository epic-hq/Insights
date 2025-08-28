// Research Question Analysis - matches insights to user's research goals

class ResearchQuestion {
  question string
  priority int @description(#" 1 - 3 with 1 being highest "#)
}

class ResearchGoal {
  goal string
  icp string // Target customer profile
  role string // User segment
  questions ResearchQuestion[]
}

class InsightMatch {
  question string
  insights_found string[] // Insight names/summaries that answer this question
  confidence int @description(#" 1 - 3 with 1 being highest "#)
  answer_summary string // Clear, concise answer based on insights
  evidence string[] // Supporting quotes/evidence from insights
}

class GapAnalysis {
  unanswered_questions string[]
  partially_answered_questions string[]
  follow_up_recommendations string[]
  suggested_interview_topics string[]
}

class ProjectAnalysis {
  research_goal ResearchGoal
  question_answers InsightMatch[]
  gap_analysis GapAnalysis
  key_discoveries string[] // Unexpected insights not related to original questions
  confidence_score int // 0-100 overall confidence in findings
  next_steps string[]
}

function AnalyzeProjectInsights(
  research_goal: string,
  insights_data: string,
  interview_summary: string,
  custom_instructions: string
) -> ProjectAnalysis {
  client CustomGPT4o
  prompt #"
    You are analyzing research findings against stated research goals and questions.

    RESEARCH GOAL:
    {{ research_goal }}

    EXTRACTED INSIGHTS:
    {{ insights_data }}

    INTERVIEW SUMMARY:
    {{ interview_summary }}

    TASK: Analyze how well the insights answer each research question:

    If we have custom_instructions, use them, otherwise follow the guidlines below.

    CUSTOM_INSTRUCTIONS:
    {{ custom_instructions }}

    GUIDELINES:

    1. For each question, produce a concise, actionable answer:
       - insights_found: names/summaries of insights that directly or indirectly answer it (2-4 items if available)
       - confidence: NUMERIC 1-3 where 1 = high, 2 = medium, 3 = low (no words)
       - answer_summary: 1-2 sentence synthesis that a PM can act on; no preamble
       - evidence: 1-3 short quotes or paraphrased snippets from interviews/insights. Prefer direct quotes. Keep each to <140 chars.

    2. Gap Analysis (be specific and scoped to the research goal):
       - Which questions remain unanswered or only partially answered
       - What follow-up research is needed
       - Suggest specific interview topics to fill gaps

    3. Key Discoveries:
       - Important insights that emerged beyond the original questions
       - Unexpected findings that could redirect research focus

    4. Next Steps:
       - Concrete recommendations for the researcher
       - Priority areas for additional interviews
       - Suggested changes to research approach if needed

    QUALITY BAR:
    - Provide concise, evidence-backed answers with explicit numeric confidence (1-3).
    - Include 1-3 relevant evidence quotes per answer, and reference related insights.
    - Be specific, honest, and grounded in the provided data.
    - Avoid generic or boilerplate phrasing, and do not repeat the question.
    - Prefer concrete, falsifiable statements.

	    	Output format:
    	{{ ctx.output_format }}
  "#
}

// Executive summary optimized for status screens
class ExecutiveSummary {
  answered_insights string[] @description("Key findings that directly answer user's research questions, leading with pithy finding and then cause if known. Include 1-2 surprises if present.'")
  // unanticipated_discoveries string[] @description("Surprising findings not related to original questions'")
  critical_unknowns string[] @description("Important questions that remain unanswered or areas where evidence is insufficient")
  completion_percentage int @description("0-100 estimate of how much of the original research goal has been addressed")
  confidence int @description("1-3 with 1 being highest confidence in findings")
  next_action string @description("Single most important next 1-2 steps to advance the research")
}

function GenerateExecutiveSummary(
  research_goal: string,
  insights_content: string,
  interview_content: string,
  custom_instructions: string
) -> ExecutiveSummary {
  client CustomGPT4o
  prompt #"
    You are analyzing research findings to create an executive summary of goals and questions answered, with what level of confidence;
		what's still unkonwn, and recommend next steps. Keep it pithy without preamble or fluff. Can be partial sentences.

    RESEARCH GOAL:
    {{ research_goal }}

    INSIGHTS:
    {{ insights_content }}

    INTERVIEWS:
    {{ interview_content }}

    CUSTOM INSTRUCTIONS (if provided):
    {{ custom_instructions }}

    ANALYSIS REQUIREMENTS:

    1. ANSWERED INSIGHTS (2-4 items):
       - Major insights learned relative to research goal (group and summarizesimilar insights)
       - Prioritize insights with strong evidence from multiple sources
			 - Example: "Users prefer mobile over desktop for quick tasks, because 8/10 interviews mentioned switching to phones when in a hurry"
			 - Call out truly surprising, UNANTICIPATED INSIGHTS if they exist and are relevant to the goal.
       - Example: "Price is less important than expected, because users consistently mentioned convenience over cost in decision-making"
       - Include only discoveries with solid evidence

    3. REMAINING UNKNOWNS (1-3 items):
       - Important questions that remain unanswered or areas with insufficient evidence
       - Format as clear questions or knowledge gaps without any preample or fluff; partial sentences bullet style ok.
       - Example: "How users behave during peak usage times" or "Whether pricing sensitivity varies by user segment"

		4. Recommendations:
       - 1-2 recommendations that address the biggest gap or highest-value opportunity
       - Be specific and actionable

    5. COMPLETION PERCENTAGE:
       - Estimate how much of the research goal has been addressed (0-100)
       - Consider both breadth (topics covered) and depth (evidence quality)


    QUALITY GUIDELINES:
    - Use concrete evidence from the data, not assumptions
    - Avoid jargon - write for business stakeholders
    - Be honest about limitations and gaps
    - Prioritize actionable insights over interesting but irrelevant findings

		Output format:
		{{ ctx.output_format }}
  "#
}

// Smart Research Question Generation for Onboarding
class SuggestedQuestion {
  question string
  rationale string // Why this question is important for their research
  interview_type "user_interview" | "stakeholder_interview" | "expert_interview"
  priority int @description(#" 1 - 3 with 1 being highest "#)
}

class ResearchQuestionSuggestions {
  core_questions SuggestedQuestion[] // 3-4 essential questions
  behavioral_questions SuggestedQuestion[] // Understanding user behavior
  pain_point_questions SuggestedQuestion[] // Identifying problems
  solution_questions SuggestedQuestion[] // Validating solutions
  context_questions SuggestedQuestion[] // Understanding environment/constraints
}

function GenerateResearchQuestions(
	target_org: string,
	target_roles: string,
	research_goal: string,
	research_goal_details: string,
	assumptions: string,
	unknowns: string,
	custom_instructions: string
) -> ResearchQuestionSuggestions {
  client CustomGPT4o
  prompt #"
    You are an expert UX researcher helping someone design interview questions.

    CONTEXT:
    - Target Audience: {{ target_org }}
    - User Role/Segment: {{ target_roles }}
    - Research Goal: {{ research_goal }}
		- Research Goal Details: {{ research_goal_details }}
		- Assumptions: {{ assumptions }}
		- Unknowns: {{ unknowns }}

		If we have custom_instructions, use them, otherwise follow the guidlines below.

		CUSTOM_INSTRUCTIONS:

    {{ custom_instructions }}

    GUIDELINES:

    Generate specific, actionable interview questions organized by category.

    1. Questions should be open-ended and behavior-focused
    2. Avoid leading questions or yes/no questions
    3. Include follow-up prompts in the question
    4. Make questions specific to their ICP and goal
    5. Prioritize questions that will reveal real user needs and pain points

    CATEGORIES:

    Core Questions (3-4 must-ask questions):
    - Essential questions that directly address their research goal
    - Should uncover key insights about user behavior and needs

    Behavioral Questions:
    - How users currently solve problems
    - Workflow and process understanding
    - Decision-making factors

    Pain Point Questions:
    - Current frustrations and challenges
    - Gaps in existing solutions
    - Cost of current approaches

    Solution Questions (if applicable):
    - Validation of potential solutions
    - Feature importance and prioritization
    - Willingness to pay or adopt

    Context Questions:
    - Environmental factors
    - Constraints and limitations
    - Stakeholder influences

    For each question provide:
    - The specific question text
    - Why it's important for their research (rationale)
    - What type of interview it's best for
    - Priority level

		Make questions helpful, unique, conversational and natural, as if asking a friend.
    Avoid jargon and make them appropriate for the target audience.

		Output format:
		{{ ctx.output_format }}
  "#
}