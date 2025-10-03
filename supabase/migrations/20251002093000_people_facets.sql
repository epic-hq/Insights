BEGIN;

SET search_path = public;

-- Global facet kinds
CREATE TABLE IF NOT EXISTS facet_kind_global (
  id serial PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_facet_kind_global_timestamp ON public.facet_kind_global;
CREATE TRIGGER set_facet_kind_global_timestamp
  BEFORE INSERT OR UPDATE ON public.facet_kind_global
  FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_timestamps();

DROP TRIGGER IF EXISTS set_facet_kind_global_user_tracking ON public.facet_kind_global;
CREATE TRIGGER set_facet_kind_global_user_tracking
  BEFORE INSERT OR UPDATE ON public.facet_kind_global
  FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_user_tracking();

ALTER TABLE public.facet_kind_global ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies
		WHERE schemaname = 'public'
		  AND tablename = 'facet_kind_global'
		  AND policyname = 'All authenticated can select'
	) THEN
		CREATE POLICY "All authenticated can select"
		  ON public.facet_kind_global
		  FOR SELECT
		  TO authenticated
		  USING (true);
	END IF;
END$$;

-- Global facets
CREATE TABLE IF NOT EXISTS facet_global (
  id serial PRIMARY KEY,
  kind_id int NOT NULL REFERENCES public.facet_kind_global(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  synonyms text[] DEFAULT '{}',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_facet_global_kind ON public.facet_global(kind_id);

DROP TRIGGER IF EXISTS set_facet_global_timestamp ON public.facet_global;
CREATE TRIGGER set_facet_global_timestamp
  BEFORE INSERT OR UPDATE ON public.facet_global
  FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_timestamps();

DROP TRIGGER IF EXISTS set_facet_global_user_tracking ON public.facet_global;
CREATE TRIGGER set_facet_global_user_tracking
  BEFORE INSERT OR UPDATE ON public.facet_global
  FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_user_tracking();

ALTER TABLE public.facet_global ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies
		WHERE schemaname = 'public'
		  AND tablename = 'facet_global'
		  AND policyname = 'All authenticated can read'
	) THEN
		CREATE POLICY "All authenticated can read"
		  ON public.facet_global
		  FOR SELECT
		  TO authenticated
		  USING (true);
	END IF;
END$$;

-- Account-level facets
CREATE TABLE IF NOT EXISTS facet_account (
  id serial PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts.accounts (id) ON DELETE CASCADE,
  kind_id int NOT NULL REFERENCES public.facet_kind_global(id) ON DELETE RESTRICT,
  global_facet_id int REFERENCES public.facet_global(id) ON DELETE SET NULL,
  slug text NOT NULL,
  label text NOT NULL,
  synonyms text[] DEFAULT '{}',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT facet_account_unique_slug UNIQUE (account_id, kind_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_facet_account_account ON public.facet_account(account_id);
CREATE INDEX IF NOT EXISTS idx_facet_account_kind ON public.facet_account(kind_id);

DROP TRIGGER IF EXISTS set_facet_account_timestamp ON public.facet_account;
CREATE TRIGGER set_facet_account_timestamp
  BEFORE INSERT OR UPDATE ON public.facet_account
  FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_timestamps();

DROP TRIGGER IF EXISTS set_facet_account_user_tracking ON public.facet_account;
CREATE TRIGGER set_facet_account_user_tracking
  BEFORE INSERT OR UPDATE ON public.facet_account
  FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_user_tracking();

ALTER TABLE public.facet_account ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies
		WHERE schemaname = 'public'
		  AND tablename = 'facet_account'
		  AND policyname = 'Account members can select'
	) THEN
		CREATE POLICY "Account members can select" ON public.facet_account
		  FOR SELECT TO authenticated
		  USING (account_id IN (SELECT accounts.get_accounts_with_role()));
	END IF;
END$$;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies
		WHERE schemaname = 'public'
		  AND tablename = 'facet_account'
		  AND policyname = 'Account members can insert'
	) THEN
		CREATE POLICY "Account members can insert" ON public.facet_account
		  FOR INSERT TO authenticated
		  WITH CHECK (account_id IN (SELECT accounts.get_accounts_with_role()));
	END IF;
END$$;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies
		WHERE schemaname = 'public'
		  AND tablename = 'facet_account'
		  AND policyname = 'Account members can update'
	) THEN
		CREATE POLICY "Account members can update" ON public.facet_account
		  FOR UPDATE TO authenticated
		  USING (account_id IN (SELECT accounts.get_accounts_with_role()));
	END IF;
END$$;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies
		WHERE schemaname = 'public'
		  AND tablename = 'facet_account'
		  AND policyname = 'Account owners can delete'
	) THEN
		CREATE POLICY "Account owners can delete" ON public.facet_account
		  FOR DELETE TO authenticated
		  USING (account_id IN (SELECT accounts.get_accounts_with_role('owner')));
	END IF;
END$$;

-- Project-level facet configuration
CREATE TABLE IF NOT EXISTS project_facet (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts.accounts(id) ON DELETE CASCADE,
  facet_ref text NOT NULL,
  scope text NOT NULL DEFAULT 'catalog' CHECK (scope IN ('catalog','project')),
  kind_slug text,
  label text,
  synonyms text[] DEFAULT '{}',
  is_enabled boolean DEFAULT true,
  alias text,
  pinned boolean DEFAULT false,
  sort_weight int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_facet_ref_pattern CHECK (
    (scope = 'catalog' AND facet_ref ~ '^(g|a):[0-9]+$' AND kind_slug IS NULL AND label IS NULL)
    OR (scope = 'project' AND facet_ref ~ '^p:[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$' AND kind_slug IS NOT NULL AND label IS NOT NULL)
  ),
  PRIMARY KEY (project_id, facet_ref)
);

CREATE INDEX IF NOT EXISTS idx_project_facet_account ON public.project_facet(account_id);

DROP TRIGGER IF EXISTS set_project_facet_timestamp ON public.project_facet;
CREATE TRIGGER set_project_facet_timestamp
  BEFORE INSERT OR UPDATE ON public.project_facet
  FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_timestamps();

DROP TRIGGER IF EXISTS set_project_facet_user_tracking ON public.project_facet;
CREATE TRIGGER set_project_facet_user_tracking
  BEFORE INSERT OR UPDATE ON public.project_facet
  FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_user_tracking();

ALTER TABLE public.project_facet ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies
		WHERE schemaname = 'public'
		  AND tablename = 'project_facet'
		  AND policyname = 'Account members can select'
	) THEN
		CREATE POLICY "Account members can select" ON public.project_facet
		  FOR SELECT TO authenticated
		  USING (account_id IN (SELECT accounts.get_accounts_with_role()));
	END IF;
END$$;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies
		WHERE schemaname = 'public'
		  AND tablename = 'project_facet'
		  AND policyname = 'Account members can insert'
	) THEN
		CREATE POLICY "Account members can insert" ON public.project_facet
		  FOR INSERT TO authenticated
		  WITH CHECK (
			account_id IN (SELECT accounts.get_accounts_with_role())
			AND project_id IN (SELECT p.id FROM public.projects p WHERE p.account_id = account_id)
		  );
	END IF;
END$$;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies
		WHERE schemaname = 'public'
		  AND tablename = 'project_facet'
		  AND policyname = 'Account members can update'
	) THEN
		CREATE POLICY "Account members can update" ON public.project_facet
		  FOR UPDATE TO authenticated
		  USING (account_id IN (SELECT accounts.get_accounts_with_role()))
		  WITH CHECK (
			account_id IN (SELECT accounts.get_accounts_with_role())
			AND project_id IN (SELECT p.id FROM public.projects p WHERE p.account_id = account_id)
		  );
	END IF;
END$$;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies
		WHERE schemaname = 'public'
		  AND tablename = 'project_facet'
		  AND policyname = 'Account owners can delete'
	) THEN
		CREATE POLICY "Account owners can delete" ON public.project_facet
		  FOR DELETE TO authenticated
		  USING (account_id IN (SELECT accounts.get_accounts_with_role('owner')));
	END IF;
END$$;

-- Facet candidates
CREATE TABLE IF NOT EXISTS facet_candidate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts.accounts(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  kind_slug text NOT NULL,
  label text NOT NULL,
  synonyms text[] DEFAULT '{}',
  source text NOT NULL CHECK (source IN ('interview','survey','telemetry','inferred','manual','document')),
  evidence_id uuid,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','merged')),
  resolved_facet_ref text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT facet_candidate_unique UNIQUE (account_id, project_id, kind_slug, label)
);

CREATE INDEX IF NOT EXISTS idx_facet_candidate_account ON public.facet_candidate(account_id);
CREATE INDEX IF NOT EXISTS idx_facet_candidate_project ON public.facet_candidate(project_id);

DROP TRIGGER IF EXISTS set_facet_candidate_timestamp ON public.facet_candidate;
CREATE TRIGGER set_facet_candidate_timestamp
  BEFORE INSERT OR UPDATE ON public.facet_candidate
  FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_timestamps();

DROP TRIGGER IF EXISTS set_facet_candidate_user_tracking ON public.facet_candidate;
CREATE TRIGGER set_facet_candidate_user_tracking
  BEFORE INSERT OR UPDATE ON public.facet_candidate
  FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_user_tracking();

ALTER TABLE public.facet_candidate ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies
		WHERE schemaname = 'public'
		  AND tablename = 'facet_candidate'
		  AND policyname = 'Account members can select'
	) THEN
		CREATE POLICY "Account members can select" ON public.facet_candidate
		  FOR SELECT TO authenticated
		  USING (account_id IN (SELECT accounts.get_accounts_with_role()));
	END IF;
END$$;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies
		WHERE schemaname = 'public'
		  AND tablename = 'facet_candidate'
		  AND policyname = 'Account members can insert'
	) THEN
		CREATE POLICY "Account members can insert" ON public.facet_candidate
		  FOR INSERT TO authenticated
		  WITH CHECK (
			account_id IN (SELECT accounts.get_accounts_with_role())
			AND project_id IN (SELECT p.id FROM public.projects p WHERE p.account_id = account_id)
		  );
	END IF;
END$$;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies
		WHERE schemaname = 'public'
		  AND tablename = 'facet_candidate'
		  AND policyname = 'Account members can update'
	) THEN
		CREATE POLICY "Account members can update" ON public.facet_candidate
		  FOR UPDATE TO authenticated
		  USING (account_id IN (SELECT accounts.get_accounts_with_role()))
		  WITH CHECK (
			account_id IN (SELECT accounts.get_accounts_with_role())
			AND project_id IN (SELECT p.id FROM public.projects p WHERE p.account_id = account_id)
		  );
	END IF;
END$$;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies
		WHERE schemaname = 'public'
		  AND tablename = 'facet_candidate'
		  AND policyname = 'Account owners can delete'
	) THEN
		CREATE POLICY "Account owners can delete" ON public.facet_candidate
		  FOR DELETE TO authenticated
		  USING (account_id IN (SELECT accounts.get_accounts_with_role('owner')));
	END IF;
END$$;

-- Person facet assignments
CREATE TABLE IF NOT EXISTS person_facet (
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts.accounts(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  facet_ref text NOT NULL,
  source text NOT NULL CHECK (source IN ('interview','survey','telemetry','inferred','manual','document')),
  evidence_id uuid,
  confidence numeric DEFAULT 0.8 CHECK (confidence >= 0 AND confidence <= 1),
  noted_at timestamptz DEFAULT now(),
  candidate_id uuid REFERENCES public.facet_candidate(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT person_facet_ref_pattern CHECK (facet_ref ~ '^(g|a|p):[0-9a-zA-Z-]+$'),
  PRIMARY KEY (person_id, facet_ref)
);

CREATE INDEX IF NOT EXISTS idx_person_facet_account ON public.person_facet(account_id);
CREATE INDEX IF NOT EXISTS idx_person_facet_project ON public.person_facet(project_id);

DROP TRIGGER IF EXISTS set_person_facet_timestamp ON public.person_facet;
CREATE TRIGGER set_person_facet_timestamp
  BEFORE INSERT OR UPDATE ON public.person_facet
  FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_timestamps();

DROP TRIGGER IF EXISTS set_person_facet_user_tracking ON public.person_facet;
CREATE TRIGGER set_person_facet_user_tracking
  BEFORE INSERT OR UPDATE ON public.person_facet
  FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_user_tracking();

ALTER TABLE public.person_facet ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies
		WHERE schemaname = 'public'
		  AND tablename = 'person_facet'
		  AND policyname = 'Account members can select'
	) THEN
		CREATE POLICY "Account members can select" ON public.person_facet
		  FOR SELECT TO authenticated
		  USING (account_id IN (SELECT accounts.get_accounts_with_role()));
	END IF;
END$$;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies
		WHERE schemaname = 'public'
		  AND tablename = 'person_facet'
		  AND policyname = 'Account members can insert'
	) THEN
		CREATE POLICY "Account members can insert" ON public.person_facet
		  FOR INSERT TO authenticated
		  WITH CHECK (
			account_id IN (SELECT accounts.get_accounts_with_role())
			AND project_id IN (SELECT p.id FROM public.projects p WHERE p.account_id = account_id)
		  );
	END IF;
END$$;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies
		WHERE schemaname = 'public'
		  AND tablename = 'person_facet'
		  AND policyname = 'Account members can update'
	) THEN
		CREATE POLICY "Account members can update" ON public.person_facet
		  FOR UPDATE TO authenticated
		  USING (account_id IN (SELECT accounts.get_accounts_with_role()))
		  WITH CHECK (
			account_id IN (SELECT accounts.get_accounts_with_role())
			AND project_id IN (SELECT p.id FROM public.projects p WHERE p.account_id = account_id)
		  );
	END IF;
END$$;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies
		WHERE schemaname = 'public'
		  AND tablename = 'person_facet'
		  AND policyname = 'Account owners can delete'
	) THEN
		CREATE POLICY "Account owners can delete" ON public.person_facet
		  FOR DELETE TO authenticated
		  USING (account_id IN (SELECT accounts.get_accounts_with_role('owner')));
	END IF;
END$$;

-- Person scales
CREATE TABLE IF NOT EXISTS person_scale (
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts.accounts(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  kind_slug text NOT NULL,
  score numeric NOT NULL CHECK (score >= 0 AND score <= 1),
  band text,
  source text NOT NULL CHECK (source IN ('interview','survey','telemetry','inferred','manual','document')),
  evidence_id uuid,
  confidence numeric DEFAULT 0.8 CHECK (confidence >= 0 AND confidence <= 1),
  noted_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (person_id, kind_slug)
);

CREATE INDEX IF NOT EXISTS idx_person_scale_account ON public.person_scale(account_id);
CREATE INDEX IF NOT EXISTS idx_person_scale_project ON public.person_scale(project_id);

DROP TRIGGER IF EXISTS set_person_scale_timestamp ON public.person_scale;
CREATE TRIGGER set_person_scale_timestamp
  BEFORE INSERT OR UPDATE ON public.person_scale
  FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_timestamps();

DROP TRIGGER IF EXISTS set_person_scale_user_tracking ON public.person_scale;
CREATE TRIGGER set_person_scale_user_tracking
  BEFORE INSERT OR UPDATE ON public.person_scale
  FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_user_tracking();

ALTER TABLE public.person_scale ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies
		WHERE schemaname = 'public'
		  AND tablename = 'person_scale'
		  AND policyname = 'Account members can select'
	) THEN
		CREATE POLICY "Account members can select" ON public.person_scale
		  FOR SELECT TO authenticated
		  USING (account_id IN (SELECT accounts.get_accounts_with_role()));
	END IF;
END$$;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies
		WHERE schemaname = 'public'
		  AND tablename = 'person_scale'
		  AND policyname = 'Account members can insert'
	) THEN
		CREATE POLICY "Account members can insert" ON public.person_scale
		  FOR INSERT TO authenticated
		  WITH CHECK (
			account_id IN (SELECT accounts.get_accounts_with_role())
			AND project_id IN (SELECT p.id FROM public.projects p WHERE p.account_id = account_id)
		  );
	END IF;
END$$;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies
		WHERE schemaname = 'public'
		  AND tablename = 'person_scale'
		  AND policyname = 'Account members can update'
	) THEN
		CREATE POLICY "Account members can update" ON public.person_scale
		  FOR UPDATE TO authenticated
		  USING (account_id IN (SELECT accounts.get_accounts_with_role()))
		  WITH CHECK (
			account_id IN (SELECT accounts.get_accounts_with_role())
			AND project_id IN (SELECT p.id FROM public.projects p WHERE p.account_id = account_id)
		  );
	END IF;
END$$;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies
		WHERE schemaname = 'public'
		  AND tablename = 'person_scale'
		  AND policyname = 'Account owners can delete'
	) THEN
		CREATE POLICY "Account owners can delete" ON public.person_scale
		  FOR DELETE TO authenticated
		  USING (account_id IN (SELECT accounts.get_accounts_with_role('owner')));
	END IF;
END$$;

COMMIT;
