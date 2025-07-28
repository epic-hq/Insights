

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


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



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

SET default_tablespace = '';

SET default_table_access_method = "heap";


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
    "persona" "text",
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
    "name_hash" "text" GENERATED ALWAYS AS ("lower"("name")) STORED
);


ALTER TABLE "public"."people" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."people_personas" (
    "person_id" "uuid" NOT NULL,
    "persona_id" "uuid" NOT NULL,
    "interview_id" "uuid",
    "project_id" "uuid",
    "confidence_score" real DEFAULT 1.0,
    "source" "text",
    "assigned_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."people_personas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."personas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "percentage" numeric,
    "color_hex" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "image_url" "text"
);


ALTER TABLE "public"."personas" OWNER TO "postgres";


COMMENT ON COLUMN "public"."personas"."image_url" IS 'URL to persona avatar/profile image';



CREATE OR REPLACE VIEW "public"."persona_distribution" AS
 WITH "participant_counts" AS (
         SELECT "p"."id" AS "persona_id",
            "p"."account_id",
            "p"."name" AS "persona_name",
            "p"."color_hex",
            "p"."description",
            "p"."created_at",
            "p"."updated_at",
            "count"("i1"."id") AS "participant_interview_count",
            ( SELECT "count"(*) AS "count"
                   FROM "public"."interviews" "i_total"
                  WHERE (("i_total"."account_id" = "p"."account_id") AND ("i_total"."participant_pseudonym" IS NOT NULL))) AS "total_participant_interviews"
           FROM ("public"."personas" "p"
             LEFT JOIN "public"."interviews" "i1" ON ((("i1"."account_id" = "p"."account_id") AND ("i1"."participant_pseudonym" = "p"."name"))))
          GROUP BY "p"."id", "p"."account_id", "p"."name", "p"."color_hex", "p"."description", "p"."created_at", "p"."updated_at"
        ), "segment_counts" AS (
         SELECT "p"."id" AS "persona_id",
            "count"("i2"."id") AS "segment_interview_count",
            ( SELECT "count"(*) AS "count"
                   FROM "public"."interviews" "i_total"
                  WHERE (("i_total"."account_id" = "p"."account_id") AND ("i_total"."segment" IS NOT NULL))) AS "total_segment_interviews"
           FROM ("public"."personas" "p"
             LEFT JOIN "public"."interviews" "i2" ON ((("i2"."account_id" = "p"."account_id") AND ("i2"."segment" = "p"."name"))))
          GROUP BY "p"."id", "p"."account_id"
        )
 SELECT "pc"."persona_id",
    "pc"."account_id",
    "pc"."persona_name",
    "pc"."color_hex",
    "pc"."description",
    "pc"."created_at",
    "pc"."updated_at",
    "pc"."participant_interview_count",
    "pc"."total_participant_interviews",
        CASE
            WHEN ("pc"."total_participant_interviews" > 0) THEN "round"(((("pc"."participant_interview_count")::numeric / ("pc"."total_participant_interviews")::numeric) * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS "participant_percentage",
    "sc"."segment_interview_count",
    "sc"."total_segment_interviews",
        CASE
            WHEN ("sc"."total_segment_interviews" > 0) THEN "round"(((("sc"."segment_interview_count")::numeric / ("sc"."total_segment_interviews")::numeric) * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS "segment_percentage"
   FROM ("participant_counts" "pc"
     JOIN "segment_counts" "sc" ON (("pc"."persona_id" = "sc"."persona_id")))
  ORDER BY "pc"."account_id", "pc"."participant_interview_count" DESC;


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



ALTER TABLE ONLY "public"."people_personas"
    ADD CONSTRAINT "people_personas_pkey" PRIMARY KEY ("person_id", "persona_id");



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
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_account_settings_account_id" ON "public"."account_settings" USING "btree" ("account_id");



CREATE INDEX "idx_comments_account_id" ON "public"."comments" USING "btree" ("account_id");



CREATE INDEX "idx_comments_insight_id" ON "public"."comments" USING "btree" ("insight_id");



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



CREATE INDEX "idx_people_personas_person_id" ON "public"."people_personas" USING "btree" ("person_id");



CREATE INDEX "idx_people_personas_persona_id" ON "public"."people_personas" USING "btree" ("persona_id");



CREATE INDEX "idx_people_personas_project_id" ON "public"."people_personas" USING "btree" ("project_id");



CREATE INDEX "idx_persona_insights_insight_id" ON "public"."persona_insights" USING "btree" ("insight_id");



CREATE INDEX "idx_persona_insights_persona_id" ON "public"."persona_insights" USING "btree" ("persona_id");



CREATE INDEX "idx_personas_account_id" ON "public"."personas" USING "btree" ("account_id");



CREATE INDEX "idx_project_people_person_id" ON "public"."project_people" USING "btree" ("person_id");



CREATE INDEX "idx_project_people_project_id" ON "public"."project_people" USING "btree" ("project_id");



CREATE INDEX "idx_projects_account_id" ON "public"."projects" USING "btree" ("account_id");



CREATE INDEX "idx_projects_title" ON "public"."projects" USING "btree" ("title");



CREATE INDEX "idx_tags_account_id" ON "public"."tags" USING "btree" ("account_id");



CREATE UNIQUE INDEX "uniq_people_account_namehash" ON "public"."people" USING "btree" ("account_id", "name_hash");



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



ALTER TABLE ONLY "public"."people_personas"
    ADD CONSTRAINT "people_personas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."people_personas"
    ADD CONSTRAINT "people_personas_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."people_personas"
    ADD CONSTRAINT "people_personas_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."people_personas"
    ADD CONSTRAINT "people_personas_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."people_personas"
    ADD CONSTRAINT "people_personas_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



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



CREATE POLICY "Users can delete people_personas for their account" ON "public"."people_personas" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."people" "p"
  WHERE (("p"."id" = "people_personas"."person_id") AND ("p"."account_id" IN ( SELECT "account_user"."account_id"
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



CREATE POLICY "Users can modify people_personas for their account" ON "public"."people_personas" USING ((EXISTS ( SELECT 1
   FROM "public"."people" "pe"
  WHERE (("pe"."id" = "people_personas"."person_id") AND ("pe"."account_id" IN ( SELECT "account_user"."account_id"
           FROM "accounts"."account_user"
          WHERE ("account_user"."user_id" = "auth"."uid"()))))))) WITH CHECK (true);



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



CREATE POLICY "Users can view people_personas for their account" ON "public"."people_personas" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."people" "pe"
  WHERE (("pe"."id" = "people_personas"."person_id") AND ("pe"."account_id" IN ( SELECT "account_user"."account_id"
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


ALTER TABLE "public"."people_personas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."persona_insights" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."personas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_people" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."accept_invitation"("lookup_invitation_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_invitation"("lookup_invitation_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_invitation"("lookup_invitation_token" "text") TO "service_role";



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



GRANT ALL ON FUNCTION "public"."invoke_edge_function"("func_name" "text", "payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."invoke_edge_function"("func_name" "text", "payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."invoke_edge_function"("func_name" "text", "payload" "jsonb") TO "service_role";



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



GRANT ALL ON FUNCTION "public"."update_account"("account_id" "uuid", "slug" "text", "name" "text", "public_metadata" "jsonb", "replace_metadata" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."update_account"("account_id" "uuid", "slug" "text", "name" "text", "public_metadata" "jsonb", "replace_metadata" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_account"("account_id" "uuid", "slug" "text", "name" "text", "public_metadata" "jsonb", "replace_metadata" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_account_user_role"("account_id" "uuid", "user_id" "uuid", "new_account_role" "accounts"."account_role", "make_primary_owner" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."update_account_user_role"("account_id" "uuid", "user_id" "uuid", "new_account_role" "accounts"."account_role", "make_primary_owner" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_account_user_role"("account_id" "uuid", "user_id" "uuid", "new_account_role" "accounts"."account_role", "make_primary_owner" boolean) TO "service_role";



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



GRANT ALL ON TABLE "public"."people_personas" TO "anon";
GRANT ALL ON TABLE "public"."people_personas" TO "authenticated";
GRANT ALL ON TABLE "public"."people_personas" TO "service_role";



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
