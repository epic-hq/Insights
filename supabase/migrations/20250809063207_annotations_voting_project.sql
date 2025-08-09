drop policy "Users can create annotations in their projects" on "public"."annotations";

drop policy "Users can delete their own annotations" on "public"."annotations";

drop policy "Users can update their own annotations" on "public"."annotations";

drop policy "Users can view annotations in their projects" on "public"."annotations";

drop policy "Users can create flags in their projects" on "public"."entity_flags";

drop policy "Users can delete their own flags" on "public"."entity_flags";

drop policy "Users can update their own flags" on "public"."entity_flags";

drop policy "Users can view flags in their projects" on "public"."entity_flags";

drop policy "Users can create votes in their projects" on "public"."votes";

drop policy "Users can delete their own votes" on "public"."votes";

drop policy "Users can update their own votes" on "public"."votes";

drop policy "Users can view votes in their projects" on "public"."votes";

drop function if exists "public"."get_user_vote"(p_entity_type text, p_entity_id uuid, p_project_id uuid);

alter table "public"."projects" add column "background" jsonb;

alter table "public"."projects" add column "findings" jsonb;

alter table "public"."projects" add column "goal" jsonb;

alter table "public"."projects" add column "questions" jsonb;

alter table "public"."projects" alter column "status" set default 'new'::text;

set check_function_bodies = off;

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

CREATE OR REPLACE FUNCTION public.get_user_flags(p_entity_type text, p_entity_id uuid, p_project_id uuid)
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
    AND ef.project_id = p_project_id
    AND ef.user_id = auth.uid();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_vote(p_entity_type text, p_entity_id uuid, p_project_id uuid)
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
    AND project_id = p_project_id
    AND user_id = auth.uid();

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


