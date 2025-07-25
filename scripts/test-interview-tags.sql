-- Test the corrected interview_tags schema
-- This should now work with the fixed foreign key references

-- First, check what interviews we have
SELECT id, title, account_id FROM interviews LIMIT 3;

-- Insert some test tags into the tags table
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
        'usability testing'
    ]) as tag_name
) t
ON CONFLICT (tag) DO NOTHING;

-- Now test inserting interview_tags with the corrected schema
-- Tag the first interview
INSERT INTO interview_tags (interview_id, tag, account_id)
SELECT 
    i.id,
    'customer discovery',
    i.account_id
FROM interviews i 
ORDER BY i.created_at 
LIMIT 1
ON CONFLICT (interview_id, tag, account_id) DO NOTHING;

-- Tag the second interview
INSERT INTO interview_tags (interview_id, tag, account_id)
SELECT 
    i.id,
    'user onboarding',
    i.account_id
FROM interviews i 
ORDER BY i.created_at 
OFFSET 1 LIMIT 1
ON CONFLICT (interview_id, tag, account_id) DO NOTHING;

-- Verify the results
SELECT 
    i.title as interview_title,
    it.tag,
    i.created_at
FROM interviews i
JOIN interview_tags it ON i.id = it.interview_id
ORDER BY i.created_at, it.tag;
