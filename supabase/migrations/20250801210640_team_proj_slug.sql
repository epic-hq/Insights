set check_function_bodies = off;

CREATE OR REPLACE FUNCTION accounts.run_new_user_setup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    first_account_id    uuid;
    team_account_id     uuid;
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

-- create first TEAM account, make user owner
-- call the create_account function
select create_account(NULL, generated_user_name) into team_account_id;

-- select update_account_user_role(team_account_id, team_account_id, true);

		-- creating user_settings
    insert into account_settings(account_id) values (first_account_id);
    -- default research project
    insert into projects(account_id, name) values (team_account_id, 'My First Project');

    return NEW;
end;
$function$
;

CREATE OR REPLACE FUNCTION accounts.slugify_account_slug()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    if NEW.slug is not null then
        NEW.slug := lower(
      trim(both '-' FROM
        regexp_replace(
          regexp_replace(NEW.slug, '[^A-Za-z0-9-]+', '-', 'g'),
        '-+', '-', 'g')
      )
    );
    end if;

    RETURN NEW;
END
$function$
;


drop view if exists "public"."persona_distribution";

drop index if exists "public"."idx_projects_name";

alter table "public"."people" add column "project_id" uuid;

alter table "public"."personas" add column "project_id" uuid;

alter table "public"."projects" add column "slug" text;

CREATE INDEX idx_people_account_project_created ON public.people USING btree (account_id, project_id, created_at);

CREATE INDEX idx_personas_account_project_created ON public.personas USING btree (account_id, project_id, created_at);

CREATE INDEX idx_projects_slug ON public.projects USING btree (slug);

CREATE UNIQUE INDEX projects_account_id_slug_unique ON public.projects USING btree (account_id, slug);

alter table "public"."people" add constraint "people_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."people" validate constraint "people_project_id_fkey";

alter table "public"."personas" add constraint "personas_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."personas" validate constraint "personas_project_id_fkey";

alter table "public"."projects" add constraint "projects_account_id_slug_unique" UNIQUE using index "projects_account_id_slug_unique";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.slugify_project_name()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.name IS NOT NULL AND NEW.name IS DISTINCT FROM OLD.name THEN
    -- 1a) replace non-alnum/dash → dash
    -- 1b) collapse multiple dashes → one
    -- 1c) trim dashes off ends
    -- 1d) lowercase
    NEW.slug := lower(
      trim(both '-' FROM
        regexp_replace(
          regexp_replace(NEW.name, '[^A-Za-z0-9-]+', '-', 'g'),
        '-+', '-', 'g')
      )
    );
  END IF;
  RETURN NEW;
END
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


CREATE TRIGGER projects_slugify_project_slug BEFORE INSERT OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION slugify_project_name();


