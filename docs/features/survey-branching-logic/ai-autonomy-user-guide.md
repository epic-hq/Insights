# AI Autonomy for Chat Surveys - User Guide

## Overview

When you enable Chat or Voice mode for a Research Link, you can control how much freedom the AI interviewer has to adapt the conversation. This setting is called **AI Autonomy**.

## AI Autonomy Levels

### Strict (Default)

**Best for:** Standardized surveys, compliance-sensitive research, large sample sizes

**How it works:**
- The AI asks each question exactly as written, in order
- No follow-up questions or probing
- Responses are brief and consistent
- Every respondent gets the identical experience

**What respondents see:**
> "Thanks! Next question: How satisfied are you with the product? (1-5)"

### Moderate

**Best for:** Customer feedback, satisfaction surveys, general research

**How it works:**
- Questions are asked in order, but the AI may ask ONE brief follow-up if an answer is particularly interesting or unclear
- Skips questions that are clearly irrelevant to the respondent's context (if known)
- Still maintains brevity and consistency

**What respondents see:**
> "Interesting that you mentioned pricing. Could you say a bit more about that? ...Got it. Next: How likely are you to recommend us?"

### Adaptive (Pro)

**Best for:** Discovery research, user interviews, exploratory conversations

**How it works:**
- The AI uses your project's research goals, unknowns, and target profiles to guide the conversation
- Probes deeper on topics that matter to your research objectives
- References respondent context when relevant (job title, company, past interactions)
- May reorder or skip questions based on conversation flow
- Asks natural follow-up questions when answers warrant exploration

**What respondents see:**
> "As a Product Manager at an enterprise company, I'm curious - you mentioned the approval process is painful. How does that typically play out with your stakeholders?"

## How to Configure

1. Go to your Research Link's edit page
2. Enable **Chat** or **Voice** response mode
3. The AI Autonomy selector will appear
4. Choose Strict, Moderate, or Adaptive
5. Save your changes

## Maximizing Adaptive Mode

Adaptive mode is most powerful when you've set up your project context:

| What to configure | Where | Impact |
|---|---|---|
| Research Goal | Project Setup | AI understands what you're trying to learn |
| Target Roles | Project Setup | AI adapts questions for the respondent's job |
| Target Orgs | Project Setup | AI considers company context |
| Key Unknowns | Project Setup | AI probes deeper on these topics |
| Decision Questions | Project Setup | AI prioritizes gathering this info |
| Custom Instructions | Project Setup | AI follows your specific guidance |

The more context you provide, the smarter the AI interviewer becomes.

## Smart CRM Integration

When a respondent is identified (via email match), Adaptive mode can access:
- Their name and role
- Company and segment
- Past interview history

This lets the AI personalize the conversation naturally without asking redundant questions.

**Note:** For anonymous/cold surveys where we don't know the respondent, the AI gracefully falls back to the standard question flow - no wasted time looking up data that doesn't exist.

## Choosing the Right Level

| Scenario | Recommended Level |
|---|---|
| NPS survey to 10,000 customers | Strict |
| Post-purchase feedback | Moderate |
| Feature satisfaction survey | Moderate |
| Customer discovery interviews | Adaptive |
| User research for new features | Adaptive |
| Win/loss interviews | Adaptive |
| Compliance-regulated research | Strict |

## FAQ

**Q: Will Adaptive mode make every survey take longer?**
A: Not necessarily. It may actually be faster because it skips irrelevant questions and gets to insights more efficiently.

**Q: Can I use Adaptive mode with anonymous surveys?**
A: Yes, but without CRM data, the AI has less context to personalize. It will still use your project's research goals.

**Q: What if the AI goes off-script too much?**
A: Start with Moderate mode. You can always switch to Adaptive after seeing how respondents engage.

**Q: Does Adaptive mode work with Form mode?**
A: No. Form mode uses simple skip logic (if configured). AI Autonomy only applies to Chat and Voice modes where there's a real conversation.
