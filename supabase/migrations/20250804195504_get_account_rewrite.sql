set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_account(account_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'accounts'
AS $function$
declare
    user_id uuid;
    user_role text;
begin
    -- Get the current user's id from the JWT/session
    user_id := auth.uid();

    -- Check if the user is a member of the account
    select account_role into user_role
    from accounts.account_user
    where account_id = get_account.account_id and user_id = user_id
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
            select bs.account_id, status
            from accounts.billing_subscriptions bs
            where bs.account_id = get_account.account_id
            order by created desc
            limit 1
        ) bs on bs.account_id = a.id
        where a.id = get_account.account_id
    );
end;
$function$
;


