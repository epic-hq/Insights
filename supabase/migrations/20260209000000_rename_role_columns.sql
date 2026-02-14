-- Phase 2: Rename ambiguous 'role' columns for clarity
-- people_organizations.role -> job_title (person's title at that org)
-- project_people.role -> relationship_type (person's relationship to project)
-- See _bmad-output/schema-cleanup-people-table.md

-- Step 1: Rename people_organizations.role -> job_title
ALTER TABLE people_organizations RENAME COLUMN role TO job_title;

COMMENT ON COLUMN people_organizations.job_title IS 'Person''s job title at this organization (e.g. VP of Engineering)';

-- Step 2: Rename project_people.role -> relationship_type
ALTER TABLE project_people RENAME COLUMN role TO relationship_type;

COMMENT ON COLUMN project_people.relationship_type IS 'Person''s relationship to the project: primary_user, stakeholder, expert, etc.';

-- Step 3: Add job_title facet kind if not exists (for title sync)
INSERT INTO facet_kind_global (slug, label, description)
VALUES ('job_title', 'Job Title', 'Raw job title text (e.g. VP of Engineering). Distinct from AI-inferred job_function.')
ON CONFLICT (slug) DO NOTHING;
