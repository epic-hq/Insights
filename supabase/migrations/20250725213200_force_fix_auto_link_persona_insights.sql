-- Force fix the auto_link_persona_insights function to use correct pe.persona_id column
-- The remote database still has an old version referencing pe.persona (without _id)

CREATE OR REPLACE FUNCTION auto_link_persona_insights(
    p_insight_id UUID
) RETURNS VOID AS $$
DECLARE
    persona_record RECORD;
    relevance_score_var DECIMAL(3,2);
BEGIN
    -- Find personas for people involved in the interview that generated this insight
    FOR persona_record IN
        SELECT DISTINCT pe.persona_id, p.name as persona
        FROM insights i
        JOIN interviews iv ON i.interview_id = iv.id
        JOIN interview_people ip ON iv.id = ip.interview_id
        JOIN people pe ON ip.person_id = pe.id
        JOIN personas p ON pe.persona_id = p.id AND pe.account_id = p.account_id
        WHERE i.id = p_insight_id
        AND pe.persona_id IS NOT NULL
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION auto_link_persona_insights(UUID) TO authenticated;