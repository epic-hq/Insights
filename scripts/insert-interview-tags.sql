-- Insert sample interview tags to demonstrate the normalized tag system
-- Run this in your Supabase SQL editor

-- First, let's see what interviews we have to work with
-- (Run this first to get actual interview IDs)
SELECT id, title, created_at FROM interviews LIMIT 5;

-- Insert some realistic interview tags into the tags table
-- (These will be upserted, so safe to run multiple times)
INSERT INTO tags (tag, account_id) 
SELECT tag, account_id FROM (
  SELECT DISTINCT 
    unnest(ARRAY[
      'customer discovery',
      'user onboarding', 
      'pricing research',
      'feature feedback',
      'usability testing',
      'competitive analysis',
      'market research',
      'product validation',
      'user journey mapping',
      'pain point analysis'
    ]) as tag,
    account_id
  FROM interviews 
  LIMIT 1
) t
ON CONFLICT (tag, account_id) DO NOTHING;

-- Now link some interviews to these tags
-- Replace the interview IDs below with actual IDs from your database
-- You can get these by running the first query above

-- Example: Tag first interview with discovery-related tags
-- Using the actual schema structure that was deployed
INSERT INTO interview_tags (interview_id, tag, account_id)
SELECT 
  i.id as interview_id,
  t.tag,
  i.account_id
FROM interviews i
CROSS JOIN (
  SELECT unnest(ARRAY['customer discovery', 'market research', 'pain point analysis']) as tag
) t
WHERE i.id = (SELECT id FROM interviews ORDER BY created_at LIMIT 1)
ON CONFLICT (interview_id, tag, account_id) DO NOTHING;

-- Example: Tag second interview with onboarding-related tags  
INSERT INTO interview_tags (interview_id, tag, account_id)
SELECT 
  i.id as interview_id,
  t.tag,
  i.account_id
FROM interviews i
CROSS JOIN (
  SELECT unnest(ARRAY['user onboarding', 'usability testing', 'user journey mapping']) as tag
) t
WHERE i.id = (SELECT id FROM interviews ORDER BY created_at OFFSET 1 LIMIT 1)
ON CONFLICT (interview_id, tag, account_id) DO NOTHING;

-- Example: Tag third interview with pricing-related tags
INSERT INTO interview_tags (interview_id, tag, account_id)
SELECT 
  i.id as interview_id,
  t.tag,
  i.account_id
FROM interviews i
CROSS JOIN (
  SELECT unnest(ARRAY['pricing research', 'feature feedback', 'competitive analysis']) as tag
) t
WHERE i.id = (SELECT id FROM interviews ORDER BY created_at OFFSET 2 LIMIT 1)
ON CONFLICT (interview_id, tag, account_id) DO NOTHING;

-- Verify the tags were inserted correctly
SELECT 
  i.title as interview_title,
  it.tag,
  i.created_at
FROM interviews i
JOIN interview_tags it ON i.id = it.interview_id
ORDER BY i.created_at, it.tag;
