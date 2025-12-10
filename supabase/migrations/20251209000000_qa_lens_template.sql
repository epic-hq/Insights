-- Add Q&A Summary lens template
-- This lens extracts question-answer pairs from interviews

insert into public.conversation_lens_templates (
  template_key, template_name, summary, primary_objective, category, display_order, template_definition, is_active, is_system
) values (
  'qa-summary',
  'Q&A Summary',
  'Extract question-answer pairs from interviews into a structured, scannable document',
  'Create a clean Q&A document that pairs interviewer questions with participant responses, highlighting key takeaways and unanswered questions',
  'research',
  15, -- After other research lenses
  '{
    "sections": [
      {
        "section_key": "qa_pairs",
        "section_name": "Question & Answer Pairs",
        "description": "Chronological Q&A pairs from the interview",
        "fields": [
          {
            "field_key": "question",
            "field_name": "Question",
            "field_type": "text",
            "description": "The interviewer question"
          },
          {
            "field_key": "answer",
            "field_name": "Answer",
            "field_type": "text",
            "description": "Synthesized participant response"
          },
          {
            "field_key": "verbatim",
            "field_name": "Key Quote",
            "field_type": "text",
            "description": "Best direct quote from the answer"
          },
          {
            "field_key": "topic",
            "field_name": "Topic",
            "field_type": "text",
            "description": "Topic category for grouping"
          }
        ]
      },
      {
        "section_key": "takeaways",
        "section_name": "Key Takeaways",
        "description": "Main learnings distilled from the Q&A session",
        "fields": [
          {
            "field_key": "takeaways",
            "field_name": "Key Takeaways",
            "field_type": "text_array",
            "description": "3-5 main learnings from the interview"
          }
        ]
      },
      {
        "section_key": "gaps",
        "section_name": "Gaps & Follow-ups",
        "description": "Questions that need follow-up",
        "fields": [
          {
            "field_key": "unanswered",
            "field_name": "Unanswered Questions",
            "field_type": "text_array",
            "description": "Questions that were not answered or need clarification"
          }
        ]
      }
    ],
    "entities": [],
    "recommendations_enabled": false
  }'::jsonb,
  true,
  true
)
on conflict (template_key) do update set
  template_name = excluded.template_name,
  summary = excluded.summary,
  primary_objective = excluded.primary_objective,
  category = excluded.category,
  display_order = excluded.display_order,
  template_definition = excluded.template_definition,
  is_active = excluded.is_active,
  is_system = excluded.is_system;
