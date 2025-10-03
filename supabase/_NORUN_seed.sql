-- Sample seed data for Insights application


-- Facet catalog seeds -------------------------------------------------------
INSERT INTO public.facet_kind_global (slug, label, description)
VALUES
  ('goal', 'Goal', 'Desired outcomes and success definitions'),
  ('pain', 'Pain', 'Frustrations, blockers, and negative moments'),
  ('behavior', 'Behavior', 'Observable actions and habits'),
  ('task', 'Task', 'Jobs to be done, workflows, or steps'),
  ('tool', 'Tool', 'Products, platforms, or solutions referenced'),
  ('value', 'Value', 'What the user values or optimizes for'),
  ('differentiator', 'Differentiator', 'Signals that separate this persona or segment'),
  ('decision_criteria', 'Decision Criteria', 'Factors weighed when making a choice'),
  ('scale', 'Scale', 'Spectrum-based assessments such as price sensitivity'),
  ('demographic', 'Demographic', 'Audience attributes such as role, title, region, tenure'),
  ('preference', 'Preference', 'Stable preferences or operating styles'),
  ('workflow', 'Workflow', 'Steps or rituals followed to accomplish tasks')
ON CONFLICT (slug)
DO UPDATE SET label = EXCLUDED.label, description = EXCLUDED.description, updated_at = now();

WITH kind_map AS (
  SELECT slug, id FROM public.facet_kind_global
)
INSERT INTO public.facet_global (kind_id, slug, label, synonyms, description)
SELECT
  km.id,
  datum.slug,
  datum.label,
  datum.synonyms,
  datum.description
FROM (
  VALUES
    ('goal', 'goal_finish_faster', 'Finish Faster', ARRAY['finish quickly','reduce time to complete'], 'Speed-oriented goal'),
    ('goal', 'goal_reduce_stress', 'Reduce Stress', ARRAY['less stressful','feel calmer'], 'Emotional relief goal'),
    ('pain', 'pain_tool_overload', 'Too Many Tools', ARRAY['tool sprawl','app switching'], 'Fragmented tool landscape'),
    ('pain', 'pain_manual_reporting', 'Manual Reporting', ARRAY['spreadsheet toil','manual updates'], 'Manual effort pain'),
    ('behavior', 'behavior_deadline_driven', 'Deadline Driven', ARRAY['works last minute','deadline crunch'], 'Behaviors tied to deadlines'),
    ('behavior', 'behavior_collaborative', 'Collaborative', ARRAY['co-creates','shares drafts'], 'Collaboration behavior'),
    ('task', 'task_progress_tracking', 'Track Progress', ARRAY['monitor status','check progress'], 'Monitoring tasks'),
    ('tool', 'tool_ai_companion', 'AI Companion', ARRAY['copilot','assistant'], 'AI helper tools'),
    ('tool', 'tool_notetaking', 'Note-taking App', ARRAY['notes app','documentation tool'], 'Notes applications'),
    ('value', 'value_autonomy', 'Autonomy', ARRAY['self-directed','independent'], 'Autonomy value'),
    ('value', 'value_guidance', 'Guidance', ARRAY['needs coaching','step-by-step'], 'Guidance value'),
    ('differentiator', 'diff_speed_vs_depth', 'Speed vs. Depth', ARRAY['shallow vs deep','breadth vs depth'], 'Preference between speed and depth'),
    ('decision_criteria', 'criteria_cost', 'Cost Fit', ARRAY['budget fit','affordable'], 'Cost-based decision criteria'),
    ('decision_criteria', 'criteria_integrations', 'Integrations', ARRAY['connects to tools','integration support'], 'Ecosystem decision factor'),
    ('demographic', 'demo_team_lead', 'Team Lead', ARRAY['manager','team lead'], 'Role: manages a team'),
    ('demographic', 'demo_region_apac', 'APAC Region', ARRAY['asia pacific','apac market'], 'Operating region'),
    ('preference', 'pref_async_updates', 'Prefers Async Updates', ARRAY['async communication','written update'], 'Communication preference'),
    ('workflow', 'workflow_weekly_review', 'Weekly Review Ritual', ARRAY['weekly planning','friday review'], 'Recurring workflow ritual')
) AS datum(kind_slug, slug, label, synonyms, description)
JOIN kind_map km ON km.slug = datum.kind_slug
ON CONFLICT (slug)
DO UPDATE SET
  label = EXCLUDED.label,
  synonyms = EXCLUDED.synonyms,
  description = EXCLUDED.description,
  updated_at = now();

-- Enable seed project with core facets --------------------------------------
WITH project_row AS (
  SELECT id, account_id FROM public.projects WHERE id = '538a6c02-bcdf-43b5-8ea4-6e4bdb4bdd16'
)
INSERT INTO public.project_facet (
  project_id,
  account_id,
  facet_ref,
  scope,
  is_enabled,
  alias,
  pinned,
  sort_weight
)
SELECT
  pr.id,
  pr.account_id,
  CONCAT('g:', fg.id) AS facet_ref,
  'catalog',
  true,
  NULL,
  CASE WHEN fg.slug IN ('goal_finish_faster','pain_tool_overload') THEN true ELSE false END,
  CASE WHEN fg.slug = 'goal_finish_faster' THEN 10 ELSE 0 END
FROM project_row pr
JOIN public.facet_global fg ON fg.slug IN (
  'goal_finish_faster',
  'goal_reduce_stress',
  'pain_tool_overload',
  'behavior_deadline_driven',
  'workflow_weekly_review',
  'pref_async_updates',
  'demo_team_lead'
)
ON CONFLICT (project_id, facet_ref)
DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled,
  alias = EXCLUDED.alias,
  pinned = EXCLUDED.pinned,
  sort_weight = EXCLUDED.sort_weight,
  updated_at = now();
