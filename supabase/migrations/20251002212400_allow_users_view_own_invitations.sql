-- Allow users to view invitations sent to their email address
-- This enables the /invites page to work for users who aren't yet members of the account

CREATE POLICY "Users can view invitations sent to their email"
ON accounts.invitations
FOR SELECT
TO authenticated
USING (
  invitee_email IS NOT NULL
  AND lower(invitee_email) = lower(auth.jwt() ->> 'email')
);
