drop view if exists "public"."insights_with_priority";

drop view if exists "public"."persona_distribution";


  create table "public"."evidence_people" (
    "id" uuid not null default gen_random_uuid(),
    "evidence_id" uuid not null,
    "person_id" uuid not null,
    "account_id" uuid not null,
    "project_id" uuid,
    "role" text,
    "confidence" numeric,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "created_by" uuid,
    "updated_by" uuid
      );


alter table "public"."evidence_people" enable row level security;

CREATE UNIQUE INDEX evidence_people_evidence_id_person_id_account_id_key ON public.evidence_people USING btree (evidence_id, person_id, account_id);

CREATE UNIQUE INDEX evidence_people_pkey ON public.evidence_people USING btree (id);

CREATE INDEX idx_evidence_people_account_id ON public.evidence_people USING btree (account_id);

CREATE INDEX idx_evidence_people_evidence_id ON public.evidence_people USING btree (evidence_id);

CREATE INDEX idx_evidence_people_person_id ON public.evidence_people USING btree (person_id);

alter table "public"."evidence_people" add constraint "evidence_people_pkey" PRIMARY KEY using index "evidence_people_pkey";

alter table "public"."evidence_people" add constraint "evidence_people_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."evidence_people" validate constraint "evidence_people_created_by_fkey";

alter table "public"."evidence_people" add constraint "evidence_people_evidence_id_fkey" FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE not valid;

alter table "public"."evidence_people" validate constraint "evidence_people_evidence_id_fkey";

alter table "public"."evidence_people" add constraint "evidence_people_evidence_id_person_id_account_id_key" UNIQUE using index "evidence_people_evidence_id_person_id_account_id_key";

alter table "public"."evidence_people" add constraint "evidence_people_person_id_fkey" FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE not valid;

alter table "public"."evidence_people" validate constraint "evidence_people_person_id_fkey";

alter table "public"."evidence_people" add constraint "evidence_people_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."evidence_people" validate constraint "evidence_people_project_id_fkey";

alter table "public"."evidence_people" add constraint "evidence_people_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) not valid;

alter table "public"."evidence_people" validate constraint "evidence_people_updated_by_fkey";

create or replace view "public"."insights_with_priority" as  SELECT i.id,
    i.account_id,
    i.interview_id,
    i.name,
    i.category,
    i.journey_stage,
    i.impact,
    i.novelty,
    i.jtbd,
    i.details,
    i.evidence,
    i.motivation,
    i.pain,
    i.desired_outcome,
    i.emotional_response,
    i.opportunity_ideas,
    i.confidence,
    i.contradictions,
    i.related_tags,
    i.project_id,
    i.embedding,
    i.created_at,
    i.updated_at,
    i.created_by,
    i.updated_by,
    COALESCE(sum(v.vote_value), (0)::bigint) AS priority
   FROM (insights i
     LEFT JOIN votes v ON (((v.entity_type = 'insight'::text) AND (v.entity_id = i.id))))
  GROUP BY i.id;


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


grant delete on table "public"."evidence_people" to "anon";

grant insert on table "public"."evidence_people" to "anon";

grant references on table "public"."evidence_people" to "anon";

grant select on table "public"."evidence_people" to "anon";

grant trigger on table "public"."evidence_people" to "anon";

grant truncate on table "public"."evidence_people" to "anon";

grant update on table "public"."evidence_people" to "anon";

grant delete on table "public"."evidence_people" to "authenticated";

grant insert on table "public"."evidence_people" to "authenticated";

grant references on table "public"."evidence_people" to "authenticated";

grant select on table "public"."evidence_people" to "authenticated";

grant trigger on table "public"."evidence_people" to "authenticated";

grant truncate on table "public"."evidence_people" to "authenticated";

grant update on table "public"."evidence_people" to "authenticated";

grant delete on table "public"."evidence_people" to "service_role";

grant insert on table "public"."evidence_people" to "service_role";

grant references on table "public"."evidence_people" to "service_role";

grant select on table "public"."evidence_people" to "service_role";

grant trigger on table "public"."evidence_people" to "service_role";

grant truncate on table "public"."evidence_people" to "service_role";

grant update on table "public"."evidence_people" to "service_role";


  create policy "Users can delete evidence_people for their account"
  on "public"."evidence_people"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM evidence e
  WHERE ((e.id = evidence_people.evidence_id) AND (e.account_id IN ( SELECT account_user.account_id
           FROM accounts.account_user
          WHERE (account_user.user_id = auth.uid())))))));



  create policy "Users can insert evidence_people for their account"
  on "public"."evidence_people"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM evidence e
  WHERE ((e.id = evidence_people.evidence_id) AND (e.account_id IN ( SELECT account_user.account_id
           FROM accounts.account_user
          WHERE (account_user.user_id = auth.uid())))))));



  create policy "Users can update evidence_people for their account"
  on "public"."evidence_people"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM evidence e
  WHERE ((e.id = evidence_people.evidence_id) AND (e.account_id IN ( SELECT account_user.account_id
           FROM accounts.account_user
          WHERE (account_user.user_id = auth.uid())))))));



  create policy "Users can view evidence_people for their account"
  on "public"."evidence_people"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM evidence e
  WHERE ((e.id = evidence_people.evidence_id) AND (e.account_id IN ( SELECT account_user.account_id
           FROM accounts.account_user
          WHERE (account_user.user_id = auth.uid())))))));


CREATE TRIGGER set_evidence_people_timestamp BEFORE INSERT OR UPDATE ON public.evidence_people FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();

CREATE TRIGGER set_evidence_people_user_tracking BEFORE INSERT OR UPDATE ON public.evidence_people FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_user_tracking();


