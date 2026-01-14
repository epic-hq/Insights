-- Extend invitation expiration from 24 hours to 3 days

-- ============================================================================
-- 1. Update RLS policy for account owners viewing invitations
-- ============================================================================
DROP POLICY IF EXISTS "Invitations viewable by account owners" ON accounts.invitations;

CREATE POLICY "Invitations viewable by account owners" ON accounts.invitations
    FOR SELECT
    TO authenticated
    USING (
        created_at > (now() - interval '3 days')
        AND accounts.has_role_on_account(account_id, 'owner') = true
    );

-- ============================================================================
-- 2. Update RLS policy for invitees viewing their invitations
-- ============================================================================
DROP POLICY IF EXISTS "Users can view invitations sent to their email" ON accounts.invitations;

CREATE POLICY "Users can view invitations sent to their email"
ON accounts.invitations
FOR SELECT
TO authenticated
USING (
  invitee_email IS NOT NULL
  AND lower(invitee_email) = lower(auth.jwt() ->> 'email')
  AND created_at > now() - interval '3 days'
);

-- ============================================================================
-- 3. Update get_account_invitations function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_account_invitations(account_id uuid, results_limit integer default 25,
                                                          results_offset integer default 0)
    RETURNS json
    LANGUAGE plpgsql
AS
$$
BEGIN
    IF (SELECT public.current_user_account_role(get_account_invitations.account_id) ->> 'account_role' <> 'owner') THEN
        RAISE EXCEPTION 'Only account owners can access this function';
    END IF;

    RETURN (SELECT json_agg(
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
              AND i.created_at > now() - interval '3 days'
            LIMIT coalesce(get_account_invitations.results_limit, 25) OFFSET coalesce(get_account_invitations.results_offset, 0));
END;
$$;

-- ============================================================================
-- 4. Update accept_invitation function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.accept_invitation(lookup_invitation_token text)
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER SET search_path = public, accounts
AS
$$
DECLARE
    lookup_account_id       uuid;
    DECLARE new_member_role accounts.account_role;
    lookup_account_slug     text;
BEGIN
    SELECT i.account_id, i.account_role, a.slug
    INTO lookup_account_id, new_member_role, lookup_account_slug
    FROM accounts.invitations i
             JOIN accounts.accounts a ON a.id = i.account_id
    WHERE i.token = lookup_invitation_token
      AND i.created_at > now() - interval '3 days';

    IF lookup_account_id IS NULL THEN
        RAISE EXCEPTION 'Invitation not found';
    END IF;

    IF lookup_account_id IS NOT NULL THEN
        INSERT INTO accounts.account_user (account_id, user_id, account_role)
        VALUES (lookup_account_id, auth.uid(), new_member_role);
        DELETE FROM accounts.invitations WHERE token = lookup_invitation_token AND invitation_type = 'one_time';
    END IF;
    RETURN json_build_object('account_id', lookup_account_id, 'account_role', new_member_role, 'slug',
                             lookup_account_slug);
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'You are already a member of this account';
END;
$$;

-- ============================================================================
-- 5. Update lookup_invitation function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.lookup_invitation(lookup_invitation_token text)
    RETURNS json
    LANGUAGE plpgsql
    SECURITY DEFINER SET search_path = public, accounts
AS
$$
DECLARE
    invitation_record RECORD;
BEGIN
    SELECT
        account_id,
        account_name,
        account_role,
        invited_by_user_id,
        CASE WHEN id IS NOT NULL THEN true ELSE false END as active
    INTO invitation_record
    FROM accounts.invitations
    WHERE token = lookup_invitation_token
      AND created_at > now() - interval '3 days'
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

-- ============================================================================
-- 6. Update list_invitations_for_current_user function
-- ============================================================================
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
      AND i.created_at > now() - interval '3 days'
  );
END;
$$;

-- ============================================================================
-- 7. Update check_duplicate_active_invitation trigger function
-- ============================================================================
CREATE OR REPLACE FUNCTION accounts.check_duplicate_active_invitation()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.invitee_email IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM accounts.invitations
            WHERE account_id = NEW.account_id
              AND lower(invitee_email) = lower(NEW.invitee_email)
              AND created_at > now() - interval '3 days'
              AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        ) THEN
            DELETE FROM accounts.invitations
            WHERE account_id = NEW.account_id
              AND lower(invitee_email) = lower(NEW.invitee_email)
              AND created_at > now() - interval '3 days'
              AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. Update check_invitation_rate_limit trigger function
-- ============================================================================
CREATE OR REPLACE FUNCTION accounts.check_invitation_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
    invitation_count integer;
    rate_limit integer := 50;
BEGIN
    SELECT COUNT(*) INTO invitation_count
    FROM accounts.invitations
    WHERE account_id = NEW.account_id
      AND created_at > now() - interval '3 days';

    IF invitation_count >= rate_limit THEN
        RAISE EXCEPTION 'Rate limit exceeded: Maximum % invitations per 3 days per account', rate_limit;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. Update cleanup_expired_invitations function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_invitations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, accounts
AS $$
DECLARE
    deleted_count integer;
BEGIN
    INSERT INTO accounts.invitation_audit (invitation_id, account_id, action, invitee_email, account_role)
    SELECT id, account_id, 'expired', invitee_email, account_role
    FROM accounts.invitations
    WHERE created_at <= now() - interval '3 days';

    WITH deleted AS (
        DELETE FROM accounts.invitations
        WHERE created_at <= now() - interval '3 days'
        RETURNING *
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;

    RETURN deleted_count;
END;
$$;
