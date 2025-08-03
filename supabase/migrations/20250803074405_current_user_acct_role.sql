set check_function_bodies = off;

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
      and wu.account_id = account_id;

    -- if the user is not a member of the account, throw an error
    if response ->> 'account_role' IS NULL then
        raise exception 'Not found';
    end if;

    return response;
END
$function$
;


