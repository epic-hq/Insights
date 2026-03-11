create extension if not exists pgmq with schema pgmq;

do $$
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
