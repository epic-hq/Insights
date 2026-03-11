-- Narrow RPC helpers to expose queue depth for integration test assertions.
-- These functions run as SECURITY DEFINER (postgres owner) so they can read
-- pgmq tables without requiring the pgmq schema to be exposed via PostgREST.
-- Only service_role can call these — not used in the application path.

create or replace function public.get_facet_embedding_queue_depth()
returns bigint
language sql
security definer
set search_path = public, pgmq
as $$
  select count(*) from pgmq.q_facet_embedding_queue;
$$;

grant execute on function public.get_facet_embedding_queue_depth() to service_role;
revoke execute on function public.get_facet_embedding_queue_depth() from public, authenticated;

create or replace function public.get_insights_embedding_queue_depth(filter_table text default null)
returns bigint
language sql
security definer
set search_path = public, pgmq
as $$
  select count(*)
  from pgmq.q_insights_embedding_queue
  where filter_table is null
     or message->>'table' = filter_table;
$$;

grant execute on function public.get_insights_embedding_queue_depth(text) to service_role;
revoke execute on function public.get_insights_embedding_queue_depth(text) from public, authenticated;

create or replace function public.get_person_facet_embedding_queue_depth()
returns bigint
language sql
security definer
set search_path = public, pgmq
as $$
  select count(*) from pgmq.q_person_facet_embedding_queue;
$$;

grant execute on function public.get_person_facet_embedding_queue_depth() to service_role;
revoke execute on function public.get_person_facet_embedding_queue_depth() from public, authenticated;

create or replace function public.get_transcribe_queue_depth()
returns bigint
language sql
security definer
set search_path = public, pgmq
as $$
  select count(*) from pgmq.q_transcribe_interview_queue;
$$;

grant execute on function public.get_transcribe_queue_depth() to service_role;
revoke execute on function public.get_transcribe_queue_depth() from public, authenticated;
