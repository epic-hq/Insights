-- Fixed version: Insert interview tags matching the actual deployed schema
-- This version handles both possible schema structures

-- First, check what structure we have:
-- If this query works, you have the TEXT version:
-- SELECT interview_id, tag, account_id FROM interview_tags LIMIT 1;

-- If this query works, you have the UUID version:  
-- SELECT interview_id, tag_id, account_id FROM interview_tags LIMIT 1;

-- VERSION 1: For schema with 'tag TEXT' (what was likely deployed)
-- Insert tags into tags table first
INSERT INTO tags (tag, account_id) 
SELECT DISTINCT
    tag_name,
    (SELECT account_id FROM interviews LIMIT 1) as account_id
FROM (
    SELECT unnest(ARRAY[
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
    ]) as tag_name
) t
ON CONFLICT (tag, account_id) DO NOTHING;

-- Insert interview_tags using TEXT tag field
-- Tag first interview
INSERT INTO interview_tags (interview_id, tag, account_id)
SELECT 
    i.id,
    t.tag_name,
    i.account_id
FROM interviews i
CROSS JOIN (
    SELECT unnest(ARRAY['customer discovery', 'market research', 'pain point analysis']) as tag_name
) t
WHERE i.id = (SELECT id FROM interviews ORDER BY created_at LIMIT 1)
ON CONFLICT (interview_id, tag, account_id) DO NOTHING;

-- Tag second interview  
INSERT INTO interview_tags (interview_id, tag, account_id)
SELECT 
    i.id,
    t.tag_name,
    i.account_id
FROM interviews i
CROSS JOIN (
    SELECT unnest(ARRAY['user onboarding', 'usability testing', 'user journey mapping']) as tag_name
) t
WHERE i.id = (SELECT id FROM interviews ORDER BY created_at OFFSET 1 LIMIT 1)
ON CONFLICT (interview_id, tag, account_id) DO NOTHING;

-- Tag third interview
INSERT INTO interview_tags (interview_id, tag, account_id)
SELECT 
    i.id,
    t.tag_name,
    i.account_id
FROM interviews i
CROSS JOIN (
    SELECT unnest(ARRAY['pricing research', 'feature feedback', 'competitive analysis']) as tag_name
) t
WHERE i.id = (SELECT id FROM interviews ORDER BY created_at OFFSET 2 LIMIT 1)
ON CONFLICT (interview_id, tag, account_id) DO NOTHING;

-- Verify the results
SELECT 
    i.title as interview_title,
    it.tag,
    i.created_at
FROM interviews i
JOIN interview_tags it ON i.id = it.interview_id
ORDER BY i.created_at, it.tag;
