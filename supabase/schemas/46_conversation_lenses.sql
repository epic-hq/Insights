-- Conversation Lenses - Generic template-based conversation analysis
-- Replaces hardcoded sales lens with flexible template system supporting
-- multiple analytical frameworks: Customer Discovery, Sales BANT, JTBD, etc.

-- ─────────────────────────────────────────────────────────────────────
-- 1. Templates Table - Reusable lens definitions
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.conversation_lens_templates (
  template_key text primary key,
  template_name text not null,
  summary text,
  primary_objective text,
  template_definition jsonb not null,
  is_active boolean default true,
  category text,
  display_order integer default 100,
  -- Custom lens support
  account_id uuid references accounts.accounts(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  is_system boolean not null default false,
  is_public boolean not null default true,
  nlp_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversation_lens_templates_active_idx
  on public.conversation_lens_templates(is_active, display_order)
  where is_active = true;

create index if not exists conversation_lens_templates_category_idx
  on public.conversation_lens_templates(category)
  where category is not null;

-- Custom lens indexes
create index if not exists conversation_lens_templates_account_idx
  on public.conversation_lens_templates(account_id)
  where account_id is not null;

create index if not exists conversation_lens_templates_created_by_idx
  on public.conversation_lens_templates(created_by)
  where created_by is not null;

-- Unique constraint: template_key unique per account scope
-- System lenses (account_id null): globally unique
-- Custom lenses: unique within account
create unique index if not exists conversation_lens_templates_scoped_key_unique
  on public.conversation_lens_templates(
    coalesce(account_id, '00000000-0000-0000-0000-000000000000'::uuid),
    template_key
  );

create trigger set_conversation_lens_templates_timestamp
  before insert or update on public.conversation_lens_templates
  for each row execute procedure accounts.trigger_set_timestamps();

-- ─────────────────────────────────────────────────────────────────────
-- 2. Analyses Table - Applied lens results
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.conversation_lens_analyses (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  template_key text not null references public.conversation_lens_templates(template_key) on delete restrict,
  account_id uuid not null references accounts.accounts(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  analysis_data jsonb not null default '{}'::jsonb,
  confidence_score float check (confidence_score >= 0 and confidence_score <= 1),
  auto_detected boolean default false,
  user_goals text[],
  icp_context jsonb,
  custom_instructions text,
  processed_at timestamptz,
  processed_by uuid references auth.users(id) on delete set null,
  status text default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  error_message text,
  trigger_run_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists conversation_lens_analyses_interview_template_unique
  on public.conversation_lens_analyses(interview_id, template_key);

create index if not exists conversation_lens_analyses_interview_idx
  on public.conversation_lens_analyses(interview_id);

create index if not exists conversation_lens_analyses_template_idx
  on public.conversation_lens_analyses(template_key);

create index if not exists conversation_lens_analyses_project_idx
  on public.conversation_lens_analyses(project_id, template_key);

create index if not exists conversation_lens_analyses_account_idx
  on public.conversation_lens_analyses(account_id);

create index if not exists conversation_lens_analyses_status_idx
  on public.conversation_lens_analyses(status)
  where status in ('pending', 'processing');

create trigger set_conversation_lens_analyses_timestamp
  before insert or update on public.conversation_lens_analyses
  for each row execute procedure accounts.trigger_set_timestamps();

-- ─────────────────────────────────────────────────────────────────────
-- 3. Row Level Security
-- ─────────────────────────────────────────────────────────────────────

alter table public.conversation_lens_templates enable row level security;
alter table public.conversation_lens_analyses enable row level security;

-- Templates: system templates readable by all, custom templates scoped to account
create policy "Users can read accessible templates"
  on public.conversation_lens_templates for select to authenticated
  using (
    is_active = true AND (
      is_system = true OR
      (account_id in (select accounts.get_accounts_with_role()) AND
       (is_public = true OR created_by = auth.uid()))
    )
  );

-- Users can create custom templates in their account
create policy "Users can create templates in their account"
  on public.conversation_lens_templates for insert to authenticated
  with check (
    account_id in (select accounts.get_accounts_with_role()) AND
    is_system = false
  );

-- Users can update their own custom templates
create policy "Users can update their own templates"
  on public.conversation_lens_templates for update to authenticated
  using (created_by = auth.uid() AND is_system = false)
  with check (created_by = auth.uid() AND is_system = false);

-- Users can delete their own custom templates (soft-delete via is_active)
create policy "Users can delete their own templates"
  on public.conversation_lens_templates for delete to authenticated
  using (created_by = auth.uid() AND is_system = false);

-- Service role can manage all templates (for system seeding)
create policy "Service role can manage lens templates"
  on public.conversation_lens_templates for all to service_role
  using (true) with check (true);

-- Analyses: account-scoped
create policy "Account members can read lens analyses"
  on public.conversation_lens_analyses for select to authenticated
  using (account_id in (select accounts.get_accounts_with_role()));

create policy "Account members can insert lens analyses"
  on public.conversation_lens_analyses for insert to authenticated
  with check (account_id in (select accounts.get_accounts_with_role()));

create policy "Account members can update lens analyses"
  on public.conversation_lens_analyses for update to authenticated
  using (account_id in (select accounts.get_accounts_with_role()))
  with check (account_id in (select accounts.get_accounts_with_role()));

create policy "Account members can delete lens analyses"
  on public.conversation_lens_analyses for delete to authenticated
  using (account_id in (select accounts.get_accounts_with_role()));

-- ─────────────────────────────────────────────────────────────────────
-- 4. Grants
-- ─────────────────────────────────────────────────────────────────────

grant select, insert, update, delete on table public.conversation_lens_templates to authenticated;
grant all on table public.conversation_lens_templates to service_role;
grant select, insert, update, delete on table public.conversation_lens_analyses to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────
-- 5. Seed System Templates
-- ─────────────────────────────────────────────────────────────────────

-- Project Research (P0) - Answers project goals, decision questions, unknowns
insert into public.conversation_lens_templates (
  template_key, template_name, summary, primary_objective, category, display_order, template_definition, is_active, is_system
) values (
  'project-research',
  'Project Research',
  'Answer project goals, decision questions, and resolve unknowns',
  'Map interview findings to specific project research objectives',
  'research',
  5,
  '{
    "sections": [
      {
        "section_key": "goal_answers",
        "section_name": "Research Goal Answers",
        "description": "Direct answers to project research goals",
        "fields": [
          {"field_key": "goal_statement", "field_name": "Goal", "field_type": "text"},
          {"field_key": "answer_summary", "field_name": "Answer", "field_type": "text"},
          {"field_key": "confidence", "field_name": "Confidence", "field_type": "text"},
          {"field_key": "supporting_findings", "field_name": "Supporting Findings", "field_type": "text_array"}
        ]
      },
      {
        "section_key": "decision_insights",
        "section_name": "Decision Insights",
        "description": "Recommendations for project decision questions",
        "fields": [
          {"field_key": "decision_question", "field_name": "Decision Question", "field_type": "text"},
          {"field_key": "recommendation", "field_name": "Recommendation", "field_type": "text"},
          {"field_key": "rationale", "field_name": "Rationale", "field_type": "text"},
          {"field_key": "risks", "field_name": "Risks", "field_type": "text_array"}
        ]
      },
      {
        "section_key": "unknown_resolutions",
        "section_name": "Unknowns Resolved",
        "description": "Status of project unknowns and uncertainties",
        "fields": [
          {"field_key": "unknown_statement", "field_name": "Unknown", "field_type": "text"},
          {"field_key": "status", "field_name": "Status", "field_type": "text"},
          {"field_key": "findings", "field_name": "Findings", "field_type": "text"},
          {"field_key": "suggested_follow_up", "field_name": "Follow-up", "field_type": "text"}
        ]
      },
      {
        "section_key": "target_fit",
        "section_name": "Target Fit Assessment",
        "description": "How well interviewee fits target criteria",
        "fields": [
          {"field_key": "fit_assessment", "field_name": "Fit", "field_type": "text"},
          {"field_key": "reasoning", "field_name": "Reasoning", "field_type": "text"},
          {"field_key": "signals", "field_name": "Signals", "field_type": "text_array"}
        ]
      }
    ],
    "entities": [],
    "recommendations_enabled": true,
    "requires_project_context": true
  }'::jsonb,
  true,
  true  -- is_system
) on conflict (template_key) do update set
  template_name = excluded.template_name,
  summary = excluded.summary,
  primary_objective = excluded.primary_objective,
  template_definition = excluded.template_definition,
  display_order = excluded.display_order,
  is_system = true;

-- Customer Discovery
insert into public.conversation_lens_templates (
  template_key, template_name, summary, primary_objective, category, display_order, template_definition, is_active, is_system
) values (
  'customer-discovery',
  'Customer Discovery',
  'Validate problem-solution fit and gather insights for product development',
  'Understand customer problems, validate hypotheses, and identify opportunities',
  'research',
  10,
  '{
    "sections": [
      {
        "section_key": "problem_validation",
        "section_name": "Problem Validation",
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
        "fields": [
          {"field_key": "proposed_solution_reaction", "field_name": "Solution Reaction", "field_type": "text"},
          {"field_key": "value_proposition_resonance", "field_name": "Value Prop Resonance", "field_type": "text"},
          {"field_key": "concerns_objections", "field_name": "Concerns/Objections", "field_type": "text_array"}
        ]
      },
      {
        "section_key": "market_insights",
        "section_name": "Market Insights",
        "fields": [
          {"field_key": "competitive_alternatives", "field_name": "Competitive Alternatives", "field_type": "text_array"},
          {"field_key": "switching_costs", "field_name": "Switching Costs", "field_type": "text"},
          {"field_key": "willingness_to_pay", "field_name": "Willingness to Pay", "field_type": "text"}
        ]
      }
    ],
    "entities": ["stakeholders", "objections"],
    "recommendations_enabled": true
  }'::jsonb,
  true,
  true  -- is_system
) on conflict (template_key) do update set
  template_name = excluded.template_name,
  summary = excluded.summary,
  template_definition = excluded.template_definition,
  is_system = true;

-- User Testing
insert into public.conversation_lens_templates (
  template_key, template_name, summary, primary_objective, category, display_order, template_definition, is_active, is_system
) values (
  'user-testing',
  'User Testing',
  'Evaluate usability, identify friction points, and gather feature feedback',
  'Assess product usability and user experience quality',
  'product',
  20,
  '{
    "sections": [
      {
        "section_key": "usability",
        "section_name": "Usability",
        "fields": [
          {"field_key": "task_completion", "field_name": "Task Completion", "field_type": "text"},
          {"field_key": "friction_points", "field_name": "Friction Points", "field_type": "text_array"},
          {"field_key": "unexpected_behaviors", "field_name": "Unexpected Behaviors", "field_type": "text_array"}
        ]
      },
      {
        "section_key": "feature_feedback",
        "section_name": "Feature Feedback",
        "fields": [
          {"field_key": "features_used", "field_name": "Features Used", "field_type": "text_array"},
          {"field_key": "features_requested", "field_name": "Features Requested", "field_type": "text_array"},
          {"field_key": "feature_clarity", "field_name": "Feature Clarity", "field_type": "text"}
        ]
      },
      {
        "section_key": "satisfaction",
        "section_name": "Satisfaction",
        "fields": [
          {"field_key": "overall_impression", "field_name": "Overall Impression", "field_type": "text"},
          {"field_key": "comparison_to_expectations", "field_name": "vs. Expectations", "field_type": "text"},
          {"field_key": "likelihood_to_recommend", "field_name": "Likelihood to Recommend", "field_type": "text"}
        ]
      }
    ],
    "entities": ["stakeholders"],
    "recommendations_enabled": true
  }'::jsonb,
  true,
  true  -- is_system
) on conflict (template_key) do update set
  template_name = excluded.template_name,
  summary = excluded.summary,
  template_definition = excluded.template_definition,
  is_system = true;

-- Product Insights
insert into public.conversation_lens_templates (
  template_key, template_name, summary, primary_objective, category, display_order, template_definition, is_active, is_system
) values (
  'product-insights',
  'Product Insights',
  'Extract JTBD, feature requests, product gaps, and competitive intelligence',
  'Identify product opportunities and user needs',
  'product',
  25,
  '{
    "sections": [
      {
        "section_key": "jobs_to_be_done",
        "section_name": "Jobs to be Done",
        "fields": [
          {"field_key": "job_description", "field_name": "Job", "field_type": "text"},
          {"field_key": "desired_outcome", "field_name": "Desired Outcome", "field_type": "text"},
          {"field_key": "current_solution", "field_name": "Current Solution", "field_type": "text"},
          {"field_key": "frustrations", "field_name": "Frustrations", "field_type": "text_array"},
          {"field_key": "importance", "field_name": "Importance", "field_type": "text"}
        ]
      },
      {
        "section_key": "feature_requests",
        "section_name": "Feature Requests",
        "fields": [
          {"field_key": "feature_name", "field_name": "Feature", "field_type": "text"},
          {"field_key": "use_case", "field_name": "Use Case", "field_type": "text"},
          {"field_key": "priority", "field_name": "Priority", "field_type": "text"}
        ]
      },
      {
        "section_key": "product_gaps",
        "section_name": "Product Gaps",
        "fields": [
          {"field_key": "gap_description", "field_name": "Gap", "field_type": "text"},
          {"field_key": "impact", "field_name": "Impact", "field_type": "text"},
          {"field_key": "workaround", "field_name": "Workaround", "field_type": "text"}
        ]
      },
      {
        "section_key": "competitive_insights",
        "section_name": "Competitive Insights",
        "fields": [
          {"field_key": "competitor_name", "field_name": "Competitor", "field_type": "text"},
          {"field_key": "context", "field_name": "Context", "field_type": "text"},
          {"field_key": "comparison_type", "field_name": "Comparison", "field_type": "text"}
        ]
      }
    ],
    "entities": ["competitive_insights"],
    "recommendations_enabled": true
  }'::jsonb,
  true,
  true  -- is_system
) on conflict (template_key) do update set
  template_name = excluded.template_name,
  summary = excluded.summary,
  template_definition = excluded.template_definition,
  is_system = true;

-- Sales BANT
insert into public.conversation_lens_templates (
  template_key, template_name, summary, primary_objective, category, display_order, template_definition, is_active, is_system
) values (
  'sales-bant',
  'Sales BANT',
  'Qualify opportunities using Budget, Authority, Need, and Timeline',
  'Qualify sales opportunities and assess deal viability',
  'sales',
  30,
  '{
    "sections": [
      {
        "section_key": "bant",
        "section_name": "BANT Qualification",
        "fields": [
          {"field_key": "budget", "field_name": "Budget", "field_type": "text"},
          {"field_key": "authority", "field_name": "Authority", "field_type": "text"},
          {"field_key": "need", "field_name": "Need", "field_type": "text"},
          {"field_key": "timeline", "field_name": "Timeline", "field_type": "text"}
        ]
      },
      {
        "section_key": "opportunity",
        "section_name": "Opportunity Assessment",
        "fields": [
          {"field_key": "deal_size", "field_name": "Potential Deal Size", "field_type": "text"},
          {"field_key": "competition", "field_name": "Competition", "field_type": "text_array"},
          {"field_key": "success_criteria", "field_name": "Success Criteria", "field_type": "text"},
          {"field_key": "blockers", "field_name": "Blockers/Risks", "field_type": "text_array"}
        ]
      }
    ],
    "entities": ["stakeholders", "next_steps", "objections"],
    "recommendations_enabled": true
  }'::jsonb,
  true,
  true  -- is_system
) on conflict (template_key) do update set
  template_name = excluded.template_name,
  summary = excluded.summary,
  template_definition = excluded.template_definition,
  is_system = true;

-- Empathy Map / JTBD
insert into public.conversation_lens_templates (
  template_key, template_name, summary, primary_objective, category, display_order, template_definition, is_active, is_system
) values (
  'empathy-map-jtbd',
  'Empathy Map / JTBD',
  'Understand user motivations, jobs-to-be-done, and emotional drivers',
  'Map user perspective and identify underlying motivations',
  'research',
  40,
  '{
    "sections": [
      {
        "section_key": "empathy_map",
        "section_name": "Empathy Map",
        "fields": [
          {"field_key": "says", "field_name": "Says", "field_type": "text_array"},
          {"field_key": "thinks", "field_name": "Thinks", "field_type": "text_array"},
          {"field_key": "does", "field_name": "Does", "field_type": "text_array"},
          {"field_key": "feels", "field_name": "Feels", "field_type": "text_array"},
          {"field_key": "pains", "field_name": "Pains", "field_type": "text_array"},
          {"field_key": "gains", "field_name": "Gains", "field_type": "text_array"}
        ]
      },
      {
        "section_key": "jobs_to_be_done",
        "section_name": "Jobs to be Done",
        "fields": [
          {"field_key": "functional_jobs", "field_name": "Functional Jobs", "field_type": "text_array"},
          {"field_key": "social_jobs", "field_name": "Social Jobs", "field_type": "text_array"},
          {"field_key": "emotional_jobs", "field_name": "Emotional Jobs", "field_type": "text_array"}
        ]
      }
    ],
    "entities": ["stakeholders"],
    "recommendations_enabled": true
  }'::jsonb,
  true,
  true  -- is_system
) on conflict (template_key) do update set
  template_name = excluded.template_name,
  summary = excluded.summary,
  template_definition = excluded.template_definition,
  is_system = true;

comment on table public.conversation_lens_templates is
  'Reusable conversation analysis templates/frameworks. Defines structure for analyzing interviews through different lenses.';

comment on table public.conversation_lens_analyses is
  'Applied lens analyses on interviews. Links interviews to templates and stores extracted/analyzed data.';
