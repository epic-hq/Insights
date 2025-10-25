-- Fix: Prevent FK constraint violation when deleting people
-- The trigger on interview_people was trying to update project_people
-- even when the person was being cascade-deleted
-- Solution: Catch and ignore FK violations in the trigger

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
        -- CRITICAL: Silently ignore FK violations during CASCADE DELETE
        -- When a person is being deleted, interview_people CASCADE deletes trigger this,
        -- but we can't update project_people because the person is gone
        BEGIN
            IF OLD.project_id IS NOT NULL THEN
                PERFORM update_project_people_stats(
                    OLD.project_id,
                    OLD.person_id
                );
            END IF;
        EXCEPTION
            WHEN foreign_key_violation THEN
                -- Silently ignore - person is being cascade deleted
                NULL;
        END;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
