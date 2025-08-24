drop view if exists "public"."persona_distribution";


  create table "public"."evidence" (
    "id" uuid not null default gen_random_uuid(),
    "account_id" uuid not null,
    "project_id" uuid,
    "interview_id" uuid,
    "source_type" text default 'primary'::text,
    "method" text default 'interview'::text,
    "modality" text not null default 'qual'::text,
    "support" text default 'supports'::text,
    "kind_tags" text[] default '{}'::text[],
    "personas" text[] default '{}'::text[],
    "segments" text[] default '{}'::text[],
    "journey_stage" text,
    "weight_quality" numeric default 0.8,
    "weight_relevance" numeric default 0.8,
    "independence_key" text,
    "confidence" text default 'medium'::text,
    "verbatim" text not null,
    "anchors" jsonb not null default '[]'::jsonb,
    "citation" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "created_by" uuid,
    "updated_by" uuid
      );


alter table "public"."evidence" enable row level security;


  create table "public"."evidence_tag" (
    "id" uuid not null default gen_random_uuid(),
    "evidence_id" uuid not null,
    "tag_id" uuid not null,
    "account_id" uuid not null,
    "project_id" uuid,
    "confidence" numeric,
    "created_at" timestamp with time zone default now(),
    "created_by" uuid
      );


alter table "public"."evidence_tag" enable row level security;


  create table "public"."theme_evidence" (
    "id" uuid not null default gen_random_uuid(),
    "theme_id" uuid not null,
    "evidence_id" uuid not null,
    "account_id" uuid not null,
    "project_id" uuid,
    "rationale" text,
    "confidence" numeric,
    "created_at" timestamp with time zone default now(),
    "created_by" uuid
      );


alter table "public"."theme_evidence" enable row level security;


  create table "public"."themes" (
    "id" uuid not null default gen_random_uuid(),
    "account_id" uuid not null,
    "project_id" uuid,
    "name" text not null,
    "statement" text,
    "inclusion_criteria" text,
    "exclusion_criteria" text,
    "synonyms" text[] default '{}'::text[],
    "anti_examples" text[] default '{}'::text[],
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "created_by" uuid,
    "updated_by" uuid
      );


alter table "public"."themes" enable row level security;

CREATE UNIQUE INDEX evidence_pkey ON public.evidence USING btree (id);

CREATE UNIQUE INDEX evidence_tag_evidence_id_tag_id_account_id_key ON public.evidence_tag USING btree (evidence_id, tag_id, account_id);

CREATE UNIQUE INDEX evidence_tag_pkey ON public.evidence_tag USING btree (id);

CREATE INDEX idx_evidence_account_id ON public.evidence USING btree (account_id);

CREATE INDEX idx_evidence_anchors_gin ON public.evidence USING gin (anchors jsonb_path_ops);

CREATE INDEX idx_evidence_created_at ON public.evidence USING btree (created_at DESC);

CREATE INDEX idx_evidence_interview_id ON public.evidence USING btree (interview_id);

CREATE INDEX idx_evidence_kind_tags ON public.evidence USING gin (kind_tags);

CREATE INDEX idx_evidence_project_id ON public.evidence USING btree (project_id);

CREATE INDEX idx_evidence_tag_account_id ON public.evidence_tag USING btree (account_id);

CREATE INDEX idx_evidence_tag_evidence_id ON public.evidence_tag USING btree (evidence_id);

CREATE INDEX idx_evidence_tag_tag_id ON public.evidence_tag USING btree (tag_id);

CREATE INDEX idx_theme_evidence_account_id ON public.theme_evidence USING btree (account_id);

CREATE INDEX idx_theme_evidence_evidence_id ON public.theme_evidence USING btree (evidence_id);

CREATE INDEX idx_theme_evidence_theme_id ON public.theme_evidence USING btree (theme_id);

CREATE INDEX idx_themes_account_id ON public.themes USING btree (account_id);

CREATE INDEX idx_themes_created_at ON public.themes USING btree (created_at DESC);

CREATE INDEX idx_themes_project_id ON public.themes USING btree (project_id);

CREATE UNIQUE INDEX theme_evidence_pkey ON public.theme_evidence USING btree (id);

CREATE UNIQUE INDEX theme_evidence_theme_id_evidence_id_account_id_key ON public.theme_evidence USING btree (theme_id, evidence_id, account_id);

CREATE UNIQUE INDEX themes_pkey ON public.themes USING btree (id);

alter table "public"."evidence" add constraint "evidence_pkey" PRIMARY KEY using index "evidence_pkey";

alter table "public"."evidence_tag" add constraint "evidence_tag_pkey" PRIMARY KEY using index "evidence_tag_pkey";

alter table "public"."theme_evidence" add constraint "theme_evidence_pkey" PRIMARY KEY using index "theme_evidence_pkey";

alter table "public"."themes" add constraint "themes_pkey" PRIMARY KEY using index "themes_pkey";

alter table "public"."evidence" add constraint "evidence_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts.accounts(id) ON DELETE CASCADE not valid;

alter table "public"."evidence" validate constraint "evidence_account_id_fkey";

alter table "public"."evidence" add constraint "evidence_confidence_check" CHECK ((confidence = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))) not valid;

alter table "public"."evidence" validate constraint "evidence_confidence_check";

alter table "public"."evidence" add constraint "evidence_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."evidence" validate constraint "evidence_created_by_fkey";

alter table "public"."evidence" add constraint "evidence_interview_id_fkey" FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE not valid;

alter table "public"."evidence" validate constraint "evidence_interview_id_fkey";

alter table "public"."evidence" add constraint "evidence_method_check" CHECK ((method = ANY (ARRAY['interview'::text, 'usability'::text, 'survey'::text, 'telemetry'::text, 'market_report'::text, 'support_ticket'::text, 'benchmark'::text, 'other'::text]))) not valid;

alter table "public"."evidence" validate constraint "evidence_method_check";

alter table "public"."evidence" add constraint "evidence_modality_check" CHECK ((modality = ANY (ARRAY['qual'::text, 'quant'::text]))) not valid;

alter table "public"."evidence" validate constraint "evidence_modality_check";

alter table "public"."evidence" add constraint "evidence_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."evidence" validate constraint "evidence_project_id_fkey";

alter table "public"."evidence" add constraint "evidence_source_type_check" CHECK ((source_type = ANY (ARRAY['primary'::text, 'secondary'::text]))) not valid;

alter table "public"."evidence" validate constraint "evidence_source_type_check";

alter table "public"."evidence" add constraint "evidence_support_check" CHECK ((support = ANY (ARRAY['supports'::text, 'refutes'::text, 'neutral'::text]))) not valid;

alter table "public"."evidence" validate constraint "evidence_support_check";

alter table "public"."evidence" add constraint "evidence_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."evidence" validate constraint "evidence_updated_by_fkey";

alter table "public"."evidence_tag" add constraint "evidence_tag_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."evidence_tag" validate constraint "evidence_tag_created_by_fkey";

alter table "public"."evidence_tag" add constraint "evidence_tag_evidence_id_fkey" FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE not valid;

alter table "public"."evidence_tag" validate constraint "evidence_tag_evidence_id_fkey";

alter table "public"."evidence_tag" add constraint "evidence_tag_evidence_id_tag_id_account_id_key" UNIQUE using index "evidence_tag_evidence_id_tag_id_account_id_key";

alter table "public"."evidence_tag" add constraint "evidence_tag_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."evidence_tag" validate constraint "evidence_tag_project_id_fkey";

alter table "public"."evidence_tag" add constraint "evidence_tag_tag_id_fkey" FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE not valid;

alter table "public"."evidence_tag" validate constraint "evidence_tag_tag_id_fkey";

alter table "public"."theme_evidence" add constraint "theme_evidence_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."theme_evidence" validate constraint "theme_evidence_created_by_fkey";

alter table "public"."theme_evidence" add constraint "theme_evidence_evidence_id_fkey" FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE not valid;

alter table "public"."theme_evidence" validate constraint "theme_evidence_evidence_id_fkey";

alter table "public"."theme_evidence" add constraint "theme_evidence_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."theme_evidence" validate constraint "theme_evidence_project_id_fkey";

alter table "public"."theme_evidence" add constraint "theme_evidence_theme_id_evidence_id_account_id_key" UNIQUE using index "theme_evidence_theme_id_evidence_id_account_id_key";

alter table "public"."theme_evidence" add constraint "theme_evidence_theme_id_fkey" FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE not valid;

alter table "public"."theme_evidence" validate constraint "theme_evidence_theme_id_fkey";

alter table "public"."themes" add constraint "themes_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts.accounts(id) ON DELETE CASCADE not valid;

alter table "public"."themes" validate constraint "themes_account_id_fkey";

alter table "public"."themes" add constraint "themes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."themes" validate constraint "themes_created_by_fkey";

alter table "public"."themes" add constraint "themes_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."themes" validate constraint "themes_project_id_fkey";

alter table "public"."themes" add constraint "themes_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."themes" validate constraint "themes_updated_by_fkey";

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


grant delete on table "public"."evidence" to "anon";

grant insert on table "public"."evidence" to "anon";

grant references on table "public"."evidence" to "anon";

grant select on table "public"."evidence" to "anon";

grant trigger on table "public"."evidence" to "anon";

grant truncate on table "public"."evidence" to "anon";

grant update on table "public"."evidence" to "anon";

grant delete on table "public"."evidence" to "authenticated";

grant insert on table "public"."evidence" to "authenticated";

grant references on table "public"."evidence" to "authenticated";

grant select on table "public"."evidence" to "authenticated";

grant trigger on table "public"."evidence" to "authenticated";

grant truncate on table "public"."evidence" to "authenticated";

grant update on table "public"."evidence" to "authenticated";

grant delete on table "public"."evidence" to "service_role";

grant insert on table "public"."evidence" to "service_role";

grant references on table "public"."evidence" to "service_role";

grant select on table "public"."evidence" to "service_role";

grant trigger on table "public"."evidence" to "service_role";

grant truncate on table "public"."evidence" to "service_role";

grant update on table "public"."evidence" to "service_role";

grant delete on table "public"."evidence_tag" to "anon";

grant insert on table "public"."evidence_tag" to "anon";

grant references on table "public"."evidence_tag" to "anon";

grant select on table "public"."evidence_tag" to "anon";

grant trigger on table "public"."evidence_tag" to "anon";

grant truncate on table "public"."evidence_tag" to "anon";

grant update on table "public"."evidence_tag" to "anon";

grant delete on table "public"."evidence_tag" to "authenticated";

grant insert on table "public"."evidence_tag" to "authenticated";

grant references on table "public"."evidence_tag" to "authenticated";

grant select on table "public"."evidence_tag" to "authenticated";

grant trigger on table "public"."evidence_tag" to "authenticated";

grant truncate on table "public"."evidence_tag" to "authenticated";

grant update on table "public"."evidence_tag" to "authenticated";

grant delete on table "public"."evidence_tag" to "service_role";

grant insert on table "public"."evidence_tag" to "service_role";

grant references on table "public"."evidence_tag" to "service_role";

grant select on table "public"."evidence_tag" to "service_role";

grant trigger on table "public"."evidence_tag" to "service_role";

grant truncate on table "public"."evidence_tag" to "service_role";

grant update on table "public"."evidence_tag" to "service_role";

grant delete on table "public"."theme_evidence" to "anon";

grant insert on table "public"."theme_evidence" to "anon";

grant references on table "public"."theme_evidence" to "anon";

grant select on table "public"."theme_evidence" to "anon";

grant trigger on table "public"."theme_evidence" to "anon";

grant truncate on table "public"."theme_evidence" to "anon";

grant update on table "public"."theme_evidence" to "anon";

grant delete on table "public"."theme_evidence" to "authenticated";

grant insert on table "public"."theme_evidence" to "authenticated";

grant references on table "public"."theme_evidence" to "authenticated";

grant select on table "public"."theme_evidence" to "authenticated";

grant trigger on table "public"."theme_evidence" to "authenticated";

grant truncate on table "public"."theme_evidence" to "authenticated";

grant update on table "public"."theme_evidence" to "authenticated";

grant delete on table "public"."theme_evidence" to "service_role";

grant insert on table "public"."theme_evidence" to "service_role";

grant references on table "public"."theme_evidence" to "service_role";

grant select on table "public"."theme_evidence" to "service_role";

grant trigger on table "public"."theme_evidence" to "service_role";

grant truncate on table "public"."theme_evidence" to "service_role";

grant update on table "public"."theme_evidence" to "service_role";

grant delete on table "public"."themes" to "anon";

grant insert on table "public"."themes" to "anon";

grant references on table "public"."themes" to "anon";

grant select on table "public"."themes" to "anon";

grant trigger on table "public"."themes" to "anon";

grant truncate on table "public"."themes" to "anon";

grant update on table "public"."themes" to "anon";

grant delete on table "public"."themes" to "authenticated";

grant insert on table "public"."themes" to "authenticated";

grant references on table "public"."themes" to "authenticated";

grant select on table "public"."themes" to "authenticated";

grant trigger on table "public"."themes" to "authenticated";

grant truncate on table "public"."themes" to "authenticated";

grant update on table "public"."themes" to "authenticated";

grant delete on table "public"."themes" to "service_role";

grant insert on table "public"."themes" to "service_role";

grant references on table "public"."themes" to "service_role";

grant select on table "public"."themes" to "service_role";

grant trigger on table "public"."themes" to "service_role";

grant truncate on table "public"."themes" to "service_role";

grant update on table "public"."themes" to "service_role";


  create policy "Account members can insert"
  on "public"."evidence"
  as permissive
  for insert
  to authenticated
with check ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



  create policy "Account members can select"
  on "public"."evidence"
  as permissive
  for select
  to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



  create policy "Account members can update"
  on "public"."evidence"
  as permissive
  for update
  to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



  create policy "Account owners can delete"
  on "public"."evidence"
  as permissive
  for delete
  to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role('owner'::accounts.account_role) AS get_accounts_with_role)));



  create policy "Users can delete evidence_tag for their account"
  on "public"."evidence_tag"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM evidence e
  WHERE ((e.id = evidence_tag.evidence_id) AND (e.account_id IN ( SELECT account_user.account_id
           FROM accounts.account_user
          WHERE (account_user.user_id = auth.uid())))))));



  create policy "Users can insert evidence_tag for their account"
  on "public"."evidence_tag"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM evidence e
  WHERE ((e.id = evidence_tag.evidence_id) AND (e.account_id IN ( SELECT account_user.account_id
           FROM accounts.account_user
          WHERE (account_user.user_id = auth.uid())))))));



  create policy "Users can update evidence_tag for their account"
  on "public"."evidence_tag"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM evidence e
  WHERE ((e.id = evidence_tag.evidence_id) AND (e.account_id IN ( SELECT account_user.account_id
           FROM accounts.account_user
          WHERE (account_user.user_id = auth.uid())))))));



  create policy "Users can view evidence_tag for their account"
  on "public"."evidence_tag"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM evidence e
  WHERE ((e.id = evidence_tag.evidence_id) AND (e.account_id IN ( SELECT account_user.account_id
           FROM accounts.account_user
          WHERE (account_user.user_id = auth.uid())))))));



  create policy "Users can delete theme_evidence for their account"
  on "public"."theme_evidence"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM themes t
  WHERE ((t.id = theme_evidence.theme_id) AND (t.account_id IN ( SELECT account_user.account_id
           FROM accounts.account_user
          WHERE (account_user.user_id = auth.uid())))))));



  create policy "Users can insert theme_evidence for their account"
  on "public"."theme_evidence"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM themes t
  WHERE ((t.id = theme_evidence.theme_id) AND (t.account_id IN ( SELECT account_user.account_id
           FROM accounts.account_user
          WHERE (account_user.user_id = auth.uid())))))));



  create policy "Users can update theme_evidence for their account"
  on "public"."theme_evidence"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM themes t
  WHERE ((t.id = theme_evidence.theme_id) AND (t.account_id IN ( SELECT account_user.account_id
           FROM accounts.account_user
          WHERE (account_user.user_id = auth.uid())))))));



  create policy "Users can view theme_evidence for their account"
  on "public"."theme_evidence"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM themes t
  WHERE ((t.id = theme_evidence.theme_id) AND (t.account_id IN ( SELECT account_user.account_id
           FROM accounts.account_user
          WHERE (account_user.user_id = auth.uid())))))));



  create policy "Account members can insert"
  on "public"."themes"
  as permissive
  for insert
  to authenticated
with check ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



  create policy "Account members can select"
  on "public"."themes"
  as permissive
  for select
  to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



  create policy "Account members can update"
  on "public"."themes"
  as permissive
  for update
  to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



  create policy "Account owners can delete"
  on "public"."themes"
  as permissive
  for delete
  to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role('owner'::accounts.account_role) AS get_accounts_with_role)));


CREATE TRIGGER set_evidence_timestamp BEFORE INSERT OR UPDATE ON public.evidence FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();

CREATE TRIGGER set_evidence_user_tracking BEFORE INSERT OR UPDATE ON public.evidence FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_user_tracking();

CREATE TRIGGER set_themes_timestamp BEFORE INSERT OR UPDATE ON public.themes FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();

CREATE TRIGGER set_themes_user_tracking BEFORE INSERT OR UPDATE ON public.themes FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_user_tracking();


