-- Survey Campaigns (Personal Touch AI - Smart Survey Campaign System)
-- Extends research_links with campaign features, personalization, and AI recommendations

-- ============================================================================
-- SURVEY CAMPAIGNS: Smart campaign management with AI-recommended recipients
-- ============================================================================

-- Add campaign-level fields to research_links
alter table public.research_links
  add column if not exists campaign_strategy text check (campaign_strategy in ('pricing_validation', 'sparse_data_discovery', 'theme_validation', 'general_research')),
  add column if not exists campaign_goal text,
  add column if not exists ai_recommendation_metadata jsonb,
  add column if not exists campaign_status text not null default 'draft' check (campaign_status in ('draft', 'active', 'paused', 'completed'));

comment on column public.research_links.campaign_strategy is 'AI strategy for selecting recipients: pricing_validation (good for pricing), sparse_data_discovery (people with little evidence), theme_validation (validate specific themes), general_research';
comment on column public.research_links.campaign_goal is 'Human-readable goal for this campaign (e.g., "Validate pricing sensitivity for enterprise segment")';
comment on column public.research_links.ai_recommendation_metadata is 'Stores AI reasoning for recommended recipients. Structure: { strategy, criteria, recommendedPeople: [{ personId, score, reason }] }';
comment on column public.research_links.campaign_status is 'Campaign lifecycle: draft (building), active (sending), paused (temporarily stopped), completed (finished)';

-- ============================================================================
-- PERSONALIZED SURVEYS: Survey instances personalized per recipient
-- ============================================================================

create table if not exists public.personalized_surveys (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts.accounts (id) on delete cascade,
  project_id uuid references projects (id) on delete set null,
  research_link_id uuid not null references public.research_links (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,

  -- Personalization context
  survey_goal text not null check (survey_goal in ('validate', 'discover', 'deep_dive', 'pricing')),
  generation_metadata jsonb not null, -- Stores PersonContext, question rationale, uses_attributes from BAML

  -- Questions (personalized per person)
  questions jsonb not null default '[]'::jsonb,

  -- Lifecycle
  status text not null default 'draft' check (status in ('draft', 'approved', 'sent', 'opened', 'completed')),
  approved_at timestamptz,
  sent_at timestamptz,
  opened_at timestamptz,
  completed_at timestamptz,

  -- Evidence extraction tracking
  evidence_extracted boolean not null default false,
  evidence_count int not null default 0,
  extraction_metadata jsonb, -- Stores extraction confidence, errors, retry count

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Ensure one personalized survey per person per campaign
  unique(research_link_id, person_id)
);

comment on table public.personalized_surveys is 'Personalized survey instances generated for specific people within a campaign. Each survey has AI-generated questions tailored to the person context.';
comment on column public.personalized_surveys.generation_metadata is 'BAML generation context including PersonContext (facets, ICP, themes), question rationale, uses_attributes for each question';
comment on column public.personalized_surveys.extraction_metadata is 'Evidence extraction tracking: { extracted_at, confidence_avg, retry_count, errors: [] }';

create index if not exists personalized_surveys_person_id_idx on public.personalized_surveys (person_id);
create index if not exists personalized_surveys_research_link_id_idx on public.personalized_surveys (research_link_id);
create index if not exists personalized_surveys_status_idx on public.personalized_surveys (status);
create index if not exists personalized_surveys_campaign_completion_idx on public.personalized_surveys (research_link_id, status) where status in ('sent', 'opened', 'completed');

-- Link personalized surveys to responses
alter table public.research_link_responses
  add column if not exists personalized_survey_id uuid references public.personalized_surveys (id) on delete set null,
  add column if not exists evidence_extracted boolean not null default false,
  add column if not exists evidence_count int not null default 0;

comment on column public.research_link_responses.personalized_survey_id is 'Links response to the personalized survey that generated it';
comment on column public.research_link_responses.evidence_extracted is 'Whether AI has extracted evidence from this response (via BAML)';
comment on column public.research_link_responses.evidence_count is 'Number of evidence pieces extracted from this response';

create index if not exists research_link_responses_personalized_survey_idx on public.research_link_responses (personalized_survey_id);

-- ============================================================================
-- CAMPAIGN STATISTICS RPC: Get campaign-level completion metrics
-- ============================================================================

create or replace function get_campaign_stats(
  p_research_link_id uuid
)
returns table (
  total_sent bigint,
  total_opened bigint,
  total_completed bigint,
  completion_rate numeric,
  avg_evidence_per_response numeric,
  total_evidence_extracted bigint
) as $$
begin
  return query
  select
    count(*) filter (where ps.status in ('sent', 'opened', 'completed'))::bigint as total_sent,
    count(*) filter (where ps.status in ('opened', 'completed'))::bigint as total_opened,
    count(*) filter (where ps.status = 'completed')::bigint as total_completed,
    case
      when count(*) filter (where ps.status in ('sent', 'opened', 'completed')) > 0
      then round(
        (count(*) filter (where ps.status = 'completed')::numeric /
         count(*) filter (where ps.status in ('sent', 'opened', 'completed'))::numeric) * 100,
        1
      )
      else 0
    end as completion_rate,
    coalesce(avg(ps.evidence_count) filter (where ps.evidence_extracted = true), 0) as avg_evidence_per_response,
    coalesce(sum(ps.evidence_count) filter (where ps.evidence_extracted = true), 0)::bigint as total_evidence_extracted
  from public.personalized_surveys ps
  where ps.research_link_id = p_research_link_id;
end;
$$ language plpgsql stable security definer;

comment on function get_campaign_stats is 'Returns campaign-level statistics: sent/opened/completed counts, completion rate, evidence metrics';

grant execute on function get_campaign_stats(uuid) to authenticated;
grant execute on function get_campaign_stats(uuid) to service_role;

-- ============================================================================
-- AI RECOMMENDATION RPC: Get recommended people for campaign strategy
-- ============================================================================

create or replace function get_campaign_recommendations(
  p_account_id uuid,
  p_project_id uuid,
  p_strategy text,
  p_limit int default 10
)
returns table (
  person_id uuid,
  person_name text,
  person_email text,
  person_title text,
  icp_score numeric,
  evidence_count bigint,
  recommendation_score numeric,
  recommendation_reason text
) as $$
begin
  -- Strategy: sparse_data_discovery (people with little evidence)
  if p_strategy = 'sparse_data_discovery' then
    return query
    select
      p.id as person_id,
      coalesce(p.firstname || ' ' || p.lastname, p.firstname, 'Unknown') as person_name,
      p.primary_email as person_email,
      p.title as person_title,
      coalesce(ps.score, 0) as icp_score,
      count(ep.evidence_id)::bigint as evidence_count,
      -- Score: High ICP + Low evidence = High priority
      (coalesce(ps.score, 0) * 100 - count(ep.evidence_id)::numeric) as recommendation_score,
      case
        when count(ep.evidence_id) = 0 then 'No evidence yet - great for discovery'
        when count(ep.evidence_id) < 3 then 'Minimal evidence (' || count(ep.evidence_id) || ' pieces) - good for follow-up'
        else 'Some evidence but gaps remain'
      end as recommendation_reason
    from public.people p
    left join public.person_scale ps on ps.person_id = p.id and ps.kind_slug = 'icp_match'
    left join public.evidence_people ep on ep.person_id = p.id
    where
      p.account_id = p_account_id
      and (p.project_id = p_project_id or p_project_id is null)
      and p.primary_email is not null
    group by p.id, p.firstname, p.lastname, p.primary_email, p.title, ps.score
    order by recommendation_score desc
    limit p_limit;

  -- Strategy: pricing_validation (high ICP people good for pricing feedback)
  elsif p_strategy = 'pricing_validation' then
    return query
    select
      p.id as person_id,
      coalesce(p.firstname || ' ' || p.lastname, p.firstname, 'Unknown') as person_name,
      p.primary_email as person_email,
      p.title as person_title,
      coalesce(ps.score, 0) as icp_score,
      count(ep.evidence_id)::bigint as evidence_count,
      -- Score: High ICP = High priority (evidence count secondary)
      (coalesce(ps.score, 0) * 100) as recommendation_score,
      case
        when coalesce(ps.score, 0) >= 0.7 then 'Strong ICP match - valuable for pricing validation'
        when coalesce(ps.score, 0) >= 0.5 then 'Moderate ICP match - useful for pricing feedback'
        else 'Weak ICP match - consider for broader perspective'
      end as recommendation_reason
    from public.people p
    left join public.person_scale ps on ps.person_id = p.id and ps.kind_slug = 'icp_match'
    left join public.evidence_people ep on ep.person_id = p.id
    where
      p.account_id = p_account_id
      and (p.project_id = p_project_id or p_project_id is null)
      and p.primary_email is not null
    group by p.id, p.firstname, p.lastname, p.primary_email, p.title, ps.score
    having coalesce(ps.score, 0) >= 0.5 -- Only recommend moderate+ ICP matches for pricing
    order by recommendation_score desc
    limit p_limit;

  -- Default: general_research (balanced approach)
  else
    return query
    select
      p.id as person_id,
      coalesce(p.firstname || ' ' || p.lastname, p.firstname, 'Unknown') as person_name,
      p.primary_email as person_email,
      p.title as person_title,
      coalesce(ps.score, 0) as icp_score,
      count(ep.evidence_id)::bigint as evidence_count,
      -- Balanced score
      (coalesce(ps.score, 0) * 50 + (10 - least(count(ep.evidence_id)::numeric, 10)) * 5) as recommendation_score,
      'Balanced candidate for general research' as recommendation_reason
    from public.people p
    left join public.person_scale ps on ps.person_id = p.id and ps.kind_slug = 'icp_match'
    left join public.evidence_people ep on ep.person_id = p.id
    where
      p.account_id = p_account_id
      and (p.project_id = p_project_id or p_project_id is null)
      and p.primary_email is not null
    group by p.id, p.firstname, p.lastname, p.primary_email, p.title, ps.score
    order by recommendation_score desc
    limit p_limit;
  end if;
end;
$$ language plpgsql stable security definer;

comment on function get_campaign_recommendations is 'Returns AI-recommended people for a campaign based on strategy (sparse_data_discovery, pricing_validation, general_research)';

grant execute on function get_campaign_recommendations(uuid, uuid, text, int) to authenticated;
grant execute on function get_campaign_recommendations(uuid, uuid, text, int) to service_role;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

alter table public.personalized_surveys enable row level security;

create policy "Members can read personalized surveys"
  on public.personalized_surveys
  for select
  using (account_id in (select accounts.get_accounts_with_role()));

create policy "Members can insert personalized surveys"
  on public.personalized_surveys
  for insert to authenticated
  with check (account_id in (select accounts.get_accounts_with_role()));

create policy "Members can update personalized surveys"
  on public.personalized_surveys
  for update to authenticated
  using (account_id in (select accounts.get_accounts_with_role()))
  with check (account_id in (select accounts.get_accounts_with_role()));

create policy "Members can delete personalized surveys"
  on public.personalized_surveys
  for delete to authenticated
  using (account_id in (select accounts.get_accounts_with_role()));

-- ============================================================================
-- TRIGGERS
-- ============================================================================

create trigger set_personalized_surveys_updated_at
  before update on public.personalized_surveys
  for each row execute function public.set_updated_at();
