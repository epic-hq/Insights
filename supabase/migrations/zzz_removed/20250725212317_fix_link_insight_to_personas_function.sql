-- Fix missing link_insight_to_personas function that was causing pe.persona column error
-- This function is a wrapper around auto_link_persona_insights for backward compatibility

CREATE OR REPLACE FUNCTION public.link_insight_to_personas(p_insight_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- This function is a wrapper around auto_link_persona_insights
    -- It exists for backward compatibility with tests and manual operations
    PERFORM auto_link_persona_insights(p_insight_id);
END;
$function$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.link_insight_to_personas(UUID) TO authenticated;