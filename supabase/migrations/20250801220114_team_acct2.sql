set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.create_account_id(primary_owner_user_id uuid DEFAULT NULL::uuid, slug text DEFAULT NULL::text, name text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
DECLARE
    new_account_id uuid;
BEGIN
    insert into accounts.accounts (primary_owner_user_id, slug, name)
    values (primary_owner_user_id, slug, name)
    returning id into new_account_id;

    return new_account_id;
EXCEPTION
    WHEN unique_violation THEN
        raise exception 'An account with that unique ID already exists';
END;
$function$
;


