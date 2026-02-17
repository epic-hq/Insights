-- People Segmentation Schema Updates
-- Adds B2B and B2C segmentation fields
-- Migrates segment data to facets
-- See docs/architecture/segments-and-targeting.md for details

-- Add B2B segmentation fields to people
ALTER TABLE people ADD COLUMN IF NOT EXISTS job_function TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS seniority_level TEXT;

-- Add B2C segmentation fields to people
ALTER TABLE people ADD COLUMN IF NOT EXISTS age_range TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS life_stage TEXT;

COMMENT ON COLUMN people.job_function IS 'Department/function: Engineering, Product, Sales, Marketing, etc.';
COMMENT ON COLUMN people.seniority_level IS 'Level: C-Level, VP, Director, Manager, IC (Individual Contributor)';
COMMENT ON COLUMN people.age_range IS 'Age bracket: 18-24, 25-34, 35-44, 45-54, 55-64, 65+';
COMMENT ON COLUMN people.life_stage IS 'Life stage: Student, New Grad, New Parent, Empty Nester, Retiree, etc.';

-- Update existing column comments for clarity
COMMENT ON COLUMN people.title IS 'Job title (B2B): VP of Engineering, Senior Product Manager, etc.';
COMMENT ON COLUMN people.role IS 'DEPRECATED: Use job_function for job role. This field will be removed. Interview role is in interview_people.role.';
COMMENT ON COLUMN people.segment IS 'DEPRECATED: Migrated to persona facets. This field will be removed.';

-- Add target_segments field to projects for ICP hypothesis tracking
ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_segments JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN projects.target_segments IS 'Target ICP hypothesis: {b2b_targets: {job_titles: [], functions: [], seniority: [], company_sizes: [], industries: []}, b2c_targets: {age_ranges: [], life_stages: [], personas: []}}';

-- Index for faster querying
CREATE INDEX IF NOT EXISTS idx_people_job_function ON people(job_function) WHERE job_function IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_people_seniority ON people(seniority_level) WHERE seniority_level IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_people_age_range ON people(age_range) WHERE age_range IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_people_life_stage ON people(life_stage) WHERE life_stage IS NOT NULL;

-- GIN index for target_segments JSONB queries
CREATE INDEX IF NOT EXISTS idx_projects_target_segments ON projects USING GIN (target_segments);
