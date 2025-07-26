

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "accounts";


ALTER SCHEMA "accounts" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE SCHEMA IF NOT EXISTS "pgmq_public";


ALTER SCHEMA "pgmq_public" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "http" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgmq" WITH SCHEMA "pgmq";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";






CREATE TYPE "accounts"."account_role" AS ENUM (
    'owner',
    'member'
);


ALTER TYPE "accounts"."account_role" OWNER TO "postgres";


CREATE TYPE "accounts"."invitation_type" AS ENUM (
    'one_time',
    '24_hour'
);


ALTER TYPE "accounts"."invitation_type" OWNER TO "postgres";


CREATE TYPE "accounts"."subscription_status" AS ENUM (
    'trialing',
    'active',
    'canceled',
    'incomplete',
    'incomplete_expired',
    'past_due',
    'unpaid'
);


ALTER TYPE "accounts"."subscription_status" OWNER TO "postgres";


CREATE TYPE "public"."interview_status" AS ENUM (
    'draft',
    'scheduled',
    'uploaded',
    'transcribed',
    'processing',
    'ready',
    'tagged',
    'archived'
);


ALTER TYPE "public"."interview_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "accounts"."add_current_user_to_new_account"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
    if new.primary_owner_user_id = auth.uid() then
        insert into accounts.account_user (account_id, user_id, account_role)
        values (NEW.id, auth.uid(), 'owner');
    end if;
    return NEW;
end;
$$;


ALTER FUNCTION "accounts"."add_current_user_to_new_account"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "accounts"."generate_token"("length" integer) RETURNS "text"
    LANGUAGE "sql"
    AS $$
select regexp_replace(replace(
                              replace(replace(replace(encode(gen_random_bytes(length)::bytea, 'base64'), '/', ''), '+',
                                              ''), '\\', ''),
                              '=',
                              ''), E'[\\n\\r]+', '', 'g');
$$;


ALTER FUNCTION "accounts"."generate_token"("length" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "accounts"."get_accounts_with_role"("passed_in_role" "accounts"."account_role" DEFAULT NULL::"accounts"."account_role") RETURNS SETOF "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
select account_id
from accounts.account_user wu
where wu.user_id = auth.uid()
  and (
            wu.account_role = passed_in_role
        or passed_in_role is null
    );
$$;


ALTER FUNCTION "accounts"."get_accounts_with_role"("passed_in_role" "accounts"."account_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "accounts"."get_config"() RETURNS json
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    result RECORD;
BEGIN
    SELECT * from accounts.config limit 1 into result;
    return row_to_json(result);
END;
$$;


ALTER FUNCTION "accounts"."get_config"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "accounts"."has_role_on_account"("account_id" "uuid", "account_role" "accounts"."account_role" DEFAULT NULL::"accounts"."account_role") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'accounts', 'public'
    AS $$
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
$$;


ALTER FUNCTION "accounts"."has_role_on_account"("account_id" "uuid", "account_role" "accounts"."account_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "accounts"."is_set"("field_name" "text") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    result BOOLEAN;
BEGIN
    execute format('select %I from accounts.config limit 1', field_name) into result;
    return result;
END;
$$;


ALTER FUNCTION "accounts"."is_set"("field_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "accounts"."protect_account_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "accounts"."protect_account_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "accounts"."run_new_user_setup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "accounts"."run_new_user_setup"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "accounts"."slugify_account_slug"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    if NEW.slug is not null then
        NEW.slug = lower(regexp_replace(NEW.slug, '[^a-zA-Z0-9-]+', '-', 'g'));
    end if;

    RETURN NEW;
END
$$;


ALTER FUNCTION "accounts"."slugify_account_slug"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "accounts"."trigger_set_invitation_details"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.invited_by_user_id = auth.uid();
    NEW.account_name = (select name from accounts.accounts where id = NEW.account_id);
    RETURN NEW;
END
$$;


ALTER FUNCTION "accounts"."trigger_set_invitation_details"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "accounts"."trigger_set_timestamps"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "accounts"."trigger_set_timestamps"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "accounts"."trigger_set_user_tracking"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    has_created_by boolean;
    has_updated_by boolean;
BEGIN
    -- Skip auth.users table entirely
    IF TG_TABLE_SCHEMA = 'auth' AND TG_TABLE_NAME = 'users' THEN
        RETURN NEW;
    END IF;
    
    -- Check if the table has the required columns
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = TG_TABLE_SCHEMA 
        AND table_name = TG_TABLE_NAME 
        AND column_name = 'created_by'
    ) INTO has_created_by;
    
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = TG_TABLE_SCHEMA 
        AND table_name = TG_TABLE_NAME 
        AND column_name = 'updated_by'
    ) INTO has_updated_by;

    -- Only set the fields if they exist
    IF TG_OP = 'INSERT' THEN
        IF has_created_by THEN
            NEW.created_by = auth.uid();
        END IF;
        IF has_updated_by THEN
            NEW.updated_by = auth.uid();
        END IF;
    ELSE
        IF has_updated_by THEN
            NEW.updated_by = auth.uid();
        END IF;
        IF has_created_by THEN
            NEW.created_by = OLD.created_by;
        END IF;
    END IF;
    RETURN NEW;
END
$$;


ALTER FUNCTION "accounts"."trigger_set_user_tracking"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "pgmq_public"."archive"("queue_name" "text", "message_id" bigint) RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$ begin return pgmq.archive( queue_name := queue_name, msg_id := message_id ); end; $$;


ALTER FUNCTION "pgmq_public"."archive"("queue_name" "text", "message_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "pgmq_public"."delete"("queue_name" "text", "message_id" bigint) RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$ begin return pgmq.delete( queue_name := queue_name, msg_id := message_id ); end; $$;


ALTER FUNCTION "pgmq_public"."delete"("queue_name" "text", "message_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "pgmq_public"."send"("queue_name" "text", "message" "jsonb", "sleep_seconds" integer DEFAULT 0) RETURNS SETOF bigint
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$ begin return query select * from pgmq.send( queue_name := queue_name, msg := message, delay := sleep_seconds ); end; $$;


ALTER FUNCTION "pgmq_public"."send"("queue_name" "text", "message" "jsonb", "sleep_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "pgmq_public"."send_batch"("queue_name" "text", "messages" "jsonb"[], "sleep_seconds" integer DEFAULT 0) RETURNS SETOF bigint
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$ begin return query select * from pgmq.send_batch( queue_name := queue_name, msgs := messages, delay := sleep_seconds ); end; $$;


ALTER FUNCTION "pgmq_public"."send_batch"("queue_name" "text", "messages" "jsonb"[], "sleep_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_invitation"("lookup_invitation_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'accounts'
    AS $$
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
$$;


ALTER FUNCTION "public"."accept_invitation"("lookup_invitation_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_link_persona_insights"("p_insight_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    persona_record RECORD;
    relevance_score_var DECIMAL(3,2);
BEGIN
    -- Find personas for people involved in the interview that generated this insight
    FOR persona_record IN
        SELECT DISTINCT pe.persona_id, p.name as persona
        FROM insights i
        JOIN interviews iv ON i.interview_id = iv.id
        JOIN interview_people ip ON iv.id = ip.interview_id
        JOIN people pe ON ip.person_id = pe.id
        JOIN personas p ON pe.persona_id = p.id AND pe.account_id = p.account_id
        WHERE i.id = p_insight_id
        AND pe.persona_id IS NOT NULL
    LOOP
        -- Calculate relevance score (simplified - could be more sophisticated)
        relevance_score_var := 1.0;
        
        -- Insert persona-insight link
        INSERT INTO persona_insights (persona_id, insight_id, relevance_score, created_at)
        VALUES (persona_record.persona_id, p_insight_id, relevance_score_var, NOW())
        ON CONFLICT (persona_id, insight_id) DO NOTHING;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."auto_link_persona_insights"("p_insight_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_account"("slug" "text" DEFAULT NULL::"text", "name" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."create_account"("slug" "text", "name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_invitation"("account_id" "uuid", "account_role" "accounts"."account_role", "invitation_type" "accounts"."invitation_type") RETURNS json
    LANGUAGE "plpgsql"
    AS $$
declare
    new_invitation accounts.invitations;
begin
    insert into accounts.invitations (account_id, account_role, invitation_type, invited_by_user_id)
    values (account_id, account_role, invitation_type, auth.uid())
    returning * into new_invitation;

    return json_build_object('token', new_invitation.token);
end
$$;


ALTER FUNCTION "public"."create_invitation"("account_id" "uuid", "account_role" "accounts"."account_role", "invitation_type" "accounts"."invitation_type") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_account_role"("account_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."current_user_account_role"("account_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_invitation"("invitation_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
    -- verify account owner for the invitation
    if accounts.has_role_on_account(
               (select account_id from accounts.invitations where id = delete_invitation.invitation_id), 'owner') <>
       true then
        raise exception 'Only account owners can delete invitations';
    end if;

    delete from accounts.invitations where id = delete_invitation.invitation_id;
end
$$;


ALTER FUNCTION "public"."delete_invitation"("invitation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_insight_embedding"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if (TG_OP = 'INSERT'
      or (TG_OP = 'UPDATE' and old.jtbd is distinct from new.jtbd)) then
    perform pgmq.send(
      'insights_embedding_queue',
      json_build_object(
        'table', TG_TABLE_NAME,
        'id',    new.id::text,
        'name',  new.name,
        'pain',  new.pain
      )::jsonb
    );
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."enqueue_insight_embedding"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_transcribe_interview"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."enqueue_transcribe_interview"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_account"("account_id" "uuid") RETURNS json
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_account"("account_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_account_billing_status"("account_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'accounts'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_account_billing_status"("account_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_account_by_slug"("slug" "text") RETURNS json
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_account_by_slug"("slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_account_id"("slug" "text") RETURNS "uuid"
    LANGUAGE "sql"
    AS $$
select id
from accounts.accounts
where slug = get_account_id.slug;
$$;


ALTER FUNCTION "public"."get_account_id"("slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_account_invitations"("account_id" "uuid", "results_limit" integer DEFAULT 25, "results_offset" integer DEFAULT 0) RETURNS json
    LANGUAGE "plpgsql"
    AS $$
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
                                   'invitation_id', i.id
                               )
                       )
            from accounts.invitations i
            where i.account_id = get_account_invitations.account_id
              and i.created_at > now() - interval '24 hours'
            limit coalesce(get_account_invitations.results_limit, 25) offset coalesce(get_account_invitations.results_offset, 0));
END;
$$;


ALTER FUNCTION "public"."get_account_invitations"("account_id" "uuid", "results_limit" integer, "results_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_account_members"("account_id" "uuid", "results_limit" integer DEFAULT 50, "results_offset" integer DEFAULT 0) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'accounts'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_account_members"("account_id" "uuid", "results_limit" integer, "results_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_accounts"() RETURNS json
    LANGUAGE "sql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_accounts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_personal_account"() RETURNS json
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    return public.get_account(auth.uid());
END;
$$;


ALTER FUNCTION "public"."get_personal_account"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_accounts"() RETURNS json
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'accounts', 'public'
    AS $$
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'account_id', au.account_id,
        'account_role', au.account_role,
        'is_primary_owner', a.primary_owner_user_id = auth.uid(),
        'name', a.name,
        'slug', a.slug,
        'personal_account', a.personal_account,
        'created_at', a.created_at,
        'updated_at', a.updated_at,
        'projects', COALESCE(
          (SELECT json_agg(
            json_build_object(
              'id', p.id,
              'title', p.title,
              'description', p.description,
              'status', p.status,
              'created_at', p.created_at,
              'updated_at', p.updated_at
            )
          )
          FROM public.projects p
          WHERE p.account_id = au.account_id
          ), '[]'::json
        )
      )
    ),
    '[]'::json
  )
  FROM accounts.account_user au
  JOIN accounts.accounts a ON a.id = au.account_id
  WHERE au.user_id = auth.uid();
$$;


ALTER FUNCTION "public"."get_user_accounts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invoke_edge_function"("func_name" "text", "payload" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."invoke_edge_function"("func_name" "text", "payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_insight_to_personas"("p_insight_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- This function is a wrapper around auto_link_persona_insights
    -- It exists for backward compatibility with tests and manual operations
    PERFORM auto_link_persona_insights(p_insight_id);
END;
$$;


ALTER FUNCTION "public"."link_insight_to_personas"("p_insight_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lookup_invitation"("lookup_invitation_token" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'accounts'
    AS $$
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
$$;


ALTER FUNCTION "public"."lookup_invitation"("lookup_invitation_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_embedding_queue"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."process_embedding_queue"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_transcribe_queue"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."process_transcribe_queue"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_account_member"("account_id" "uuid", "user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."remove_account_member"("account_id" "uuid", "user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."service_role_upsert_customer_subscription"("account_id" "uuid", "customer" "jsonb" DEFAULT NULL::"jsonb", "subscription" "jsonb" DEFAULT NULL::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."service_role_upsert_customer_subscription"("account_id" "uuid", "customer" "jsonb", "subscription" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_insight_tags"("p_insight_id" "uuid", "p_tag_names" "text"[], "p_account_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    tag_record RECORD;
    tag_id_var UUID;
BEGIN
    -- Remove existing tags for this insight
    DELETE FROM insight_tags WHERE insight_id = p_insight_id;
    
    -- Add new tags
    IF p_tag_names IS NOT NULL AND array_length(p_tag_names, 1) > 0 THEN
        FOREACH tag_record.tag IN ARRAY p_tag_names LOOP
            -- Find or create the tag
            SELECT account_id, tag INTO tag_id_var 
            FROM tags 
            WHERE account_id = p_account_id AND tag = tag_record.tag;
            
            -- If tag doesn't exist, create it
            IF NOT FOUND THEN
                INSERT INTO tags (account_id, tag, created_at)
                VALUES (p_account_id, tag_record.tag, NOW());
                tag_id_var := p_account_id || tag_record.tag; -- Composite key reference
            END IF;
            
            -- Insert junction record
            INSERT INTO insight_tags (insight_id, tag_id, created_at)
            VALUES (p_insight_id, tag_id_var, NOW())
            ON CONFLICT (insight_id, tag_id) DO NOTHING;
        END LOOP;
    END IF;
END;
$$;


ALTER FUNCTION "public"."sync_insight_tags"("p_insight_id" "uuid", "p_tag_names" "text"[], "p_account_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_opportunity_insights"("p_opportunity_id" "uuid", "p_insight_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Remove existing insights for this opportunity
    DELETE FROM opportunity_insights WHERE opportunity_id = p_opportunity_id;
    
    -- Add new insights
    IF p_insight_ids IS NOT NULL AND array_length(p_insight_ids, 1) > 0 THEN
        INSERT INTO opportunity_insights (opportunity_id, insight_id, created_at)
        SELECT p_opportunity_id, unnest(p_insight_ids), NOW()
        ON CONFLICT (opportunity_id, insight_id) DO NOTHING;
    END IF;
END;
$$;


ALTER FUNCTION "public"."sync_opportunity_insights"("p_opportunity_id" "uuid", "p_insight_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_auto_link_persona_insights"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM auto_link_persona_insights(NEW.id);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."trigger_auto_link_persona_insights"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_update_project_people"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Get project_id from interview
        PERFORM update_project_people_stats(
            (SELECT project_id FROM interviews WHERE id = NEW.interview_id),
            NEW.person_id
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Get project_id from interview
        PERFORM update_project_people_stats(
            (SELECT project_id FROM interviews WHERE id = OLD.interview_id),
            OLD.person_id
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."trigger_update_project_people"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_account"("account_id" "uuid", "slug" "text" DEFAULT NULL::"text", "name" "text" DEFAULT NULL::"text", "public_metadata" "jsonb" DEFAULT NULL::"jsonb", "replace_metadata" boolean DEFAULT false) RETURNS json
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."update_account"("account_id" "uuid", "slug" "text", "name" "text", "public_metadata" "jsonb", "replace_metadata" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_account_user_role"("account_id" "uuid", "user_id" "uuid", "new_account_role" "accounts"."account_role", "make_primary_owner" boolean DEFAULT false) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."update_account_user_role"("account_id" "uuid", "user_id" "uuid", "new_account_role" "accounts"."account_role", "make_primary_owner" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_project_people_stats"("p_project_id" "uuid", "p_person_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    interview_count_var INTEGER;
    first_interview_date TIMESTAMPTZ;
    last_interview_date TIMESTAMPTZ;
BEGIN
    -- Calculate stats for this person in this project
    SELECT 
        COUNT(*),
        MIN(i.interview_date),
        MAX(i.interview_date)
    INTO 
        interview_count_var,
        first_interview_date,
        last_interview_date
    FROM interviews i
    JOIN interview_people ip ON i.id = ip.interview_id
    WHERE i.project_id = p_project_id 
    AND ip.person_id = p_person_id;
    
    -- Update or insert project_people record
    INSERT INTO project_people (
        project_id, 
        person_id, 
        interview_count, 
        first_seen_at, 
        last_seen_at,
        created_at,
        updated_at
    )
    VALUES (
        p_project_id,
        p_person_id,
        COALESCE(interview_count_var, 0),
        COALESCE(first_interview_date, NOW()),
        COALESCE(last_interview_date, NOW()),
        NOW(),
        NOW()
    )
    ON CONFLICT (project_id, person_id) 
    DO UPDATE SET
        interview_count = COALESCE(interview_count_var, 0),
        first_seen_at = COALESCE(first_interview_date, project_people.first_seen_at),
        last_seen_at = COALESCE(last_interview_date, project_people.last_seen_at),
        updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."update_project_people_stats"("p_project_id" "uuid", "p_person_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "accounts"."account_user" (
    "user_id" "uuid" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "account_role" "accounts"."account_role" NOT NULL
);


ALTER TABLE "accounts"."account_user" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "accounts"."accounts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "primary_owner_user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "name" "text",
    "slug" "text",
    "personal_account" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "created_by" "uuid",
    "updated_by" "uuid",
    "private_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "public_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "accounts_accounts_slug_null_if_personal_account_true" CHECK (((("personal_account" = true) AND ("slug" IS NULL)) OR (("personal_account" = false) AND ("slug" IS NOT NULL))))
);


ALTER TABLE "accounts"."accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "accounts"."billing_customers" (
    "account_id" "uuid" NOT NULL,
    "id" "text" NOT NULL,
    "email" "text",
    "active" boolean,
    "provider" "text"
);


ALTER TABLE "accounts"."billing_customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "accounts"."billing_subscriptions" (
    "id" "text" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "billing_customer_id" "text" NOT NULL,
    "status" "accounts"."subscription_status",
    "metadata" "jsonb",
    "price_id" "text",
    "plan_name" "text",
    "quantity" integer,
    "cancel_at_period_end" boolean,
    "created" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "current_period_start" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "current_period_end" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "ended_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "cancel_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "canceled_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "trial_start" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "trial_end" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "provider" "text"
);


ALTER TABLE "accounts"."billing_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "accounts"."config" (
    "enable_team_accounts" boolean DEFAULT true,
    "enable_personal_account_billing" boolean DEFAULT true,
    "enable_team_account_billing" boolean DEFAULT true,
    "billing_provider" "text" DEFAULT 'stripe'::"text"
);


ALTER TABLE "accounts"."config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "accounts"."invitations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "account_role" "accounts"."account_role" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "token" "text" DEFAULT "accounts"."generate_token"(30) NOT NULL,
    "invited_by_user_id" "uuid" NOT NULL,
    "account_name" "text",
    "updated_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "invitation_type" "accounts"."invitation_type" NOT NULL
);


ALTER TABLE "accounts"."invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."account_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_id" "uuid",
    "title" "text",
    "role" "text",
    "onboarding_completed" boolean DEFAULT false NOT NULL,
    "app_activity" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    "created_by" "uuid"
);


ALTER TABLE "public"."account_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_id" "uuid" NOT NULL,
    "insight_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."insight_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "insight_id" "uuid" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "tag_id" "uuid" NOT NULL
);


ALTER TABLE "public"."insight_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."insights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_id" "uuid" NOT NULL,
    "interview_id" "uuid",
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "journey_stage" "text",
    "impact" smallint,
    "novelty" smallint,
    "jtbd" "text",
    "details" "text",
    "evidence" "text",
    "motivation" "text",
    "pain" "text",
    "desired_outcome" "text",
    "emotional_response" "text",
    "opportunity_ideas" "text"[],
    "confidence" "text",
    "contradictions" "text",
    "related_tags" "text"[],
    "embedding" "public"."vector"(1536),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "insights_confidence_check" CHECK (("confidence" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "insights_impact_check" CHECK ((("impact" >= 1) AND ("impact" <= 5))),
    CONSTRAINT "insights_novelty_check" CHECK ((("novelty" >= 1) AND ("novelty" <= 5)))
);


ALTER TABLE "public"."insights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."interview_people" (
    "interview_id" "uuid" NOT NULL,
    "person_id" "uuid" NOT NULL,
    "role" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."interview_people" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."interview_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "interview_id" "uuid" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "tag_id" "uuid" NOT NULL
);


ALTER TABLE "public"."interview_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."interviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "title" "text",
    "interview_date" "date",
    "interviewer_id" "uuid",
    "participant_pseudonym" "text",
    "segment" "text",
    "transcript" "text",
    "transcript_formatted" "jsonb",
    "high_impact_themes" "text"[],
    "open_questions_and_next_steps" "text",
    "observations_and_notes" "text",
    "duration_min" integer,
    "status" "public"."interview_status" DEFAULT 'draft'::"public"."interview_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "media_url" "text"
);


ALTER TABLE "public"."interviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."opportunities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "owner_id" "uuid",
    "kanban_status" "text",
    "related_insight_ids" "uuid"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "opportunities_kanban_status_check" CHECK (("kanban_status" = ANY (ARRAY['Explore'::"text", 'Validate'::"text", 'Build'::"text"])))
);


ALTER TABLE "public"."opportunities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."opportunity_insights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "opportunity_id" "uuid" NOT NULL,
    "insight_id" "uuid" NOT NULL,
    "weight" numeric(3,2) DEFAULT 1.0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."opportunity_insights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."people" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_id" "uuid",
    "name" "text",
    "description" "text",
    "segment" "text",
    "age" integer,
    "gender" "text",
    "income" integer,
    "education" "text",
    "occupation" "text",
    "location" "text",
    "contact_info" "jsonb",
    "preferences" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name_hash" "text" GENERATED ALWAYS AS ("lower"("name")) STORED,
    "persona_id" "uuid"
);


ALTER TABLE "public"."people" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."personas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "percentage" numeric,
    "color_hex" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."personas" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."persona_distribution" AS
 WITH "persona_interview_counts" AS (
         SELECT "p"."id" AS "persona_id",
            "p"."account_id",
            "p"."name" AS "persona_name",
            "p"."color_hex",
            "p"."description",
            "p"."created_at",
            "p"."updated_at",
            "count"(DISTINCT "i"."id") AS "interview_count",
            ( SELECT "count"(DISTINCT "i_total"."id") AS "count"
                   FROM ("public"."interviews" "i_total"
                     JOIN "public"."interview_people" "ip_total" ON (("ip_total"."interview_id" = "i_total"."id")))
                  WHERE ("i_total"."account_id" = "p"."account_id")) AS "total_interviews_with_participants"
           FROM ((("public"."personas" "p"
             LEFT JOIN "public"."people" "ppl" ON ((("ppl"."persona_id" = "p"."id") AND ("ppl"."account_id" = "p"."account_id"))))
             LEFT JOIN "public"."interview_people" "ip" ON (("ip"."person_id" = "ppl"."id")))
             LEFT JOIN "public"."interviews" "i" ON ((("i"."id" = "ip"."interview_id") AND ("i"."account_id" = "p"."account_id"))))
          GROUP BY "p"."id", "p"."account_id", "p"."name", "p"."color_hex", "p"."description", "p"."created_at", "p"."updated_at"
        ), "legacy_fallback_counts" AS (
         SELECT "p"."id" AS "persona_id",
            "count"(DISTINCT "i_legacy"."id") AS "legacy_interview_count",
            ( SELECT "count"(DISTINCT "i_total"."id") AS "count"
                   FROM "public"."interviews" "i_total"
                  WHERE (("i_total"."account_id" = "p"."account_id") AND (("i_total"."participant_pseudonym" IS NOT NULL) OR ("i_total"."segment" IS NOT NULL)) AND (NOT (EXISTS ( SELECT 1
                           FROM "public"."interview_people" "ip_check"
                          WHERE ("ip_check"."interview_id" = "i_total"."id")))))) AS "total_legacy_interviews"
           FROM ("public"."personas" "p"
             LEFT JOIN "public"."interviews" "i_legacy" ON ((("i_legacy"."account_id" = "p"."account_id") AND (("i_legacy"."participant_pseudonym" = "p"."name") OR ("i_legacy"."segment" = "p"."name")) AND (NOT (EXISTS ( SELECT 1
                   FROM "public"."interview_people" "ip_check"
                  WHERE ("ip_check"."interview_id" = "i_legacy"."id")))))))
          GROUP BY "p"."id", "p"."account_id"
        )
 SELECT "pic"."persona_id",
    "pic"."account_id",
    "pic"."persona_name",
    "pic"."color_hex",
    "pic"."description",
    "pic"."created_at",
    "pic"."updated_at",
    "pic"."interview_count",
    "pic"."total_interviews_with_participants",
        CASE
            WHEN ("pic"."total_interviews_with_participants" > 0) THEN "round"(((("pic"."interview_count")::numeric / ("pic"."total_interviews_with_participants")::numeric) * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS "interview_percentage",
    "lfc"."legacy_interview_count",
    "lfc"."total_legacy_interviews",
        CASE
            WHEN ("lfc"."total_legacy_interviews" > 0) THEN "round"(((("lfc"."legacy_interview_count")::numeric / ("lfc"."total_legacy_interviews")::numeric) * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS "legacy_percentage",
    ("pic"."interview_count" + "lfc"."legacy_interview_count") AS "total_interview_count",
    ("pic"."total_interviews_with_participants" + "lfc"."total_legacy_interviews") AS "total_interviews",
        CASE
            WHEN (("pic"."total_interviews_with_participants" + "lfc"."total_legacy_interviews") > 0) THEN "round"((((("pic"."interview_count" + "lfc"."legacy_interview_count"))::numeric / (("pic"."total_interviews_with_participants" + "lfc"."total_legacy_interviews"))::numeric) * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS "combined_percentage"
   FROM ("persona_interview_counts" "pic"
     JOIN "legacy_fallback_counts" "lfc" ON (("pic"."persona_id" = "lfc"."persona_id")))
  ORDER BY "pic"."account_id", ("pic"."interview_count" + "lfc"."legacy_interview_count") DESC;


ALTER VIEW "public"."persona_distribution" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."persona_insights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "persona_id" "uuid" NOT NULL,
    "insight_id" "uuid" NOT NULL,
    "relevance_score" numeric(3,2) DEFAULT 1.0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."persona_insights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_people" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "person_id" "uuid" NOT NULL,
    "role" "text",
    "first_seen_at" timestamp with time zone DEFAULT "now"(),
    "last_seen_at" timestamp with time zone DEFAULT "now"(),
    "interview_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid"
);


ALTER TABLE "public"."project_people" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tags" (
    "tag" "text" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "term" "text",
    "definition" "text",
    "set_name" "text",
    "embedding" "public"."vector"(1536),
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "public"."tags" OWNER TO "postgres";


ALTER TABLE ONLY "accounts"."account_user"
    ADD CONSTRAINT "account_user_pkey" PRIMARY KEY ("user_id", "account_id");



ALTER TABLE ONLY "accounts"."accounts"
    ADD CONSTRAINT "accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "accounts"."accounts"
    ADD CONSTRAINT "accounts_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "accounts"."billing_customers"
    ADD CONSTRAINT "billing_customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "accounts"."billing_subscriptions"
    ADD CONSTRAINT "billing_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "accounts"."invitations"
    ADD CONSTRAINT "invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "accounts"."invitations"
    ADD CONSTRAINT "invitations_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."account_settings"
    ADD CONSTRAINT "account_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."insight_tags"
    ADD CONSTRAINT "insight_tags_insight_id_tag_id_account_id_key" UNIQUE ("insight_id", "tag_id", "account_id");



ALTER TABLE ONLY "public"."insight_tags"
    ADD CONSTRAINT "insight_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."insights"
    ADD CONSTRAINT "insights_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."interview_people"
    ADD CONSTRAINT "interview_people_pkey" PRIMARY KEY ("interview_id", "person_id");



ALTER TABLE ONLY "public"."interview_tags"
    ADD CONSTRAINT "interview_tags_interview_id_tag_id_account_id_key" UNIQUE ("interview_id", "tag_id", "account_id");



ALTER TABLE ONLY "public"."interview_tags"
    ADD CONSTRAINT "interview_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."interviews"
    ADD CONSTRAINT "interviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."opportunities"
    ADD CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."opportunity_insights"
    ADD CONSTRAINT "opportunity_insights_opportunity_id_insight_id_key" UNIQUE ("opportunity_id", "insight_id");



ALTER TABLE ONLY "public"."opportunity_insights"
    ADD CONSTRAINT "opportunity_insights_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."persona_insights"
    ADD CONSTRAINT "persona_insights_persona_id_insight_id_key" UNIQUE ("persona_id", "insight_id");



ALTER TABLE ONLY "public"."persona_insights"
    ADD CONSTRAINT "persona_insights_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."personas"
    ADD CONSTRAINT "personas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_people"
    ADD CONSTRAINT "project_people_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_people"
    ADD CONSTRAINT "project_people_project_id_person_id_key" UNIQUE ("project_id", "person_id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_account_tag_unique" UNIQUE ("account_id", "tag");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_account_settings_account_id" ON "public"."account_settings" USING "btree" ("account_id");



CREATE INDEX "idx_comments_account_id" ON "public"."comments" USING "btree" ("account_id");



CREATE INDEX "idx_comments_insight_id" ON "public"."comments" USING "btree" ("insight_id");



CREATE INDEX "idx_insight_tags_account_id" ON "public"."insight_tags" USING "btree" ("account_id");



CREATE INDEX "idx_insight_tags_insight_id" ON "public"."insight_tags" USING "btree" ("insight_id");



CREATE INDEX "idx_insight_tags_tag_id" ON "public"."insight_tags" USING "btree" ("tag_id");



CREATE INDEX "idx_insights_account_id" ON "public"."insights" USING "btree" ("account_id");



CREATE INDEX "idx_insights_category" ON "public"."insights" USING "btree" ("category");



CREATE INDEX "idx_insights_embedding_hnsw" ON "public"."insights" USING "hnsw" ("embedding" "public"."vector_l2_ops") WITH ("m"='16', "ef_construction"='64');



CREATE INDEX "idx_insights_interview_id" ON "public"."insights" USING "btree" ("interview_id");



CREATE INDEX "idx_insights_journey_stage" ON "public"."insights" USING "btree" ("journey_stage");



CREATE INDEX "idx_insights_name" ON "public"."insights" USING "btree" ("name");



CREATE INDEX "idx_interview_people_interview_id" ON "public"."interview_people" USING "btree" ("interview_id");



CREATE INDEX "idx_interview_people_person_id" ON "public"."interview_people" USING "btree" ("person_id");



CREATE INDEX "idx_interview_tags_account_id" ON "public"."interview_tags" USING "btree" ("account_id");



CREATE INDEX "idx_interview_tags_interview_id" ON "public"."interview_tags" USING "btree" ("interview_id");



CREATE INDEX "idx_interview_tags_tag_id" ON "public"."interview_tags" USING "btree" ("tag_id");



CREATE INDEX "idx_interviews_account_id" ON "public"."interviews" USING "btree" ("account_id");



CREATE INDEX "idx_interviews_date" ON "public"."interviews" USING "btree" ("interview_date");



CREATE INDEX "idx_interviews_project_id" ON "public"."interviews" USING "btree" ("project_id");



CREATE INDEX "idx_interviews_title" ON "public"."interviews" USING "btree" ("title");



CREATE INDEX "idx_opportunities_account_id" ON "public"."opportunities" USING "btree" ("account_id");



CREATE INDEX "idx_opportunities_project_id" ON "public"."opportunities" USING "btree" ("project_id");



CREATE INDEX "idx_opportunities_title" ON "public"."opportunities" USING "btree" ("title");



CREATE INDEX "idx_opportunity_insights_insight_id" ON "public"."opportunity_insights" USING "btree" ("insight_id");



CREATE INDEX "idx_opportunity_insights_opportunity_id" ON "public"."opportunity_insights" USING "btree" ("opportunity_id");



CREATE INDEX "idx_people_account_id" ON "public"."people" USING "btree" ("account_id");



CREATE INDEX "idx_persona_insights_insight_id" ON "public"."persona_insights" USING "btree" ("insight_id");



CREATE INDEX "idx_persona_insights_persona_id" ON "public"."persona_insights" USING "btree" ("persona_id");



CREATE INDEX "idx_personas_account_id" ON "public"."personas" USING "btree" ("account_id");



CREATE INDEX "idx_project_people_person_id" ON "public"."project_people" USING "btree" ("person_id");



CREATE INDEX "idx_project_people_project_id" ON "public"."project_people" USING "btree" ("project_id");



CREATE INDEX "idx_projects_account_id" ON "public"."projects" USING "btree" ("account_id");



CREATE INDEX "idx_projects_title" ON "public"."projects" USING "btree" ("title");



CREATE INDEX "idx_tags_account_id" ON "public"."tags" USING "btree" ("account_id");



CREATE UNIQUE INDEX "uniq_people_account_namehash" ON "public"."people" USING "btree" ("account_id", "name_hash");



CREATE OR REPLACE TRIGGER "accounts_add_current_user_to_new_account" AFTER INSERT ON "accounts"."accounts" FOR EACH ROW EXECUTE FUNCTION "accounts"."add_current_user_to_new_account"();



CREATE OR REPLACE TRIGGER "accounts_protect_account_fields" BEFORE UPDATE ON "accounts"."accounts" FOR EACH ROW EXECUTE FUNCTION "accounts"."protect_account_fields"();



CREATE OR REPLACE TRIGGER "accounts_set_accounts_timestamp" BEFORE INSERT OR UPDATE ON "accounts"."accounts" FOR EACH ROW EXECUTE FUNCTION "accounts"."trigger_set_timestamps"();



CREATE OR REPLACE TRIGGER "accounts_set_accounts_user_tracking" BEFORE INSERT OR UPDATE ON "accounts"."accounts" FOR EACH ROW EXECUTE FUNCTION "accounts"."trigger_set_user_tracking"();



CREATE OR REPLACE TRIGGER "accounts_set_invitations_timestamp" BEFORE INSERT OR UPDATE ON "accounts"."invitations" FOR EACH ROW EXECUTE FUNCTION "accounts"."trigger_set_timestamps"();



CREATE OR REPLACE TRIGGER "accounts_slugify_account_slug" BEFORE INSERT OR UPDATE ON "accounts"."accounts" FOR EACH ROW EXECUTE FUNCTION "accounts"."slugify_account_slug"();



CREATE OR REPLACE TRIGGER "accounts_trigger_set_invitation_details" BEFORE INSERT ON "accounts"."invitations" FOR EACH ROW EXECUTE FUNCTION "accounts"."trigger_set_invitation_details"();



CREATE OR REPLACE TRIGGER "set_account_settings_timestamp" BEFORE INSERT OR UPDATE ON "public"."account_settings" FOR EACH ROW EXECUTE FUNCTION "accounts"."trigger_set_timestamps"();



CREATE OR REPLACE TRIGGER "set_account_settings_user_tracking" BEFORE INSERT OR UPDATE ON "public"."account_settings" FOR EACH ROW EXECUTE FUNCTION "accounts"."trigger_set_user_tracking"();



CREATE OR REPLACE TRIGGER "set_comments_timestamp" BEFORE INSERT OR UPDATE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "accounts"."trigger_set_timestamps"();



CREATE OR REPLACE TRIGGER "set_comments_user_tracking" BEFORE INSERT OR UPDATE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "accounts"."trigger_set_user_tracking"();



CREATE OR REPLACE TRIGGER "set_insights_timestamp" BEFORE INSERT OR UPDATE ON "public"."insights" FOR EACH ROW EXECUTE FUNCTION "accounts"."trigger_set_timestamps"();



CREATE OR REPLACE TRIGGER "set_insights_user_tracking" BEFORE INSERT OR UPDATE ON "public"."insights" FOR EACH ROW EXECUTE FUNCTION "accounts"."trigger_set_user_tracking"();



CREATE OR REPLACE TRIGGER "set_interview_people_timestamp" BEFORE INSERT OR UPDATE ON "public"."interview_people" FOR EACH ROW EXECUTE FUNCTION "accounts"."trigger_set_timestamps"();



CREATE OR REPLACE TRIGGER "set_interview_people_user_tracking" BEFORE INSERT OR UPDATE ON "public"."interview_people" FOR EACH ROW EXECUTE FUNCTION "accounts"."trigger_set_user_tracking"();



CREATE OR REPLACE TRIGGER "set_interviews_timestamp" BEFORE INSERT OR UPDATE ON "public"."interviews" FOR EACH ROW EXECUTE FUNCTION "accounts"."trigger_set_timestamps"();



CREATE OR REPLACE TRIGGER "set_interviews_user_tracking" BEFORE INSERT OR UPDATE ON "public"."interviews" FOR EACH ROW EXECUTE FUNCTION "accounts"."trigger_set_user_tracking"();



CREATE OR REPLACE TRIGGER "set_opportunities_timestamp" BEFORE INSERT OR UPDATE ON "public"."opportunities" FOR EACH ROW EXECUTE FUNCTION "accounts"."trigger_set_timestamps"();



CREATE OR REPLACE TRIGGER "set_opportunities_user_tracking" BEFORE INSERT OR UPDATE ON "public"."opportunities" FOR EACH ROW EXECUTE FUNCTION "accounts"."trigger_set_user_tracking"();



CREATE OR REPLACE TRIGGER "set_people_timestamp" BEFORE INSERT OR UPDATE ON "public"."people" FOR EACH ROW EXECUTE FUNCTION "accounts"."trigger_set_timestamps"();



CREATE OR REPLACE TRIGGER "set_people_user_tracking" BEFORE INSERT OR UPDATE ON "public"."people" FOR EACH ROW EXECUTE FUNCTION "accounts"."trigger_set_user_tracking"();



CREATE OR REPLACE TRIGGER "set_personas_timestamp" BEFORE INSERT OR UPDATE ON "public"."personas" FOR EACH ROW EXECUTE FUNCTION "accounts"."trigger_set_timestamps"();



CREATE OR REPLACE TRIGGER "set_personas_user_tracking" BEFORE INSERT OR UPDATE ON "public"."personas" FOR EACH ROW EXECUTE FUNCTION "accounts"."trigger_set_user_tracking"();



CREATE OR REPLACE TRIGGER "set_projects_timestamp" BEFORE INSERT OR UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "accounts"."trigger_set_timestamps"();



CREATE OR REPLACE TRIGGER "set_projects_user_tracking" BEFORE INSERT OR UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "accounts"."trigger_set_user_tracking"();



CREATE OR REPLACE TRIGGER "trg_enqueue_insight" AFTER INSERT OR UPDATE ON "public"."insights" FOR EACH ROW EXECUTE FUNCTION "public"."enqueue_insight_embedding"();



CREATE OR REPLACE TRIGGER "trg_enqueue_transcribe_interview" AFTER INSERT OR UPDATE ON "public"."interviews" FOR EACH ROW EXECUTE FUNCTION "public"."enqueue_transcribe_interview"();



CREATE OR REPLACE TRIGGER "trigger_auto_link_persona_insights_on_insert" AFTER INSERT ON "public"."insights" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_auto_link_persona_insights"();



CREATE OR REPLACE TRIGGER "trigger_update_project_people_on_interview_people" AFTER INSERT OR DELETE OR UPDATE ON "public"."interview_people" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_update_project_people"();



ALTER TABLE ONLY "accounts"."account_user"
    ADD CONSTRAINT "account_user_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "accounts"."account_user"
    ADD CONSTRAINT "account_user_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "accounts"."accounts"
    ADD CONSTRAINT "accounts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "accounts"."accounts"
    ADD CONSTRAINT "accounts_primary_owner_user_id_fkey" FOREIGN KEY ("primary_owner_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "accounts"."accounts"
    ADD CONSTRAINT "accounts_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "accounts"."billing_customers"
    ADD CONSTRAINT "billing_customers_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "accounts"."billing_subscriptions"
    ADD CONSTRAINT "billing_subscriptions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "accounts"."billing_subscriptions"
    ADD CONSTRAINT "billing_subscriptions_billing_customer_id_fkey" FOREIGN KEY ("billing_customer_id") REFERENCES "accounts"."billing_customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "accounts"."invitations"
    ADD CONSTRAINT "invitations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "accounts"."invitations"
    ADD CONSTRAINT "invitations_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."account_settings"
    ADD CONSTRAINT "account_settings_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."account_settings"
    ADD CONSTRAINT "account_settings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."account_settings"
    ADD CONSTRAINT "account_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_insight_id_fkey" FOREIGN KEY ("insight_id") REFERENCES "public"."insights"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."insight_tags"
    ADD CONSTRAINT "insight_tags_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."insight_tags"
    ADD CONSTRAINT "insight_tags_insight_id_fkey" FOREIGN KEY ("insight_id") REFERENCES "public"."insights"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."insight_tags"
    ADD CONSTRAINT "insight_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."insights"
    ADD CONSTRAINT "insights_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."insights"
    ADD CONSTRAINT "insights_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id");



ALTER TABLE ONLY "public"."interview_people"
    ADD CONSTRAINT "interview_people_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."interview_people"
    ADD CONSTRAINT "interview_people_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interview_people"
    ADD CONSTRAINT "interview_people_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interview_people"
    ADD CONSTRAINT "interview_people_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."interview_tags"
    ADD CONSTRAINT "interview_tags_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."interview_tags"
    ADD CONSTRAINT "interview_tags_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interview_tags"
    ADD CONSTRAINT "interview_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interviews"
    ADD CONSTRAINT "interviews_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interviews"
    ADD CONSTRAINT "interviews_interviewer_id_fkey" FOREIGN KEY ("interviewer_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."interviews"
    ADD CONSTRAINT "interviews_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."opportunities"
    ADD CONSTRAINT "opportunities_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."opportunities"
    ADD CONSTRAINT "opportunities_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."opportunities"
    ADD CONSTRAINT "opportunities_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."opportunity_insights"
    ADD CONSTRAINT "opportunity_insights_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."opportunity_insights"
    ADD CONSTRAINT "opportunity_insights_insight_id_fkey" FOREIGN KEY ("insight_id") REFERENCES "public"."insights"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."opportunity_insights"
    ADD CONSTRAINT "opportunity_insights_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."persona_insights"
    ADD CONSTRAINT "persona_insights_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."persona_insights"
    ADD CONSTRAINT "persona_insights_insight_id_fkey" FOREIGN KEY ("insight_id") REFERENCES "public"."insights"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."persona_insights"
    ADD CONSTRAINT "persona_insights_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."personas"
    ADD CONSTRAINT "personas_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_people"
    ADD CONSTRAINT "project_people_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."project_people"
    ADD CONSTRAINT "project_people_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_people"
    ADD CONSTRAINT "project_people_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_people"
    ADD CONSTRAINT "project_people_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"."accounts"("id") ON DELETE CASCADE;



CREATE POLICY "Account users can be deleted by owners except primary account o" ON "accounts"."account_user" FOR DELETE TO "authenticated" USING ((("accounts"."has_role_on_account"("account_id", 'owner'::"accounts"."account_role") = true) AND ("user_id" <> ( SELECT "accounts"."primary_owner_user_id"
   FROM "accounts"."accounts"
  WHERE ("account_user"."account_id" = "accounts"."id")))));



CREATE POLICY "Accounts are viewable by members" ON "accounts"."accounts" FOR SELECT TO "authenticated" USING (("accounts"."has_role_on_account"("id") = true));



CREATE POLICY "Accounts are viewable by primary owner" ON "accounts"."accounts" FOR SELECT TO "authenticated" USING (("primary_owner_user_id" = "auth"."uid"()));



CREATE POLICY "Accounts can be edited by owners" ON "accounts"."accounts" FOR UPDATE TO "authenticated" USING (("accounts"."has_role_on_account"("id", 'owner'::"accounts"."account_role") = true));



CREATE POLICY "Can only view own billing customer data." ON "accounts"."billing_customers" FOR SELECT USING (("accounts"."has_role_on_account"("account_id") = true));



CREATE POLICY "Can only view own billing subscription data." ON "accounts"."billing_subscriptions" FOR SELECT USING (("accounts"."has_role_on_account"("account_id") = true));



CREATE POLICY "Invitations can be created by account owners" ON "accounts"."invitations" FOR INSERT TO "authenticated" WITH CHECK ((("accounts"."is_set"('enable_team_accounts'::"text") = true) AND (( SELECT "accounts"."personal_account"
   FROM "accounts"."accounts"
  WHERE ("accounts"."id" = "invitations"."account_id")) = false) AND ("accounts"."has_role_on_account"("account_id", 'owner'::"accounts"."account_role") = true)));



CREATE POLICY "Invitations can be deleted by account owners" ON "accounts"."invitations" FOR DELETE TO "authenticated" USING (("accounts"."has_role_on_account"("account_id", 'owner'::"accounts"."account_role") = true));



CREATE POLICY "Invitations viewable by account owners" ON "accounts"."invitations" FOR SELECT TO "authenticated" USING ((("created_at" > ("now"() - '24:00:00'::interval)) AND ("accounts"."has_role_on_account"("account_id", 'owner'::"accounts"."account_role") = true)));



CREATE POLICY "Team accounts can be created by any user" ON "accounts"."accounts" FOR INSERT TO "authenticated" WITH CHECK ((("accounts"."is_set"('enable_team_accounts'::"text") = true) AND ("personal_account" = false)));



ALTER TABLE "accounts"."account_user" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "accounts"."accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "accounts settings can be read by authenticated users" ON "accounts"."config" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "accounts"."billing_customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "accounts"."billing_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "accounts"."config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "accounts"."invitations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users can view their own account_users" ON "accounts"."account_user" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users can view their teammates" ON "accounts"."account_user" FOR SELECT TO "authenticated" USING (("accounts"."has_role_on_account"("account_id") = true));



CREATE POLICY "Account members can insert" ON "public"."account_settings" FOR INSERT TO "authenticated" WITH CHECK (("account_id" IN ( SELECT "accounts"."get_accounts_with_role"() AS "get_accounts_with_role")));



CREATE POLICY "Account members can insert" ON "public"."comments" FOR INSERT TO "authenticated" WITH CHECK (("account_id" IN ( SELECT "accounts"."get_accounts_with_role"() AS "get_accounts_with_role")));



CREATE POLICY "Account members can insert" ON "public"."insights" FOR INSERT TO "authenticated" WITH CHECK (("account_id" IN ( SELECT "accounts"."get_accounts_with_role"() AS "get_accounts_with_role")));



CREATE POLICY "Account members can insert" ON "public"."interview_people" FOR INSERT TO "authenticated" WITH CHECK (("interview_id" IN ( SELECT "interviews"."id"
   FROM "public"."interviews"
  WHERE ("interviews"."account_id" IN ( SELECT "accounts"."get_accounts_with_role"() AS "get_accounts_with_role")))));



CREATE POLICY "Account members can insert" ON "public"."interviews" FOR INSERT TO "authenticated" WITH CHECK (("account_id" IN ( SELECT "accounts"."get_accounts_with_role"() AS "get_accounts_with_role")));



CREATE POLICY "Account members can insert" ON "public"."opportunities" FOR INSERT TO "authenticated" WITH CHECK (("account_id" IN ( SELECT "accounts"."get_accounts_with_role"() AS "get_accounts_with_role")));



CREATE POLICY "Account members can insert" ON "public"."people" FOR INSERT TO "authenticated" WITH CHECK (("account_id" IN ( SELECT "accounts"."get_accounts_with_role"() AS "get_accounts_with_role")));



CREATE POLICY "Account members can insert" ON "public"."personas" FOR INSERT TO "authenticated" WITH CHECK (("account_id" IN ( SELECT "accounts"."get_accounts_with_role"() AS "get_accounts_with_role")));



CREATE POLICY "Account members can insert" ON "public"."projects" FOR INSERT TO "authenticated" WITH CHECK (("account_id" IN ( SELECT "accounts"."get_accounts_with_role"() AS "get_accounts_with_role")));



CREATE POLICY "Account members can select" ON "public"."account_settings" FOR SELECT TO "authenticated" USING (("account_id" IN ( SELECT "accounts"."get_accounts_with_role"() AS "get_accounts_with_role")));



CREATE POLICY "Account members can select" ON "public"."comments" FOR SELECT TO "authenticated" USING (("account_id" IN ( SELECT "accounts"."get_accounts_with_role"() AS "get_accounts_with_role")));



CREATE POLICY "Account members can select" ON "public"."insights" FOR SELECT TO "authenticated" USING (("account_id" IN ( SELECT "accounts"."get_accounts_with_role"() AS "get_accounts_with_role")));



CREATE POLICY "Account members can select" ON "public"."interview_people" FOR SELECT TO "authenticated" USING (("interview_id" IN ( SELECT "interviews"."id"
   FROM "public"."interviews"
  WHERE ("interviews"."account_id" IN ( SELECT "accounts"."get_accounts_with_role"() AS "get_accounts_with_role")))));



CREATE POLICY "Account members can select" ON "public"."interviews" FOR SELECT TO "authenticated" USING (("account_id" IN ( SELECT "accounts"."get_accounts_with_role"() AS "get_accounts_with_role")));



CREATE POLICY "Account members can select" ON "public"."opportunities" FOR SELECT TO "authenticated" USING (("account_id" IN ( SELECT "accounts"."get_accounts_with_role"() AS "get_accounts_with_role")));



CREATE POLICY "Account members can select" ON "public"."people" FOR SELECT TO "authenticated" USING (("account_id" IN ( SELECT "accounts"."get_accounts_with_role"() AS "get_accounts_with_role")));



CREATE POLICY "Account members can select" ON "public"."personas" FOR SELECT TO "authenticated" USING (("account_id" IN ( SELECT "accounts"."get_accounts_with_role"() AS "get_accounts_with_role")));



CREATE POLICY "Account members can select" ON "public"."projects" FOR SELECT TO "authenticated" USING (("account_id" IN ( SELECT "accounts"."get_accounts_with_role"() AS "get_accounts_with_role")));



CREATE POLICY "Account members can update" ON "public"."account_settings" FOR UPDATE TO "authenticated" USING (("account_id" IN ( SELECT "accounts"."get_accounts_with_role"() AS "get_accounts_with_role")));



CREATE POLICY "Account members can update" ON "public"."insights" FOR UPDATE TO "authenticated" USING (("account_id" IN ( SELECT "accounts"."get_accounts_with_role"() AS "get_accounts_with_role")));



CREATE POLICY "Account members can update" ON "public"."interview_people" FOR UPDATE TO "authenticated" USING (("interview_id" IN ( SELECT "interviews"."id"
   FROM "public"."interviews"
  WHERE ("interviews"."account_id" IN ( SELECT "accounts"."get_accounts_with_role"() AS "get_accounts_with_role")))));



CREATE POLICY "Account members can update" ON "public"."interviews" FOR UPDATE TO "authenticated" USING (("account_id" IN ( SELECT "accounts"."get_accounts_with_role"() AS "get_accounts_with_role")));



CREATE POLICY "Account members can update" ON "public"."opportunities" FOR UPDATE TO "authenticated" USING (("account_id" IN ( SELECT "accounts"."get_accounts_with_role"() AS "get_accounts_with_role")));



CREATE POLICY "Account members can update" ON "public"."people" FOR UPDATE TO "authenticated" USING (("account_id" IN ( SELECT "accounts"."get_accounts_with_role"() AS "get_accounts_with_role")));



CREATE POLICY "Account members can update" ON "public"."personas" FOR UPDATE TO "authenticated" USING (("account_id" IN ( SELECT "accounts"."get_accounts_with_role"() AS "get_accounts_with_role")));



CREATE POLICY "Account members can update" ON "public"."projects" FOR UPDATE TO "authenticated" USING (("account_id" IN ( SELECT "accounts"."get_accounts_with_role"() AS "get_accounts_with_role")));



CREATE POLICY "Account owners can delete" ON "public"."account_settings" FOR DELETE TO "authenticated" USING (("account_id" IN ( SELECT "accounts"."get_accounts_with_role"('owner'::"accounts"."account_role") AS "get_accounts_with_role")));



CREATE POLICY "Account owners can delete" ON "public"."comments" FOR DELETE TO "authenticated" USING (("account_id" IN ( SELECT "accounts"."get_accounts_with_role"('owner'::"accounts"."account_role") AS "get_accounts_with_role")));



CREATE POLICY "Account owners can delete" ON "public"."insights" FOR DELETE TO "authenticated" USING (("account_id" IN ( SELECT "accounts"."get_accounts_with_role"('owner'::"accounts"."account_role") AS "get_accounts_with_role")));



CREATE POLICY "Account owners can delete" ON "public"."interview_people" FOR DELETE TO "authenticated" USING (("interview_id" IN ( SELECT "interviews"."id"
   FROM "public"."interviews"
  WHERE ("interviews"."account_id" IN ( SELECT "accounts"."get_accounts_with_role"('owner'::"accounts"."account_role") AS "get_accounts_with_role")))));



CREATE POLICY "Account owners can delete" ON "public"."interviews" FOR DELETE TO "authenticated" USING (("account_id" IN ( SELECT "accounts"."get_accounts_with_role"('owner'::"accounts"."account_role") AS "get_accounts_with_role")));



CREATE POLICY "Account owners can delete" ON "public"."opportunities" FOR DELETE TO "authenticated" USING (("account_id" IN ( SELECT "accounts"."get_accounts_with_role"('owner'::"accounts"."account_role") AS "get_accounts_with_role")));



CREATE POLICY "Account owners can delete" ON "public"."people" FOR DELETE TO "authenticated" USING (("account_id" IN ( SELECT "accounts"."get_accounts_with_role"('owner'::"accounts"."account_role") AS "get_accounts_with_role")));



CREATE POLICY "Account owners can delete" ON "public"."personas" FOR DELETE TO "authenticated" USING (("account_id" IN ( SELECT "accounts"."get_accounts_with_role"('owner'::"accounts"."account_role") AS "get_accounts_with_role")));



CREATE POLICY "Account owners can delete" ON "public"."projects" FOR DELETE TO "authenticated" USING (("account_id" IN ( SELECT "accounts"."get_accounts_with_role"('owner'::"accounts"."account_role") AS "get_accounts_with_role")));



CREATE POLICY "Comment authors can update their own comments" ON "public"."comments" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete insight_tags for their account" ON "public"."insight_tags" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."insights" "i"
  WHERE (("i"."id" = "insight_tags"."insight_id") AND ("i"."account_id" IN ( SELECT "account_user"."account_id"
           FROM "accounts"."account_user"
          WHERE ("account_user"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can delete interview_tags for their account" ON "public"."interview_tags" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."interviews" "i"
  WHERE (("i"."id" = "interview_tags"."interview_id") AND ("i"."account_id" IN ( SELECT "account_user"."account_id"
           FROM "accounts"."account_user"
          WHERE ("account_user"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can delete opportunity_insights for their account" ON "public"."opportunity_insights" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."opportunities" "o"
  WHERE (("o"."id" = "opportunity_insights"."opportunity_id") AND ("o"."account_id" IN ( SELECT "account_user"."account_id"
           FROM "accounts"."account_user"
          WHERE ("account_user"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can delete persona_insights for their account" ON "public"."persona_insights" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."personas" "p"
  WHERE (("p"."id" = "persona_insights"."persona_id") AND ("p"."account_id" IN ( SELECT "account_user"."account_id"
           FROM "accounts"."account_user"
          WHERE ("account_user"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can delete project_people for their account" ON "public"."project_people" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "project_people"."project_id") AND ("p"."account_id" IN ( SELECT "account_user"."account_id"
           FROM "accounts"."account_user"
          WHERE ("account_user"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can insert insight_tags for their account" ON "public"."insight_tags" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."insights" "i"
  WHERE (("i"."id" = "insight_tags"."insight_id") AND ("i"."account_id" IN ( SELECT "account_user"."account_id"
           FROM "accounts"."account_user"
          WHERE ("account_user"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can insert interview_tags for their account" ON "public"."interview_tags" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."interviews" "i"
  WHERE (("i"."id" = "interview_tags"."interview_id") AND ("i"."account_id" IN ( SELECT "account_user"."account_id"
           FROM "accounts"."account_user"
          WHERE ("account_user"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can insert opportunity_insights for their account" ON "public"."opportunity_insights" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."opportunities" "o"
  WHERE (("o"."id" = "opportunity_insights"."opportunity_id") AND ("o"."account_id" IN ( SELECT "account_user"."account_id"
           FROM "accounts"."account_user"
          WHERE ("account_user"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can insert persona_insights for their account" ON "public"."persona_insights" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."personas" "p"
  WHERE (("p"."id" = "persona_insights"."persona_id") AND ("p"."account_id" IN ( SELECT "account_user"."account_id"
           FROM "accounts"."account_user"
          WHERE ("account_user"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can insert project_people for their account" ON "public"."project_people" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "project_people"."project_id") AND ("p"."account_id" IN ( SELECT "account_user"."account_id"
           FROM "accounts"."account_user"
          WHERE ("account_user"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can update insight_tags for their account" ON "public"."insight_tags" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."insights" "i"
  WHERE (("i"."id" = "insight_tags"."insight_id") AND ("i"."account_id" IN ( SELECT "account_user"."account_id"
           FROM "accounts"."account_user"
          WHERE ("account_user"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can update interview_tags for their account" ON "public"."interview_tags" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."interviews" "i"
  WHERE (("i"."id" = "interview_tags"."interview_id") AND ("i"."account_id" IN ( SELECT "account_user"."account_id"
           FROM "accounts"."account_user"
          WHERE ("account_user"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can update opportunity_insights for their account" ON "public"."opportunity_insights" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."opportunities" "o"
  WHERE (("o"."id" = "opportunity_insights"."opportunity_id") AND ("o"."account_id" IN ( SELECT "account_user"."account_id"
           FROM "accounts"."account_user"
          WHERE ("account_user"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can update persona_insights for their account" ON "public"."persona_insights" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."personas" "p"
  WHERE (("p"."id" = "persona_insights"."persona_id") AND ("p"."account_id" IN ( SELECT "account_user"."account_id"
           FROM "accounts"."account_user"
          WHERE ("account_user"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can update project_people for their account" ON "public"."project_people" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "project_people"."project_id") AND ("p"."account_id" IN ( SELECT "account_user"."account_id"
           FROM "accounts"."account_user"
          WHERE ("account_user"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can view insight_tags for their account" ON "public"."insight_tags" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."insights" "i"
  WHERE (("i"."id" = "insight_tags"."insight_id") AND ("i"."account_id" IN ( SELECT "account_user"."account_id"
           FROM "accounts"."account_user"
          WHERE ("account_user"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can view interview_tags for their account" ON "public"."interview_tags" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."interviews" "i"
  WHERE (("i"."id" = "interview_tags"."interview_id") AND ("i"."account_id" IN ( SELECT "account_user"."account_id"
           FROM "accounts"."account_user"
          WHERE ("account_user"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can view opportunity_insights for their account" ON "public"."opportunity_insights" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."opportunities" "o"
  WHERE (("o"."id" = "opportunity_insights"."opportunity_id") AND ("o"."account_id" IN ( SELECT "account_user"."account_id"
           FROM "accounts"."account_user"
          WHERE ("account_user"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can view persona_insights for their account" ON "public"."persona_insights" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."personas" "p"
  WHERE (("p"."id" = "persona_insights"."persona_id") AND ("p"."account_id" IN ( SELECT "account_user"."account_id"
           FROM "accounts"."account_user"
          WHERE ("account_user"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can view project_people for their account" ON "public"."project_people" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "project_people"."project_id") AND ("p"."account_id" IN ( SELECT "account_user"."account_id"
           FROM "accounts"."account_user"
          WHERE ("account_user"."user_id" = "auth"."uid"())))))));



ALTER TABLE "public"."account_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."insight_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."insights" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."interview_people" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."interview_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."interviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."opportunities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."opportunity_insights" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."people" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."persona_insights" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."personas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_people" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "service_role";







































































































































































































































GRANT ALL ON FUNCTION "public"."accept_invitation"("lookup_invitation_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_invitation"("lookup_invitation_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_invitation"("lookup_invitation_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_link_persona_insights"("p_insight_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."auto_link_persona_insights"("p_insight_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_link_persona_insights"("p_insight_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_account"("slug" "text", "name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_account"("slug" "text", "name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_account"("slug" "text", "name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_invitation"("account_id" "uuid", "account_role" "accounts"."account_role", "invitation_type" "accounts"."invitation_type") TO "anon";
GRANT ALL ON FUNCTION "public"."create_invitation"("account_id" "uuid", "account_role" "accounts"."account_role", "invitation_type" "accounts"."invitation_type") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_invitation"("account_id" "uuid", "account_role" "accounts"."account_role", "invitation_type" "accounts"."invitation_type") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_account_role"("account_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_account_role"("account_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_account_role"("account_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_invitation"("invitation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_invitation"("invitation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_invitation"("invitation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_insight_embedding"() TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_insight_embedding"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_insight_embedding"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_transcribe_interview"() TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_transcribe_interview"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_transcribe_interview"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_account"("account_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_account"("account_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_account"("account_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_account_billing_status"("account_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_account_billing_status"("account_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_account_billing_status"("account_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_account_by_slug"("slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_account_by_slug"("slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_account_by_slug"("slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_account_id"("slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_account_id"("slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_account_id"("slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_account_invitations"("account_id" "uuid", "results_limit" integer, "results_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_account_invitations"("account_id" "uuid", "results_limit" integer, "results_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_account_invitations"("account_id" "uuid", "results_limit" integer, "results_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_account_members"("account_id" "uuid", "results_limit" integer, "results_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_account_members"("account_id" "uuid", "results_limit" integer, "results_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_account_members"("account_id" "uuid", "results_limit" integer, "results_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_accounts"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_accounts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_accounts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_personal_account"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_personal_account"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_personal_account"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_accounts"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_accounts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_accounts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."invoke_edge_function"("func_name" "text", "payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."invoke_edge_function"("func_name" "text", "payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."invoke_edge_function"("func_name" "text", "payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."link_insight_to_personas"("p_insight_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."link_insight_to_personas"("p_insight_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_insight_to_personas"("p_insight_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."lookup_invitation"("lookup_invitation_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."lookup_invitation"("lookup_invitation_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lookup_invitation"("lookup_invitation_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_embedding_queue"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_embedding_queue"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_embedding_queue"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_transcribe_queue"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_transcribe_queue"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_transcribe_queue"() TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_account_member"("account_id" "uuid", "user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_account_member"("account_id" "uuid", "user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_account_member"("account_id" "uuid", "user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."service_role_upsert_customer_subscription"("account_id" "uuid", "customer" "jsonb", "subscription" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."service_role_upsert_customer_subscription"("account_id" "uuid", "customer" "jsonb", "subscription" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."service_role_upsert_customer_subscription"("account_id" "uuid", "customer" "jsonb", "subscription" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_insight_tags"("p_insight_id" "uuid", "p_tag_names" "text"[], "p_account_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_insight_tags"("p_insight_id" "uuid", "p_tag_names" "text"[], "p_account_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_insight_tags"("p_insight_id" "uuid", "p_tag_names" "text"[], "p_account_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_opportunity_insights"("p_opportunity_id" "uuid", "p_insight_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sync_opportunity_insights"("p_opportunity_id" "uuid", "p_insight_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_opportunity_insights"("p_opportunity_id" "uuid", "p_insight_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_auto_link_persona_insights"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_auto_link_persona_insights"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_auto_link_persona_insights"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_update_project_people"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_update_project_people"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_update_project_people"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_account"("account_id" "uuid", "slug" "text", "name" "text", "public_metadata" "jsonb", "replace_metadata" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."update_account"("account_id" "uuid", "slug" "text", "name" "text", "public_metadata" "jsonb", "replace_metadata" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_account"("account_id" "uuid", "slug" "text", "name" "text", "public_metadata" "jsonb", "replace_metadata" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_account_user_role"("account_id" "uuid", "user_id" "uuid", "new_account_role" "accounts"."account_role", "make_primary_owner" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."update_account_user_role"("account_id" "uuid", "user_id" "uuid", "new_account_role" "accounts"."account_role", "make_primary_owner" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_account_user_role"("account_id" "uuid", "user_id" "uuid", "new_account_role" "accounts"."account_role", "make_primary_owner" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_project_people_stats"("p_project_id" "uuid", "p_person_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_project_people_stats"("p_project_id" "uuid", "p_person_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_project_people_stats"("p_project_id" "uuid", "p_person_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "service_role";












GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "accounts"."account_user" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "accounts"."account_user" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "accounts"."accounts" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "accounts"."accounts" TO "service_role";



GRANT SELECT ON TABLE "accounts"."billing_customers" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "accounts"."billing_customers" TO "service_role";



GRANT SELECT ON TABLE "accounts"."billing_subscriptions" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "accounts"."billing_subscriptions" TO "service_role";



GRANT SELECT ON TABLE "accounts"."config" TO "authenticated";
GRANT SELECT ON TABLE "accounts"."config" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "accounts"."invitations" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "accounts"."invitations" TO "service_role";















GRANT ALL ON TABLE "public"."account_settings" TO "anon";
GRANT ALL ON TABLE "public"."account_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."account_settings" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."insight_tags" TO "anon";
GRANT ALL ON TABLE "public"."insight_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."insight_tags" TO "service_role";



GRANT ALL ON TABLE "public"."insights" TO "anon";
GRANT ALL ON TABLE "public"."insights" TO "authenticated";
GRANT ALL ON TABLE "public"."insights" TO "service_role";



GRANT ALL ON TABLE "public"."interview_people" TO "anon";
GRANT ALL ON TABLE "public"."interview_people" TO "authenticated";
GRANT ALL ON TABLE "public"."interview_people" TO "service_role";



GRANT ALL ON TABLE "public"."interview_tags" TO "anon";
GRANT ALL ON TABLE "public"."interview_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."interview_tags" TO "service_role";



GRANT ALL ON TABLE "public"."interviews" TO "anon";
GRANT ALL ON TABLE "public"."interviews" TO "authenticated";
GRANT ALL ON TABLE "public"."interviews" TO "service_role";



GRANT ALL ON TABLE "public"."opportunities" TO "anon";
GRANT ALL ON TABLE "public"."opportunities" TO "authenticated";
GRANT ALL ON TABLE "public"."opportunities" TO "service_role";



GRANT ALL ON TABLE "public"."opportunity_insights" TO "anon";
GRANT ALL ON TABLE "public"."opportunity_insights" TO "authenticated";
GRANT ALL ON TABLE "public"."opportunity_insights" TO "service_role";



GRANT ALL ON TABLE "public"."people" TO "anon";
GRANT ALL ON TABLE "public"."people" TO "authenticated";
GRANT ALL ON TABLE "public"."people" TO "service_role";



GRANT ALL ON TABLE "public"."personas" TO "anon";
GRANT ALL ON TABLE "public"."personas" TO "authenticated";
GRANT ALL ON TABLE "public"."personas" TO "service_role";



GRANT ALL ON TABLE "public"."persona_distribution" TO "anon";
GRANT ALL ON TABLE "public"."persona_distribution" TO "authenticated";
GRANT ALL ON TABLE "public"."persona_distribution" TO "service_role";



GRANT ALL ON TABLE "public"."persona_insights" TO "anon";
GRANT ALL ON TABLE "public"."persona_insights" TO "authenticated";
GRANT ALL ON TABLE "public"."persona_insights" TO "service_role";



GRANT ALL ON TABLE "public"."project_people" TO "anon";
GRANT ALL ON TABLE "public"."project_people" TO "authenticated";
GRANT ALL ON TABLE "public"."project_people" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."tags" TO "anon";
GRANT ALL ON TABLE "public"."tags" TO "authenticated";
GRANT ALL ON TABLE "public"."tags" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
