create table "public"."annotations" (
    "id" uuid not null default gen_random_uuid(),
    "account_id" uuid not null,
    "project_id" uuid not null,
    "entity_type" text not null,
    "entity_id" uuid not null,
    "annotation_type" text not null,
    "content" text,
    "metadata" jsonb default '{}'::jsonb,
    "created_by_user_id" uuid,
    "created_by_ai" boolean default false,
    "ai_model" text,
    "status" text default 'active'::text,
    "visibility" text default 'team'::text,
    "parent_annotation_id" uuid,
    "thread_root_id" uuid,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."annotations" enable row level security;

create table "public"."entity_flags" (
    "id" uuid not null default gen_random_uuid(),
    "account_id" uuid not null,
    "project_id" uuid not null,
    "entity_type" text not null,
    "entity_id" uuid not null,
    "user_id" uuid not null,
    "flag_type" text not null,
    "flag_value" boolean default true,
    "metadata" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."entity_flags" enable row level security;

create table "public"."votes" (
    "id" uuid not null default gen_random_uuid(),
    "account_id" uuid not null,
    "project_id" uuid not null,
    "entity_type" text not null,
    "entity_id" uuid not null,
    "user_id" uuid not null,
    "vote_value" integer not null,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."votes" enable row level security;

CREATE UNIQUE INDEX annotations_pkey ON public.annotations USING btree (id);

CREATE UNIQUE INDEX entity_flags_pkey ON public.entity_flags USING btree (id);

CREATE UNIQUE INDEX entity_flags_user_id_entity_type_entity_id_flag_type_key ON public.entity_flags USING btree (user_id, entity_type, entity_id, flag_type);

CREATE INDEX idx_annotations_entity ON public.annotations USING btree (entity_type, entity_id);

CREATE INDEX idx_annotations_project ON public.annotations USING btree (project_id);

CREATE INDEX idx_annotations_thread ON public.annotations USING btree (thread_root_id);

CREATE INDEX idx_annotations_type ON public.annotations USING btree (annotation_type);

CREATE INDEX idx_annotations_user ON public.annotations USING btree (created_by_user_id);

CREATE INDEX idx_entity_flags_entity ON public.entity_flags USING btree (entity_type, entity_id);

CREATE INDEX idx_entity_flags_project ON public.entity_flags USING btree (project_id);

CREATE INDEX idx_entity_flags_user ON public.entity_flags USING btree (user_id, flag_type);

CREATE INDEX idx_votes_entity ON public.votes USING btree (entity_type, entity_id);

CREATE INDEX idx_votes_project ON public.votes USING btree (project_id);

CREATE INDEX idx_votes_user ON public.votes USING btree (user_id);

CREATE UNIQUE INDEX votes_pkey ON public.votes USING btree (id);

CREATE UNIQUE INDEX votes_user_id_entity_type_entity_id_key ON public.votes USING btree (user_id, entity_type, entity_id);

alter table "public"."annotations" add constraint "annotations_pkey" PRIMARY KEY using index "annotations_pkey";

alter table "public"."entity_flags" add constraint "entity_flags_pkey" PRIMARY KEY using index "entity_flags_pkey";

alter table "public"."votes" add constraint "votes_pkey" PRIMARY KEY using index "votes_pkey";

alter table "public"."annotations" add constraint "annotations_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts.accounts(id) ON DELETE CASCADE not valid;

alter table "public"."annotations" validate constraint "annotations_account_id_fkey";

alter table "public"."annotations" add constraint "annotations_annotation_type_check" CHECK ((annotation_type = ANY (ARRAY['comment'::text, 'ai_suggestion'::text, 'flag'::text, 'note'::text, 'todo'::text, 'reaction'::text]))) not valid;

alter table "public"."annotations" validate constraint "annotations_annotation_type_check";

alter table "public"."annotations" add constraint "annotations_created_by_user_id_fkey" FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."annotations" validate constraint "annotations_created_by_user_id_fkey";

alter table "public"."annotations" add constraint "annotations_entity_type_check" CHECK ((entity_type = ANY (ARRAY['insight'::text, 'persona'::text, 'opportunity'::text, 'interview'::text, 'person'::text]))) not valid;

alter table "public"."annotations" validate constraint "annotations_entity_type_check";

alter table "public"."annotations" add constraint "annotations_parent_annotation_id_fkey" FOREIGN KEY (parent_annotation_id) REFERENCES annotations(id) ON DELETE CASCADE not valid;

alter table "public"."annotations" validate constraint "annotations_parent_annotation_id_fkey";

alter table "public"."annotations" add constraint "annotations_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."annotations" validate constraint "annotations_project_id_fkey";

alter table "public"."annotations" add constraint "annotations_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text, 'deleted'::text]))) not valid;

alter table "public"."annotations" validate constraint "annotations_status_check";

alter table "public"."annotations" add constraint "annotations_thread_root_id_fkey" FOREIGN KEY (thread_root_id) REFERENCES annotations(id) ON DELETE CASCADE not valid;

alter table "public"."annotations" validate constraint "annotations_thread_root_id_fkey";

alter table "public"."annotations" add constraint "annotations_visibility_check" CHECK ((visibility = ANY (ARRAY['private'::text, 'team'::text, 'public'::text]))) not valid;

alter table "public"."annotations" validate constraint "annotations_visibility_check";

alter table "public"."entity_flags" add constraint "entity_flags_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts.accounts(id) ON DELETE CASCADE not valid;

alter table "public"."entity_flags" validate constraint "entity_flags_account_id_fkey";

alter table "public"."entity_flags" add constraint "entity_flags_entity_type_check" CHECK ((entity_type = ANY (ARRAY['insight'::text, 'persona'::text, 'opportunity'::text, 'interview'::text, 'person'::text]))) not valid;

alter table "public"."entity_flags" validate constraint "entity_flags_entity_type_check";

alter table "public"."entity_flags" add constraint "entity_flags_flag_type_check" CHECK ((flag_type = ANY (ARRAY['hidden'::text, 'archived'::text, 'starred'::text, 'priority'::text]))) not valid;

alter table "public"."entity_flags" validate constraint "entity_flags_flag_type_check";

alter table "public"."entity_flags" add constraint "entity_flags_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."entity_flags" validate constraint "entity_flags_project_id_fkey";

alter table "public"."entity_flags" add constraint "entity_flags_user_id_entity_type_entity_id_flag_type_key" UNIQUE using index "entity_flags_user_id_entity_type_entity_id_flag_type_key";

alter table "public"."entity_flags" add constraint "entity_flags_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."entity_flags" validate constraint "entity_flags_user_id_fkey";

alter table "public"."votes" add constraint "votes_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts.accounts(id) ON DELETE CASCADE not valid;

alter table "public"."votes" validate constraint "votes_account_id_fkey";

alter table "public"."votes" add constraint "votes_entity_type_check" CHECK ((entity_type = ANY (ARRAY['insight'::text, 'persona'::text, 'opportunity'::text, 'interview'::text, 'person'::text]))) not valid;

alter table "public"."votes" validate constraint "votes_entity_type_check";

alter table "public"."votes" add constraint "votes_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."votes" validate constraint "votes_project_id_fkey";

alter table "public"."votes" add constraint "votes_user_id_entity_type_entity_id_key" UNIQUE using index "votes_user_id_entity_type_entity_id_key";

alter table "public"."votes" add constraint "votes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."votes" validate constraint "votes_user_id_fkey";

alter table "public"."votes" add constraint "votes_vote_value_check" CHECK ((vote_value = ANY (ARRAY['-1'::integer, 1]))) not valid;

alter table "public"."votes" validate constraint "votes_vote_value_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_annotation_counts(p_entity_type text, p_entity_id uuid, p_project_id uuid)
 RETURNS TABLE(annotation_type text, count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    a.annotation_type,
    COUNT(*) as count
  FROM public.annotations a
  WHERE a.entity_type = p_entity_type
    AND a.entity_id = p_entity_id
    AND a.project_id = p_project_id
    AND a.status = 'active'
  GROUP BY a.annotation_type;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_flags(p_entity_type text, p_entity_id uuid, p_user_id uuid)
 RETURNS TABLE(flag_type text, flag_value boolean, metadata jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    ef.flag_type,
    ef.flag_value,
    ef.metadata
  FROM public.entity_flags ef
  WHERE ef.entity_type = p_entity_type
    AND ef.entity_id = p_entity_id
    AND ef.user_id = p_user_id;
END;
$function$
;


CREATE OR REPLACE FUNCTION public.get_user_vote(p_entity_type text, p_entity_id uuid, p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  user_vote INTEGER;
BEGIN
  SELECT vote_value INTO user_vote
  FROM public.votes
  WHERE entity_type = p_entity_type
    AND entity_id = p_entity_id
    AND user_id = p_user_id;

  RETURN COALESCE(user_vote, 0);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_vote_counts(p_entity_type text, p_entity_id uuid, p_project_id uuid)
 RETURNS TABLE(upvotes bigint, downvotes bigint, total_votes bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN v.vote_value = 1 THEN 1 ELSE 0 END), 0) as upvotes,
    COALESCE(SUM(CASE WHEN v.vote_value = -1 THEN 1 ELSE 0 END), 0) as downvotes,
    COUNT(*) as total_votes
  FROM public.votes v
  WHERE v.entity_type = p_entity_type
    AND v.entity_id = p_entity_id
    AND v.project_id = p_project_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_account(account_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'accounts', 'public'
AS $function$
declare
    user_id uuid;
    user_role text;
begin
    -- Get the current user's id from the JWT/session
    user_id := auth.uid();

    -- Check if the user is a member of the account
    select au.account_role into user_role
    from accounts.account_user au
    where au.account_id = get_account.account_id and au.user_id = user_id
    limit 1;

    if user_role is null then
        raise exception 'You must be a member of an account to access it';
    end if;

    -- Return the account data
    return (
        select json_build_object(
            'account_id', a.id,
            'account_role', user_role,
            'is_primary_owner', a.primary_owner_user_id = user_id,
            'name', a.name,
            'slug', a.slug,
            'personal_account', a.personal_account,
            'billing_enabled', case
                when a.personal_account = true then config.enable_personal_account_billing
                else config.enable_team_account_billing
            end,
            'billing_status', bs.status,
            'created_at', a.created_at,
            'updated_at', a.updated_at,
            'metadata', a.public_metadata
        )
        from accounts.accounts a
        join accounts.config config on true
        left join (
            select bs.account_id, bs.status
            from accounts.billing_subscriptions bs
            where bs.account_id = get_account.account_id
            order by bs.created desc
            limit 1
        ) bs on bs.account_id = a.id
        where a.id = get_account.account_id
    );
end;
$function$
;

grant delete on table "public"."annotations" to "anon";

grant insert on table "public"."annotations" to "anon";

grant references on table "public"."annotations" to "anon";

grant select on table "public"."annotations" to "anon";

grant trigger on table "public"."annotations" to "anon";

grant truncate on table "public"."annotations" to "anon";

grant update on table "public"."annotations" to "anon";

grant delete on table "public"."annotations" to "authenticated";

grant insert on table "public"."annotations" to "authenticated";

grant references on table "public"."annotations" to "authenticated";

grant select on table "public"."annotations" to "authenticated";

grant trigger on table "public"."annotations" to "authenticated";

grant truncate on table "public"."annotations" to "authenticated";

grant update on table "public"."annotations" to "authenticated";

grant delete on table "public"."annotations" to "service_role";

grant insert on table "public"."annotations" to "service_role";

grant references on table "public"."annotations" to "service_role";

grant select on table "public"."annotations" to "service_role";

grant trigger on table "public"."annotations" to "service_role";

grant truncate on table "public"."annotations" to "service_role";

grant update on table "public"."annotations" to "service_role";

grant delete on table "public"."entity_flags" to "anon";

grant insert on table "public"."entity_flags" to "anon";

grant references on table "public"."entity_flags" to "anon";

grant select on table "public"."entity_flags" to "anon";

grant trigger on table "public"."entity_flags" to "anon";

grant truncate on table "public"."entity_flags" to "anon";

grant update on table "public"."entity_flags" to "anon";

grant delete on table "public"."entity_flags" to "authenticated";

grant insert on table "public"."entity_flags" to "authenticated";

grant references on table "public"."entity_flags" to "authenticated";

grant select on table "public"."entity_flags" to "authenticated";

grant trigger on table "public"."entity_flags" to "authenticated";

grant truncate on table "public"."entity_flags" to "authenticated";

grant update on table "public"."entity_flags" to "authenticated";

grant delete on table "public"."entity_flags" to "service_role";

grant insert on table "public"."entity_flags" to "service_role";

grant references on table "public"."entity_flags" to "service_role";

grant select on table "public"."entity_flags" to "service_role";

grant trigger on table "public"."entity_flags" to "service_role";

grant truncate on table "public"."entity_flags" to "service_role";

grant update on table "public"."entity_flags" to "service_role";

grant delete on table "public"."votes" to "anon";

grant insert on table "public"."votes" to "anon";

grant references on table "public"."votes" to "anon";

grant select on table "public"."votes" to "anon";

grant trigger on table "public"."votes" to "anon";

grant truncate on table "public"."votes" to "anon";

grant update on table "public"."votes" to "anon";

grant delete on table "public"."votes" to "authenticated";

grant insert on table "public"."votes" to "authenticated";

grant references on table "public"."votes" to "authenticated";

grant select on table "public"."votes" to "authenticated";

grant trigger on table "public"."votes" to "authenticated";

grant truncate on table "public"."votes" to "authenticated";

grant update on table "public"."votes" to "authenticated";

grant delete on table "public"."votes" to "service_role";

grant insert on table "public"."votes" to "service_role";

grant references on table "public"."votes" to "service_role";

grant select on table "public"."votes" to "service_role";

grant trigger on table "public"."votes" to "service_role";

grant truncate on table "public"."votes" to "service_role";

grant update on table "public"."votes" to "service_role";
