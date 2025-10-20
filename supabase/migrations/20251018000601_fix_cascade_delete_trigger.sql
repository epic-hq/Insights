-- Fix cascade delete issue in trigger_update_project_people
-- When an interview is deleted, CASCADE DELETE removes interview_people records AFTER the interview is gone
-- The trigger was trying to query the deleted interview, getting NULL project_id, causing constraint violations

CREATE OR REPLACE FUNCTION trigger_update_project_people()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Use project_id from interview_people table (can also query interview if needed)
        PERFORM update_project_people_stats(
            COALESCE(NEW.project_id, (SELECT project_id FROM interviews WHERE id = NEW.interview_id)),
            NEW.person_id
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- CRITICAL: Use project_id directly from OLD record since interview may already be cascade-deleted
        -- Don't query interviews table - it may be gone already due to CASCADE DELETE
        IF OLD.project_id IS NOT NULL THEN
            PERFORM update_project_people_stats(
                OLD.project_id,
                OLD.person_id
            );
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
