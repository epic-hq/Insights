-- Add Consulting Project lens template
-- For aligning consulting engagements: goals, scope, risks, and stakeholder expectations

INSERT INTO public.conversation_lens_templates (
  template_key, template_name, summary, primary_objective, category, display_order, template_definition, is_active
) VALUES (
  'consulting-project',
  'Consulting Project',
  'Align goals, scope, risks, and expectations across stakeholder conversations',
  'Make the delivery plan explicit, achievable, and agreed by the client',
  'research',
  15,
  '{
    "sections": [
      {
        "section_key": "context_brief",
        "section_name": "Context & Brief",
        "description": "Client problem, goals, success measures, scope boundaries",
        "fields": [
          {"field_key": "client_problem", "field_name": "Client Problem", "field_type": "text"},
          {"field_key": "stated_goals", "field_name": "Stated Goals", "field_type": "text_array"},
          {"field_key": "success_measures", "field_name": "Success Measures", "field_type": "text_array"},
          {"field_key": "scope_boundaries", "field_name": "Scope Boundaries", "field_type": "text"},
          {"field_key": "constraints", "field_name": "Constraints", "field_type": "text_array"},
          {"field_key": "key_dates", "field_name": "Key Dates", "field_type": "text_array"}
        ]
      },
      {
        "section_key": "stakeholder_inputs",
        "section_name": "Stakeholder Inputs",
        "description": "Individual goals, expectations, concerns, and success/failure definitions",
        "fields": [
          {"field_key": "stakeholder_goals", "field_name": "Stakeholder Goals", "field_type": "text_array"},
          {"field_key": "expectations", "field_name": "Expectations", "field_type": "text_array"},
          {"field_key": "concerns", "field_name": "Concerns", "field_type": "text_array"},
          {"field_key": "decision_criteria", "field_name": "Decision Criteria", "field_type": "text_array"},
          {"field_key": "success_definition", "field_name": "What Success Looks Like", "field_type": "text"},
          {"field_key": "failure_definition", "field_name": "What Would Make It Fail", "field_type": "text"}
        ]
      },
      {
        "section_key": "alignment_gaps",
        "section_name": "Alignment & Gaps",
        "description": "Agreements, conflicts, ambiguities that need resolution",
        "fields": [
          {"field_key": "agreements", "field_name": "Agreements", "field_type": "text_array"},
          {"field_key": "conflicts", "field_name": "Conflicts/Disagreements", "field_type": "text_array"},
          {"field_key": "ambiguities", "field_name": "Ambiguities", "field_type": "text_array"},
          {"field_key": "dependencies", "field_name": "Dependencies", "field_type": "text_array"}
        ]
      },
      {
        "section_key": "plan_milestones",
        "section_name": "Plan & Milestones",
        "description": "Phases, deliverables, owners, checkpoints",
        "fields": [
          {"field_key": "phases", "field_name": "Phases", "field_type": "text_array"},
          {"field_key": "deliverables", "field_name": "Deliverables", "field_type": "text_array"},
          {"field_key": "owners", "field_name": "Owners", "field_type": "text_array"},
          {"field_key": "checkpoints", "field_name": "Checkpoints/Decision Gates", "field_type": "text_array"},
          {"field_key": "assumptions", "field_name": "Assumptions", "field_type": "text_array"}
        ]
      },
      {
        "section_key": "risks_mitigations",
        "section_name": "Risks & Mitigations",
        "description": "Top risks and how to address them",
        "fields": [
          {"field_key": "scope_risks", "field_name": "Scope Risks", "field_type": "text_array"},
          {"field_key": "timeline_risks", "field_name": "Timeline Risks", "field_type": "text_array"},
          {"field_key": "adoption_risks", "field_name": "Adoption Risks", "field_type": "text_array"},
          {"field_key": "resource_risks", "field_name": "Resource Risks", "field_type": "text_array"},
          {"field_key": "mitigations", "field_name": "Mitigations", "field_type": "text_array"},
          {"field_key": "contingency_triggers", "field_name": "Contingency Triggers", "field_type": "text_array"}
        ]
      },
      {
        "section_key": "commitments_next_steps",
        "section_name": "Commitments & Next Steps",
        "description": "Confirmed expectations and immediate actions",
        "fields": [
          {"field_key": "confirmed_expectations", "field_name": "Confirmed Expectations", "field_type": "text_array"},
          {"field_key": "open_questions", "field_name": "Open Questions", "field_type": "text_array"},
          {"field_key": "immediate_actions", "field_name": "Immediate Actions", "field_type": "text_array"},
          {"field_key": "communication_cadence", "field_name": "Communication Cadence", "field_type": "text"}
        ]
      }
    ],
    "entities": ["stakeholders", "next_steps"],
    "recommendations_enabled": true
  }'::jsonb,
  true
) ON CONFLICT (template_key) DO UPDATE SET
  template_name = EXCLUDED.template_name,
  summary = EXCLUDED.summary,
  primary_objective = EXCLUDED.primary_objective,
  template_definition = EXCLUDED.template_definition,
  updated_at = now();
