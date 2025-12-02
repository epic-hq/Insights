-- Fix stuck interview that was uploaded with wrong mediaType
-- Replace 'YOUR_INTERVIEW_ID' with the actual interview ID

-- 1. Check current state
SELECT
    i.id,
    i.title,
    i.status as interview_status,
    i.media_url IS NOT NULL as has_media,
    i.transcript IS NOT NULL as has_transcript,
    LENGTH(i.transcript) as transcript_length
FROM interviews i
WHERE i.id = 'YOUR_INTERVIEW_ID';

-- 2. SIMPLE FIX: Just update the interview status to 'ready'
--    (No upload_jobs or analysis_jobs exist, so nothing else to fix)
UPDATE interviews
SET status = 'ready'
WHERE id = 'YOUR_INTERVIEW_ID';

-- 5. Verify the fix
SELECT
    i.id,
    i.title,
    i.status as interview_status,
    i.media_url IS NOT NULL as has_media,
    i.transcript IS NOT NULL as has_transcript,
    uj.status as upload_job_status,
    aj.status as analysis_job_status
FROM interviews i
LEFT JOIN upload_jobs uj ON uj.interview_id = i.id
LEFT JOIN analysis_jobs aj ON aj.interview_id = i.id
WHERE i.id = 'YOUR_INTERVIEW_ID';
