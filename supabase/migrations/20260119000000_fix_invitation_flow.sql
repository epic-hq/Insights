-- Fix invitation flow gaps and logic errors
-- 1. Add 24-hour filter to list_invitations_for_current_user()
-- 2. Fix RLS policy for invitees to include 24h expiration check
-- 3. Add account_id to lookup_invitation() return value
-- 4. Add unique constraint on (account_id, invitee_email) for active invitations
-- 5. Add rate limiting for invitation creation (50/day/account)
-- 6. Add invitation audit trail table
-- 7. Add cleanup function for expired invitations

-- ============================================================================
-- 1. Fix list_invitations_for_current_user() to filter expired invitations
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
  -- Determine current user's email
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
      AND i.created_at > now() - interval '24 hours'  -- Only show non-expired invitations
  );
END;
$$;

-- ============================================================================
-- 2. Fix RLS policy for invitees to include 24h expiration check
-- ============================================================================
DROP POLICY IF EXISTS "Users can view invitations sent to their email" ON accounts.invitations;

CREATE POLICY "Users can view invitations sent to their email"
ON accounts.invitations
FOR SELECT
TO authenticated
USING (
  invitee_email IS NOT NULL
  AND lower(invitee_email) = lower(auth.jwt() ->> 'email')
  AND created_at > now() - interval '24 hours'  -- Only show non-expired invitations
);

-- ============================================================================
-- 3. Fix lookup_invitation() to return account_id
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
      AND created_at > now() - interval '24 hours'
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
-- 4. Add unique partial index for (account_id, invitee_email) on active invitations
-- This prevents duplicate invitations to the same email for the same account
-- while allowing re-inviting after expiration
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS invitations_unique_active_email
ON accounts.invitations (account_id, lower(invitee_email))
WHERE invitee_email IS NOT NULL
  AND created_at > now() - interval '24 hours';

-- Note: The above index won't work as expected because it uses a volatile expression.
-- Instead, we'll use a trigger-based approach to enforce uniqueness for active invitations.
DROP INDEX IF EXISTS accounts.invitations_unique_active_email;

-- Create a function to check for duplicate active invitations
CREATE OR REPLACE FUNCTION accounts.check_duplicate_active_invitation()
RETURNS TRIGGER AS $$
BEGIN
    -- Only check for email-based invitations
    IF NEW.invitee_email IS NOT NULL THEN
        -- Check if there's already an active (non-expired) invitation for this email/account combo
        IF EXISTS (
            SELECT 1 FROM accounts.invitations
            WHERE account_id = NEW.account_id
              AND lower(invitee_email) = lower(NEW.invitee_email)
              AND created_at > now() - interval '24 hours'
              AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        ) THEN
            -- Delete the old invitation and allow the new one (effectively "replace")
            DELETE FROM accounts.invitations
            WHERE account_id = NEW.account_id
              AND lower(invitee_email) = lower(NEW.invitee_email)
              AND created_at > now() - interval '24 hours'
              AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_duplicate_invitation_trigger ON accounts.invitations;
CREATE TRIGGER check_duplicate_invitation_trigger
    BEFORE INSERT ON accounts.invitations
    FOR EACH ROW
    EXECUTE FUNCTION accounts.check_duplicate_active_invitation();

-- ============================================================================
-- 5. Add rate limiting for invitation creation (50 per day per account)
-- ============================================================================
CREATE OR REPLACE FUNCTION accounts.check_invitation_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
    invitation_count integer;
    rate_limit integer := 50;  -- Max invitations per account per day
BEGIN
    -- Count invitations created in the last 24 hours for this account
    SELECT COUNT(*) INTO invitation_count
    FROM accounts.invitations
    WHERE account_id = NEW.account_id
      AND created_at > now() - interval '24 hours';

    IF invitation_count >= rate_limit THEN
        RAISE EXCEPTION 'Rate limit exceeded: Maximum % invitations per day per account', rate_limit;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invitation_rate_limit_trigger ON accounts.invitations;
CREATE TRIGGER invitation_rate_limit_trigger
    BEFORE INSERT ON accounts.invitations
    FOR EACH ROW
    EXECUTE FUNCTION accounts.check_invitation_rate_limit();

-- ============================================================================
-- 6. Add invitation audit trail table
-- ============================================================================
CREATE TABLE IF NOT EXISTS accounts.invitation_audit (
    id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    invitation_id uuid,  -- May be null if invitation was deleted
    account_id uuid NOT NULL,
    action text NOT NULL,  -- 'created', 'accepted', 'deleted', 'expired', 'email_sent', 'email_failed'
    actor_user_id uuid,  -- Who performed the action (null for system actions)
    invitee_email text,
    account_role accounts.account_role,
    details jsonb,  -- Additional context (error messages, etc.)
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for querying audit trail
CREATE INDEX IF NOT EXISTS invitation_audit_account_idx ON accounts.invitation_audit (account_id);
CREATE INDEX IF NOT EXISTS invitation_audit_created_at_idx ON accounts.invitation_audit (created_at);
CREATE INDEX IF NOT EXISTS invitation_audit_invitation_id_idx ON accounts.invitation_audit (invitation_id);

-- RLS for audit table - owners can view their account's audit trail
ALTER TABLE accounts.invitation_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Audit viewable by account owners" ON accounts.invitation_audit
    FOR SELECT
    TO authenticated
    USING (accounts.has_role_on_account(account_id, 'owner') = true);

-- Allow service_role full access for logging
GRANT SELECT, INSERT ON TABLE accounts.invitation_audit TO authenticated, service_role;

-- Trigger to log invitation creation
CREATE OR REPLACE FUNCTION accounts.log_invitation_created()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO accounts.invitation_audit (
        invitation_id, account_id, action, actor_user_id, invitee_email, account_role
    ) VALUES (
        NEW.id, NEW.account_id, 'created', NEW.invited_by_user_id, NEW.invitee_email, NEW.account_role
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS log_invitation_created_trigger ON accounts.invitations;
CREATE TRIGGER log_invitation_created_trigger
    AFTER INSERT ON accounts.invitations
    FOR EACH ROW
    EXECUTE FUNCTION accounts.log_invitation_created();

-- Trigger to log invitation deletion
CREATE OR REPLACE FUNCTION accounts.log_invitation_deleted()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO accounts.invitation_audit (
        invitation_id, account_id, action, actor_user_id, invitee_email, account_role
    ) VALUES (
        OLD.id, OLD.account_id, 'deleted', auth.uid(), OLD.invitee_email, OLD.account_role
    );
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS log_invitation_deleted_trigger ON accounts.invitations;
CREATE TRIGGER log_invitation_deleted_trigger
    AFTER DELETE ON accounts.invitations
    FOR EACH ROW
    EXECUTE FUNCTION accounts.log_invitation_deleted();

-- ============================================================================
-- 7. Add cleanup function for expired invitations (to be called by cron)
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
    -- Log expired invitations before deleting
    INSERT INTO accounts.invitation_audit (invitation_id, account_id, action, invitee_email, account_role)
    SELECT id, account_id, 'expired', invitee_email, account_role
    FROM accounts.invitations
    WHERE created_at <= now() - interval '24 hours';

    -- Delete expired invitations
    WITH deleted AS (
        DELETE FROM accounts.invitations
        WHERE created_at <= now() - interval '24 hours'
        RETURNING *
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;

    RETURN deleted_count;
END;
$$;

-- Grant execute to service_role for cron jobs
GRANT EXECUTE ON FUNCTION public.cleanup_expired_invitations() TO service_role;

-- ============================================================================
-- 8. Add function to check if email is already a member
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_email_account_member(check_account_id uuid, check_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, accounts
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM accounts.account_user au
        JOIN auth.users u ON u.id = au.user_id
        WHERE au.account_id = check_account_id
          AND lower(u.email) = lower(check_email)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_email_account_member(uuid, text) TO authenticated;

-- ============================================================================
-- 9. Add function to log audit events from application code
-- ============================================================================
CREATE OR REPLACE FUNCTION public.log_invitation_audit(
    p_invitation_id uuid,
    p_account_id uuid,
    p_action text,
    p_invitee_email text DEFAULT NULL,
    p_account_role accounts.account_role DEFAULT NULL,
    p_details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, accounts
AS $$
BEGIN
    INSERT INTO accounts.invitation_audit (
        invitation_id, account_id, action, actor_user_id, invitee_email, account_role, details
    ) VALUES (
        p_invitation_id, p_account_id, p_action, auth.uid(), p_invitee_email, p_account_role, p_details
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_invitation_audit(uuid, uuid, text, text, accounts.account_role, jsonb) TO authenticated;
