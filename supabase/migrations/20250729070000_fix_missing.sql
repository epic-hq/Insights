
/**
  * When a user signs up, we need to create a personal account for them
  * and add them to the account_user table so they can act on it
 */
create or replace function accounts.run_new_user_setup()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
as
$$
declare
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
    insert into projects(account_id, name) values (first_account_id, 'My First Project');

    return NEW;
end;
$$;

-- trigger the function every time a user is created
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
        CREATE TRIGGER on_auth_user_created
            AFTER INSERT
            ON auth.users
            FOR EACH ROW
        EXECUTE PROCEDURE accounts.run_new_user_setup();
    END IF;
END $$;


-- Create trigger function to sync insight tags
CREATE OR REPLACE FUNCTION trigger_sync_insight_tags()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        PERFORM sync_insight_tags(NEW.id, NEW.tags, NEW.account_id);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to sync insight tags
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_sync_insight_tags') THEN
        CREATE TRIGGER trigger_sync_insight_tags
            AFTER INSERT OR UPDATE ON insights
            FOR EACH ROW EXECUTE FUNCTION trigger_sync_insight_tags();
    END IF;
END $$;


-- a) create the queue for embeddings
select pgmq.create('transcribe_interview_queue');
-- grant access to the queue table
grant insert, select, delete on table pgmq.q_transcribe_interview_queue to authenticated;

-- (optional) enable RLS and define policies
-- Enable RLS
alter table pgmq.q_transcribe_interview_queue enable row level security;

-- Create policies if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated can enqueue' AND tablename = 'q_transcribe_interview_queue') THEN
        CREATE POLICY "authenticated can enqueue"
        ON pgmq.q_transcribe_interview_queue
        FOR INSERT
        TO authenticated
        WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated can read' AND tablename = 'q_transcribe_interview_queue') THEN
        CREATE POLICY "authenticated can read"
        ON pgmq.q_transcribe_interview_queue
        FOR SELECT
        TO authenticated
        USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated can delete' AND tablename = 'q_transcribe_interview_queue') THEN
        CREATE POLICY "authenticated can delete"
        ON pgmq.q_transcribe_interview_queue
        FOR DELETE
        TO authenticated
        USING (true);
    END IF;
END $$;


-- b) trigger fn to enqueue transcription job
-- Update functions to use extensions schema for pgmq and cron
create or replace function public.enqueue_transcribe_interview()
returns trigger language plpgsql as $$
begin
  if (TG_OP = 'INSERT'
      or (TG_OP = 'UPDATE' and old.media_url is distinct from new.media_url)) then
    perform pgmq.send(
      'transcribe_interview_queue',
      json_build_object(
        'table', TG_TABLE_NAME,
        'id',    new.id::text,
        'media_url',  new.media_url
      )::jsonb
    );
  end if;
  return new;
end;
$$;

-- Create trigger for transcribe interview queue
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_enqueue_transcribe_interview') THEN
        CREATE TRIGGER trg_enqueue_transcribe_interview
            AFTER INSERT OR UPDATE ON public.interviews
            FOR EACH ROW EXECUTE FUNCTION public.enqueue_transcribe_interview();
    END IF;
END $$;

-- c) helper to invoke your Edge Function:: Generic. dont' need to replicate. already setup in 50_queues
-- create or replace function public.invoke_edge_function(func_name text, payload jsonb)
-- returns void


-- d) processor that drains the queue and processes the job

create or replace function public.process_transcribe_queue()
returns text
language plpgsql
as $$
declare
  job record;
  count int := 0;
begin
  for job in
    select * from pgmq.read(
      'transcribe_interview_queue',
      5,
      30
    )
  loop
    perform public.invoke_edge_function('transcribe', job.message::jsonb);
    perform pgmq.delete(
      'transcribe_interview_queue',
      job.msg_id
    );
    count := count + 1;
  end loop;

  return format('Processed %s message(s) from transcribe queue.', count);
end;
$$;




-- e) cron-job to run every minute
select cron.schedule(
  '*/1 * * * *',
  'select public.process_transcribe_queue()'
);