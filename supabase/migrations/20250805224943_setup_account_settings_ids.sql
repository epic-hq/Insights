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
    new_project_id      uuid;
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

    -- create default project for team account
    insert into projects(account_id, name) values (team_account_id, 'My First Project') RETURNING id INTO new_project_id;
    -- create user's account_settings with default values for current_account_id and current_project_id
    insert into account_settings(account_id, current_account_id, current_project_id) values (first_account_id, team_account_id, new_project_id);

    return NEW;
end;
$function$
;


