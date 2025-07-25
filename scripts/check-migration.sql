-- Check Migration Results
-- Run these queries in your Supabase SQL editor to verify the migration

-- 1. Check how many insights had their related_tags migrated (should be NULL now)
SELECT 
  COUNT(*) as total_insights,
  COUNT(related_tags) as insights_with_arrays,
  COUNT(*) - COUNT(related_tags) as insights_migrated
FROM insights;

-- 2. Check how many opportunities had their related_insight_ids migrated (should be NULL now)  
SELECT 
  COUNT(*) as total_opportunities,
  COUNT(related_insight_ids) as opportunities_with_arrays,
  COUNT(*) - COUNT(related_insight_ids) as opportunities_migrated
FROM opportunities;

-- 3. Check the new junction table records created
SELECT 
  'insight_tags' as table_name,
  COUNT(*) as records_created
FROM insight_tags
UNION ALL
SELECT 
  'opportunity_insights' as table_name,
  COUNT(*) as records_created  
FROM opportunity_insights;

-- 4. Sample the migrated data - see actual insight tags
SELECT 
  i.name as insight_name,
  it.tag,
  t.tag as tag_record
FROM insights i
JOIN insight_tags it ON i.id = it.insight_id
JOIN tags t ON it.tag = t.tag
LIMIT 10;

-- 5. Sample the migrated data - see actual opportunity insights
SELECT 
  o.title as opportunity_title,
  i.name as insight_name,
  oi.weight
FROM opportunities o
JOIN opportunity_insights oi ON o.id = oi.opportunity_id  
JOIN insights i ON oi.insight_id = i.id
LIMIT 10;

-- 6. Verify no data loss - check if any insights/opportunities still have array data
SELECT 'Insights with remaining arrays' as check_type, COUNT(*) as count
FROM insights 
WHERE related_tags IS NOT NULL
UNION ALL
SELECT 'Opportunities with remaining arrays' as check_type, COUNT(*) as count
FROM opportunities
WHERE related_insight_ids IS NOT NULL;
