set check_function_bodies = off;

CREATE OR REPLACE FUNCTION accounts.run_new_user_setup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    first_account_id    uuid;
    generated_user_name text;
begin

    -- first we setup the user profile
    -- TODO: see if we can get the user's name from the auth.users table once we learn how oauth works
    if new.email IS NOT NULL then
        generated_user_name := split_part(new.email, '@', 1);
    end if;
    -- create the new users's personal account
    insert into accounts.accounts (name, primary_owner_user_id, personal_account, id)
    values (generated_user_name, NEW.id, true, NEW.id)
    returning id into first_account_id;

    -- add them to the account_user table so they can act on it
    insert into accounts.account_user (account_id, user_id, account_role)
    values (first_account_id, NEW.id, 'owner');

		-- creating user_settings
    insert into account_settings(account_id) values (first_account_id);
    -- default research project
    insert into projects(account_id, name) values (first_account_id, 'My First Project');

    return NEW;
end;
$function$
;

----------------------
-- 1. add column nullable with sensible default for new rows
ALTER TABLE public.insights
ADD COLUMN created_by uuid DEFAULT auth.uid();

-- 2. back-fill existing rows (choose an owner for historical rows)
UPDATE public.insights
SET    created_by = (
  SELECT user_id                -- or some service-role uuid
  FROM   accounts.account_user
  WHERE  account_role = 'owner'
  LIMIT  1
)
WHERE  created_by IS NULL;

-- 3. enforce NOT NULL + user-tracking trigger
-- ALTER TABLE public.insights
-- ALTER COLUMN created_by SET NOT NULL;

ALTER TABLE public.insights
ADD COLUMN updated_by uuid DEFAULT auth.uid();   -- keep it NULLABLE for now

-- optional back-fill
UPDATE public.insights
SET    updated_by = created_by
WHERE  updated_by IS NULL;

----------------------

drop policy "Users can delete people_personas for their account" on "public"."people_personas";

drop view if exists "public"."persona_distribution";

drop index if exists "public"."idx_projects_title";

-- alter table "public"."insights" add column "updated_by" uuid not null;

-- alter table "public"."people" drop column "persona";

alter table "public"."projects" drop column "title";

alter table "public"."projects" add column "name" text not null;

alter table "public"."tags" enable row level security;

CREATE INDEX idx_insight_tags_account_id ON public.insight_tags USING btree (account_id);

CREATE INDEX idx_interview_tags_account_id ON public.interview_tags USING btree (account_id);

CREATE INDEX idx_projects_name ON public.projects USING btree (name);

CREATE UNIQUE INDEX tags_account_tag_unique ON public.tags USING btree (account_id, tag);

alter table "public"."insights" add constraint "insights_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."insights" validate constraint "insights_created_by_fkey";

alter table "public"."insights" add constraint "insights_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."insights" validate constraint "insights_updated_by_fkey";

alter table "public"."tags" add constraint "tags_account_tag_unique" UNIQUE using index "tags_account_tag_unique";

set check_function_bodies = off;

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

CREATE OR REPLACE FUNCTION public.trigger_auto_link_persona_insights()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM auto_link_persona_insights(NEW.id);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_update_project_people()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Get project_id from interview
        PERFORM update_project_people_stats(
            (SELECT project_id FROM interviews WHERE id = NEW.interview_id),
            NEW.person_id
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Get project_id from interview
        PERFORM update_project_people_stats(
            (SELECT project_id FROM interviews WHERE id = OLD.interview_id),
            OLD.person_id
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
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

CREATE OR REPLACE FUNCTION public.enqueue_insight_embedding()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if (TG_OP = 'INSERT'
      or (TG_OP = 'UPDATE' and old.jtbd is distinct from new.jtbd)) then
    perform pgmq.send(
      'insights_embedding_queue',
      json_build_object(
        'table', TG_TABLE_NAME,
        'id',    new.id::text,
        'name',  new.name,
        'pain',  new.pain
      )::jsonb
    );
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_accounts()
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'accounts', 'public'
AS $function$
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'account_id', au.account_id,
        'account_role', au.account_role,
        'is_primary_owner', a.primary_owner_user_id = auth.uid(),
        'name', a.name,
        'slug', a.slug,
        'personal_account', a.personal_account,
        'created_at', a.created_at,
        'updated_at', a.updated_at,
        'projects', COALESCE(
          (SELECT json_agg(
            json_build_object(
              'id', p.id,
              'name', p.name,
              'description', p.description,
              'status', p.status,
              'created_at', p.created_at,
              'updated_at', p.updated_at
            )
          )
          FROM public.projects p
          WHERE p.account_id = au.account_id
          ), '[]'::json
        )
      )
    ),
    '[]'::json
  )
  FROM accounts.account_user au
  JOIN accounts.accounts a ON a.id = au.account_id
  WHERE au.user_id = auth.uid();
$function$
;

create or replace view "public"."persona_distribution" as  WITH persona_interview_counts AS (
         SELECT p.id AS persona_id,
            p.account_id,
            p.name AS persona_name,
            p.color_hex,
            p.description,
            p.created_at,
            p.updated_at,
            count(DISTINCT i.id) AS interview_count,
            ( SELECT count(DISTINCT i_total.id) AS count
                   FROM (interviews i_total
                     JOIN interview_people ip_total ON ((ip_total.interview_id = i_total.id)))
                  WHERE (i_total.account_id = p.account_id)) AS total_interviews_with_participants
           FROM (((personas p
             LEFT JOIN people_personas pp ON ((pp.persona_id = p.id)))
             LEFT JOIN interview_people ip ON ((ip.person_id = pp.person_id)))
             LEFT JOIN interviews i ON (((i.id = ip.interview_id) AND (i.account_id = p.account_id))))
          GROUP BY p.id, p.account_id, p.name, p.color_hex, p.description, p.created_at, p.updated_at
        ), legacy_fallback_counts AS (
         SELECT p.id AS persona_id,
            count(DISTINCT i_legacy.id) AS legacy_interview_count,
            ( SELECT count(DISTINCT i_total.id) AS count
                   FROM interviews i_total
                  WHERE ((i_total.account_id = p.account_id) AND ((i_total.participant_pseudonym IS NOT NULL) OR (i_total.segment IS NOT NULL)) AND (NOT (EXISTS ( SELECT 1
                           FROM interview_people ip_check
                          WHERE (ip_check.interview_id = i_total.id)))))) AS total_legacy_interviews
           FROM (personas p
             LEFT JOIN interviews i_legacy ON (((i_legacy.account_id = p.account_id) AND ((i_legacy.participant_pseudonym = p.name) OR (i_legacy.segment = p.name)) AND (NOT (EXISTS ( SELECT 1
                   FROM interview_people ip_check
                  WHERE (ip_check.interview_id = i_legacy.id)))))))
          GROUP BY p.id, p.account_id
        )
 SELECT pic.persona_id,
    pic.account_id,
    pic.persona_name,
    pic.color_hex,
    pic.description,
    pic.created_at,
    pic.updated_at,
    pic.interview_count,
    pic.total_interviews_with_participants,
        CASE
            WHEN (pic.total_interviews_with_participants > 0) THEN round((((pic.interview_count)::numeric / (pic.total_interviews_with_participants)::numeric) * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS interview_percentage,
    lfc.legacy_interview_count,
    lfc.total_legacy_interviews,
        CASE
            WHEN (lfc.total_legacy_interviews > 0) THEN round((((lfc.legacy_interview_count)::numeric / (lfc.total_legacy_interviews)::numeric) * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS legacy_percentage,
    (pic.interview_count + lfc.legacy_interview_count) AS total_interview_count,
    (pic.total_interviews_with_participants + lfc.total_legacy_interviews) AS total_interviews,
        CASE
            WHEN ((pic.total_interviews_with_participants + lfc.total_legacy_interviews) > 0) THEN round(((((pic.interview_count + lfc.legacy_interview_count))::numeric / ((pic.total_interviews_with_participants + lfc.total_legacy_interviews))::numeric) * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS combined_percentage
   FROM (persona_interview_counts pic
     JOIN legacy_fallback_counts lfc ON ((pic.persona_id = lfc.persona_id)))
  ORDER BY pic.account_id, (pic.interview_count + lfc.legacy_interview_count) DESC;


create policy "Account members can insert"
on "public"."tags"
as permissive
for insert
to authenticated
with check ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account members can select"
on "public"."tags"
as permissive
for select
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account members can update"
on "public"."tags"
as permissive
for update
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account owners can delete"
on "public"."tags"
as permissive
for delete
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role('owner'::accounts.account_role) AS get_accounts_with_role)));


CREATE TRIGGER trigger_auto_link_persona_insights_on_insert AFTER INSERT ON public.insights FOR EACH ROW EXECUTE FUNCTION trigger_auto_link_persona_insights();

CREATE TRIGGER trigger_update_project_people_on_interview_people AFTER INSERT OR DELETE OR UPDATE ON public.interview_people FOR EACH ROW EXECUTE FUNCTION trigger_update_project_people();
