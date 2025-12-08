-- Add customer profile sections to Customer Discovery lens template
-- This enhances the template with interviewee profile, organization context,
-- behavioral characteristics, and segment signals - key for UX research

UPDATE public.conversation_lens_templates
SET
  summary = 'Profile customers, validate problems, and gather insights for product development',
  primary_objective = 'Understand WHO the customer is, their problems, and opportunities',
  template_definition = '{
    "sections": [
      {
        "section_key": "interviewee_profile",
        "section_name": "Interviewee Profile",
        "description": "Who is this person - their role, responsibilities, and context",
        "fields": [
          {"field_key": "role_title", "field_name": "Role/Title", "field_type": "text"},
          {"field_key": "responsibilities", "field_name": "Key Responsibilities", "field_type": "text_array"},
          {"field_key": "experience_level", "field_name": "Experience Level", "field_type": "text"},
          {"field_key": "team_size", "field_name": "Team Size/Structure", "field_type": "text"},
          {"field_key": "decision_authority", "field_name": "Decision Authority", "field_type": "text"}
        ]
      },
      {
        "section_key": "organization_context",
        "section_name": "Organization Context",
        "description": "Company/organization characteristics for segmentation",
        "fields": [
          {"field_key": "org_type", "field_name": "Organization Type", "field_type": "text"},
          {"field_key": "org_size", "field_name": "Organization Size", "field_type": "text"},
          {"field_key": "industry_vertical", "field_name": "Industry/Vertical", "field_type": "text"},
          {"field_key": "tech_maturity", "field_name": "Tech Maturity", "field_type": "text"},
          {"field_key": "growth_stage", "field_name": "Growth Stage", "field_type": "text"}
        ]
      },
      {
        "section_key": "behavioral_characteristics",
        "section_name": "Behavioral Characteristics",
        "description": "Behaviors, habits, and patterns relevant to product adoption",
        "fields": [
          {"field_key": "adopter_type", "field_name": "Adopter Type", "field_type": "text"},
          {"field_key": "buying_behavior", "field_name": "Buying Behavior", "field_type": "text"},
          {"field_key": "information_sources", "field_name": "Information Sources", "field_type": "text_array"},
          {"field_key": "tool_ecosystem", "field_name": "Tool Ecosystem", "field_type": "text_array"},
          {"field_key": "workflow_patterns", "field_name": "Workflow Patterns", "field_type": "text"}
        ]
      },
      {
        "section_key": "problem_validation",
        "section_name": "Problem Validation",
        "description": "Primary problems, frequency, and severity",
        "fields": [
          {"field_key": "problem_statement", "field_name": "Primary Problem", "field_type": "text"},
          {"field_key": "problem_frequency", "field_name": "Problem Frequency", "field_type": "text"},
          {"field_key": "current_solutions", "field_name": "Current Solutions", "field_type": "text_array"},
          {"field_key": "pain_severity", "field_name": "Pain Severity", "field_type": "text"}
        ]
      },
      {
        "section_key": "solution_validation",
        "section_name": "Solution Validation",
        "description": "Reactions to proposed solutions and value propositions",
        "fields": [
          {"field_key": "proposed_solution_reaction", "field_name": "Solution Reaction", "field_type": "text"},
          {"field_key": "value_proposition_resonance", "field_name": "Value Prop Resonance", "field_type": "text"},
          {"field_key": "concerns_objections", "field_name": "Concerns/Objections", "field_type": "text_array"}
        ]
      },
      {
        "section_key": "market_insights",
        "section_name": "Market Insights",
        "description": "Competitive landscape and willingness to pay",
        "fields": [
          {"field_key": "competitive_alternatives", "field_name": "Competitive Alternatives", "field_type": "text_array"},
          {"field_key": "switching_costs", "field_name": "Switching Costs", "field_type": "text"},
          {"field_key": "willingness_to_pay", "field_name": "Willingness to Pay", "field_type": "text"}
        ]
      },
      {
        "section_key": "segment_signals",
        "section_name": "Segment Signals",
        "description": "Key indicators for ICP fit and segmentation",
        "fields": [
          {"field_key": "icp_fit_assessment", "field_name": "ICP Fit", "field_type": "text"},
          {"field_key": "segment_indicators", "field_name": "Segment Indicators", "field_type": "text_array"},
          {"field_key": "differentiating_attributes", "field_name": "Differentiating Attributes", "field_type": "text_array"}
        ]
      }
    ],
    "entities": ["stakeholders", "objections"],
    "recommendations_enabled": true
  }'::jsonb,
  updated_at = now()
WHERE template_key = 'customer-discovery';
