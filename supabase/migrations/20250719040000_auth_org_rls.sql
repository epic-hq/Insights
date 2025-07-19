-- 20250719040000_auth_org_rls.sql
-- Adds indexes, enum type, and row-level security policies for organizations & user_org_memberships

-- 1. Enum for membership roles -------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_role') THEN
    CREATE TYPE membership_role AS ENUM ('owner', 'member');
  END IF;
END $$;

-- drop existing check constraint on role (text)
ALTER TABLE public.user_org_memberships
  DROP CONSTRAINT IF EXISTS user_org_memberships_role_check;

-- convert text -> enum
ALTER TABLE public.user_org_memberships
  ALTER COLUMN role DROP DEFAULT,
  ALTER COLUMN role TYPE membership_role USING role::text::membership_role,
  ALTER COLUMN role SET DEFAULT 'member';

-- no additional constraint needed; enum itself enforces valid values

-- 2. Helpful indexes -----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_user_org_memberships_user ON public.user_org_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_user_org_memberships_org  ON public.user_org_memberships (org_id);

-- 3. Row-Level Security --------------------------------------------------------
ALTER TABLE public.organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_org_memberships ENABLE ROW LEVEL SECURITY;

-- a) Organizations: members of org may select/update their org row -------------
CREATE POLICY org_members_select ON public.organizations
  FOR SELECT USING (id IN (
    SELECT org_id FROM public.user_org_memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY org_members_update ON public.organizations
  FOR UPDATE USING (id IN (
    SELECT org_id FROM public.user_org_memberships WHERE user_id = auth.uid()
  ));

-- b) Memberships: user can manage their own membership row ---------------------
CREATE POLICY memberships_self ON public.user_org_memberships
  FOR ALL USING (user_id = auth.uid());

-- Default: owners can insert membership rows (invites) -------------------------
CREATE POLICY memberships_owner_insert ON public.user_org_memberships
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.user_org_memberships mus
      WHERE mus.org_id = org_id AND mus.role = 'owner'
    )
  );

-- 4. Future tables should follow same pattern: org_id column and RLS predicate
--    org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid;
