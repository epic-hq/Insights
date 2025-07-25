-- Check what interview_tags table structure actually exists in the database
-- Run this first to see the actual schema

-- 1. Check the table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'interview_tags' 
ORDER BY ordinal_position;

-- 2. Check what unique constraints exist
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'interview_tags'
    AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
ORDER BY tc.constraint_name, kcu.ordinal_position;

-- 3. Check if the table exists and has any data
SELECT COUNT(*) as row_count FROM interview_tags;

-- 4. Sample a few rows to see the actual structure
SELECT * FROM interview_tags LIMIT 3;
