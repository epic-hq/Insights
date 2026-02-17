-- Add JTBD Conversation Pipeline lens template
-- Converts interviews into job context, switching forces, constraints, and ranked opportunities.

INSERT INTO public.conversation_lens_templates (
  template_key,
  template_name,
  summary,
  primary_objective,
  category,
  display_order,
  template_definition,
  is_active,
  is_system
) VALUES (
  'jtbd-conversation-pipeline',
  $$JTBD Conversation Pipeline$$,
  $$Turn customer conversations into a job map, switching forces, and ranked opportunities.$$,
  $$Extract decision-ready Jobs-to-be-Done signals from messy conversations and recommend the next best actions.$$,
  'research',
  16,
  $${
    "sections": [
      {
        "section_key": "job_context",
        "section_name": "Job + Context",
        "description": "Situation, trigger, desired progress, and current hire.",
        "explainer": "A Job-to-be-Done explains the progress the customer is trying to make in a specific context, not just the feature they requested.",
        "fields": [
          {"field_key": "situation_trigger", "field_name": "Situation / Trigger", "field_type": "text", "explainer": "The event or context that starts the search for a better way."},
          {"field_key": "desired_progress", "field_name": "Desired Progress", "field_type": "text", "explainer": "What better looks like from the customer's perspective."},
          {"field_key": "current_hire", "field_name": "Current Hire", "field_type": "text", "explainer": "What the customer currently hires to get the job done (tool, process, person, or workaround)."},
          {"field_key": "job_statement", "field_name": "JTBD Statement", "field_type": "text", "explainer": "Concise framing: when [situation], I want to [motivation], so I can [expected outcome]."},
          {"field_key": "functional_jobs", "field_name": "Functional Jobs", "field_type": "text_array", "explainer": "Practical tasks the customer needs to accomplish."},
          {"field_key": "social_jobs", "field_name": "Social Jobs", "field_type": "text_array", "explainer": "How the customer wants to be perceived by others while doing the job."},
          {"field_key": "emotional_jobs", "field_name": "Emotional Jobs", "field_type": "text_array", "explainer": "How the customer wants to feel before, during, and after completing the job."}
        ]
      },
      {
        "section_key": "forces_of_progress",
        "section_name": "Forces of Progress",
        "description": "Push, pull, anxieties, and habits shaping switching behavior.",
        "explainer": "The four forces model explains why customers switch (or do not switch): push away from current state, pull toward a new solution, anxieties about risk, and habits holding the status quo.",
        "fields": [
          {"field_key": "push_forces", "field_name": "Push Forces", "field_type": "text_array", "explainer": "Pain and frustration pushing the customer away from the current approach."},
          {"field_key": "pull_forces", "field_name": "Pull Forces", "field_type": "text_array", "explainer": "Attractive outcomes pulling the customer toward a new solution."},
          {"field_key": "anxieties", "field_name": "Anxieties", "field_type": "text_array", "explainer": "Perceived risks, uncertainty, or fear about switching."},
          {"field_key": "habits_inertia", "field_name": "Habits / Inertia", "field_type": "text_array", "explainer": "Existing routines, sunk costs, and switching effort that keep the status quo in place."},
          {"field_key": "strongest_force_summary", "field_name": "Strongest Force Summary", "field_type": "text"}
        ]
      },
      {
        "section_key": "outcomes",
        "section_name": "Outcome Lens",
        "description": "Desired outcomes and success metrics tied to progress.",
        "fields": [
          {"field_key": "desired_outcomes", "field_name": "Desired Outcomes", "field_type": "text_array"},
          {"field_key": "success_metrics", "field_name": "Success Metrics", "field_type": "text_array"},
          {"field_key": "time_to_value_expectation", "field_name": "Time to Value Expectation", "field_type": "text"},
          {"field_key": "unmet_outcomes", "field_name": "Unmet Outcomes", "field_type": "text_array"}
        ]
      },
      {
        "section_key": "constraints",
        "section_name": "Constraints Lens",
        "description": "Hard constraints that limit adoption or purchase.",
        "fields": [
          {"field_key": "budget_constraints", "field_name": "Budget Constraints", "field_type": "text_array"},
          {"field_key": "procurement_constraints", "field_name": "Procurement Constraints", "field_type": "text_array"},
          {"field_key": "compliance_constraints", "field_name": "Compliance Constraints", "field_type": "text_array"},
          {"field_key": "integration_constraints", "field_name": "Integration Constraints", "field_type": "text_array"},
          {"field_key": "time_skill_constraints", "field_name": "Time / Skill Constraints", "field_type": "text_array"}
        ]
      },
      {
        "section_key": "alternatives",
        "section_name": "Alternative Lens",
        "description": "Status quo, competitors, DIY, or internal build alternatives.",
        "fields": [
          {"field_key": "competitor_alternatives", "field_name": "Competitor Alternatives", "field_type": "text_array"},
          {"field_key": "diy_or_internal_build", "field_name": "DIY / Internal Build", "field_type": "text_array"},
          {"field_key": "status_quo_workarounds", "field_name": "Status Quo Workarounds", "field_type": "text_array"},
          {"field_key": "switching_barriers", "field_name": "Switching Barriers", "field_type": "text_array"}
        ]
      },
      {
        "section_key": "job_map",
        "section_name": "Job Map",
        "description": "Step-level job flow with bottlenecks and evidence-backed pain.",
        "explainer": "Job Maps break the customer's process into stable steps so teams can pinpoint where progress stalls and where to design improvements.",
        "fields": [
          {"field_key": "job_steps_summary", "field_name": "Job Steps Summary", "field_type": "text_array", "explainer": "Ordered steps in the customer's workflow from first intent to successful completion."},
          {"field_key": "bottleneck_step", "field_name": "Bottleneck Step", "field_type": "text", "explainer": "The step where effort, delay, or risk is highest."},
          {"field_key": "workarounds_by_step", "field_name": "Workarounds by Step", "field_type": "text_array", "explainer": "Temporary methods customers use to cope with weak steps."},
          {"field_key": "metrics_by_step", "field_name": "Metrics by Step", "field_type": "text_array", "explainer": "How customers measure success at each step."}
        ]
      },
      {
        "section_key": "opportunity_board",
        "section_name": "Opportunity Board",
        "description": "Prioritized opportunities linked to step, force, and segment.",
        "fields": [
          {"field_key": "opportunity_candidates", "field_name": "Opportunity Candidates", "field_type": "text_array"},
          {"field_key": "importance", "field_name": "Importance (1-5)", "field_type": "text"},
          {"field_key": "dissatisfaction", "field_name": "Dissatisfaction (1-5)", "field_type": "text"},
          {"field_key": "frequency", "field_name": "Frequency (1-5)", "field_type": "text"},
          {"field_key": "friction", "field_name": "Friction (1-5)", "field_type": "text"},
          {"field_key": "priority_score", "field_name": "Priority Score", "field_type": "text"},
          {"field_key": "highest_priority_opportunity", "field_name": "Highest Priority Opportunity", "field_type": "text"}
        ]
      },
      {
        "section_key": "guidance",
        "section_name": "Guidance",
        "description": "Interview probes and post-interview actions to close evidence gaps.",
        "fields": [
          {"field_key": "pre_interview_probes", "field_name": "Before Next Interview", "field_type": "text_array"},
          {"field_key": "in_interview_prompts", "field_name": "During Interview", "field_type": "text_array"},
          {"field_key": "post_interview_actions", "field_name": "After Interviews", "field_type": "text_array"},
          {"field_key": "decision_ready_summary", "field_name": "Decision-Ready Summary", "field_type": "text"}
        ]
      }
    ],
    "visualizations": [
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
          "steps": "Each step represents a stable part of the customer's process.",
          "bottleneck_step": "The highest-friction step with the biggest improvement opportunity."
        }
      },
      {
        "viz_key": "job_map_journey_matrix",
        "type": "job_map_matrix",
        "title": "JTBD Journey Matrix",
        "description": "Cross-stage matrix of experience, insights, opportunities, and solutions.",
        "section_key": "job_map",
        "mapping": {
          "steps": "job_map.job_steps_summary",
          "bottleneck_step": "job_map.bottleneck_step",
          "workarounds": "job_map.workarounds_by_step",
          "metrics": "job_map.metrics_by_step",
          "insights": "outcomes.desired_outcomes",
          "opportunities": "opportunity_board.opportunity_candidates",
          "solutions": "guidance.post_interview_actions"
        },
        "explainers": {
          "steps": "Ordered customer workflow stages.",
          "insights": "Signals and desired outcomes mapped to each stage.",
          "opportunities": "Priority opportunities linked to each stage.",
          "solutions": "Proposed actions that reduce friction or improve outcomes."
        }
      }
    ],
    "entities": ["stakeholders", "next_steps", "objections"],
    "recommendations_enabled": true,
    "requires_project_context": true
  }$$::jsonb,
  true,
  true
)
ON CONFLICT (template_key) DO UPDATE SET
  template_name = EXCLUDED.template_name,
  summary = EXCLUDED.summary,
  primary_objective = EXCLUDED.primary_objective,
  category = EXCLUDED.category,
  display_order = EXCLUDED.display_order,
  template_definition = EXCLUDED.template_definition,
  is_active = EXCLUDED.is_active,
  is_system = true,
  updated_at = now();
