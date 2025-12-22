-- Add Question Coverage lens template
-- Simple lens to track asked/answered questions, skipped items, and follow-ups

INSERT INTO public.conversation_lens_templates (
  template_key, template_name, summary, primary_objective, category, display_order, template_definition, is_active, is_system
) VALUES (
  'question-coverage',
  'Question Coverage',
  'Track which questions were asked, what was answered, and what was skipped.',
  'Keep conversations honest about question coverage and highlight what still needs answers.',
  'research',
  6,
  '{
    "sections": [
      {
        "section_key": "questions_asked",
        "section_name": "Questions Asked",
        "description": "Capture the questions asked and the answers provided.",
        "fields": [
          {"field_key": "answered_questions", "field_name": "Answered Questions (Q → A)", "field_type": "text_array"},
          {"field_key": "unanswered_questions", "field_name": "Unanswered Questions", "field_type": "text_array"},
          {"field_key": "skipped_questions", "field_name": "Skipped / Not Asked", "field_type": "text_array"}
        ]
      },
      {
        "section_key": "next_steps",
        "section_name": "Follow-ups",
        "description": "Capture what is needed to answer the open questions.",
        "fields": [
          {"field_key": "follow_up_actions", "field_name": "Follow-up Actions", "field_type": "text_array"},
          {"field_key": "owners", "field_name": "Owners / Accountability", "field_type": "text_array"}
        ]
      }
    ],
    "entities": ["next_steps"],
    "recommendations_enabled": true
  }'::jsonb,
  true,
  true
) ON CONFLICT (template_key) DO UPDATE SET
  template_name = EXCLUDED.template_name,
  summary = EXCLUDED.summary,
  primary_objective = EXCLUDED.primary_objective,
  template_definition = EXCLUDED.template_definition,
  display_order = EXCLUDED.display_order,
  is_system = true,
  updated_at = now();
