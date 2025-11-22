-- Fix auto_link_persona_insights function to work without interview_id on themes
-- Themes are linked to interviews via: theme -> theme_evidence -> evidence -> interview

CREATE OR REPLACE FUNCTION public.auto_link_persona_insights(
    p_insight_id UUID
) RETURNS VOID AS $$
DECLARE
    persona_record RECORD;
    relevance_score_var DECIMAL(3,2);
BEGIN
    -- Find personas for people involved in interviews that have evidence linked to this theme
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
        relevance_score_var := 0.80;

        INSERT INTO persona_insights (persona_id, insight_id, relevance_score, created_at, updated_at)
        VALUES (persona_record.persona_id, p_insight_id, relevance_score_var, NOW(), NOW())
        ON CONFLICT (persona_id, insight_id) DO UPDATE SET relevance_score = relevance_score_var;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
