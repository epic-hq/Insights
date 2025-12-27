-- Public Access Configuration for Projects
-- Enables projects to have a public-facing survey/chat interface at /r/:slug
-- Replaces the separate research_links table with integrated project config

-- Add public access columns to projects table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS public_slug text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS public_hero_title text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS public_hero_subtitle text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS public_cta_label text DEFAULT 'Share your feedback';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS public_cta_helper text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS public_allow_chat boolean DEFAULT false;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS public_redirect_url text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS public_calendar_url text;

-- Unique index for public slug lookup (only on non-null slugs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_public_slug
  ON public.projects(public_slug)
  WHERE public_slug IS NOT NULL;

-- Index for finding public projects by account
CREATE INDEX IF NOT EXISTS idx_projects_account_public
  ON public.projects(account_id, is_public)
  WHERE is_public = true;

-- Comments for documentation
COMMENT ON COLUMN public.projects.public_slug IS 'URL slug for public access at /r/:slug (auto-generated from name, can be customized)';
COMMENT ON COLUMN public.projects.is_public IS 'Whether the project is accessible via public link';
COMMENT ON COLUMN public.projects.public_hero_title IS 'Title displayed on public survey page';
COMMENT ON COLUMN public.projects.public_hero_subtitle IS 'Subtitle/description on public survey page';
COMMENT ON COLUMN public.projects.public_cta_label IS 'Call-to-action button text (default: Share your feedback)';
COMMENT ON COLUMN public.projects.public_cta_helper IS 'Helper text below the CTA button';
COMMENT ON COLUMN public.projects.public_allow_chat IS 'Whether AI chat mode is enabled for public responses';
COMMENT ON COLUMN public.projects.public_redirect_url IS 'URL to redirect to after survey completion';
COMMENT ON COLUMN public.projects.public_calendar_url IS 'Optional calendar booking link to show on public page';

-- Auto-generate public_slug from project name when is_public is set to true
CREATE OR REPLACE FUNCTION public.auto_generate_public_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter int := 0;
BEGIN
  -- Only generate if is_public is being set to true and public_slug is null
  IF NEW.is_public = true AND NEW.public_slug IS NULL THEN
    -- Generate base slug from project name
    base_slug := lower(
      trim(both '-' FROM
        regexp_replace(
          regexp_replace(COALESCE(NEW.name, 'project'), '[^A-Za-z0-9-]+', '-', 'g'),
        '-+', '-', 'g')
      )
    );

    -- Try base slug first
    final_slug := base_slug;

    -- Check for collisions and add suffix if needed
    WHILE EXISTS (SELECT 1 FROM public.projects WHERE public_slug = final_slug AND id != NEW.id) LOOP
      counter := counter + 1;
      -- Add 4-char random suffix
      final_slug := base_slug || '-' || substr(md5(random()::text), 1, 4);
      -- Safety valve
      IF counter > 10 THEN
        final_slug := base_slug || '-' || substr(md5(NEW.id::text || random()::text), 1, 8);
        EXIT;
      END IF;
    END LOOP;

    NEW.public_slug := final_slug;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate public slug
DROP TRIGGER IF EXISTS projects_auto_generate_public_slug ON public.projects;
CREATE TRIGGER projects_auto_generate_public_slug
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_public_slug();

-- Slugify public_slug on manual entry (normalize format)
CREATE OR REPLACE FUNCTION public.slugify_public_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.public_slug IS NOT NULL AND NEW.public_slug IS DISTINCT FROM OLD.public_slug THEN
    NEW.public_slug := lower(
      trim(both '-' FROM
        regexp_replace(
          regexp_replace(NEW.public_slug, '[^A-Za-z0-9-]+', '-', 'g'),
        '-+', '-', 'g')
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS projects_slugify_public_slug ON public.projects;
CREATE TRIGGER projects_slugify_public_slug
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.slugify_public_slug();
