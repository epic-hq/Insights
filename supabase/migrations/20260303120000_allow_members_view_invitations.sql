-- Allow all account members (not just owners) to view pending invitations
-- This enables non-owner members to see who has been invited to the team

create or replace function public.get_account_invitations(account_id uuid, results_limit integer default 25,
                                                          results_offset integer default 0)
    returns json
    language plpgsql
as
$$
DECLARE
    user_role text;
BEGIN
    -- Check that the current user is a member of this account (any role)
    user_role := (select public.current_user_account_role(get_account_invitations.account_id) ->> 'account_role');

    if user_role is null then
        raise exception 'You are not a member of this account';
    end if;

    return (select json_agg(
                           json_build_object(
                                   'account_role', i.account_role,
                                   'created_at', i.created_at,
                                   'invitation_type', i.invitation_type,
                                   'invitation_id', i.id,
                                   'email', i.invitee_email
                               )
                       )
            from accounts.invitations i
            where i.account_id = get_account_invitations.account_id
              and i.created_at > now() - interval '3 days'
            limit coalesce(get_account_invitations.results_limit, 25) offset coalesce(get_account_invitations.results_offset, 0));
END;
$$;
