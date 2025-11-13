-- Check the current SUPABASE_ANON_KEY in vault
SELECT name, created_at,
       substring(decrypted_secret, 1, 50) || '...' as key_preview
FROM vault.decrypted_secrets
WHERE name = 'SUPABASE_ANON_KEY'
ORDER BY created_at DESC
LIMIT 1;

-- The correct key should be:
-- eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiZ2lucXZna29ubm9rdHJ0dHF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyMTcxMDksImV4cCI6MjA2Nzc5MzEwOX0.Z_ybpc9JF1rJCNNpF00ze2gTp99iHgBVt-IHqCh4pvw

-- If wrong, update it:
-- DELETE FROM vault.secrets WHERE name = 'SUPABASE_ANON_KEY';
-- SELECT vault.create_secret(
--   'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiZ2lucXZna29ubm9rdHJ0dHF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyMTcxMDksImV4cCI6MjA2Nzc5MzEwOX0.Z_ybpc9JF1rJCNNpF00ze2gTp99iHgBVt-IHqCh4pvw',
--   'SUPABASE_ANON_KEY'
-- );
