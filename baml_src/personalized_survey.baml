// Personal Touch AI - Personalized Survey Question Generation
// Generates context-aware questions based on person attributes and project research goals

// ============================================================================
// CONTEXT CLASSES
// ============================================================================

class PersonFacets {
  pains string[] @description("Known pain points from conversations")
  goals string[] @description("Stated goals and desired outcomes")
  workflows string[] @description("Current workflows and processes")
  tools string[] @description("Tools and systems they use")
}

class PersonContext {
  name string @description("Person's full name")
  title string? @description("Job title (e.g., 'VP Engineering')")
  company string? @description("Company name")
  role string? @description("Job function (e.g., 'Engineering', 'Product')")
  seniority_level string? @description("Seniority (e.g., 'VP', 'IC', 'C-Level')")

  icp_band string? @description("ICP match band: 'Strong', 'Moderate', 'Weak'")
  icp_score float? @description("ICP match score 0-1")

  facets PersonFacets @description("Known attributes from past conversations")
  missing_fields string[] @description("Fields we don't have data for (gaps to fill)")
  conversation_themes string[] @description("Key themes from past interviews")
  last_interaction_date string? @description("Date of last contact")

  sparse_mode bool @description("True if person has minimal data (discovery mode)")
}

class ThemeValidation {
  theme_name string @description("Name of theme needing validation")
  evidence_count int @description("Current number of evidence pieces")
  target_count int @description("Target number for confidence")
  confidence string @description("Theme confidence: 'low', 'medium', 'high'")
}

class ProjectContext {
  research_goals string[] @description("Project research objectives")
  themes_needing_validation ThemeValidation[] @description("Themes with low evidence counts")
  decision_questions string[] @description("Key decisions project needs to make")
}

class SurveyGoal {
  goal "validate" | "discover" | "deep_dive" | "pricing" @description("Primary survey objective")
  focus_theme string? @description("Specific theme to validate (if goal=validate)")
  target_segment string? @description("Target persona segment")
}

// ============================================================================
// OUTPUT CLASSES
// ============================================================================

class PersonalizedQuestion {
  text string @description("The survey question text (conversational, open-ended)")
  rationale string @description("Why this question for this person (shown to user)")
  uses_attributes string[] @description("Which person attributes influenced this question")
  evidence_type string @description("Expected evidence type: pain, goal, workflow, tool, context")
  order int @description("Priority/order ranking")
}

// ============================================================================
// MAIN GENERATION FUNCTION
// ============================================================================

function GeneratePersonalizedQuestions(
  person_context: PersonContext,
  project_context: ProjectContext,
  survey_goal: SurveyGoal,
  question_count: int
) -> PersonalizedQuestion[] {
  client CustomGPT4o

  prompt #"
    You are a research expert generating personalized survey questions for customer research.

    Your goal: Create {{question_count}} questions that feel PERSONAL but not CREEPY,
    leveraging what we know about this person while filling knowledge gaps.

    ═══════════════════════════════════════════════════════════════════════
    PERSON CONTEXT
    ═══════════════════════════════════════════════════════════════════════

    Name: {{person_context.name}}
    {% if person_context.title %}Title: {{person_context.title}}{% if person_context.company %} at {{person_context.company}}{% endif %}{% endif %}
    {% if person_context.role %}Role/Function: {{person_context.role}}{% if person_context.seniority_level %}, {{person_context.seniority_level}}{% endif %}{% endif %}
    {% if person_context.icp_band %}ICP Match: {{person_context.icp_band}}{% if person_context.icp_score %} (Score: {{person_context.icp_score}}){% endif %}{% endif %}

    {% if person_context.sparse_mode %}
    ⚠️ SPARSE DATA MODE: Person has minimal information. Focus on DISCOVERY questions.
    {% endif %}

    Known Attributes (from past conversations):
    {% if person_context.facets.pains %}
    - Pains: {{person_context.facets.pains | join(", ")}}
    {% endif %}
    {% if person_context.facets.goals %}
    - Goals: {{person_context.facets.goals | join(", ")}}
    {% endif %}
    {% if person_context.facets.workflows %}
    - Workflows: {{person_context.facets.workflows | join(", ")}}
    {% endif %}
    {% if person_context.facets.tools %}
    - Tools: {{person_context.facets.tools | join(", ")}}
    {% endif %}

    {% if person_context.missing_fields %}
    Missing Data (opportunities to fill gaps): {{person_context.missing_fields | join(", ")}}
    {% endif %}

    {% if person_context.conversation_themes %}
    Past Conversation Themes: {{person_context.conversation_themes | join(", ")}}
    {% endif %}

    {% if person_context.last_interaction_date %}
    Last Contact: {{person_context.last_interaction_date}}
    {% endif %}

    ═══════════════════════════════════════════════════════════════════════
    PROJECT CONTEXT
    ═══════════════════════════════════════════════════════════════════════

    {% if project_context.research_goals %}
    Research Goals:
    {% for goal in project_context.research_goals %}
    - {{goal}}
    {% endfor %}
    {% endif %}

    {% if project_context.themes_needing_validation %}
    Themes Needing Validation (low evidence):
    {% for theme in project_context.themes_needing_validation %}
    - "{{theme.theme_name}}": {{theme.evidence_count}}/{{theme.target_count}} evidence ({{theme.confidence}} confidence)
    {% endfor %}
    {% endif %}

    ═══════════════════════════════════════════════════════════════════════
    SURVEY GOAL
    ═══════════════════════════════════════════════════════════════════════

    Primary Goal: {{survey_goal.goal | upper}}
    {% if survey_goal.focus_theme %}Focus Theme: "{{survey_goal.focus_theme}}"{% endif %}
    {% if survey_goal.target_segment %}Target Segment: {{survey_goal.target_segment}}{% endif %}

    ═══════════════════════════════════════════════════════════════════════
    YOUR TASK
    ═══════════════════════════════════════════════════════════════════════

    Generate {{question_count}} personalized survey questions following these principles:

    1. LEVERAGE WHAT WE KNOW:
       - Reference their specific role/context naturally (e.g., "As a {{person_context.title}}...")
       - Build on past conversations when relevant (e.g., "You mentioned X in our last call...")
       - Address their known pains/goals directly
       - BUT: Don't say "Based on your profile" or "Our system shows" - be natural

    2. FILL KNOWLEDGE GAPS:
       - Ask about missing fields when relevant (title, company, role)
       - Validate themes with low evidence (< 3 pieces)
       - Support project research goals

    3. FEEL PERSONAL, NOT CREEPY:
       - Use conversational, friendly tone
       - Reference attributes naturally, woven into the question
       - Ask open-ended questions (avoid yes/no unless necessary)
       - Be curious, not interrogative

    4. STRATEGIC VALUE:
       - Each question should generate evidence for themes/goals
       - Prioritize questions for high-ICP people (they're valuable)
       - Support decision-making (not just data collection)

    ═══════════════════════════════════════════════════════════════════════
    EXAMPLES OF GOOD VS BAD QUESTIONS
    ═══════════════════════════════════════════════════════════════════════

    ❌ BAD (too generic):
    "What challenges do you face at work?"

    ✅ GOOD (personalized to context):
    "As a VP Engineering at a Series B company, what's your biggest challenge with research tools?"
    Rationale: References title, company stage, and research tool context
    Uses: [title, company_stage, domain]

    ❌ BAD (creepy, robotic):
    "Based on your profile, you mentioned budget concerns. Can you elaborate?"

    ✅ GOOD (natural reference to past):
    "In our last conversation, you brought up budget constraints. Has that changed at all, or is pricing still a key factor in your evaluation?"
    Rationale: References past conversation naturally, asks for update
    Uses: [conversation_themes]

    ❌ BAD (sparse data, still generic):
    "Tell me about your role."

    ✅ GOOD (sparse data, gap-filling):
    "I'd love to understand your role better - what does a typical day look like for you?"
    Rationale: Fills missing title/role data, conversational
    Uses: [missing_fields: title, role]

    ═══════════════════════════════════════════════════════════════════════
    OUTPUT FORMAT
    ═══════════════════════════════════════════════════════════════════════

    Return exactly {{question_count}} PersonalizedQuestion objects with:

    - text: The question text (conversational, 1-2 sentences max)
    - rationale: Why this question for THIS person (1 sentence, shown to user)
    - uses_attributes: List of person attributes that informed this question
        Examples: ["title", "company_stage", "past_pain_points", "icp_score", "missing_role"]
    - evidence_type: What type of evidence this question will generate
        Options: "pain", "goal", "workflow", "tool", "context"
    - order: Priority ranking (1 = highest priority)

    ═══════════════════════════════════════════════════════════════════════

    Generate {{question_count}} questions now:
  "#
}

// ============================================================================
// EVIDENCE EXTRACTION (for survey responses)
// ============================================================================

class ExtractedEvidence {
  gist string @description("12-word max essence of the insight")
  verbatim string @description("Direct quote from survey response (preserve exact wording)")
  context_summary string @description("1-2 sentence summary explaining why this matters")
  category "pain" | "goal" | "workflow" | "tool" | "context" @description("Type of evidence")
  confidence float @description("Confidence score 0-1")

  // Empathy map facets (optional, based on category)
  says string[] @description("What they explicitly said (quotes)")
  thinks string[] @description("What they might be thinking (inferred)")
  feels string[] @description("Emotional state (inferred)")
  pains string[] @description("Pain points mentioned")
  gains string[] @description("Gains/benefits mentioned")

  theme_matches string[] @description("Themes this evidence relates to (names)")
}

function ExtractEvidenceFromAnswer(
  question_text: string,
  answer_text: string,
  question_metadata: string,
  question_index: int
) -> ExtractedEvidence[] {
  client CustomGPT4o

  prompt #"
    Extract structured evidence from this survey response.

    IMPORTANT: Long answers may contain MULTIPLE distinct insights. Extract each as a separate evidence piece.

    Question #{{question_index}}: {{question_text}}

    Question Context (from generation): {{question_metadata}}

    Person's Answer:
    "{{answer_text}}"

    ═══════════════════════════════════════════════════════════════════════
    YOUR TASK
    ═══════════════════════════════════════════════════════════════════════

    Extract 1-5 evidence pieces from this answer. For EACH distinct insight:

    1. **gist**: 12-word max summary (punchy, specific)
       - Good: "Struggles to align stakeholders without visual evidence"
       - Bad: "Has challenges with stakeholders"

    2. **verbatim**: EXACT quote from answer (preserve their words)
       - If answer is 1-2 sentences, use the full answer
       - If longer, extract the most relevant 1-3 sentences per insight
       - NEVER paraphrase - use their exact words

    3. **context_summary**: 1-2 sentences explaining why this matters
       - Connect to broader patterns or implications
       - Example: "This reflects common B2B pain point around evidence-based selling. Visual proof materials help overcome stakeholder skepticism."

    4. **category**: pain, goal, workflow, tool, or context
       - pain: Problems, frustrations, blockers
       - goal: Desired outcomes, objectives
       - workflow: How they work, processes
       - tool: Software/tools they use
       - context: Background info (role, company, situation)

    5. **confidence**: 0-1 score
       - 0.9-1.0: Explicit, clear, specific
       - 0.7-0.89: Clear but slightly vague
       - 0.5-0.69: Implied or requires interpretation
       - < 0.5: Too vague, don't extract

    6. **Empathy map facets** (optional arrays):
       - says: Direct quotes (if different from verbatim)
       - thinks: What they might be thinking (careful inference)
       - feels: Emotional state (if expressed)
       - pains: Pain points (if category=pain)
       - gains: Benefits/gains mentioned (if category=goal)

    7. **theme_matches**: Theme names this relates to
       - Leave empty if unsure - we'll link later

    ═══════════════════════════════════════════════════════════════════════
    EXTRACTION RULES
    ═══════════════════════════════════════════════════════════════════════

    ✅ DO:
    - Extract multiple pieces if answer covers multiple topics
    - Preserve exact wording in verbatim (quotes matter!)
    - Be specific in gist (actionable insights)
    - Include context_summary to explain significance

    ❌ DON'T:
    - Paraphrase verbatim (use their words!)
    - Extract vague/generic statements
    - Create evidence from off-topic rambling
    - Extract if confidence < 0.5

    ═══════════════════════════════════════════════════════════════════════
    EXAMPLES
    ═══════════════════════════════════════════════════════════════════════

    Example 1: Single insight answer
    Question: "What's your biggest challenge with customer research?"
    Answer: "I spend 3-4 hours per week manually tagging interview notes, and I still miss important patterns."

    Output (1 evidence piece):
    [{
      gist: "Spends 3-4 hrs/week manually tagging notes, still misses patterns",
      verbatim: "I spend 3-4 hours per week manually tagging interview notes, and I still miss important patterns.",
      context_summary: "Manual tagging is time-consuming and error-prone. Reflects need for automated analysis tools.",
      category: "pain",
      confidence: 0.95,
      says: ["I spend 3-4 hours per week manually tagging interview notes"],
      pains: ["Time-consuming manual work", "Missing important patterns"],
      theme_matches: []
    }]

    Example 2: Multiple insights in one answer
    Question: "How do you currently validate pricing with customers?"
    Answer: "We usually do email surveys after demos, but response rates are terrible (maybe 10%). When we do get feedback, it's often vague like 'too expensive' without specifics. I've been thinking we should do live pricing walkthroughs instead."

    Output (3 evidence pieces):
    [
      {
        gist: "Email surveys after demos get ~10% response rate",
        verbatim: "We usually do email surveys after demos, but response rates are terrible (maybe 10%).",
        context_summary: "Low engagement with async email surveys. Timing and format may be wrong for pricing feedback.",
        category: "workflow",
        confidence: 0.9,
        says: ["response rates are terrible (maybe 10%)"],
        pains: ["Low survey response rates"],
        theme_matches: []
      },
      {
        gist: "Pricing feedback is vague ('too expensive') without details",
        verbatim: "When we do get feedback, it's often vague like 'too expensive' without specifics.",
        context_summary: "Survey format doesn't elicit actionable pricing feedback. Need deeper qualitative exploration.",
        category: "pain",
        confidence: 0.85,
        says: ["it's often vague like 'too expensive' without specifics"],
        pains: ["Vague feedback", "Lack of actionable pricing data"],
        theme_matches: []
      },
      {
        gist: "Considering live pricing walkthroughs as alternative",
        verbatim: "I've been thinking we should do live pricing walkthroughs instead.",
        context_summary: "Exploring synchronous methods for better pricing validation. Shows willingness to experiment with format.",
        category: "goal",
        confidence: 0.75,
        thinks: ["Live walkthroughs would work better than async surveys"],
        gains: ["More detailed pricing feedback", "Real-time clarification"],
        theme_matches: []
      }
    ]

    ═══════════════════════════════════════════════════════════════════════

    Now extract evidence from the answer above. Return 1-5 pieces.
  "#
}
