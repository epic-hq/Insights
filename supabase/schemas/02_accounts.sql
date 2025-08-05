/**
      ____                 _
     |  _ \               (_)
     | |_) | __ _ ___  ___ _ _   _ _ __ ___  _ __
     |  _ < / _` / __|/ _ \ | | | | '_ ` _ \| '_ \
     | |_) | (_| \__ \  __/ | |_| | | | | | | |_) |
     |____/ \__,_|___/\___| |\__,_|_| |_| |_| .__/
                         _/ |               | |
                        |__/                |_|

     accounts is a starter kit for building SaaS products on top of Supabase.
     Learn more at https://useaccounts.com
 */

/**
  * -------------------------------------------------------
  * Section - Accounts
  * -------------------------------------------------------
 */

/**
 * Account roles allow you to provide permission levels to users
 * when they're acting on an account.  By default, we provide
 * "owner" and "member".  The only distinction is that owners can
 * also manage billing and invite/remove account members.
 */
DO
$$
    BEGIN
        -- check it account_role already exists on accounts schema
        IF NOT EXISTS(SELECT 1
                      FROM pg_type t
                               JOIN pg_namespace n ON n.oid = t.typnamespace
                      WHERE t.typname = 'account_role'
                        AND n.nspname = 'accounts') THEN
            CREATE TYPE accounts.account_role AS ENUM ('owner', 'member');
        end if;
    end;
$$;

/**
 * Accounts are the primary grouping for most objects within
 * the system. They have many users, and all billing is connected to
 * an account.
 */
CREATE TABLE IF NOT EXISTS accounts.accounts
(
    id                    uuid unique                NOT NULL DEFAULT extensions.uuid_generate_v4(),
    -- defaults to the user who creates the account
    -- this user cannot be removed from an account without changing
    -- the primary owner first
    primary_owner_user_id uuid references auth.users not null default auth.uid(),
    -- Account name
    name                  text,
    slug                  text unique,
    personal_account      boolean                             default false not null,
    updated_at            timestamp with time zone,
    created_at            timestamp with time zone,
    created_by            uuid references auth.users,
    updated_by            uuid references auth.users,
    private_metadata      jsonb                               default '{}'::jsonb,
    public_metadata       jsonb                               default '{}'::jsonb,
    PRIMARY KEY (id)
);

-- constraint that conditionally allows nulls on the slug ONLY if personal_account is true
-- remove this if you want to ignore accounts slugs entirely
ALTER TABLE accounts.accounts
    ADD CONSTRAINT accounts_accounts_slug_null_if_personal_account_true CHECK (
            (personal_account = true AND slug is null)
						OR (personal_account = false) -- slug can be null or undef for TEAM accounts
        );

-- Open up access to accounts
-- run manually: see supabase/migrations/imperative.sql
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE accounts.accounts TO authenticated, service_role;

/**
 * We want to protect some fields on accounts from being updated
 * Specifically the primary owner user id and account id.
 * primary_owner_user_id should be updated using the dedicated function
 */
CREATE OR REPLACE FUNCTION accounts.protect_account_fields()
    RETURNS TRIGGER AS
$$
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
$$ LANGUAGE plpgsql;

-- trigger to protect account fields
CREATE TRIGGER accounts_protect_account_fields
    BEFORE UPDATE
    ON accounts.accounts
    FOR EACH ROW
EXECUTE FUNCTION accounts.protect_account_fields();

-- convert any character in the slug that's not a letter, number, or dash to a dash on insert/update for accounts
CREATE OR REPLACE FUNCTION accounts.slugify_account_slug()
    RETURNS TRIGGER AS
$$
BEGIN
    if NEW.slug is not null then
        NEW.slug := lower(
      trim(both '-' FROM
        regexp_replace(
          regexp_replace(NEW.slug, '[^A-Za-z0-9-]+', '-', 'g'),
        '-+', '-', 'g')
      )
    );
    end if;

    RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- trigger to slugify the account slug
CREATE TRIGGER accounts_slugify_account_slug
    BEFORE INSERT OR UPDATE
    ON accounts.accounts
    FOR EACH ROW
EXECUTE FUNCTION accounts.slugify_account_slug();

-- enable RLS for accounts
alter table accounts.accounts
    enable row level security;

-- Allow authenticated users to select from accounts.accounts
CREATE POLICY "Authenticated users can read accounts"
  ON accounts.accounts
  FOR SELECT
  TO authenticated
  USING (true);

-- protect the timestamps
CREATE TRIGGER accounts_set_accounts_timestamp
    BEFORE INSERT OR UPDATE
    ON accounts.accounts
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_timestamps();

-- set the user tracking
CREATE TRIGGER accounts_set_accounts_user_tracking
    BEFORE INSERT OR UPDATE
    ON accounts.accounts
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_user_tracking();

/**
  * Account users are the users that are associated with an account.
  * They can be invited to join the account, and can have different roles.
  * The system does not enforce any permissions for roles, other than restricting
  * billing and account membership to only owners`
 */
create table if not exists accounts.account_user
(
    -- id of the user in the account
    user_id      uuid references auth.users on delete cascade        not null,
    -- id of the account the user is in
    account_id   uuid references accounts.accounts on delete cascade not null,
    -- role of the user in the account
    account_role accounts.account_role                               not null,
    constraint account_user_pkey primary key (user_id, account_id)
);

-- run manually: see supabase/migrations/imperative.sql
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE accounts.account_user TO authenticated, service_role;


-- enable RLS for account_user
alter table accounts.account_user
    enable row level security;

/**
  * When an account gets created, we want to insert the current user as the first
  * owner
 */
create or replace function accounts.add_current_user_to_new_account()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
as
$$
begin
    if new.primary_owner_user_id = auth.uid() then
        insert into accounts.account_user (account_id, user_id, account_role)
        values (NEW.id, auth.uid(), 'owner');
    end if;
    return NEW;
end;
$$;

-- trigger the function whenever a new account is created
CREATE TRIGGER accounts_add_current_user_to_new_account
    AFTER INSERT
    ON accounts.accounts
    FOR EACH ROW
EXECUTE FUNCTION accounts.add_current_user_to_new_account();

/**
  * When a user signs up, we need to create a personal account for them
  * and add them to the account_user table so they can act on it
 */
create or replace function accounts.run_new_user_setup()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
as
$$
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
$$;

-- trigger the function every time a user is created
create trigger on_auth_user_created
    after insert
    on auth.users
    for each row
execute procedure accounts.run_new_user_setup();

/**
  * -------------------------------------------------------
  * Section - Account permission utility functions
  * -------------------------------------------------------
  * These functions are stored on the accounts schema, and useful for things like
  * generating RLS policies
 */

/**
  * Returns true if the current user has the pass in role on the passed in account
  * If no role is sent, will return true if the user is a member of the account
  * NOTE: This is an inefficient function when used on large query sets. You should reach for the get_accounts_with_role and lookup
  * the account ID in those cases.
 */
create or replace function accounts.has_role_on_account(account_id uuid, account_role accounts.account_role default null)
    returns boolean
    language sql
    security definer
    set search_path = accounts, public
as
$$
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

grant execute on function accounts.has_role_on_account(uuid, accounts.account_role) to authenticated;


/**
  * Returns account_ids that the current user is a member of. If you pass in a role,
  * it'll only return accounts that the user is a member of with that role.
  */
create or replace function accounts.get_accounts_with_role(passed_in_role accounts.account_role default null)
    returns setof uuid
    language sql

    security definer
    set search_path = public
as
$$
select account_id
from accounts.account_user wu
where wu.user_id = auth.uid()
  and (
            wu.account_role = passed_in_role
        or passed_in_role is null
    );
$$;

grant execute on function accounts.get_accounts_with_role(accounts.account_role) to authenticated;

/**
  * -------------------------
  * Section - RLS Policies
  * -------------------------
  * This is where we define access to tables in the accounts schema
 */

create policy "users can view their own account_users" on accounts.account_user
    for select
    to authenticated
    using (
    user_id = auth.uid()
    );

create policy "users can view their teammates" on accounts.account_user
    for select
    to authenticated
    using (
    accounts.has_role_on_account(account_id) = true
    );

create policy "Account users can be deleted by owners except primary account owner" on accounts.account_user
    for delete
    to authenticated
    using (
        (accounts.has_role_on_account(account_id, 'owner') = true)
        AND
        user_id != (select primary_owner_user_id
                    from accounts.accounts
                    where account_id = accounts.id)
    );

create policy "Accounts are viewable by members" on accounts.accounts
    for select
    to authenticated
    using (
    accounts.has_role_on_account(id) = true
    );

-- Primary owner should always have access to the account
create policy "Accounts are viewable by primary owner" on accounts.accounts
    for select
    to authenticated
    using (
    primary_owner_user_id = auth.uid()
    );

create policy "Team accounts can be created by any user" on accounts.accounts
    for insert
    to authenticated
    with check (
            accounts.is_set('enable_team_accounts') = true
        and personal_account = false
    );


create policy "Accounts can be edited by owners" on accounts.accounts
    for update
    to authenticated
    using (
    accounts.has_role_on_account(id, 'owner') = true
    );

/**
  * -------------------------------------------------------
  * Section - Public functions
  * -------------------------------------------------------
  * Each of these functions exists in the public name space because they are accessible
  * via the API.  it is the primary way developers can interact with accounts accounts
 */

/**
* Returns the account_id for a given account slug
*/

create or replace function public.get_account_id(slug text)
    returns uuid
    language sql
as
$$
select id
from accounts.accounts
where slug = get_account_id.slug;
$$;

grant execute on function public.get_account_id(text) to authenticated, service_role;

/**
 * Returns the current user's role within a given account_id
*/
create or replace function public.current_user_account_role(p_account_id uuid)
    returns jsonb
    language plpgsql
		SECURITY DEFINER
		SET search_path = accounts,public
as
$$
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
      and wu.account_id = p_account_id;

    -- if the user is not a member of the account, throw an error
    if response ->> 'account_role' IS NULL then
        raise exception 'Not found';
    end if;

    return response;
END
$$;

grant execute on function public.current_user_account_role(uuid) to authenticated;

/**
  * Let's you update a users role within an account if you are an owner of that account
  **/
create or replace function public.update_account_user_role(account_id uuid, user_id uuid,
                                                           new_account_role accounts.account_role,
                                                           make_primary_owner boolean default false)
    returns void
    security definer
    set search_path = public
    language plpgsql
as
$$
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

grant execute on function public.update_account_user_role(uuid, uuid, accounts.account_role, boolean) to authenticated;

/**
  Returns the current user's accounts
 */
create or replace function public.get_accounts()
    returns json
    language sql
as
$$
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

grant execute on function public.get_accounts() to authenticated;

/**
  Returns a specific account that the current user has access to
 */
 create or replace function public.get_account(account_id uuid)
    returns json
    language plpgsql
    security definer
    set search_path = accounts,public
as
$$
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
$$;

grant execute on function public.get_account(uuid) to anon, authenticated, service_role;


-- create or replace function public.get_account(account_id uuid)
--     returns json
--     language plpgsql
-- as
-- $$
-- BEGIN
--     -- check if the user is a member of the account or a service_role user
--     if current_user IN ('anon', 'authenticated') and
--        (select current_user_account_role(get_account.account_id) ->> 'account_role' IS NULL) then
--         raise exception 'You must be a member of an account to access it';
--     end if;


--     return (select json_build_object(
--                            'account_id', a.id,
--                            'account_role', wu.account_role,
--                            'is_primary_owner', a.primary_owner_user_id = auth.uid(),
--                            'name', a.name,
--                            'slug', a.slug,
--                            'personal_account', a.personal_account,
--                            'billing_enabled', case
--                                                   when a.personal_account = true then
--                                                       config.enable_personal_account_billing
--                                                   else
--                                                       config.enable_team_account_billing
--                                end,
--                            'billing_status', bs.status,
--                            'created_at', a.created_at,
--                            'updated_at', a.updated_at,
--                            'metadata', a.public_metadata
--                        )
--             from accounts.accounts a
--                      left join accounts.account_user wu on a.id = wu.account_id and wu.user_id = auth.uid()
--                      join accounts.config config on true
--                      left join (select bs.account_id, status
--                                 from accounts.billing_subscriptions bs
--                                 where bs.account_id = get_account.account_id
--                                 order by created desc
--                                 limit 1) bs on bs.account_id = a.id
--             where a.id = get_account.account_id);
-- END;
-- $$;

-- grant execute on function public.get_account(uuid) to authenticated, service_role;

/**
  Returns a specific account that the current user has access to
 */
create or replace function public.get_account_by_slug(slug text)
    returns json
    language plpgsql
as
$$
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

grant execute on function public.get_account_by_slug(text) to authenticated;

/**
  Returns the personal account for the current user
 */
create or replace function public.get_personal_account()
    returns json
    language plpgsql
as
$$
BEGIN
    return public.get_account(auth.uid());
END;
$$;

grant execute on function public.get_personal_account() to authenticated;

/**
  * Create an account
 */
create or replace function public.create_account(slug text default null, name text default null)
    returns json
    language plpgsql
as
$$
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

create or replace function public.create_account_id(primary_owner_user_id uuid default null, slug text default null, name text default null)
    returns uuid
    language plpgsql
as
$$
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
$$;


grant execute on function public.create_account(slug text, name text) to authenticated;
grant execute on function public.create_account_id(primary_owner_user_id uuid, slug text, name text) to authenticated;

/**
  Update an account with passed in info. None of the info is required except for account ID.
  If you don't pass in a value for a field, it will not be updated.
  If you set replace_meta to true, the metadata will be replaced with the passed in metadata.
  If you set replace_meta to false, the metadata will be merged with the passed in metadata.
 */
create or replace function public.update_account(account_id uuid, slug text default null, name text default null,
                                                 public_metadata jsonb default null,
                                                 replace_metadata boolean default false)
    returns json
    language plpgsql
as
$$
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

grant execute on function public.update_account(uuid, text, text, jsonb, boolean) to authenticated, service_role;

/**
  Returns a list of current account members. Only account owners can access this function.
  It's a security definer because it requries us to lookup personal_accounts for existing members so we can
  get their names.
 */
create or replace function public.get_account_members(account_id uuid, results_limit integer default 50,
                                                      results_offset integer default 0)
    returns json
    language plpgsql
    security definer
    set search_path = accounts
as
$$
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

grant execute on function public.get_account_members(uuid, integer, integer) to authenticated;

/**
  Allows an owner of the account to remove any member other than the primary owner
 */

create or replace function public.remove_account_member(account_id uuid, user_id uuid)
    returns void
    language plpgsql
as
$$
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

grant execute on function public.remove_account_member(uuid, uuid) to authenticated;