-- Promote themes as the canonical insight store
-- Add legacy compatibility views + repoint foreign keys

begin;

-- Ensure the descriptive insight columns exist on themes
alter table public.themes
    add column if not exists category text,
    add column if not exists journey_stage text,
    add column if not exists desired_outcome text,
    add column if not exists emotional_response text,
    add column if not exists jtbd text,
    add column if not exists motivation text,
    add column if not exists contradictions text,
    add column if not exists pain text,
    add column if not exists details text,
    add column if not exists evidence text,
    add column if not exists impact numeric,
    add column if not exists novelty numeric,
    add column if not exists opportunity_ideas text[],
    add column if not exists related_tags text[],
    add column if not exists confidence text,
    add column if not exists interview_id uuid,
    add column if not exists embedding vector(1536),
    add column if not exists embedding_model text,
    add column if not exists embedding_generated_at timestamptz;

-- Recreate insight compatibility views backed by themes
drop view if exists public.insights_with_priority;
drop view if exists public.insights_current cascade;

create view public.insights_current as
select
    t.id,
    t.account_id,
    t.project_id,
    t.name,
    t.pain,
    t.details,
    t.category,
    t.journey_stage,
    t.emotional_response,
    t.desired_outcome,
    t.jtbd,
    t.impact,
    t.evidence,
    t.motivation,
    t.contradictions,
    t.embedding,
    t.embedding_model,
    t.embedding_generated_at,
    t.opportunity_ideas,
    t.related_tags,
    t.novelty,
    t.confidence,
    t.interview_id,
    t.statement,
    t.synonyms,
    t.inclusion_criteria,
    t.exclusion_criteria,
    t.anti_examples,
    t.created_at,
    t.created_by,
    t.updated_at,
    t.updated_by
from public.themes t;

create view public.insights_with_priority as
select
    ic.id,
    ic.account_id,
    ic.project_id,
    ic.name,
    ic.pain,
    ic.details,
    ic.category,
    ic.journey_stage,
    ic.emotional_response,
    ic.desired_outcome,
    ic.jtbd,
    ic.impact,
    ic.evidence,
    ic.motivation,
    ic.contradictions,
    ic.embedding,
    ic.embedding_model,
    ic.embedding_generated_at,
    ic.opportunity_ideas,
    ic.related_tags,
    ic.novelty,
    ic.confidence,
    ic.interview_id,
    ic.statement,
    ic.synonyms,
    ic.inclusion_criteria,
    ic.exclusion_criteria,
    ic.anti_examples,
    ic.created_at,
    ic.created_by,
    ic.updated_at,
    ic.updated_by,
    coalesce(sum(v.vote_value), 0) as priority
from public.insights_current ic
left join public.votes v
    on v.entity_type = 'insight'
    and v.entity_id = ic.id
group by
    ic.id,
    ic.account_id,
    ic.project_id,
    ic.name,
    ic.pain,
    ic.details,
    ic.category,
    ic.journey_stage,
    ic.emotional_response,
    ic.desired_outcome,
    ic.jtbd,
    ic.impact,
    ic.evidence,
    ic.motivation,
    ic.contradictions,
    ic.embedding,
    ic.embedding_model,
    ic.embedding_generated_at,
    ic.opportunity_ideas,
    ic.related_tags,
    ic.novelty,
    ic.confidence,
    ic.interview_id,
    ic.statement,
    ic.synonyms,
    ic.inclusion_criteria,
    ic.exclusion_criteria,
    ic.anti_examples,
    ic.created_at,
    ic.created_by,
    ic.updated_at,
    ic.updated_by;

grant select on public.insights_current to authenticated;
grant select on public.insights_with_priority to authenticated;

-- Repoint FK constraints so the junction tables accept theme ids
alter table if exists public.comments
    drop constraint if exists comments_insight_id_fkey;
alter table if exists public.comments
    add constraint comments_insight_id_fkey foreign key (insight_id)
        references public.themes(id) on delete cascade not valid;

alter table if exists public.insight_tags
    drop constraint if exists insight_tags_insight_id_fkey;
alter table if exists public.insight_tags
    add constraint insight_tags_insight_id_fkey foreign key (insight_id)
        references public.themes(id) on delete cascade not valid;

alter table if exists public.opportunity_insights
    drop constraint if exists opportunity_insights_insight_id_fkey;
alter table if exists public.opportunity_insights
    add constraint opportunity_insights_insight_id_fkey foreign key (insight_id)
        references public.themes(id) on delete cascade not valid;

alter table if exists public.persona_insights
    drop constraint if exists persona_insights_insight_id_fkey;
alter table if exists public.persona_insights
    add constraint persona_insights_insight_id_fkey foreign key (insight_id)
        references public.themes(id) on delete cascade not valid;

alter table if exists public.actions
    drop constraint if exists actions_insight_id_fkey;
alter table if exists public.actions
    add constraint actions_insight_id_fkey foreign key (insight_id)
        references public.themes(id) on delete set null not valid;

-- Refresh helper that links personas whenever a theme/insight is inserted
create or replace function public.auto_link_persona_insights(
    p_insight_id uuid
) returns void as $$
declare
    persona_record record;
    relevance_score_var decimal(3,2);
begin
    for persona_record in
        select distinct pp.persona_id
        from public.themes i
        join public.interviews iv on i.interview_id = iv.id
        join public.interview_people ip on iv.id = ip.interview_id
        join public.people pe on ip.person_id = pe.id
        join public.people_personas pp on pe.id = pp.person_id
        where i.id = p_insight_id
          and pp.persona_id is not null
    loop
        relevance_score_var := 1.0;
        insert into public.persona_insights (persona_id, insight_id, relevance_score, created_at)
        values (persona_record.persona_id, p_insight_id, relevance_score_var, now())
        on conflict (persona_id, insight_id) do nothing;
    end loop;
end;
$$ language plpgsql security definer;

drop trigger if exists trigger_auto_link_persona_insights_on_insert on public.insights;
drop trigger if exists trigger_auto_link_persona_insights_on_insert on public.themes;
create trigger trigger_auto_link_persona_insights_on_insert
    after insert on public.themes
    for each row execute function public.trigger_auto_link_persona_insights();

commit;
