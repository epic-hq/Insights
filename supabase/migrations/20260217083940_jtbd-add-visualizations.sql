-- Add visualizations, entities, and recommendations to JTBD Conversation Pipeline template
UPDATE public.conversation_lens_templates
SET template_definition = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        template_definition,
        '{visualizations}',
        '[
          {
            "viz_key": "four_forces_graphic",
            "type": "forces_quadrant",
            "title": "Forces of Progress Graphic",
            "description": "Visualizes push, pull, anxieties, and habits from extracted evidence.",
            "section_key": "forces_of_progress",
            "mapping": {
              "push": "push_forces",
              "pull": "pull_forces",
              "anxiety": "anxieties",
              "habit": "habits_inertia"
            },
            "explainers": {
              "push": "Pain and frustration pushing the customer away from the current state.",
              "pull": "Attraction to a new solution and expected gains.",
              "anxiety": "Uncertainty and risk that make switching feel unsafe.",
              "habit": "Existing routines and sunk costs that keep the status quo."
            }
          },
          {
            "viz_key": "job_map_graphic",
            "type": "job_map_timeline",
            "title": "Job Map Timeline",
            "description": "Shows workflow steps and bottleneck signals in sequence.",
            "section_key": "job_map",
            "mapping": {
              "steps": "job_steps_summary",
              "bottleneck_step": "bottleneck_step"
            },
            "explainers": {
              "steps": "Each step represents a stable part of the customer''s process.",
              "bottleneck_step": "The highest-friction step with the biggest improvement opportunity."
            }
          }
        ]'::jsonb
      ),
      '{entities}',
      '["stakeholders", "next_steps", "objections"]'::jsonb
    ),
    '{recommendations_enabled}',
    'true'::jsonb
  ),
  '{requires_project_context}',
  'true'::jsonb
),
updated_at = now()
WHERE template_key = 'jtbd-conversation-pipeline';
