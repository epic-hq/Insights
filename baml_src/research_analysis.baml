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
  interview_summary: string
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

    1. For each question, identify:
       - Which insights directly or indirectly answer it
       - Confidence level in the answer (high/medium/low)
       - Clear, actionable answer summary
       - Supporting evidence from the data

    2. Gap Analysis:
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

    Be specific, actionable, and honest about confidence levels and gaps.

		Output format:
		{{ ctx.output_format }}
  "#
}

// Quick summary for status screens
class QuickInsights {
  key_findings string[]
  completion_percentage int
  confidence int @description("1-3 with 1 being highest ")
  next_action string
}

function GenerateQuickInsights(
  research_goal: string,
  insights_content: string,
  interview_content: string
) -> QuickInsights {
  client CustomGPT4o
  prompt #"
    Generate a quick summary for a project status screen.

    Research Goal: {{ research_goal }}

    INSIGHTS:
    {{ insights_content }}

    INTERVIEWS:
    {{ interview_content }}

    Analyze the content and provide:

    key_findings: Array of 2-3 most important discoveries (strings)
    completion_percentage: Integer 0-100 estimating how much of the research goal has been answered
    confidence: Integer 1-3 where 1 is highest confidence, 2 is medium, 3 is low
    next_action: Single string describing the most important next step

    Focus on actionable insights that help the researcher understand progress and next steps.

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
	icp: string,
	role: string,
	research_goal: string,
	custom_instructions: string
) -> ResearchQuestionSuggestions {
  client CustomGPT4o
  prompt #"
    You are an expert UX researcher helping someone design interview questions.

    CONTEXT:
    - Target Audience: {{ icp }}
    - User Role/Segment: {{ role }}
    - Research Goal: {{ research_goal }}

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

    Make questions conversational and natural, as if asking a friend.
    Avoid jargon and make them appropriate for the target audience.

		Output format:
		{{ ctx.output_format }}
  "#
}