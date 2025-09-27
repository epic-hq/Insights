/**
  * -------------------------------------------------------
  * Section - Invitations
  * -------------------------------------------------------
 */

/**
  * Invitations are sent to users to join a account
  * They pre-define the role the user should have once they join
 */
create table if not exists accounts.invitations
(
    -- the id of the invitation
    id                 uuid unique                                              not null default extensions.uuid_generate_v4(),
    -- what role should invitation accepters be given in this account
    account_role       accounts.account_role                                    not null,
    -- the account the invitation is for
    account_id         uuid references accounts.accounts (id) on delete cascade not null,
    -- unique token used to accept the invitation
    token              text unique                                              not null default accounts.generate_token(30),
    -- who created the invitation
    invited_by_user_id uuid references auth.users                               not null,
    -- account name. filled in by a trigger
    account_name       text,
    -- when the invitation was last updated
    updated_at         timestamp with time zone,
    -- when the invitation was created
    created_at         timestamp with time zone,
    -- what type of invitation is this
    invitation_type    accounts.invitation_type                                 not null,
    -- the email of the invitee
    invitee_email      text,
    primary key (id)
);

-- Open up access to invitations
-- run manually: see supabase/migrations/imperative.sql
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE accounts.invitations TO authenticated, service_role;

-- manage timestamps
CREATE TRIGGER accounts_set_invitations_timestamp
    BEFORE INSERT OR UPDATE
    ON accounts.invitations
    FOR EACH ROW
EXECUTE FUNCTION accounts.trigger_set_timestamps();

/**
  * This funciton fills in account info and inviting user email
  * so that the recipient can get more info about the invitation prior to
  * accepting.  It allows us to avoid complex permissions on accounts
 */
CREATE OR REPLACE FUNCTION accounts.trigger_set_invitation_details()
    RETURNS TRIGGER AS
$$
BEGIN
    NEW.invited_by_user_id = auth.uid();
    NEW.account_name = (select name from accounts.accounts where id = NEW.account_id);
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER accounts_trigger_set_invitation_details
    BEFORE INSERT
    ON accounts.invitations
    FOR EACH ROW
EXECUTE FUNCTION accounts.trigger_set_invitation_details();

-- enable RLS on invitations
alter table accounts.invitations
    enable row level security;

/**
  * -------------------------
  * Section - RLS Policies
  * -------------------------
  * This is where we define access to tables in the accounts schema
 */

 create policy "Invitations viewable by account owners" on accounts.invitations
    for select
    to authenticated
    using (
            created_at > (now() - interval '24 hours')
        and
            accounts.has_role_on_account(account_id, 'owner') = true
    );


create policy "Invitations can be created by account owners" on accounts.invitations
    for insert
    to authenticated
    with check (
    -- team accounts should be enabled
            accounts.is_set('enable_team_accounts') = true
        -- this should not be a personal account
        and (SELECT personal_account
             FROM accounts.accounts
             WHERE id = account_id) = false
        -- the inserting user should be an owner of the account
        and
            (accounts.has_role_on_account(account_id, 'owner') = true)
    );

create policy "Invitations can be deleted by account owners" on accounts.invitations
    for delete
    to authenticated
    using (
    accounts.has_role_on_account(account_id, 'owner') = true
    );



/**
  * -------------------------------------------------------
  * Section - Public functions
  * -------------------------------------------------------
  * Each of these functions exists in the public name space because they are accessible
  * via the API.  it is the primary way developers can interact with accounts accounts
 */


/**
  Returns a list of currently active invitations for a given account
 */

create or replace function public.get_account_invitations(account_id uuid, results_limit integer default 25,
                                                          results_offset integer default 0)
    returns json
    language plpgsql
as
$$
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

grant execute on function public.get_account_invitations(uuid, integer, integer) to authenticated;


/**
  * Allows a user to accept an existing invitation and join a account
  * This one exists in the public schema because we want it to be called
  * using the supabase rpc method
 */
create or replace function public.accept_invitation(lookup_invitation_token text)
    returns jsonb
    language plpgsql
    security definer set search_path = public, accounts
as
$$
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

grant execute on function public.accept_invitation(text) to authenticated;


/**
  * Allows a user to lookup an existing invitation and join a account
  * This one exists in the public schema because we want it to be called
  * using the supabase rpc method
 */
create or replace function public.lookup_invitation(lookup_invitation_token text)
    returns json
    language plpgsql
    security definer set search_path = public, accounts
as
$$
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

grant execute on function public.lookup_invitation(text) to authenticated;


/**
  Allows a user to create a new invitation if they are an owner of an account
 */
CREATE FUNCTION public.create_invitation(
  account_id uuid,
  account_role accounts.account_role,
  invitation_type accounts.invitation_type,
  invitee_email text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  new_invitation accounts.invitations;
BEGIN
  INSERT INTO accounts.invitations (account_id, account_role, invitation_type, invited_by_user_id, invitee_email)
  VALUES (account_id, account_role, invitation_type, auth.uid(), invitee_email)
  RETURNING * INTO new_invitation;

  RETURN json_build_object('token', new_invitation.token);
END;
$$;

grant execute on function public.create_invitation(uuid, accounts.account_role, accounts.invitation_type, text) to authenticated;

/**
  Allows an owner to delete an existing invitation
 */

create or replace function public.delete_invitation(invitation_id uuid)
    returns void
    language plpgsql
as
$$
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

grant execute on function public.delete_invitation(uuid) to authenticated;