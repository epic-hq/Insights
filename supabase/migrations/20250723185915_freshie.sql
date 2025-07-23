set check_function_bodies = off;

-- Setup pgmq extension before creating functions that depend on it
create extension if not exists vector;
create extension if not exists pg_net;
create extension if not exists pg_cron;
DROP EXTENSION IF EXISTS pgmq CASCADE;
CREATE SCHEMA IF NOT EXISTS pgmq;
CREATE EXTENSION IF NOT EXISTS pgmq WITH SCHEMA pgmq;

-- Create the insights embedding queue
select pgmq.create('insights_embedding_queue');

-- Grant access to the queue table
grant insert, select, delete on table pgmq.q_insights_embedding_queue to authenticated;

-- Enable RLS on queue table
alter table pgmq.q_insights_embedding_queue enable row level security;

-- RLS policies for queue
create policy "authenticated can enqueue"
on pgmq.q_insights_embedding_queue
for insert
to authenticated
with check (true);

create policy "authenticated can read"
on pgmq.q_insights_embedding_queue
for select
to authenticated
USING (true);

create policy "authenticated can delete"
on pgmq.q_insights_embedding_queue
for delete
to authenticated
USING (true);

CREATE OR REPLACE FUNCTION accounts.run_new_user_setup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$declare
    first_account_id    uuid;
    generated_user_name text;
begin

    -- first we setup the user profile
    -- TODO: see if we can get the user's name from the auth.users table once we learn how oauth works
    if new.email IS NOT NULL then
        generated_user_name := split_part(new.email, '@', 1);
    end if;
    -- create the new users's personal account
    insert into accounts.accounts (name, primary_owner_user_id, personal_account, id)
    values (generated_user_name, NEW.id, true, NEW.id)
    returning id into first_account_id;

    -- add them to the account_user table so they can act on it
    insert into accounts.account_user (account_id, user_id, account_role)
    values (first_account_id, NEW.id, 'owner');

		-- creating user_settings
    insert into account_settings(account_id) values (first_account_id);
    -- default research project
    insert into projects(account_id, title) values (first_account_id, 'My First Project');

    return NEW;
end;$function$
;


create extension if not exists "http" with schema "extensions";


create schema if not exists "pgmq_public";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION pgmq_public.archive(queue_name text, message_id bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ begin return pgmq.archive( queue_name := queue_name, msg_id := message_id ); end; $function$
;

CREATE OR REPLACE FUNCTION pgmq_public.delete(queue_name text, message_id bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ begin return pgmq.delete( queue_name := queue_name, msg_id := message_id ); end; $function$
;

CREATE OR REPLACE FUNCTION pgmq_public.pop(queue_name text)
 RETURNS SETOF pgmq.message_record
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ begin return query select * from pgmq.pop( queue_name := queue_name ); end; $function$
;

CREATE OR REPLACE FUNCTION pgmq_public.read(queue_name text, sleep_seconds integer, n integer)
 RETURNS SETOF pgmq.message_record
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ begin return query select * from pgmq.read( queue_name := queue_name, vt := sleep_seconds, qty := n ); end; $function$
;

CREATE OR REPLACE FUNCTION pgmq_public.send(queue_name text, message jsonb, sleep_seconds integer DEFAULT 0)
 RETURNS SETOF bigint
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ begin return query select * from pgmq.send( queue_name := queue_name, msg := message, delay := sleep_seconds ); end; $function$
;

CREATE OR REPLACE FUNCTION pgmq_public.send_batch(queue_name text, messages jsonb[], sleep_seconds integer DEFAULT 0)
 RETURNS SETOF bigint
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ begin return query select * from pgmq.send_batch( queue_name := queue_name, msgs := messages, delay := sleep_seconds ); end; $function$
;


create extension if not exists "pg_net" with schema "public" version '0.14.0';

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.enqueue_insight_embedding()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if (TG_OP = 'INSERT'
      or (TG_OP = 'UPDATE' and old.jtbd is distinct from new.jtbd)) then
    perform pgmq.send(
      'insights_embedding_queue',
      json_build_object(
        'table', TG_TABLE_NAME,
        'id',    new.id::text,
        'category',  new.category,
        'jtbd',  new.jtbd
      )::jsonb
    );
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.invoke_edge_function(func_name text, payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  req_id bigint;
  supabase_anon_key text;
begin
  select decrypted_secret
  into supabase_anon_key
  from vault.decrypted_secrets
  where name = 'SUPABASE_ANON_KEY'
  order by created_at desc
  limit 1;

  req_id := net.http_post(
    format('https://rbginqvgkonnoktrttqv.functions.supabase.co/%s', func_name),
    payload,
    '{}'::jsonb,
    jsonb_build_object(
      'Authorization', 'Bearer ' || supabase_anon_key,
      'Content-Type', 'application/json'
    ),
    2000  -- timeout in milliseconds
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.process_embedding_queue()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
  job record;
  count int := 0;
begin
  for job in
    select * from pgmq.read(
      'insights_embedding_queue',
      5,
      30
    )
  loop
    perform public.invoke_edge_function('embed', job.message::jsonb);
    perform pgmq.delete(
      'insights_embedding_queue',
      job.msg_id
    );
    count := count + 1;
  end loop;

  return format('Processed %s message(s) from embedding queue.', count);
end;
$function$
;

DROP TRIGGER IF EXISTS trg_enqueue_insight ON public.insights;
CREATE TRIGGER trg_enqueue_insight AFTER INSERT OR UPDATE ON public.insights FOR EACH ROW EXECUTE FUNCTION public.enqueue_insight_embedding();
