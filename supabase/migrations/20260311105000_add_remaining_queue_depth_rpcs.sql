-- Remaining queue depth RPCs not included in 20260311104000 at time of first push.
-- Adds helpers for person_facet and transcribe queues used by integration test assertions.

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
