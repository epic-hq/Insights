set check_function_bodies = off;

CREATE OR REPLACE FUNCTION accounts.generate_token(length integer)
 RETURNS text
 LANGUAGE sql
AS $function$
select regexp_replace(replace(
                              replace(replace(replace(encode(gen_random_bytes(length)::bytea, 'base64'), '/', ''), '+',
                                              ''), '\\', ''),
                              '=',
                              ''), E'[\\n\\r]+', '', 'g');
$function$
;

CREATE OR REPLACE FUNCTION accounts.run_new_user_setup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    insert into projects(account_id, title) values (first_account_id, 'My First Project');

    return NEW;
end;
$function$
;


drop function if exists "public"."get_user_accounts"();

create table "public"."interview_people" (
    "interview_id" uuid not null,
    "person_id" uuid not null,
    "role" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "created_by" uuid,
    "updated_by" uuid
);


alter table "public"."interview_people" enable row level security;

CREATE INDEX idx_interview_people_interview_id ON public.interview_people USING btree (interview_id);

CREATE INDEX idx_interview_people_person_id ON public.interview_people USING btree (person_id);

CREATE UNIQUE INDEX interview_people_pkey ON public.interview_people USING btree (interview_id, person_id);

alter table "public"."interview_people" add constraint "interview_people_pkey" PRIMARY KEY using index "interview_people_pkey";

alter table "public"."interview_people" add constraint "interview_people_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."interview_people" validate constraint "interview_people_created_by_fkey";

alter table "public"."interview_people" add constraint "interview_people_interview_id_fkey" FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE not valid;

alter table "public"."interview_people" validate constraint "interview_people_interview_id_fkey";

alter table "public"."interview_people" add constraint "interview_people_person_id_fkey" FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE not valid;

alter table "public"."interview_people" validate constraint "interview_people_person_id_fkey";

alter table "public"."interview_people" add constraint "interview_people_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) not valid;

alter table "public"."interview_people" validate constraint "interview_people_updated_by_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.enqueue_transcribe_interview()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.process_transcribe_queue()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
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
$function$
;

grant delete on table "public"."interview_people" to "anon";

grant insert on table "public"."interview_people" to "anon";

grant references on table "public"."interview_people" to "anon";

grant select on table "public"."interview_people" to "anon";

grant trigger on table "public"."interview_people" to "anon";

grant truncate on table "public"."interview_people" to "anon";

grant update on table "public"."interview_people" to "anon";

grant delete on table "public"."interview_people" to "authenticated";

grant insert on table "public"."interview_people" to "authenticated";

grant references on table "public"."interview_people" to "authenticated";

grant select on table "public"."interview_people" to "authenticated";

grant trigger on table "public"."interview_people" to "authenticated";

grant truncate on table "public"."interview_people" to "authenticated";

grant update on table "public"."interview_people" to "authenticated";

grant delete on table "public"."interview_people" to "service_role";

grant insert on table "public"."interview_people" to "service_role";

grant references on table "public"."interview_people" to "service_role";

grant select on table "public"."interview_people" to "service_role";

grant trigger on table "public"."interview_people" to "service_role";

grant truncate on table "public"."interview_people" to "service_role";

grant update on table "public"."interview_people" to "service_role";

create policy "Account members can insert"
on "public"."interview_people"
as permissive
for insert
to authenticated
with check ((interview_id IN ( SELECT interviews.id
   FROM interviews
  WHERE (interviews.account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)))));


create policy "Account members can select"
on "public"."interview_people"
as permissive
for select
to authenticated
using ((interview_id IN ( SELECT interviews.id
   FROM interviews
  WHERE (interviews.account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)))));


create policy "Account members can update"
on "public"."interview_people"
as permissive
for update
to authenticated
using ((interview_id IN ( SELECT interviews.id
   FROM interviews
  WHERE (interviews.account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)))));


create policy "Account owners can delete"
on "public"."interview_people"
as permissive
for delete
to authenticated
using ((interview_id IN ( SELECT interviews.id
   FROM interviews
  WHERE (interviews.account_id IN ( SELECT accounts.get_accounts_with_role('owner'::accounts.account_role) AS get_accounts_with_role)))));


CREATE OR REPLACE TRIGGER set_interview_people_timestamp BEFORE INSERT OR UPDATE ON public.interview_people FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();

CREATE OR REPLACE TRIGGER set_interview_people_user_tracking BEFORE INSERT OR UPDATE ON public.interview_people FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_user_tracking();

CREATE OR REPLACE TRIGGER trg_enqueue_transcribe_interview AFTER INSERT OR UPDATE ON public.interviews FOR EACH ROW EXECUTE FUNCTION enqueue_transcribe_interview();
