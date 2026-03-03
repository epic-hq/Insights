-- Extend invitation expiry from 3 days to 14 days
-- Also widen the listing window to 30 days so expired invitations are visible in the UI

-- 1. RLS: owners can see invitations up to 30 days old (UI shows expired status)
DROP POLICY IF EXISTS "Invitations viewable by account owners" ON accounts.invitations;
CREATE POLICY "Invitations viewable by account owners" ON accounts.invitations
    FOR SELECT
    TO authenticated
    USING (
        created_at > (now() - interval '30 days')
        AND accounts.has_role_on_account(account_id, 'owner') = true
    );

-- 2. RLS: invitees can see their own invitations up to 30 days (to see expired status)
DROP POLICY IF EXISTS "Users can view invitations sent to their email" ON accounts.invitations;
CREATE POLICY "Users can view invitations sent to their email" ON accounts.invitations
    FOR SELECT
    TO authenticated
    USING (
        invitee_email IS NOT NULL
        AND lower(invitee_email) = lower(auth.jwt() ->> 'email')
        AND created_at > now() - interval '30 days'
    );

-- 3. get_account_invitations: return invitations from last 30 days (UI computes expired)
CREATE OR REPLACE FUNCTION public.get_account_invitations(
    account_id uuid,
    results_limit integer DEFAULT 25,
    results_offset integer DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
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

-- 4. accept_invitation: enforce 14-day expiry
CREATE OR REPLACE FUNCTION public.accept_invitation(lookup_invitation_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, accounts
AS $$
DECLARE
    lookup_account_id       uuid;
    new_member_role         accounts.account_role;
    lookup_account_slug     text;
BEGIN
    SELECT i.account_id, i.account_role, a.slug
    INTO lookup_account_id, new_member_role, lookup_account_slug
    FROM accounts.invitations i
    JOIN accounts.accounts a ON a.id = i.account_id
    WHERE i.token = lookup_invitation_token
      AND i.created_at > now() - interval '14 days';

    IF lookup_account_id IS NULL THEN
        RAISE EXCEPTION 'Invitation not found';
    END IF;

    IF lookup_account_id IS NOT NULL THEN
        INSERT INTO accounts.account_user (account_id, user_id, account_role)
        VALUES (lookup_account_id, auth.uid(), new_member_role);
        DELETE FROM accounts.invitations WHERE token = lookup_invitation_token AND invitation_type = 'one_time';
    END IF;

    RETURN json_build_object('account_id', lookup_account_id, 'account_role', new_member_role, 'slug', lookup_account_slug);
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'You are already a member of this account';
END;
$$;

-- 5. lookup_invitation: enforce 14-day expiry
CREATE OR REPLACE FUNCTION public.lookup_invitation(lookup_invitation_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, accounts
AS $$
DECLARE
    invitation_record RECORD;
BEGIN
    SELECT
        account_id,
        account_name,
        account_role,
        invited_by_user_id,
        CASE WHEN id IS NOT NULL THEN true ELSE false END AS active
    INTO invitation_record
    FROM accounts.invitations
    WHERE token = lookup_invitation_token
      AND created_at > now() - interval '14 days'
    LIMIT 1;

    RETURN json_build_object(
        'active', coalesce(invitation_record.active, false),
        'account_name', invitation_record.account_name,
        'account_id', invitation_record.account_id,
        'account_role', invitation_record.account_role,
        'inviter_user_id', invitation_record.invited_by_user_id
    );
END;
$$;

-- 6. list_invitations_for_current_user: show invitations from last 30 days
CREATE OR REPLACE FUNCTION public.list_invitations_for_current_user()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, accounts
AS $$
DECLARE
    current_email text;
BEGIN
    SELECT email INTO current_email FROM auth.users WHERE id = auth.uid();
    IF current_email IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    RETURN (
        SELECT COALESCE(
            json_agg(
                json_build_object(
                    'account_id', i.account_id,
                    'account_name', i.account_name,
                    'account_role', i.account_role,
                    'invitation_type', i.invitation_type,
                    'created_at', i.created_at,
                    'token', i.token
                )
                ORDER BY i.created_at DESC
            ), '[]'::json
        )
        FROM accounts.invitations i
        WHERE i.invitee_email IS NOT NULL
          AND lower(i.invitee_email) = lower(current_email)
          AND i.created_at > now() - interval '30 days'
    );
END;
$$;
