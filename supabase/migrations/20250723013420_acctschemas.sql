create extension if not exists pgcrypto;
SET search_path = public, extensions, accounts;
create schema if not exists "accounts";

create type "accounts"."account_role" as enum ('owner', 'member');

create type "accounts"."invitation_type" as enum ('one_time', '24_hour');

create type "accounts"."subscription_status" as enum ('trialing', 'active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid');

-- Move generate_token function definition before it's used in invitations table
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

create table "accounts"."account_user" (
    "user_id" uuid not null,
    "account_id" uuid not null,
    "account_role" accounts.account_role not null
);


alter table "accounts"."account_user" enable row level security;

create table "accounts"."accounts" (
    "id" uuid not null default uuid_generate_v4(),
    "primary_owner_user_id" uuid not null default auth.uid(),
    "name" text,
    "slug" text,
    "personal_account" boolean not null default false,
    "updated_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "created_by" uuid,
    "updated_by" uuid,
    "private_metadata" jsonb default '{}'::jsonb,
    "public_metadata" jsonb default '{}'::jsonb
);


alter table "accounts"."accounts" enable row level security;

create table "accounts"."billing_customers" (
    "account_id" uuid not null,
    "id" text not null,
    "email" text,
    "active" boolean,
    "provider" text
);


alter table "accounts"."billing_customers" enable row level security;

create table "accounts"."billing_subscriptions" (
    "id" text not null,
    "account_id" uuid not null,
    "billing_customer_id" text not null,
    "status" accounts.subscription_status,
    "metadata" jsonb,
    "price_id" text,
    "plan_name" text,
    "quantity" integer,
    "cancel_at_period_end" boolean,
    "created" timestamp with time zone not null default timezone('utc'::text, now()),
    "current_period_start" timestamp with time zone not null default timezone('utc'::text, now()),
    "current_period_end" timestamp with time zone not null default timezone('utc'::text, now()),
    "ended_at" timestamp with time zone default timezone('utc'::text, now()),
    "cancel_at" timestamp with time zone default timezone('utc'::text, now()),
    "canceled_at" timestamp with time zone default timezone('utc'::text, now()),
    "trial_start" timestamp with time zone default timezone('utc'::text, now()),
    "trial_end" timestamp with time zone default timezone('utc'::text, now()),
    "provider" text
);


alter table "accounts"."billing_subscriptions" enable row level security;

create table "accounts"."config" (
    "enable_team_accounts" boolean default true,
    "enable_personal_account_billing" boolean default true,
    "enable_team_account_billing" boolean default true,
    "billing_provider" text default 'stripe'::text
);


alter table "accounts"."config" enable row level security;

create table "accounts"."invitations" (
    "id" uuid not null default uuid_generate_v4(),
    "account_role" accounts.account_role not null,
    "account_id" uuid not null,
    "token" text not null default accounts.generate_token(30),
    "invited_by_user_id" uuid not null,
    "account_name" text,
    "updated_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "invitation_type" accounts.invitation_type not null
);


alter table "accounts"."invitations" enable row level security;

CREATE UNIQUE INDEX account_user_pkey ON accounts.account_user USING btree (user_id, account_id);

CREATE UNIQUE INDEX accounts_pkey ON accounts.accounts USING btree (id);

CREATE UNIQUE INDEX accounts_slug_key ON accounts.accounts USING btree (slug);

CREATE UNIQUE INDEX billing_customers_pkey ON accounts.billing_customers USING btree (id);

CREATE UNIQUE INDEX billing_subscriptions_pkey ON accounts.billing_subscriptions USING btree (id);

CREATE UNIQUE INDEX invitations_pkey ON accounts.invitations USING btree (id);

CREATE UNIQUE INDEX invitations_token_key ON accounts.invitations USING btree (token);

alter table "accounts"."account_user" add constraint "account_user_pkey" PRIMARY KEY using index "account_user_pkey";

alter table "accounts"."accounts" add constraint "accounts_pkey" PRIMARY KEY using index "accounts_pkey";

alter table "accounts"."billing_customers" add constraint "billing_customers_pkey" PRIMARY KEY using index "billing_customers_pkey";

alter table "accounts"."billing_subscriptions" add constraint "billing_subscriptions_pkey" PRIMARY KEY using index "billing_subscriptions_pkey";

alter table "accounts"."invitations" add constraint "invitations_pkey" PRIMARY KEY using index "invitations_pkey";

alter table "accounts"."account_user" add constraint "account_user_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts.accounts(id) ON DELETE CASCADE not valid;

alter table "accounts"."account_user" validate constraint "account_user_account_id_fkey";

alter table "accounts"."account_user" add constraint "account_user_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "accounts"."account_user" validate constraint "account_user_user_id_fkey";

alter table "accounts"."accounts" add constraint "accounts_accounts_slug_null_if_personal_account_true" CHECK ((((personal_account = true) AND (slug IS NULL)) OR ((personal_account = false) AND (slug IS NOT NULL)))) not valid;

alter table "accounts"."accounts" validate constraint "accounts_accounts_slug_null_if_personal_account_true";

alter table "accounts"."accounts" add constraint "accounts_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "accounts"."accounts" validate constraint "accounts_created_by_fkey";

alter table "accounts"."accounts" add constraint "accounts_primary_owner_user_id_fkey" FOREIGN KEY (primary_owner_user_id) REFERENCES auth.users(id) not valid;

alter table "accounts"."accounts" validate constraint "accounts_primary_owner_user_id_fkey";

alter table "accounts"."accounts" add constraint "accounts_slug_key" UNIQUE using index "accounts_slug_key";

alter table "accounts"."accounts" add constraint "accounts_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) not valid;

alter table "accounts"."accounts" validate constraint "accounts_updated_by_fkey";

alter table "accounts"."billing_customers" add constraint "billing_customers_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts.accounts(id) ON DELETE CASCADE not valid;

alter table "accounts"."billing_customers" validate constraint "billing_customers_account_id_fkey";

alter table "accounts"."billing_subscriptions" add constraint "billing_subscriptions_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts.accounts(id) ON DELETE CASCADE not valid;

alter table "accounts"."billing_subscriptions" validate constraint "billing_subscriptions_account_id_fkey";

alter table "accounts"."billing_subscriptions" add constraint "billing_subscriptions_billing_customer_id_fkey" FOREIGN KEY (billing_customer_id) REFERENCES accounts.billing_customers(id) ON DELETE CASCADE not valid;

alter table "accounts"."billing_subscriptions" validate constraint "billing_subscriptions_billing_customer_id_fkey";

alter table "accounts"."invitations" add constraint "invitations_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts.accounts(id) ON DELETE CASCADE not valid;

alter table "accounts"."invitations" validate constraint "invitations_account_id_fkey";

alter table "accounts"."invitations" add constraint "invitations_invited_by_user_id_fkey" FOREIGN KEY (invited_by_user_id) REFERENCES auth.users(id) not valid;

alter table "accounts"."invitations" validate constraint "invitations_invited_by_user_id_fkey";

alter table "accounts"."invitations" add constraint "invitations_token_key" UNIQUE using index "invitations_token_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION accounts.add_current_user_to_new_account()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
    if new.primary_owner_user_id = auth.uid() then
        insert into accounts.account_user (account_id, user_id, account_role)
        values (NEW.id, auth.uid(), 'owner');
    end if;
    return NEW;
end;
$function$
;

CREATE OR REPLACE FUNCTION accounts.generate_token(length integer)
 RETURNS text
 LANGUAGE sql
AS $function$
select regexp_replace(replace(
                              replace(replace(replace(encode(gen_random_bytes(length)::bytea, 'base64'), '/', ''), '+',
                                              ''), '\', ''),
                              '=',
                              ''), E'[\\n\\r]+', '', 'g');
$function$
;

CREATE OR REPLACE FUNCTION accounts.get_accounts_with_role(passed_in_role accounts.account_role DEFAULT NULL::accounts.account_role)
 RETURNS SETOF uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
select account_id
from accounts.account_user wu
where wu.user_id = auth.uid()
  and (
            wu.account_role = passed_in_role
        or passed_in_role is null
    );
$function$
;

CREATE OR REPLACE FUNCTION accounts.get_config()
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    result RECORD;
BEGIN
    SELECT * from accounts.config limit 1 into result;
    return row_to_json(result);
END;
$function$
;

CREATE OR REPLACE FUNCTION accounts.has_role_on_account(account_id uuid, account_role accounts.account_role DEFAULT NULL::accounts.account_role)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'accounts', 'public'
AS $function$
select exists(
               select 1
               from accounts.account_user wu
               where wu.user_id = auth.uid()
                 and wu.account_id = has_role_on_account.account_id
                 and (
                           wu.account_role = has_role_on_account.account_role
                       or has_role_on_account.account_role is null
                   )
           );
$function$
;

CREATE OR REPLACE FUNCTION accounts.is_set(field_name text)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
    result BOOLEAN;
BEGIN
    execute format('select %I from accounts.config limit 1', field_name) into result;
    return result;
END;
$function$
;

CREATE OR REPLACE FUNCTION accounts.protect_account_fields()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF current_user IN ('authenticated', 'anon') THEN
        -- these are protected fields that users are not allowed to update themselves
        -- platform admins should be VERY careful about updating them as well.
        if NEW.id <> OLD.id
            OR NEW.personal_account <> OLD.personal_account
            OR NEW.primary_owner_user_id <> OLD.primary_owner_user_id
        THEN
            RAISE EXCEPTION 'You do not have permission to update this field';
        end if;
    end if;

    RETURN NEW;
END
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
    insert into user_settings(account_id) values (NEW.id);
    -- default research project
    insert into research_projects(account_id, title) values (first_account_id, 'My First Project');

    return NEW;
end;
$function$
;

CREATE OR REPLACE FUNCTION accounts.slugify_account_slug()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    if NEW.slug is not null then
        NEW.slug = lower(regexp_replace(NEW.slug, '[^a-zA-Z0-9-]+', '-', 'g'));
    end if;

    RETURN NEW;
END
$function$
;

CREATE OR REPLACE FUNCTION accounts.trigger_set_invitation_details()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.invited_by_user_id = auth.uid();
    NEW.account_name = (select name from accounts.accounts where id = NEW.account_id);
    RETURN NEW;
END
$function$
;

CREATE OR REPLACE FUNCTION accounts.trigger_set_timestamps()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    if TG_OP = 'INSERT' then
        NEW.created_at = now();
        NEW.updated_at = now();
    else
        NEW.updated_at = now();
        NEW.created_at = OLD.created_at;
    end if;
    RETURN NEW;
END
$function$
;

CREATE OR REPLACE FUNCTION accounts.trigger_set_user_tracking()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    if TG_OP = 'INSERT' then
        NEW.created_by = auth.uid();
        NEW.updated_by = auth.uid();
    else
        NEW.updated_by = auth.uid();
        NEW.created_by = OLD.created_by;
    end if;
    RETURN NEW;
END
$function$
;

grant delete on table "accounts"."account_user" to "authenticated";

grant insert on table "accounts"."account_user" to "authenticated";

grant select on table "accounts"."account_user" to "authenticated";

grant update on table "accounts"."account_user" to "authenticated";

grant delete on table "accounts"."account_user" to "service_role";

grant insert on table "accounts"."account_user" to "service_role";

grant select on table "accounts"."account_user" to "service_role";

grant update on table "accounts"."account_user" to "service_role";

grant delete on table "accounts"."accounts" to "authenticated";

grant insert on table "accounts"."accounts" to "authenticated";

grant select on table "accounts"."accounts" to "authenticated";

grant update on table "accounts"."accounts" to "authenticated";

grant delete on table "accounts"."accounts" to "service_role";

grant insert on table "accounts"."accounts" to "service_role";

grant select on table "accounts"."accounts" to "service_role";

grant update on table "accounts"."accounts" to "service_role";

grant select on table "accounts"."billing_customers" to "authenticated";

grant delete on table "accounts"."billing_customers" to "service_role";

grant insert on table "accounts"."billing_customers" to "service_role";

grant select on table "accounts"."billing_customers" to "service_role";

grant update on table "accounts"."billing_customers" to "service_role";

grant select on table "accounts"."billing_subscriptions" to "authenticated";

grant delete on table "accounts"."billing_subscriptions" to "service_role";

grant insert on table "accounts"."billing_subscriptions" to "service_role";

grant select on table "accounts"."billing_subscriptions" to "service_role";

grant update on table "accounts"."billing_subscriptions" to "service_role";

grant select on table "accounts"."config" to "authenticated";

grant select on table "accounts"."config" to "service_role";

grant delete on table "accounts"."invitations" to "authenticated";

grant insert on table "accounts"."invitations" to "authenticated";

grant select on table "accounts"."invitations" to "authenticated";

grant update on table "accounts"."invitations" to "authenticated";

grant delete on table "accounts"."invitations" to "service_role";

grant insert on table "accounts"."invitations" to "service_role";

grant select on table "accounts"."invitations" to "service_role";

grant update on table "accounts"."invitations" to "service_role";

create policy "Account users can be deleted by owners except primary account o"
on "accounts"."account_user"
as permissive
for delete
to authenticated
using (((accounts.has_role_on_account(account_id, 'owner'::accounts.account_role) = true) AND (user_id <> ( SELECT accounts.primary_owner_user_id
   FROM accounts.accounts
  WHERE (account_user.account_id = accounts.id)))));


create policy "users can view their own account_users"
on "accounts"."account_user"
as permissive
for select
to authenticated
using ((user_id = auth.uid()));


create policy "users can view their teammates"
on "accounts"."account_user"
as permissive
for select
to authenticated
using ((accounts.has_role_on_account(account_id) = true));


create policy "Accounts are viewable by members"
on "accounts"."accounts"
as permissive
for select
to authenticated
using ((accounts.has_role_on_account(id) = true));


create policy "Accounts are viewable by primary owner"
on "accounts"."accounts"
as permissive
for select
to authenticated
using ((primary_owner_user_id = auth.uid()));


create policy "Accounts can be edited by owners"
on "accounts"."accounts"
as permissive
for update
to authenticated
using ((accounts.has_role_on_account(id, 'owner'::accounts.account_role) = true));


create policy "Team accounts can be created by any user"
on "accounts"."accounts"
as permissive
for insert
to authenticated
with check (((accounts.is_set('enable_team_accounts'::text) = true) AND (personal_account = false)));


create policy "Can only view own billing customer data."
on "accounts"."billing_customers"
as permissive
for select
to public
using ((accounts.has_role_on_account(account_id) = true));


create policy "Can only view own billing subscription data."
on "accounts"."billing_subscriptions"
as permissive
for select
to public
using ((accounts.has_role_on_account(account_id) = true));


create policy "accounts settings can be read by authenticated users"
on "accounts"."config"
as permissive
for select
to authenticated
using (true);


create policy "Invitations can be created by account owners"
on "accounts"."invitations"
as permissive
for insert
to authenticated
with check (((accounts.is_set('enable_team_accounts'::text) = true) AND (( SELECT accounts.personal_account
   FROM accounts.accounts
  WHERE (accounts.id = invitations.account_id)) = false) AND (accounts.has_role_on_account(account_id, 'owner'::accounts.account_role) = true)));


create policy "Invitations can be deleted by account owners"
on "accounts"."invitations"
as permissive
for delete
to authenticated
using ((accounts.has_role_on_account(account_id, 'owner'::accounts.account_role) = true));


create policy "Invitations viewable by account owners"
on "accounts"."invitations"
as permissive
for select
to authenticated
using (((created_at > (now() - '24:00:00'::interval)) AND (accounts.has_role_on_account(account_id, 'owner'::accounts.account_role) = true)));


CREATE TRIGGER accounts_add_current_user_to_new_account AFTER INSERT ON accounts.accounts FOR EACH ROW EXECUTE FUNCTION accounts.add_current_user_to_new_account();

CREATE TRIGGER accounts_protect_account_fields BEFORE UPDATE ON accounts.accounts FOR EACH ROW EXECUTE FUNCTION accounts.protect_account_fields();

CREATE TRIGGER accounts_set_accounts_timestamp BEFORE INSERT OR UPDATE ON accounts.accounts FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();

CREATE TRIGGER accounts_set_accounts_user_tracking BEFORE INSERT OR UPDATE ON accounts.accounts FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_user_tracking();

CREATE TRIGGER accounts_slugify_account_slug BEFORE INSERT OR UPDATE ON accounts.accounts FOR EACH ROW EXECUTE FUNCTION accounts.slugify_account_slug();

CREATE TRIGGER accounts_set_invitations_timestamp BEFORE INSERT OR UPDATE ON accounts.invitations FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();

CREATE TRIGGER accounts_trigger_set_invitation_details BEFORE INSERT ON accounts.invitations FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_invitation_details();


create extension if not exists "vector" with schema "public" version '0.8.0';

create type "public"."interview_status" as enum ('draft', 'scheduled', 'uploaded', 'transcribed', 'processing', 'ready', 'tagged', 'archived');

create table "public"."account_settings" (
    "id" uuid not null default gen_random_uuid(),
    "account_id" uuid,
    "title" text,
    "role" text,
    "onboarding_completed" boolean not null default false,
    "app_activity" jsonb not null default '{}'::jsonb,
    "metadata" jsonb not null default '{}'::jsonb,
    "updated_at" timestamp with time zone not null default now(),
    "created_at" timestamp with time zone not null default now(),
    "updated_by" uuid,
    "created_by" uuid
);


alter table "public"."account_settings" enable row level security;

create table "public"."comments" (
    "id" uuid not null default gen_random_uuid(),
    "account_id" uuid not null,
    "insight_id" uuid not null,
    "user_id" uuid not null,
    "content" text not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."comments" enable row level security;

create table "public"."insights" (
    "id" uuid not null default gen_random_uuid(),
    "account_id" uuid not null,
    "interview_id" uuid,
    "name" text not null,
    "category" text not null,
    "journey_stage" text,
    "impact" smallint,
    "novelty" smallint,
    "jtbd" text,
    "details" text,
    "evidence" text,
    "motivation" text,
    "pain" text,
    "desired_outcome" text,
    "emotional_response" text,
    "opportunity_ideas" text[],
    "confidence" text,
    "contradictions" text,
    "related_tags" text[],
    "embedding" vector(1536),
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."insights" enable row level security;

create table "public"."interviews" (
    "id" uuid not null default gen_random_uuid(),
    "account_id" uuid not null,
    "project_id" uuid not null,
    "title" text,
    "interview_date" date,
    "interviewer_id" uuid,
    "participant_pseudonym" text,
    "segment" text,
    "transcript" text,
    "transcript_formatted" jsonb,
    "high_impact_themes" text[],
    "open_questions_and_next_steps" text,
    "observations_and_notes" text,
    "duration_min" integer,
    "status" interview_status not null default 'draft'::interview_status,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."interviews" enable row level security;

create table "public"."opportunities" (
    "id" uuid not null default gen_random_uuid(),
    "account_id" uuid not null,
    "project_id" uuid not null,
    "title" text not null,
    "owner_id" uuid,
    "kanban_status" text,
    "related_insight_ids" uuid[],
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."opportunities" enable row level security;

create table "public"."people" (
    "id" uuid not null default gen_random_uuid(),
    "account_id" uuid,
    "name" text,
    "description" text,
    "segment" text,
    "persona" text,
    "age" integer,
    "gender" text,
    "income" integer,
    "education" text,
    "occupation" text,
    "location" text,
    "contact_info" jsonb,
    "preferences" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."people" enable row level security;

create table "public"."personas" (
    "id" uuid not null default gen_random_uuid(),
    "account_id" uuid not null,
    "name" text not null,
    "description" text,
    "percentage" numeric,
    "color_hex" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."personas" enable row level security;

create table "public"."projects" (
    "id" uuid not null default gen_random_uuid(),
    "account_id" uuid not null,
    "title" text not null,
    "description" text,
    "status" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."projects" enable row level security;

create table "public"."tags" (
    "tag" text not null,
    "account_id" uuid not null,
    "term" text,
    "definition" text,
    "set_name" text,
    "embedding" vector(1536),
    "updated_at" timestamp with time zone not null default now(),
    "created_at" timestamp with time zone not null default now()
);


CREATE UNIQUE INDEX account_settings_pkey ON public.account_settings USING btree (id);

CREATE UNIQUE INDEX comments_pkey ON public.comments USING btree (id);

CREATE INDEX idx_account_settings_account_id ON public.account_settings USING btree (account_id);

CREATE INDEX idx_comments_account_id ON public.comments USING btree (account_id);

CREATE INDEX idx_comments_insight_id ON public.comments USING btree (insight_id);

CREATE INDEX idx_insights_account_id ON public.insights USING btree (account_id);

CREATE INDEX idx_insights_category ON public.insights USING btree (category);

CREATE INDEX idx_insights_embedding_hnsw ON public.insights USING hnsw (embedding vector_l2_ops) WITH (m='16', ef_construction='64');

CREATE INDEX idx_insights_interview_id ON public.insights USING btree (interview_id);

CREATE INDEX idx_insights_journey_stage ON public.insights USING btree (journey_stage);

CREATE INDEX idx_insights_name ON public.insights USING btree (name);

CREATE INDEX idx_interviews_account_id ON public.interviews USING btree (account_id);

CREATE INDEX idx_interviews_date ON public.interviews USING btree (interview_date);

CREATE INDEX idx_interviews_project_id ON public.interviews USING btree (project_id);

CREATE INDEX idx_interviews_title ON public.interviews USING btree (title);

CREATE INDEX idx_opportunities_account_id ON public.opportunities USING btree (account_id);

CREATE INDEX idx_opportunities_project_id ON public.opportunities USING btree (project_id);

CREATE INDEX idx_opportunities_title ON public.opportunities USING btree (title);

CREATE INDEX idx_people_account_id ON public.people USING btree (account_id);

CREATE INDEX idx_personas_account_id ON public.personas USING btree (account_id);

CREATE INDEX idx_projects_account_id ON public.projects USING btree (account_id);

CREATE INDEX idx_projects_title ON public.projects USING btree (title);

CREATE INDEX idx_tags_account_id ON public.tags USING btree (account_id);

CREATE UNIQUE INDEX insights_pkey ON public.insights USING btree (id);

CREATE UNIQUE INDEX interviews_pkey ON public.interviews USING btree (id);

CREATE UNIQUE INDEX opportunities_pkey ON public.opportunities USING btree (id);

CREATE UNIQUE INDEX people_pkey ON public.people USING btree (id);

CREATE UNIQUE INDEX personas_pkey ON public.personas USING btree (id);

CREATE UNIQUE INDEX projects_pkey ON public.projects USING btree (id);

CREATE UNIQUE INDEX tags_pkey ON public.tags USING btree (tag);

alter table "public"."account_settings" add constraint "account_settings_pkey" PRIMARY KEY using index "account_settings_pkey";

alter table "public"."comments" add constraint "comments_pkey" PRIMARY KEY using index "comments_pkey";

alter table "public"."insights" add constraint "insights_pkey" PRIMARY KEY using index "insights_pkey";

alter table "public"."interviews" add constraint "interviews_pkey" PRIMARY KEY using index "interviews_pkey";

alter table "public"."opportunities" add constraint "opportunities_pkey" PRIMARY KEY using index "opportunities_pkey";

alter table "public"."people" add constraint "people_pkey" PRIMARY KEY using index "people_pkey";

alter table "public"."personas" add constraint "personas_pkey" PRIMARY KEY using index "personas_pkey";

alter table "public"."projects" add constraint "projects_pkey" PRIMARY KEY using index "projects_pkey";

alter table "public"."tags" add constraint "tags_pkey" PRIMARY KEY using index "tags_pkey";

alter table "public"."account_settings" add constraint "account_settings_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts.accounts(id) ON DELETE CASCADE not valid;

alter table "public"."account_settings" validate constraint "account_settings_account_id_fkey";

alter table "public"."account_settings" add constraint "account_settings_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."account_settings" validate constraint "account_settings_created_by_fkey";

alter table "public"."account_settings" add constraint "account_settings_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) not valid;

alter table "public"."account_settings" validate constraint "account_settings_updated_by_fkey";

alter table "public"."comments" add constraint "comments_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts.accounts(id) ON DELETE CASCADE not valid;

alter table "public"."comments" validate constraint "comments_account_id_fkey";

alter table "public"."comments" add constraint "comments_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES insights(id) ON DELETE CASCADE not valid;

alter table "public"."comments" validate constraint "comments_insight_id_fkey";

alter table "public"."comments" add constraint "comments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."comments" validate constraint "comments_user_id_fkey";

alter table "public"."insights" add constraint "insights_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts.accounts(id) ON DELETE CASCADE not valid;

alter table "public"."insights" validate constraint "insights_account_id_fkey";

alter table "public"."insights" add constraint "insights_confidence_check" CHECK ((confidence = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))) not valid;

alter table "public"."insights" validate constraint "insights_confidence_check";

alter table "public"."insights" add constraint "insights_impact_check" CHECK (((impact >= 1) AND (impact <= 5))) not valid;

alter table "public"."insights" validate constraint "insights_impact_check";

alter table "public"."insights" add constraint "insights_interview_id_fkey" FOREIGN KEY (interview_id) REFERENCES interviews(id) not valid;

alter table "public"."insights" validate constraint "insights_interview_id_fkey";

alter table "public"."insights" add constraint "insights_novelty_check" CHECK (((novelty >= 1) AND (novelty <= 5))) not valid;

alter table "public"."insights" validate constraint "insights_novelty_check";

alter table "public"."interviews" add constraint "interviews_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts.accounts(id) ON DELETE CASCADE not valid;

alter table "public"."interviews" validate constraint "interviews_account_id_fkey";

alter table "public"."interviews" add constraint "interviews_interviewer_id_fkey" FOREIGN KEY (interviewer_id) REFERENCES auth.users(id) not valid;

alter table "public"."interviews" validate constraint "interviews_interviewer_id_fkey";

alter table "public"."interviews" add constraint "interviews_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."interviews" validate constraint "interviews_project_id_fkey";

alter table "public"."opportunities" add constraint "opportunities_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts.accounts(id) ON DELETE CASCADE not valid;

alter table "public"."opportunities" validate constraint "opportunities_account_id_fkey";

alter table "public"."opportunities" add constraint "opportunities_kanban_status_check" CHECK ((kanban_status = ANY (ARRAY['Explore'::text, 'Validate'::text, 'Build'::text]))) not valid;

alter table "public"."opportunities" validate constraint "opportunities_kanban_status_check";

alter table "public"."opportunities" add constraint "opportunities_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) not valid;

alter table "public"."opportunities" validate constraint "opportunities_owner_id_fkey";

alter table "public"."opportunities" add constraint "opportunities_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."opportunities" validate constraint "opportunities_project_id_fkey";

alter table "public"."people" add constraint "people_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts.accounts(id) ON DELETE CASCADE not valid;

alter table "public"."people" validate constraint "people_account_id_fkey";

alter table "public"."personas" add constraint "personas_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts.accounts(id) ON DELETE CASCADE not valid;

alter table "public"."personas" validate constraint "personas_account_id_fkey";

alter table "public"."projects" add constraint "projects_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts.accounts(id) ON DELETE CASCADE not valid;

alter table "public"."projects" validate constraint "projects_account_id_fkey";

alter table "public"."tags" add constraint "tags_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts.accounts(id) ON DELETE CASCADE not valid;

alter table "public"."tags" validate constraint "tags_account_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.accept_invitation(lookup_invitation_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'accounts'
AS $function$
declare
    lookup_account_id       uuid;
    declare new_member_role accounts.account_role;
    lookup_account_slug     text;
begin
    select i.account_id, i.account_role, a.slug
    into lookup_account_id, new_member_role, lookup_account_slug
    from accounts.invitations i
             join accounts.accounts a on a.id = i.account_id
    where i.token = lookup_invitation_token
      and i.created_at > now() - interval '24 hours';

    if lookup_account_id IS NULL then
        raise exception 'Invitation not found';
    end if;

    if lookup_account_id is not null then
        -- we've validated the token is real, so grant the user access
        insert into accounts.account_user (account_id, user_id, account_role)
        values (lookup_account_id, auth.uid(), new_member_role);
        -- email types of invitations are only good for one usage
        delete from accounts.invitations where token = lookup_invitation_token and invitation_type = 'one_time';
    end if;
    return json_build_object('account_id', lookup_account_id, 'account_role', new_member_role, 'slug',
                             lookup_account_slug);
EXCEPTION
    WHEN unique_violation THEN
        raise exception 'You are already a member of this account';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_account(slug text DEFAULT NULL::text, name text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    new_account_id uuid;
BEGIN
    insert into accounts.accounts (slug, name)
    values (create_account.slug, create_account.name)
    returning id into new_account_id;

    return public.get_account(new_account_id);
EXCEPTION
    WHEN unique_violation THEN
        raise exception 'An account with that unique ID already exists';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_invitation(account_id uuid, account_role accounts.account_role, invitation_type accounts.invitation_type)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
declare
    new_invitation accounts.invitations;
begin
    insert into accounts.invitations (account_id, account_role, invitation_type, invited_by_user_id)
    values (account_id, account_role, invitation_type, auth.uid())
    returning * into new_invitation;

    return json_build_object('token', new_invitation.token);
end
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_account_role(account_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    response jsonb;
BEGIN

    select jsonb_build_object(
                   'account_role', wu.account_role,
                   'is_primary_owner', a.primary_owner_user_id = auth.uid(),
                   'is_personal_account', a.personal_account
               )
    into response
    from accounts.account_user wu
             join accounts.accounts a on a.id = wu.account_id
    where wu.user_id = auth.uid()
      and wu.account_id = current_user_account_role.account_id;

    -- if the user is not a member of the account, throw an error
    if response ->> 'account_role' IS NULL then
        raise exception 'Not found';
    end if;

    return response;
END
$function$
;

CREATE OR REPLACE FUNCTION public.delete_invitation(invitation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
    -- verify account owner for the invitation
    if accounts.has_role_on_account(
               (select account_id from accounts.invitations where id = delete_invitation.invitation_id), 'owner') <>
       true then
        raise exception 'Only account owners can delete invitations';
    end if;

    delete from accounts.invitations where id = delete_invitation.invitation_id;
end
$function$
;

CREATE OR REPLACE FUNCTION public.get_account(account_id uuid)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- check if the user is a member of the account or a service_role user
    if current_user IN ('anon', 'authenticated') and
       (select current_user_account_role(get_account.account_id) ->> 'account_role' IS NULL) then
        raise exception 'You must be a member of an account to access it';
    end if;


    return (select json_build_object(
                           'account_id', a.id,
                           'account_role', wu.account_role,
                           'is_primary_owner', a.primary_owner_user_id = auth.uid(),
                           'name', a.name,
                           'slug', a.slug,
                           'personal_account', a.personal_account,
                           'billing_enabled', case
                                                  when a.personal_account = true then
                                                      config.enable_personal_account_billing
                                                  else
                                                      config.enable_team_account_billing
                               end,
                           'billing_status', bs.status,
                           'created_at', a.created_at,
                           'updated_at', a.updated_at,
                           'metadata', a.public_metadata
                       )
            from accounts.accounts a
                     left join accounts.account_user wu on a.id = wu.account_id and wu.user_id = auth.uid()
                     join accounts.config config on true
                     left join (select bs.account_id, status
                                from accounts.billing_subscriptions bs
                                where bs.account_id = get_account.account_id
                                order by created desc
                                limit 1) bs on bs.account_id = a.id
            where a.id = get_account.account_id);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_account_billing_status(account_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'accounts'
AS $function$
DECLARE
    result      jsonb;
    role_result jsonb;
BEGIN
    select public.current_user_account_role(get_account_billing_status.account_id) into role_result;

    select jsonb_build_object(
                   'account_id', get_account_billing_status.account_id,
                   'billing_subscription_id', s.id,
                   'billing_enabled', case
                                          when a.personal_account = true then config.enable_personal_account_billing
                                          else config.enable_team_account_billing end,
                   'billing_status', s.status,
                   'billing_customer_id', c.id,
                   'billing_provider', config.billing_provider,
                   'billing_email',
                   coalesce(c.email, u.email) -- if we don't have a customer email, use the user's email as a fallback
               )
    into result
    from accounts.accounts a
             join auth.users u on u.id = a.primary_owner_user_id
             left join accounts.billing_subscriptions s on s.account_id = a.id
             left join accounts.billing_customers c on c.account_id = coalesce(s.account_id, a.id)
             join accounts.config config on true
    where a.id = get_account_billing_status.account_id
    order by s.created desc
    limit 1;

    return result || role_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_account_by_slug(slug text)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    internal_account_id uuid;
BEGIN
    select a.id
    into internal_account_id
    from accounts.accounts a
    where a.slug IS NOT NULL
      and a.slug = get_account_by_slug.slug;

    return public.get_account(internal_account_id);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_account_id(slug text)
 RETURNS uuid
 LANGUAGE sql
AS $function$
select id
from accounts.accounts
where slug = get_account_id.slug;
$function$
;

CREATE OR REPLACE FUNCTION public.get_account_invitations(account_id uuid, results_limit integer DEFAULT 25, results_offset integer DEFAULT 0)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- only account owners can access this function
    if (select public.current_user_account_role(get_account_invitations.account_id) ->> 'account_role' <> 'owner') then
        raise exception 'Only account owners can access this function';
    end if;

    return (select json_agg(
                           json_build_object(
                                   'account_role', i.account_role,
                                   'created_at', i.created_at,
                                   'invitation_type', i.invitation_type,
                                   'invitation_id', i.id,
                                   'email', i.invitee_email
                               )
                       )
            from accounts.invitations i
            where i.account_id = get_account_invitations.account_id
              and i.created_at > now() - interval '24 hours'
            limit coalesce(get_account_invitations.results_limit, 25) offset coalesce(get_account_invitations.results_offset, 0));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_account_members(account_id uuid, results_limit integer DEFAULT 50, results_offset integer DEFAULT 0)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'accounts'
AS $function$
BEGIN

    -- only account owners can access this function
    if (select public.current_user_account_role(get_account_members.account_id) ->> 'account_role' <> 'owner') then
        raise exception 'Only account owners can access this function';
    end if;

    return (select json_agg(
                           json_build_object(
                                   'user_id', wu.user_id,
                                   'account_role', wu.account_role,
                                   'name', p.name,
                                   'email', u.email,
                                   'is_primary_owner', a.primary_owner_user_id = wu.user_id
                               )
                       )
            from accounts.account_user wu
                     join accounts.accounts a on a.id = wu.account_id
                     join accounts.accounts p on p.primary_owner_user_id = wu.user_id and p.personal_account = true
                     join auth.users u on u.id = wu.user_id
            where wu.account_id = get_account_members.account_id
            limit coalesce(get_account_members.results_limit, 50) offset coalesce(get_account_members.results_offset, 0));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_accounts()
 RETURNS json
 LANGUAGE sql
AS $function$
select coalesce(json_agg(
                        json_build_object(
                                'account_id', wu.account_id,
                                'account_role', wu.account_role,
                                'is_primary_owner', a.primary_owner_user_id = auth.uid(),
                                'name', a.name,
                                'slug', a.slug,
                                'personal_account', a.personal_account,
                                'created_at', a.created_at,
                                'updated_at', a.updated_at
                            )
                    ), '[]'::json)
from accounts.account_user wu
         join accounts.accounts a on a.id = wu.account_id
where wu.user_id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.get_personal_account()
 RETURNS json
 LANGUAGE plpgsql
AS $function$
BEGIN
    return public.get_account(auth.uid());
END;
$function$
;

CREATE OR REPLACE FUNCTION public.lookup_invitation(lookup_invitation_token text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'accounts'
AS $function$
declare
    name              text;
    invitation_active boolean;
begin
    select account_name,
           case when id IS NOT NULL then true else false end as active
    into name, invitation_active
    from accounts.invitations
    where token = lookup_invitation_token
      and created_at > now() - interval '24 hours'
    limit 1;
    return json_build_object('active', coalesce(invitation_active, false), 'account_name', name);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.remove_account_member(account_id uuid, user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- only account owners can access this function
    if accounts.has_role_on_account(remove_account_member.account_id, 'owner') <> true then
        raise exception 'Only account owners can access this function';
    end if;

    delete
    from accounts.account_user wu
    where wu.account_id = remove_account_member.account_id
      and wu.user_id = remove_account_member.user_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.service_role_upsert_customer_subscription(account_id uuid, customer jsonb DEFAULT NULL::jsonb, subscription jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- if the customer is not null, upsert the data into billing_customers, only upsert fields that are present in the jsonb object
    if customer is not null then
        insert into accounts.billing_customers (id, account_id, email, provider)
        values (customer ->> 'id', service_role_upsert_customer_subscription.account_id, customer ->> 'billing_email',
                (customer ->> 'provider'))
        on conflict (id) do update
            set email = customer ->> 'billing_email';
    end if;

    -- if the subscription is not null, upsert the data into billing_subscriptions, only upsert fields that are present in the jsonb object
    if subscription is not null then
        insert into accounts.billing_subscriptions (id, account_id, billing_customer_id, status, metadata, price_id,
                                                    quantity, cancel_at_period_end, created, current_period_start,
                                                    current_period_end, ended_at, cancel_at, canceled_at, trial_start,
                                                    trial_end, plan_name, provider)
        values (subscription ->> 'id', service_role_upsert_customer_subscription.account_id,
                subscription ->> 'billing_customer_id', (subscription ->> 'status')::accounts.subscription_status,
                subscription -> 'metadata',
                subscription ->> 'price_id', (subscription ->> 'quantity')::int,
                (subscription ->> 'cancel_at_period_end')::boolean,
                (subscription ->> 'created')::timestamptz, (subscription ->> 'current_period_start')::timestamptz,
                (subscription ->> 'current_period_end')::timestamptz, (subscription ->> 'ended_at')::timestamptz,
                (subscription ->> 'cancel_at')::timestamptz,
                (subscription ->> 'canceled_at')::timestamptz, (subscription ->> 'trial_start')::timestamptz,
                (subscription ->> 'trial_end')::timestamptz,
                subscription ->> 'plan_name', (subscription ->> 'provider'))
        on conflict (id) do update
            set billing_customer_id  = subscription ->> 'billing_customer_id',
                status               = (subscription ->> 'status')::accounts.subscription_status,
                metadata             = subscription -> 'metadata',
                price_id             = subscription ->> 'price_id',
                quantity             = (subscription ->> 'quantity')::int,
                cancel_at_period_end = (subscription ->> 'cancel_at_period_end')::boolean,
                current_period_start = (subscription ->> 'current_period_start')::timestamptz,
                current_period_end   = (subscription ->> 'current_period_end')::timestamptz,
                ended_at             = (subscription ->> 'ended_at')::timestamptz,
                cancel_at            = (subscription ->> 'cancel_at')::timestamptz,
                canceled_at          = (subscription ->> 'canceled_at')::timestamptz,
                trial_start          = (subscription ->> 'trial_start')::timestamptz,
                trial_end            = (subscription ->> 'trial_end')::timestamptz,
                plan_name            = subscription ->> 'plan_name';
    end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_account(account_id uuid, slug text DEFAULT NULL::text, name text DEFAULT NULL::text, public_metadata jsonb DEFAULT NULL::jsonb, replace_metadata boolean DEFAULT false)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
BEGIN

    -- check if postgres role is service_role
    if current_user IN ('anon', 'authenticated') and
       not (select current_user_account_role(update_account.account_id) ->> 'account_role' = 'owner') then
        raise exception 'Only account owners can update an account';
    end if;

    update accounts.accounts accounts
    set slug            = coalesce(update_account.slug, accounts.slug),
        name            = coalesce(update_account.name, accounts.name),
        public_metadata = case
                              when update_account.public_metadata is null then accounts.public_metadata -- do nothing
                              when accounts.public_metadata IS NULL then update_account.public_metadata -- set metadata
                              when update_account.replace_metadata
                                  then update_account.public_metadata -- replace metadata
                              else accounts.public_metadata || update_account.public_metadata end -- merge metadata
    where accounts.id = update_account.account_id;

    return public.get_account(account_id);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_account_user_role(account_id uuid, user_id uuid, new_account_role accounts.account_role, make_primary_owner boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    is_account_owner         boolean;
    is_account_primary_owner boolean;
    changing_primary_owner   boolean;
begin
    -- check if the user is an owner, and if they are, allow them to update the role
    select accounts.has_role_on_account(update_account_user_role.account_id, 'owner') into is_account_owner;

    if not is_account_owner then
        raise exception 'You must be an owner of the account to update a users role';
    end if;

    -- check if the user being changed is the primary owner, if so its not allowed
    select primary_owner_user_id = auth.uid(), primary_owner_user_id = update_account_user_role.user_id
    into is_account_primary_owner, changing_primary_owner
    from accounts.accounts
    where id = update_account_user_role.account_id;

    if changing_primary_owner = true and is_account_primary_owner = false then
        raise exception 'You must be the primary owner of the account to change the primary owner';
    end if;

    update accounts.account_user au
    set account_role = new_account_role
    where au.account_id = update_account_user_role.account_id
      and au.user_id = update_account_user_role.user_id;

    if make_primary_owner = true then
        -- first we see if the current user is the owner, only they can do this
        if is_account_primary_owner = false then
            raise exception 'You must be the primary owner of the account to change the primary owner';
        end if;

        update accounts.accounts
        set primary_owner_user_id = update_account_user_role.user_id
        where id = update_account_user_role.account_id;
    end if;
end;
$function$
;

grant delete on table "public"."account_settings" to "anon";

grant insert on table "public"."account_settings" to "anon";

grant references on table "public"."account_settings" to "anon";

grant select on table "public"."account_settings" to "anon";

grant trigger on table "public"."account_settings" to "anon";

grant truncate on table "public"."account_settings" to "anon";

grant update on table "public"."account_settings" to "anon";

grant delete on table "public"."account_settings" to "authenticated";

grant insert on table "public"."account_settings" to "authenticated";

grant references on table "public"."account_settings" to "authenticated";

grant select on table "public"."account_settings" to "authenticated";

grant trigger on table "public"."account_settings" to "authenticated";

grant truncate on table "public"."account_settings" to "authenticated";

grant update on table "public"."account_settings" to "authenticated";

grant delete on table "public"."account_settings" to "service_role";

grant insert on table "public"."account_settings" to "service_role";

grant references on table "public"."account_settings" to "service_role";

grant select on table "public"."account_settings" to "service_role";

grant trigger on table "public"."account_settings" to "service_role";

grant truncate on table "public"."account_settings" to "service_role";

grant update on table "public"."account_settings" to "service_role";

grant delete on table "public"."comments" to "anon";

grant insert on table "public"."comments" to "anon";

grant references on table "public"."comments" to "anon";

grant select on table "public"."comments" to "anon";

grant trigger on table "public"."comments" to "anon";

grant truncate on table "public"."comments" to "anon";

grant update on table "public"."comments" to "anon";

grant delete on table "public"."comments" to "authenticated";

grant insert on table "public"."comments" to "authenticated";

grant references on table "public"."comments" to "authenticated";

grant select on table "public"."comments" to "authenticated";

grant trigger on table "public"."comments" to "authenticated";

grant truncate on table "public"."comments" to "authenticated";

grant update on table "public"."comments" to "authenticated";

grant delete on table "public"."comments" to "service_role";

grant insert on table "public"."comments" to "service_role";

grant references on table "public"."comments" to "service_role";

grant select on table "public"."comments" to "service_role";

grant trigger on table "public"."comments" to "service_role";

grant truncate on table "public"."comments" to "service_role";

grant update on table "public"."comments" to "service_role";

grant delete on table "public"."insights" to "anon";

grant insert on table "public"."insights" to "anon";

grant references on table "public"."insights" to "anon";

grant select on table "public"."insights" to "anon";

grant trigger on table "public"."insights" to "anon";

grant truncate on table "public"."insights" to "anon";

grant update on table "public"."insights" to "anon";

grant delete on table "public"."insights" to "authenticated";

grant insert on table "public"."insights" to "authenticated";

grant references on table "public"."insights" to "authenticated";

grant select on table "public"."insights" to "authenticated";

grant trigger on table "public"."insights" to "authenticated";

grant truncate on table "public"."insights" to "authenticated";

grant update on table "public"."insights" to "authenticated";

grant delete on table "public"."insights" to "service_role";

grant insert on table "public"."insights" to "service_role";

grant references on table "public"."insights" to "service_role";

grant select on table "public"."insights" to "service_role";

grant trigger on table "public"."insights" to "service_role";

grant truncate on table "public"."insights" to "service_role";

grant update on table "public"."insights" to "service_role";

grant delete on table "public"."interviews" to "anon";

grant insert on table "public"."interviews" to "anon";

grant references on table "public"."interviews" to "anon";

grant select on table "public"."interviews" to "anon";

grant trigger on table "public"."interviews" to "anon";

grant truncate on table "public"."interviews" to "anon";

grant update on table "public"."interviews" to "anon";

grant delete on table "public"."interviews" to "authenticated";

grant insert on table "public"."interviews" to "authenticated";

grant references on table "public"."interviews" to "authenticated";

grant select on table "public"."interviews" to "authenticated";

grant trigger on table "public"."interviews" to "authenticated";

grant truncate on table "public"."interviews" to "authenticated";

grant update on table "public"."interviews" to "authenticated";

grant delete on table "public"."interviews" to "service_role";

grant insert on table "public"."interviews" to "service_role";

grant references on table "public"."interviews" to "service_role";

grant select on table "public"."interviews" to "service_role";

grant trigger on table "public"."interviews" to "service_role";

grant truncate on table "public"."interviews" to "service_role";

grant update on table "public"."interviews" to "service_role";

grant delete on table "public"."opportunities" to "anon";

grant insert on table "public"."opportunities" to "anon";

grant references on table "public"."opportunities" to "anon";

grant select on table "public"."opportunities" to "anon";

grant trigger on table "public"."opportunities" to "anon";

grant truncate on table "public"."opportunities" to "anon";

grant update on table "public"."opportunities" to "anon";

grant delete on table "public"."opportunities" to "authenticated";

grant insert on table "public"."opportunities" to "authenticated";

grant references on table "public"."opportunities" to "authenticated";

grant select on table "public"."opportunities" to "authenticated";

grant trigger on table "public"."opportunities" to "authenticated";

grant truncate on table "public"."opportunities" to "authenticated";

grant update on table "public"."opportunities" to "authenticated";

grant delete on table "public"."opportunities" to "service_role";

grant insert on table "public"."opportunities" to "service_role";

grant references on table "public"."opportunities" to "service_role";

grant select on table "public"."opportunities" to "service_role";

grant trigger on table "public"."opportunities" to "service_role";

grant truncate on table "public"."opportunities" to "service_role";

grant update on table "public"."opportunities" to "service_role";

grant delete on table "public"."people" to "anon";

grant insert on table "public"."people" to "anon";

grant references on table "public"."people" to "anon";

grant select on table "public"."people" to "anon";

grant trigger on table "public"."people" to "anon";

grant truncate on table "public"."people" to "anon";

grant update on table "public"."people" to "anon";

grant delete on table "public"."people" to "authenticated";

grant insert on table "public"."people" to "authenticated";

grant references on table "public"."people" to "authenticated";

grant select on table "public"."people" to "authenticated";

grant trigger on table "public"."people" to "authenticated";

grant truncate on table "public"."people" to "authenticated";

grant update on table "public"."people" to "authenticated";

grant delete on table "public"."people" to "service_role";

grant insert on table "public"."people" to "service_role";

grant references on table "public"."people" to "service_role";

grant select on table "public"."people" to "service_role";

grant trigger on table "public"."people" to "service_role";

grant truncate on table "public"."people" to "service_role";

grant update on table "public"."people" to "service_role";

grant delete on table "public"."personas" to "anon";

grant insert on table "public"."personas" to "anon";

grant references on table "public"."personas" to "anon";

grant select on table "public"."personas" to "anon";

grant trigger on table "public"."personas" to "anon";

grant truncate on table "public"."personas" to "anon";

grant update on table "public"."personas" to "anon";

grant delete on table "public"."personas" to "authenticated";

grant insert on table "public"."personas" to "authenticated";

grant references on table "public"."personas" to "authenticated";

grant select on table "public"."personas" to "authenticated";

grant trigger on table "public"."personas" to "authenticated";

grant truncate on table "public"."personas" to "authenticated";

grant update on table "public"."personas" to "authenticated";

grant delete on table "public"."personas" to "service_role";

grant insert on table "public"."personas" to "service_role";

grant references on table "public"."personas" to "service_role";

grant select on table "public"."personas" to "service_role";

grant trigger on table "public"."personas" to "service_role";

grant truncate on table "public"."personas" to "service_role";

grant update on table "public"."personas" to "service_role";

grant delete on table "public"."projects" to "anon";

grant insert on table "public"."projects" to "anon";

grant references on table "public"."projects" to "anon";

grant select on table "public"."projects" to "anon";

grant trigger on table "public"."projects" to "anon";

grant truncate on table "public"."projects" to "anon";

grant update on table "public"."projects" to "anon";

grant delete on table "public"."projects" to "authenticated";

grant insert on table "public"."projects" to "authenticated";

grant references on table "public"."projects" to "authenticated";

grant select on table "public"."projects" to "authenticated";

grant trigger on table "public"."projects" to "authenticated";

grant truncate on table "public"."projects" to "authenticated";

grant update on table "public"."projects" to "authenticated";

grant delete on table "public"."projects" to "service_role";

grant insert on table "public"."projects" to "service_role";

grant references on table "public"."projects" to "service_role";

grant select on table "public"."projects" to "service_role";

grant trigger on table "public"."projects" to "service_role";

grant truncate on table "public"."projects" to "service_role";

grant update on table "public"."projects" to "service_role";

grant delete on table "public"."tags" to "anon";

grant insert on table "public"."tags" to "anon";

grant references on table "public"."tags" to "anon";

grant select on table "public"."tags" to "anon";

grant trigger on table "public"."tags" to "anon";

grant truncate on table "public"."tags" to "anon";

grant update on table "public"."tags" to "anon";

grant delete on table "public"."tags" to "authenticated";

grant insert on table "public"."tags" to "authenticated";

grant references on table "public"."tags" to "authenticated";

grant select on table "public"."tags" to "authenticated";

grant trigger on table "public"."tags" to "authenticated";

grant truncate on table "public"."tags" to "authenticated";

grant update on table "public"."tags" to "authenticated";

grant delete on table "public"."tags" to "service_role";

grant insert on table "public"."tags" to "service_role";

grant references on table "public"."tags" to "service_role";

grant select on table "public"."tags" to "service_role";

grant trigger on table "public"."tags" to "service_role";

grant truncate on table "public"."tags" to "service_role";

grant update on table "public"."tags" to "service_role";

create policy "Account members can insert"
on "public"."account_settings"
as permissive
for insert
to authenticated
with check ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account members can select"
on "public"."account_settings"
as permissive
for select
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account members can update"
on "public"."account_settings"
as permissive
for update
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account owners can delete"
on "public"."account_settings"
as permissive
for delete
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role('owner'::accounts.account_role) AS get_accounts_with_role)));


create policy "Account members can insert"
on "public"."comments"
as permissive
for insert
to authenticated
with check ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account members can select"
on "public"."comments"
as permissive
for select
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account owners can delete"
on "public"."comments"
as permissive
for delete
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role('owner'::accounts.account_role) AS get_accounts_with_role)));


create policy "Comment authors can update their own comments"
on "public"."comments"
as permissive
for update
to authenticated
using ((user_id = auth.uid()));


create policy "Account members can insert"
on "public"."insights"
as permissive
for insert
to authenticated
with check ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account members can select"
on "public"."insights"
as permissive
for select
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account members can update"
on "public"."insights"
as permissive
for update
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account owners can delete"
on "public"."insights"
as permissive
for delete
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role('owner'::accounts.account_role) AS get_accounts_with_role)));


create policy "Account members can insert"
on "public"."interviews"
as permissive
for insert
to authenticated
with check ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account members can select"
on "public"."interviews"
as permissive
for select
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account members can update"
on "public"."interviews"
as permissive
for update
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account owners can delete"
on "public"."interviews"
as permissive
for delete
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role('owner'::accounts.account_role) AS get_accounts_with_role)));


create policy "Account members can insert"
on "public"."opportunities"
as permissive
for insert
to authenticated
with check ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account members can select"
on "public"."opportunities"
as permissive
for select
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account members can update"
on "public"."opportunities"
as permissive
for update
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account owners can delete"
on "public"."opportunities"
as permissive
for delete
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role('owner'::accounts.account_role) AS get_accounts_with_role)));


create policy "Account members can insert"
on "public"."people"
as permissive
for insert
to authenticated
with check ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account members can select"
on "public"."people"
as permissive
for select
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account members can update"
on "public"."people"
as permissive
for update
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account owners can delete"
on "public"."people"
as permissive
for delete
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role('owner'::accounts.account_role) AS get_accounts_with_role)));


create policy "Account members can insert"
on "public"."personas"
as permissive
for insert
to authenticated
with check ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account members can select"
on "public"."personas"
as permissive
for select
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account members can update"
on "public"."personas"
as permissive
for update
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account owners can delete"
on "public"."personas"
as permissive
for delete
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role('owner'::accounts.account_role) AS get_accounts_with_role)));


create policy "Account members can insert"
on "public"."projects"
as permissive
for insert
to authenticated
with check ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account members can select"
on "public"."projects"
as permissive
for select
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account members can update"
on "public"."projects"
as permissive
for update
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account owners can delete"
on "public"."projects"
as permissive
for delete
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role('owner'::accounts.account_role) AS get_accounts_with_role)));


CREATE TRIGGER set_account_settings_timestamp BEFORE INSERT OR UPDATE ON public.account_settings FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();

CREATE TRIGGER set_account_settings_user_tracking BEFORE INSERT OR UPDATE ON public.account_settings FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_user_tracking();

CREATE TRIGGER set_comments_timestamp BEFORE INSERT OR UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();

CREATE TRIGGER set_comments_user_tracking BEFORE INSERT OR UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_user_tracking();

CREATE TRIGGER set_insights_timestamp BEFORE INSERT OR UPDATE ON public.insights FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();

CREATE TRIGGER set_insights_user_tracking BEFORE INSERT OR UPDATE ON public.insights FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_user_tracking();

CREATE TRIGGER set_interviews_timestamp BEFORE INSERT OR UPDATE ON public.interviews FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();

CREATE TRIGGER set_interviews_user_tracking BEFORE INSERT OR UPDATE ON public.interviews FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_user_tracking();

CREATE TRIGGER set_opportunities_timestamp BEFORE INSERT OR UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();

CREATE TRIGGER set_opportunities_user_tracking BEFORE INSERT OR UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_user_tracking();

CREATE TRIGGER set_people_timestamp BEFORE INSERT OR UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();

CREATE TRIGGER set_people_user_tracking BEFORE INSERT OR UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_user_tracking();

CREATE TRIGGER set_personas_timestamp BEFORE INSERT OR UPDATE ON public.personas FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();

CREATE TRIGGER set_personas_user_tracking BEFORE INSERT OR UPDATE ON public.personas FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_user_tracking();

CREATE TRIGGER set_projects_timestamp BEFORE INSERT OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();

CREATE TRIGGER set_projects_user_tracking BEFORE INSERT OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_user_tracking();
