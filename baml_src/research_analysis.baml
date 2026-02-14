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

class EvidenceItem {
  id string
  verbatim string
  support "supports" | "refutes" | "neutral"
  interview_id string?
  context_summary string?
}

class QuestionContext {
  id string
  kind "decision" | "research"
  decision_question_id string?
  text string
  rationale string?
}

class EvidenceQuestionLink {
  question_id string
  question_kind "decision" | "research"
  decision_question_id string?
  relationship "supports" | "refutes" | "neutral"
  confidence float
  answer_summary string
  rationale string
  next_steps string?
}

class ResearchQuestionAnswer {
  research_question_id string
  findings string[] @description("2-5 specific findings from evidence, each a clear statement")
  evidence_ids string[] @description("IDs of evidence that support these findings")
  confidence float
  reasoning string @description("Brief explanation of how evidence supports these findings")
}

class DecisionQuestionAnswer {
  decision_question_id string
  strategic_insight string @description("High-level strategic answer synthesized from research findings")
  supporting_findings string[] @description("Key findings from research questions that inform this decision")
  research_question_ids string[] @description("IDs of research questions that contributed to this answer")
  confidence float
  reasoning string @description("How the research findings lead to this strategic insight")
  recommended_actions string[] @description("Specific next steps based on this insight")
}

class EvidenceLinkResult {
  evidence_id string
  links EvidenceQuestionLink[]
}

class QuestionAnalysisSummary {
  question_id string
  question_kind "decision" | "research"
  decision_question_id string?
  confidence float
  summary string
  goal_achievement_summary string?
  next_steps string?
}

class EvidenceAnalysisResponse {
  evidence_results EvidenceLinkResult[]
  research_question_answers ResearchQuestionAnswer[] @description("Evidence-based findings for each research question")
  decision_question_answers DecisionQuestionAnswer[] @description("Strategic insights synthesized from research findings")
  global_goal_summary string?
  recommended_actions string[]
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

function LinkEvidenceToResearchStructure(
  evidence: EvidenceItem[],
  questions: QuestionContext[],
  custom_instructions: string
) -> EvidenceAnalysisResponse {
  client CustomGPT4oMini
  prompt #"
    You are an expert research analyst linking raw evidence to structured research questions and decisions.

    EVIDENCE ITEMS (array of JSON objects with id, verbatim, support, interview_id, context_summary when available):
    {{ evidence }}

    QUESTION CONTEXT (each includes id, kind=decision/research, text, optional decision_question_id when kind='research'):
    {{ questions }}

    CUSTOM INSTRUCTIONS (optional, may be empty):
    {{ custom_instructions }}

    TASK REQUIREMENTS:

    PHASE 1 - EVIDENCE TO RESEARCH QUESTIONS:
    1. For each evidence item, link it to relevant RESEARCH questions only (not decision questions):
       - Provide relationship (supports/refutes/neutral) and confidence 0.0 – 1.0
       - Summarize what this evidence tells us (<= 2 sentences)
       - Include rationale referencing key phrases from evidence (<= 220 chars)
       - Suggest next steps when helpful

    PHASE 2 - RESEARCH QUESTION ANSWERS:
    2. For each research question, synthesize all linked evidence into findings:
       - Generate 2-5 specific, evidence-based findings (clear statements, not questions)
       - List evidence IDs that support each finding
       - Provide overall confidence based on evidence strength and agreement
       - Explain reasoning: how the evidence supports these findings
       - Example finding: "Users are willing to pay for interview assistance tools (5 mentions across 3 interviews)"

    PHASE 3 - DECISION QUESTION SYNTHESIS:
    3. For each decision question, synthesize insights from its research questions:
       - Create ONE strategic insight that answers the decision (not a list of evidence)
       - Extract key findings from research questions that inform this decision
       - List research question IDs that contributed
       - Provide confidence based on research question coverage
       - Explain reasoning: how research findings lead to this strategic answer
       - Recommend 2-4 specific actions based on this insight
       - Example insight: "Adopt freemium model with premium interview features" (NOT "Users mentioned tools" - that's RQ-level)

    4. Provide project-wide guidance:
       - global_goal_summary: overall progress toward research goal
       - recommended_actions: 2-4 high-level actions for the project team

    OUTPUT RULES:
    - Return valid JSON matching EvidenceAnalysisResponse exactly.
    - Omit evidence items that do not meaningfully map to questions (empty links array is acceptable).
    - Keep confidence within [0.0, 1.0].
    - Ensure every evidence link references question ids that exist in QUESTION CONTEXT.

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

// // Smart Research Question Generation for Onboarding
// class SuggestedQuestion {
//   question string
//   rationale string // Why this question is important for their research
//   interview_type "user_interview" | "stakeholder_interview" | "expert_interview"
//   priority int @description(#" 1 - 3 with 1 being highest "#)
// }

// class ResearchQuestionSuggestions {
//   core_questions SuggestedQuestion[] // 3-4 essential questions
//   behavioral_questions SuggestedQuestion[] // Understanding user behavior
//   pain_point_questions SuggestedQuestion[] // Identifying problems
//   solution_questions SuggestedQuestion[] // Validating solutions
//   context_questions SuggestedQuestion[] // Understanding environment/constraints
// }

// function GenerateResearchQuestions(
// 	target_org: string,
// 	target_roles: string,
// 	research_goal: string,
// 	research_goal_details: string,
// 	assumptions: string,
// 	unknowns: string,
// 	custom_instructions: string
// ) -> ResearchQuestionSuggestions {
//   client CustomGPT4o
//   prompt #"
//     You are an expert UX researcher helping someone design interview questions.

//     CONTEXT:
//     - Target Audience: {{ target_org }}
//     - User Role/Segment: {{ target_roles }}
//     - Research Goal: {{ research_goal }}
// 		- Research Goal Details: {{ research_goal_details }}
// 		- Assumptions: {{ assumptions }}
// 		- Unknowns: {{ unknowns }}

// 		If we have custom_instructions, use them, otherwise follow the guidlines below.

// 		CUSTOM_INSTRUCTIONS:

//     {{ custom_instructions }}

//     GUIDELINES:

//     Generate specific, actionable interview questions organized by category.

//     1. Questions should be open-ended and behavior-focused
//     2. Avoid leading questions or yes/no questions
//     3. Include follow-up prompts in the question
//     4. Make questions specific to their ICP and goal
//     5. Prioritize questions that will reveal real user needs and pain points

//     CATEGORIES:

//     Core Questions (3-4 must-ask questions):
//     - Essential questions that directly address their research goal
//     - Should uncover key insights about user behavior and needs

//     Behavioral Questions:
//     - How users currently solve problems
//     - Workflow and process understanding
//     - Decision-making factors

//     Pain Point Questions:
//     - Current frustrations and challenges
//     - Gaps in existing solutions
//     - Cost of current approaches

//     Solution Questions (if applicable):
//     - Validation of potential solutions
//     - Feature importance and prioritization
//     - Willingness to pay or adopt

//     Context Questions:
//     - Environmental factors
//     - Constraints and limitations
//     - Stakeholder influences

//     For each question provide:
//     - The specific question text
//     - Why it's important for their research (rationale)
//     - What type of interview it's best for
//     - Priority level

// 		Make questions helpful, unique, conversational and natural, as if asking a friend.
//     Avoid jargon and make them appropriate for the target audience.

// 		Output format:
// 		{{ ctx.output_format }}
//   "#
// }

// ---------- Core data classes ----------
class Category {
  id string @description("Stable string ID for the category (e.g., 'goals', 'pain', 'workflow', 'context', 'constraints', 'willingness-to-pay'). Use lowercase kebab/camel; must be unique within this QuestionSet.")
  label string @description("Human-readable category name shown in the UI (e.g., 'Goals & Outcomes').")
  weight float? @description("Optional multiplier (>=0.5 to <=1.5 typical) that boosts selection priority for this category. default = 1.0")
}

class Scores {
  goalMatch float @description("0..1. How strongly this question aligns with the user's stated goals. Higher = more aligned.")
  novelty float @description("0..1. How different this question is from previously shown/asked items. Higher = more novel.")
  importance float @description("0..1. Domain importance for understanding needs vs potential. Weight this highest.")
  uncertainty float? @description("0..1. Confidence gap. Higher = exploring unknowns; helps diversify when uncertainty is high.")
}

class Source {

}

class Question {
  id string @description("CRITICAL: Unique string identifier (uuid/ulid-like). Must be globally unique across this entire QuestionSet. Generate using crypto.randomUUID() or similar. Never reuse IDs.")
  text string @description("The complete, conversational question text as you would ask a person. Include natural follow-ups when helpful.")
  categoryId string @description("Category.id this question belongs to. Must match a Category in this QuestionSet.")
  rationale string? @description("One short sentence on why this question matters for needs/potential.")
  tags string[]? @description("Optional short tags for filtering (e.g., 'pricing', 'workflow', 'adoption').")
  scores Scores @description("Scoring object. Provide values in [0,1] per field; the app computes a composite.")
  estimatedMinutes float @description("Realistic time estimate in minutes for this question (1-5 minutes typical). Consider question complexity, follow-ups, and discussion depth.")
  status "proposed" | "shown" | "rejected" | "asked" | "answered" @description("Lifecycle state. New questions must start as 'proposed'.")
  source "llm" | "curated" | "custom" @description("Origin of the question. Use 'llm' for generated items by default.")
  displayOrder int? @description("Optional UI order hint. Leave unset; the app may assign.")
  externalRef string? @description("Optional reference to a template/library identifier for provenance.")
}

class HistoryItem {
  questionId string @description("The Question.id this event relates to.")
  action "shown" | "rejected" | "asked" | "answered" @description("What happened to the question at the given timestamp.")
  ts string @description("ISO-8601 timestamp of the event (e.g., '2025-08-27T04:15:00Z').")
  interviewId string? @description("Optional interview identifier to tie this event to a specific interview.")
}

class QuestionPolicy {
  totalPerRound int @description("Maximum number of questions to surface in the next round.")
  perCategoryMin int? @description("Minimum number to include from each category for coverage. Use 0–2 typically.")
  perCategoryMax int? @description("Maximum number allowed from any single category to avoid flooding.")
  dedupeWindowRounds int? @description("How many previous rounds to consider for avoiding repeats. Use 1–3.")
  balanceBy string[]? @description("Balancing dimensions. Usually include 'category' and optionally 'novelty' or 'importance'.")
}

class QuestionSet {
  sessionId string? @description("Stable session identifier. Injected by caller from inputs.session_id; LLM should NOT generate.")
  policy QuestionPolicy? @description("Selection policy. Injected by caller from inputs; LLM should NOT generate.")
  categories Category[] @description("The complete list of categories available for this session. Keep to < 8.")
  questions Question[] @description("Pool of proposed questions. Start all as 'proposed'. Do not include duplicates.")
  history HistoryItem[] @description("Past events for this session. If the caller provides prior history, do not alter it; only append in the app.")
  round int? @description("Current round number. Injected by caller from inputs.round; LLM should NOT generate.")
}

// ---------- Research Structure Classes ----------
class DecisionQuestionItem {
  id string @description("Unique identifier for this decision question.")
  text string @description("The key business decision to be made (e.g., 'Should we build feature X?').")
  rationale string? @description("Why this decision matters for the business.")
}

class ResearchQuestionItem {
  id string @description("Unique identifier for this research question.")
  text string @description("Specific research question to investigate (e.g., 'How do users currently solve problem Y?').")
  rationale string? @description("Why this research question helps answer the decision question.")
  decision_question_id string @description("ID of the decision question this research question supports.")
}

class InterviewPromptItem {
  id string @description("Unique identifier for this interview prompt.")
  text string @description("Natural, conversational question to ask in interviews.")
  research_question_id string @description("ID of the research question this prompt investigates.")
}

class ResearchStructure {
  decision_questions DecisionQuestionItem[] @description("High-level business decisions to be made.")
  research_questions ResearchQuestionItem[] @description("Specific research questions that support the decisions.")
  interview_prompts InterviewPromptItem[] @description("Natural interview questions that gather evidence.")
}

// ---------- Legacy compatibility (kept) ----------
class SuggestedQuestion {
  question string @description("Plain-text question wording.")
  rationale string @description("Why this question is important for research.")
  interview_type "user_interview" | "stakeholder_interview" | "expert_interview" @description("Primary interview type this question suits best.")
  priority int @description("1..3 (1 = highest). Indicate urgency/importance for early rounds.")
}

class ResearchQuestionSuggestions {
  core_questions SuggestedQuestion[] @description("3–4 must-ask questions aligned to the research goal.")
  behavioral_questions SuggestedQuestion[] @description("Questions to understand current workflows/behaviors.")
  pain_point_questions SuggestedQuestion[] @description("Questions that surface current problems and friction.")
  solution_questions SuggestedQuestion[] @description("Questions to validate potential solutions and value.")
  context_questions SuggestedQuestion[] @description("Questions to capture environment, constraints, stakeholders.")
}

// ---------- Inputs ----------
class GenerateInputs {
  customer_problem string? @description("The business/customer problem being solved or addressed.")
  target_org string? @description("Target organization context (industry, size, market).")
  target_roles string? @description("Primary user roles/segments to interview (comma-separated or natural language).")
  offerings string? @description("Products and services offered to customers.")
  competitors string? @description("Other products or solutions customers are using or considering.")
  research_goal string @description("Short statement of the overarching research goal.")
  research_goal_details string? @description("Specific details and hypotheses relevant to this study.")
  assumptions string? @description("Key assumptions the team currently holds.")
  unknowns string? @description("Open questions and uncertainties to investigate.")
  custom_instructions string? @description("Optional caller-provided guidance that overrides defaults.")
  research_mode string? @description("Study mode. Expected: 'exploratory', 'validation', or 'user_testing'.")
  session_id string @description("Session identifier to embed into the returned QuestionSet.sessionId.")
  round int @description("1-based round number provided by the caller.")
  total_per_round int? @description("Default 25: number of questions to show per round.")
  per_category_min int? @description("Default 3: minimum per category.")
  per_category_max int? @description("Default 5: maximum per category.")
  interview_time_limit int? @description("Default 30: Expected interview time in minutes, use this to guide the selection of must ask questions.")
}

// ---------- Research Structure Generation ----------
function GenerateResearchStructure(
  inputs: GenerateInputs
) -> ResearchStructure {
  client CustomGPT4o
  prompt #"
  You are a research strategist helping to structure a user research study. Generate a complete research structure with decision questions, research questions, and interview prompts.

  BUSINESS CONTEXT:
  CUSTOMER PROBLEM: {{ inputs.customer_problem }}
  OFFERINGS: {{ inputs.offerings }}
  COMPETITORS: {{ inputs.competitors }}
  TARGET ORGS: {{ inputs.target_org }}
  TARGET ROLES: {{ inputs.target_roles }}

  RESEARCH CONTEXT:
  RESEARCH GOAL: {{ inputs.research_goal }}
  DETAILS: {{ inputs.research_goal_details }}
  RESEARCH MODE: {{ inputs.research_mode or "exploratory" }}
  ASSUMPTIONS: {{ inputs.assumptions }}
  UNKNOWNS: {{ inputs.unknowns }}

  TASK: Create a structured research plan with three levels:

  1. DECISION QUESTIONS (2-3 items):
     - High-level business decisions that need to be made
     - Should be strategic and actionable
     - Examples: "Should we build feature X?", "Which user segment should we prioritize?"
     - Each needs a unique ID and clear rationale

  2. RESEARCH QUESTIONS (2-4 per decision question):
     - Specific questions that help answer each decision question
     - Should be investigative and focused
     - Examples: "How do users currently solve problem Y?", "What are the main barriers to adoption?"
     - Each needs a unique ID, rationale, and links to a decision question

  3. INTERVIEW PROMPTS (2-3 per research question):
     - Natural, conversational questions to ask in interviews
     - Should be open-ended and behavior-focused
     - Examples: "Tell me about the last time you...", "What's most frustrating about..."
     - Each needs a unique ID and links to a research question

  GUIDELINES:
  - Make interview prompts conversational and natural, like you're talking to a friend
  - Focus on understanding user behavior, pain points, and needs
  - Avoid leading questions or yes/no questions
  - Generate unique IDs for all items (use crypto.randomUUID() style)
  - Ensure all items have proper relationships (research questions link to decision questions, etc.)

  QUESTION DIVERSITY - Create a balanced mix covering:
  - Background/Context: Current situation, existing solutions (especially competitors), tools being used
  - Goals & Outcomes: What they're trying to achieve, success metrics, desired outcomes
  - Pain Points: Frustrations with current solutions (including competitors), unmet needs, blockers
  - Workflow & Behavior: Day-to-day processes, specific scenarios, decision-making patterns
  - Constraints & Barriers: Budget limitations, technical constraints, organizational challenges
  - Value & Willingness to Pay: What they'd pay for, ROI expectations, budget allocation
  - Demographics/Firmographics: Company size, industry, role details, team structure

  - If the research mode is "validation":
      * Create exactly four research questions aligned to validation gates: Pain Exists, Awareness, Quantified Impact, Taking Action.
      * Use deterministic IDs for those research questions: "pain_exists", "awareness", "quantified", "acting".
      * Craft decision questions that frame the business need for validating assumptions.
      * For each validation research question, include 2-3 interview prompts that directly probe evidence for that gate; including pain awareness, acting on it, Willingness to pay.
      * When research mode is not "validation", follow the general exploratory guidance and choose research question counts based on context.
  - If research mode is "user_testing", emphasise prompts seeking to understand if the user is aware of what is possible and expected ofthem. What actions do they want to take and why? How easy to understand and how usable is it.

  QUALITY REQUIREMENTS:
  - Decision questions should be strategic and business-focused
  - Research questions should be specific and investigative
  - Interview prompts should be natural and open-ended
  - All text should be clear, concise, and actionable

  Return the complete structure with all relationships properly linked.

  {{ ctx.output_format }}
  "#
}

// ---------- Main generation function ----------
function GenerateQuestionSet(
  inputs: GenerateInputs
) -> QuestionSet {
  client CustomGPT4o
  prompt #"
  You are creating natural conversation starters for informal interviews. Think like a curious friend who wants to understand someone's work and life, not a corporate consultant.

  CRITICAL: Follow these CUSTOM INSTRUCTIONS above all else:
  {{ inputs.custom_instructions }}

  IMPORTANT: If the custom instructions above conflict with any context below, ALWAYS prioritize the custom instructions. The custom instructions define the true goal and scope of this research.

	You will generate a larger set than can be asked in the available time, and prioritize the most important questions based on importance, goalMatch, and novelty.

	IMPORTANT: For each question, provide a realistic estimatedMinutes value (2-7 minutes typical):
	- Simple yes/no or factual questions: 1-2 minutes
	- Open-ended exploratory questions: 3-4 minutes
	- Complex scenario or deep-dive questions: 5-6 minutes
	- Consider follow-up discussion time in your estimate

	Total available time: {{ inputs.interview_time_limit }} minutes.
	Generate 25% more questions than can fit to give the interviewer options and backups.

  BACKGROUND CONTEXT (use only if it aligns with custom instructions above):
  - Customer Problem: {{ inputs.customer_problem }}
  - Offerings: {{ inputs.offerings }}
  - Competitors: {{ inputs.competitors }}
  - Target Org: {{ inputs.target_org }}
  - Roles/Segments: {{ inputs.target_roles }}
  - Research Goal: {{ inputs.research_goal }}
  - Goal Details: {{ inputs.research_goal_details }}
  - Assumptions: {{ inputs.assumptions }}
  - Unknowns: {{ inputs.unknowns }}

  RESEARCH MODE: {{ inputs.research_mode or "exploratory" }}
  MODE-SPECIFIC GUIDANCE:
    - If research mode is "validation":
        * Prioritise questions that surface evidence for the four validation gates (Pain Exists, Awareness, Quantified Impact, Acting/Next Steps).
        * Ensure categories favour these gates (e.g., use categoryId values of "pain", "awareness", "quantified", "acting" when relevant).
        * Keep prompts crisp and outcome-focused so answers can be mapped to go/no-go decisions.
    - If research mode is "user_testing":
        * Focus categories on usability, comprehension, task completion, and adoption.
    - Otherwise keep a balanced exploratory mix across context, goals, pain, workflow, constraints, willingness, and demographics.

  IMPORTANT: Pay special attention to the TARGET ROLES/SEGMENTS above. Create questions that are:
  1) Highly specific to their daily work, creative processes, and unique challenges
  2) Focused on their actual tools, platforms, and workflows they use
  3) Addressing their specific pain points in their creative field
  4) Understanding their community, audience, and collaboration patterns
  5) Exploring their business model, income streams, and professional needs

  EXAMPLES of GOOD conversational questions:
  - "I'm curious - when you're stuck on a design, what do you actually do? Like, do you take a walk, scroll Instagram, call a friend?"
  - "What's the most annoying thing clients do? I bet you have some stories..."
  - "Show me your workspace - what's the one tool or app you can't live without?"
  - "When was the last time you collaborated with another artist? How did that come about?"
  - "What's your biggest creative struggle right now? The thing that keeps you up at night?"
  - "Where do you actually find your best ideas? I'm always curious about this."

  EXAMPLES of BAD formal/corporate questions to AVOID:
  - "What challenges do you face in your creative process?" (too formal)
  - "How do you align your content with your organizational mission?" (corporate speak)
  - "What are your primary goals when creating content?" (consultant-speak)
  - "What platforms do you use for inspiration and how do they influence your creative process?" (too wordy/formal)

  TONE & LANGUAGE REQUIREMENTS:
  - Write questions like you're having coffee with a friend who does this work
  - Use casual, natural language - avoid formal research-speak
  - Be genuinely curious, not corporate or consultant-like
  - Include contractions, casual phrases, personal touches
  - Ask about real, specific situations they've experienced
  - Show you understand their world (tools, platforms, community, struggles)

  GUIDELINES:
    1) Questions must be conversational, open-ended, and genuinely curious.
    2) Include natural follow-ups in the question text when helpful.
    3) Tailor specifically to the roles/segments - get into the weeds of their actual work.
    4) Ask about specific situations, tools, processes they encounter daily.
    5) Focus on real stories, concrete examples, day-to-day reality.
    6) Provide balanced coverage across categories:
       context, goals, pain, workflow, motivation, constraints, willingness, demographics.
    7) Provide scores in [0,1]: importance (highest signal), goalMatch, novelty.
    8) New questions must have status 'proposed'.
    9) CRITICAL: Use completely unique string IDs for questions (uuid/ulid-like). Never reuse IDs. Each question must have a globally unique identifier.
    10) Sound like a human talking to another human, not a researcher conducting an interview.
    11) Do NOT use placeholders or template tokens like [relevant process], <thing>, {something}. If specifics are missing, write a complete, neutral phrase without brackets. The final question text must not contain '[' or ']'.

  LENGTH & CLARITY CONSTRAINTS (strict):
  - Keep each question short and crisp: 8–18 words (target ~12–16 words), max 140 characters.
  - Do NOT list or restate roles/organizations in the question text; address the interviewee as "you".
  - No long enumerations, comma chains, or multiple clauses; one clear idea per question.
  - Avoid jargon and qualifiers; prefer simple, conversational phrasing.
  - Never stitch together multiple audiences (e.g., "Special Education Teacher, CIO, Clinical Psychologist..."). Pick a single perspective implicitly via "you".

  OUTPUT SHAPE
  Return only valid JSON with these fields:
  - categories: Category[] (required - you generate this)
  - questions: Question[] (required - you generate this)
  - history: [] (always empty array)

  DO NOT include sessionId, policy, or round - these will be injected by the system.

  HARD CONSTRAINTS
  - No placeholders or bracketed variables in any question text.
  - Max 140 characters per question. If longer, rewrite to fit while preserving meaning.

  Return JSON only:
  {{ ctx.output_format }}
  "#
}

// Follow-up question generation for dive deeper functionality
class FollowUpQuestionScores {
  importance float @description("0.0-1.0 how important this follow-up is")
  goalMatch float @description("0.0-1.0 how well it matches research goals")
  novelty float @description("0.0-1.0 how novel/unique this angle is")
}

class FollowUpQuestion {
  id string @description("Unique identifier for the follow-up question")
  text string @description("The follow-up question text")
  rationale string @description("Why this follow-up question is valuable")
  estimatedMinutes int @description("Estimated time in minutes to ask this question")
  categoryId string @description("Category like 'context', 'pain', 'workflow', etc.")
  scores FollowUpQuestionScores @description("Scoring metrics for this question")
}

class FollowUpSet {
  originalQuestion string @description("The question we're diving deeper on")
  followUps FollowUpQuestion[] @description("2-4 follow-up questions")
}

function GenerateFollowUpQuestions(
  original_question: string,
  research_context: string,
  target_roles: string,
  custom_instructions: string
) -> FollowUpSet {
  client CustomGPT4oMini
  prompt #"
    You are an expert UX researcher generating follow-up questions to dive deeper into a specific topic.

    ORIGINAL QUESTION: {{ original_question }}

    RESEARCH CONTEXT: {{ research_context }}
    TARGET ROLES: {{ target_roles }}

    CUSTOM INSTRUCTIONS (follow these strictly):
    {{ custom_instructions }}

    TASK: Generate 2-4 thoughtful follow-up questions that dive deeper into the original question. These should:

    1. Explore different angles of the original question
    2. Uncover underlying motivations, pain points, or workflows
    3. Ask for specific examples or stories
    4. Probe for emotional responses or deeper context

    QUALITY GUIDELINES:
    - Make questions conversational and natural
    - Avoid yes/no questions - prefer open-ended
    - Ask for specific examples: "Can you walk me through..." or "Tell me about a time when..."
    - Probe for emotions: "How did that make you feel?" or "What was most frustrating about..."
    - Explore impact: "What would happen if..." or "How does this affect your..."
    - Be specific to the target audience ({{ target_roles }})

    CATEGORIES to use:
    - context: Background and situational questions
    - pain: Problems, frustrations, challenges
    - workflow: Process, behavior, how things work
    - goals: Motivations, desired outcomes
    - constraints: Limitations, barriers
    - willingness: Adoption, willingness to change
    - demographics: Role, tenure, team size, seniority, geography, org size, etc.

    SCORING:
    - importance: 0.7-1.0 (these are follow-ups to important questions)
    - goalMatch: 0.6-0.9 (should align well with research goals)
    - novelty: 0.4-0.8 (varies by how unique the angle is)

    ESTIMATED TIME:
    - Simple clarification: 2-3 minutes
    - Story/example requests: 4-5 minutes
    - Complex scenario discussion: 5-6 minutes

    KEEP THEM BRIEF:
    - 6–16 words (max 120 characters) per follow-up.
    - No role/organization lists; address the person as "you".

    Return exactly {{ ctx.output_format }}
  "#
}

test GenerateQuestionSet_Custom_Instructions2 {
  functions [GenerateQuestionSet]
  args {
		inputs {
    target_org "Regional nonprofit hospital network (6 clinics, 450-bed hospital)",
    target_roles "Patients (outpatient), Front-desk staff, Nurses, Primary-care physicians",
    research_goal "Improve patient intake and follow-up experience",
    research_goal_details "Reduce waiting time, clarify instructions, and raise follow-up adherence for chronic care patients (diabetes, hypertension).",
    assumptions "Patients miss follow-ups due to confusing discharge instructions; staff tools are fragmented.",
    unknowns "Which steps create the most confusion? How do staff prioritize time? What would increase adherence?",
    custom_instructions "Favor plain language for patients 8th-grade reading level; include at least 2 questions about accessibility and language.",
    session_id "proj_health_001",
    round 1,
    total_per_round 8,
    per_category_min 1,
    per_category_max 4
	}
  }
}
