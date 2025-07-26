-- Comprehensive migration to convert tags table from TEXT PK to UUID PK
-- and update all foreign key references

BEGIN;

-- Step 1: Add UUID id column to tags table (keeping existing data)
ALTER TABLE public.tags ADD COLUMN id UUID DEFAULT gen_random_uuid();

-- Step 2: Populate id values for existing tags
UPDATE public.tags SET id = gen_random_uuid() WHERE id IS NULL;

-- Step 3: Make id NOT NULL
ALTER TABLE public.tags ALTER COLUMN id SET NOT NULL;

-- Step 4: Add tag_id column to junction tables
ALTER TABLE public.insight_tags ADD COLUMN tag_id UUID;
ALTER TABLE public.interview_tags ADD COLUMN tag_id UUID;

-- Step 5: Clean up orphaned records (insight_tags with no matching tag)
DELETE FROM public.insight_tags WHERE tag NOT IN (SELECT tag FROM public.tags);
DELETE FROM public.interview_tags WHERE tag NOT IN (SELECT tag FROM public.tags);

-- Step 6: Populate tag_id values by joining with tags table
UPDATE public.insight_tags 
SET tag_id = t.id 
FROM public.tags t 
WHERE insight_tags.tag = t.tag;

UPDATE public.interview_tags 
SET tag_id = t.id 
FROM public.tags t 
WHERE interview_tags.tag = t.tag;

-- Step 7: Make tag_id NOT NULL
ALTER TABLE public.insight_tags ALTER COLUMN tag_id SET NOT NULL;
ALTER TABLE public.interview_tags ALTER COLUMN tag_id SET NOT NULL;

-- Step 7: Drop old constraints and indexes
ALTER TABLE public.insight_tags DROP CONSTRAINT IF EXISTS insight_tags_tag_fkey;
ALTER TABLE public.interview_tags DROP CONSTRAINT IF EXISTS interview_tags_tag_fkey;
DROP INDEX IF EXISTS public.idx_insight_tags_tag;
DROP INDEX IF EXISTS public.idx_interview_tags_tag;

-- Step 8: Drop old primary key and unique constraints
ALTER TABLE public.tags DROP CONSTRAINT IF EXISTS tags_pkey;
ALTER TABLE public.insight_tags DROP CONSTRAINT IF EXISTS insight_tags_insight_id_tag_account_id_key;
ALTER TABLE public.interview_tags DROP CONSTRAINT IF EXISTS interview_tags_interview_id_tag_account_id_key;

-- Step 9: Create new primary key on tags.id
ALTER TABLE public.tags ADD CONSTRAINT tags_pkey PRIMARY KEY (id);

-- Step 10: Add foreign key constraints for tag_id
ALTER TABLE public.insight_tags ADD CONSTRAINT insight_tags_tag_id_fkey 
  FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;
ALTER TABLE public.interview_tags ADD CONSTRAINT interview_tags_tag_id_fkey 
  FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;

-- Step 11: Add new unique constraints
ALTER TABLE public.insight_tags ADD CONSTRAINT insight_tags_insight_id_tag_id_account_id_key 
  UNIQUE (insight_id, tag_id, account_id);
ALTER TABLE public.interview_tags ADD CONSTRAINT interview_tags_interview_id_tag_id_account_id_key 
  UNIQUE (interview_id, tag_id, account_id);

-- Step 12: Create new indexes
CREATE INDEX idx_insight_tags_tag_id ON public.insight_tags(tag_id);
CREATE INDEX idx_interview_tags_tag_id ON public.interview_tags(tag_id);

-- Step 13: Drop old tag columns from junction tables
ALTER TABLE public.insight_tags DROP COLUMN tag;
ALTER TABLE public.interview_tags DROP COLUMN tag;

COMMIT;
