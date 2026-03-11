create or replace function public.ensure_facet_embedding_queue()
returns void
language plpgsql
security definer
set search_path = public, pgmq
as $$
begin
  perform pgmq.create('facet_embedding_queue');
exception
  when duplicate_table then
    null;
  when duplicate_object then
    null;
  when sqlstate '42P07' then
    null;
end;
$$;

grant execute on function public.ensure_facet_embedding_queue() to service_role;
