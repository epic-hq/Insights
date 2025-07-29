set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.set_primary_persona_once()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  -- Set only if not already set
  update public.people p
     set primary_persona_id = new.persona_id
   where p.id = new.person_id
     and p.primary_persona_id is null;

  return null; -- statement is complete
end;
$function$
;

CREATE OR REPLACE FUNCTION public.auto_link_persona_insights(p_insight_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.sync_insight_tags(p_insight_id uuid, p_tag_names text[], p_account_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.sync_opportunity_insights(p_opportunity_id uuid, p_insight_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_project_people_stats(p_project_id uuid, p_person_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

create policy "Users can delete people_personas for their account"
on "public"."people_personas"
as permissive
for delete
to public
using ((EXISTS ( SELECT 1
   FROM people pe
  WHERE ((pe.id = people_personas.person_id) AND (pe.account_id IN ( SELECT account_user.account_id
           FROM accounts.account_user
          WHERE (account_user.user_id = auth.uid())))))));


CREATE TRIGGER trg_people_personas_set_primary_once AFTER INSERT ON public.people_personas FOR EACH ROW EXECUTE FUNCTION set_primary_persona_once();


