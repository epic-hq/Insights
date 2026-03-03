-- Fix: get_account_invitations was SECURITY INVOKER, so RLS on accounts.invitations
-- blocked non-owner members from seeing rows even though the function's own access
-- check allows any member. Switch to SECURITY DEFINER to bypass RLS (the function
-- already validates membership before returning data).

CREATE OR REPLACE FUNCTION public.get_account_invitations(
    account_id uuid,
    results_limit integer DEFAULT 25,
    results_offset integer DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, accounts
AS $$
DECLARE
    user_role text;
BEGIN
    user_role := (SELECT public.current_user_account_role(get_account_invitations.account_id) ->> 'account_role');
    IF user_role IS NULL THEN
        RAISE EXCEPTION 'You are not a member of this account';
    END IF;

    RETURN (
        SELECT json_agg(
            json_build_object(
                'account_role', i.account_role,
                'created_at', i.created_at,
                'invitation_type', i.invitation_type,
                'invitation_id', i.id,
                'email', i.invitee_email
            )
        )
        FROM accounts.invitations i
        WHERE i.account_id = get_account_invitations.account_id
          AND i.created_at > now() - interval '30 days'
        LIMIT coalesce(get_account_invitations.results_limit, 25)
        OFFSET coalesce(get_account_invitations.results_offset, 0)
    );
END;
$$;
