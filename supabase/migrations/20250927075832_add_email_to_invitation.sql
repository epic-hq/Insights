-- Add invitee_email to invitations and update RPCs
BEGIN;

-- 1) Add column to store the invitee email
ALTER TABLE accounts.invitations
  ADD COLUMN IF NOT EXISTS invitee_email text;

-- 2) Replace get_account_invitations to include email in the JSON payload
CREATE OR REPLACE FUNCTION public.get_account_invitations(
  account_id uuid,
  results_limit integer DEFAULT 25,
  results_offset integer DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
AS $$
BEGIN
  -- only account owners can access this function
  IF (
    SELECT public.current_user_account_role(get_account_invitations.account_id) ->> 'account_role'
  ) <> 'owner' THEN
    RAISE EXCEPTION 'Only account owners can access this function';
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
      AND i.created_at > now() - interval '24 hours'
    LIMIT COALESCE(get_account_invitations.results_limit, 25)
    OFFSET COALESCE(get_account_invitations.results_offset, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_account_invitations(uuid, integer, integer) TO authenticated;

-- 3) Replace create_invitation to accept optional invitee_email
DROP FUNCTION IF EXISTS public.create_invitation(uuid, accounts.account_role, accounts.invitation_type);

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

GRANT EXECUTE ON FUNCTION public.create_invitation(uuid, accounts.account_role, accounts.invitation_type, text) TO authenticated;

COMMIT;
