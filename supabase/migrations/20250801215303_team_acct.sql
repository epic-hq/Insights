set check_function_bodies = off;

CREATE OR REPLACE FUNCTION accounts.run_new_user_setup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    first_account_id    uuid;
    team_account_id     uuid;
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

-- create first TEAM account, make user owner
-- call the create_account_id function
select create_account_id(NEW.id, NULL, generated_user_name) into team_account_id;
insert into accounts.account_user (account_id, user_id, account_role)
values (team_account_id, NEW.id, 'owner');

-- select update_account_user_role(team_account_id, team_account_id, true);

		-- creating user_settings
    insert into account_settings(account_id) values (first_account_id);
    -- default research project
    insert into projects(account_id, name) values (team_account_id, 'My First Project');

    return NEW;
end;
$function$
;


set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.create_account_id(primary_owner_user_id uuid DEFAULT NULL::uuid, slug text DEFAULT NULL::text, name text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
DECLARE
    new_account_id uuid;
BEGIN
    insert into accounts.accounts (primary_owner_user_id, slug, name)
    values (create_account.primary_owner_user_id, create_account.slug, create_account.name)
    returning id into new_account_id;

    return new_account_id;
EXCEPTION
    WHEN unique_violation THEN
        raise exception 'An account with that unique ID already exists';
END;
$function$
;


