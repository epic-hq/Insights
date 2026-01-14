-- Allow users to view invitations sent to their email address
-- This enables the /invites page to work for users who aren't yet members of the account

CREATE POLICY "Users can view invitations sent to their email"
ON accounts.invitations
FOR SELECT
TO authenticated
USING (
  invitee_email IS NOT NULL
  AND lower(invitee_email) = lower(auth.jwt() ->> 'email')
  AND created_at > now() - interval '24 hours'  -- Only show non-expired invitations
);

-- List pending invitations for the currently authenticated user's email
-- Returns a JSON array of invitations with account info and token
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

GRANT EXECUTE ON FUNCTION public.list_invitations_for_current_user() TO authenticated;