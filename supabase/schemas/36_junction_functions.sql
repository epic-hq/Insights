-- Helper functions for managing junction table relationships

-- Function to sync insight tags from array to junction table
CREATE OR REPLACE FUNCTION sync_insight_tags(
    p_insight_id UUID,
    p_tag_names TEXT[],
    p_account_id UUID
) RETURNS VOID AS $$
DECLARE
    tag_record RECORD;
    tag_id_var UUID;
BEGIN
    -- Remove existing tags for this insight
    DELETE FROM insight_tags WHERE insight_id = p_insight_id;

    -- Add new tags
    IF p_tag_names IS NOT NULL AND array_length(p_tag_names, 1) > 0 THEN
        FOREACH tag_record.tag IN ARRAY p_tag_names LOOP
            -- Find or create the tag
            SELECT account_id, tag INTO tag_id_var
            FROM tags
            WHERE account_id = p_account_id AND tag = tag_record.tag;

            -- If tag doesn't exist, create it
            IF NOT FOUND THEN
                INSERT INTO tags (account_id, tag, created_at)
                VALUES (p_account_id, tag_record.tag, NOW());
                tag_id_var := p_account_id || tag_record.tag; -- Composite key reference
            END IF;

            -- Insert junction record
            INSERT INTO insight_tags (insight_id, tag_id, created_at)
            VALUES (p_insight_id, tag_id_var, NOW())
            ON CONFLICT (insight_id, tag_id) DO NOTHING;
        END LOOP;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -- Create trigger to sync insight tags
-- CREATE TRIGGER sync_insight_tags
--     AFTER INSERT OR UPDATE ON insights
--     FOR EACH ROW EXECUTE FUNCTION sync_insight_tags(
--         NEW.id,
--         NEW.tags,
--         NEW.account_id
--     );

-- Function to sync opportunity insights from array to junction table
CREATE OR REPLACE FUNCTION sync_opportunity_insights(
    p_opportunity_id UUID,
    p_insight_ids UUID[]
) RETURNS VOID AS $$
BEGIN
    -- Remove existing insights for this opportunity
    DELETE FROM opportunity_insights WHERE opportunity_id = p_opportunity_id;

    -- Add new insights
    IF p_insight_ids IS NOT NULL AND array_length(p_insight_ids, 1) > 0 THEN
        INSERT INTO opportunity_insights (opportunity_id, insight_id, created_at)
        SELECT p_opportunity_id, unnest(p_insight_ids), NOW()
        ON CONFLICT (opportunity_id, insight_id) DO NOTHING;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update project_people stats when interviews are added/removed
CREATE OR REPLACE FUNCTION update_project_people_stats(
    p_project_id UUID,
    p_person_id UUID
) RETURNS VOID AS $$
DECLARE
    interview_count_var INTEGER;
    first_interview_date TIMESTAMPTZ;
    last_interview_date TIMESTAMPTZ;
BEGIN
    -- Calculate stats for this person in this project
    SELECT
        COUNT(*),
        MIN(i.interview_date),
        MAX(i.interview_date)
    INTO
        interview_count_var,
        first_interview_date,
        last_interview_date
    FROM interviews i
    JOIN interview_people ip ON i.id = ip.interview_id
    WHERE i.project_id = p_project_id
    AND ip.person_id = p_person_id;

    -- Update or insert project_people record
    INSERT INTO project_people (
        project_id,
        person_id,
        interview_count,
        first_seen_at,
        last_seen_at,
        created_at,
        updated_at
    )
    VALUES (
        p_project_id,
        p_person_id,
        COALESCE(interview_count_var, 0),
        COALESCE(first_interview_date, NOW()),
        COALESCE(last_interview_date, NOW()),
        NOW(),
        NOW()
    )
    ON CONFLICT (project_id, person_id)
    DO UPDATE SET
        interview_count = COALESCE(interview_count_var, 0),
        first_seen_at = COALESCE(first_interview_date, project_people.first_seen_at),
        last_seen_at = COALESCE(last_interview_date, project_people.last_seen_at),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to automatically link insights to personas based on people
CREATE OR REPLACE FUNCTION auto_link_persona_insights(
    p_insight_id UUID
) RETURNS VOID AS $$
DECLARE
    persona_record RECORD;
    relevance_score_var DECIMAL(3,2);
BEGIN
    -- Find personas for people involved in interviews that have evidence linked to this theme
    -- Themes don't have interview_id - they're linked via theme_evidence -> evidence -> interview
    FOR persona_record IN
        SELECT DISTINCT pp.persona_id, p.name as persona
        FROM themes t
        -- Link through theme_evidence junction to get to interviews
        JOIN theme_evidence te ON t.id = te.theme_id
        JOIN evidence e ON te.evidence_id = e.id
        JOIN interviews iv ON e.interview_id = iv.id
        JOIN interview_people ip ON iv.id = ip.interview_id
        JOIN people pe ON ip.person_id = pe.id
        JOIN people_personas pp ON pe.id = pp.person_id
        JOIN personas p ON pp.persona_id = p.id AND pe.account_id = p.account_id
        WHERE t.id = p_insight_id
        AND pp.persona_id IS NOT NULL
    LOOP
        -- Calculate relevance score (simplified - could be more sophisticated)
        relevance_score_var := 1.0;

        -- Insert persona-insight link
        INSERT INTO persona_insights (persona_id, insight_id, relevance_score, created_at)
        VALUES (persona_record.persona_id, p_insight_id, relevance_score_var, NOW())
        ON CONFLICT (persona_id, insight_id) DO NOTHING;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically update project_people when interview_people changes
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

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_project_people_on_interview_people ON interview_people;
CREATE TRIGGER trigger_update_project_people_on_interview_people
    AFTER INSERT OR UPDATE OR DELETE ON interview_people
    FOR EACH ROW EXECUTE FUNCTION trigger_update_project_people();

-- Trigger to automatically link insights to personas
CREATE OR REPLACE FUNCTION trigger_auto_link_persona_insights()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM auto_link_persona_insights(NEW.id);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_auto_link_persona_insights_on_insert ON themes;
CREATE TRIGGER trigger_auto_link_persona_insights_on_insert
    AFTER INSERT ON themes
    FOR EACH ROW EXECUTE FUNCTION trigger_auto_link_persona_insights();

-- Grant permissions
-- run manually: see supabase/migrations/imperative.sql
GRANT EXECUTE ON FUNCTION sync_insight_tags(UUID, TEXT[], UUID) TO authenticated;
-- run manually: see supabase/migrations/imperative.sql
GRANT EXECUTE ON FUNCTION sync_opportunity_insights(UUID, UUID[]) TO authenticated;
-- run manually: see supabase/migrations/imperative.sql
GRANT EXECUTE ON FUNCTION update_project_people_stats(UUID, UUID) TO authenticated;
-- run manually: see supabase/migrations/imperative.sql
GRANT EXECUTE ON FUNCTION auto_link_persona_insights(UUID) TO authenticated;
