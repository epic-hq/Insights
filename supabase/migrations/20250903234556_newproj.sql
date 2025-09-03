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
    insert into public.user_settings (user_id) values (NEW.id);

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
-- call the create_account_id function
select create_account_id(NEW.id, NULL, generated_user_name) into team_account_id;
insert into accounts.account_user (account_id, user_id, account_role)
values (team_account_id, NEW.id, 'owner');

-- select update_account_user_role(team_account_id, team_account_id, true);

    -- Removed automatic project and account_settings creation on signup.
    -- Project onboarding is now handled in-app on first visit to /home.

    return NEW;
end;
$function$
;


drop view if exists "public"."persona_distribution";

create table "public"."decision_question_metrics" (
    "id" uuid not null default gen_random_uuid(),
    "project_id" uuid not null,
    "decision_question_id" uuid not null,
    "metric" text not null
);


alter table "public"."decision_question_metrics" enable row level security;

create table "public"."decision_question_risks" (
    "id" uuid not null default gen_random_uuid(),
    "project_id" uuid not null,
    "decision_question_id" uuid not null,
    "risk" text not null
);


alter table "public"."decision_question_risks" enable row level security;

create table "public"."decision_questions" (
    "id" uuid not null default gen_random_uuid(),
    "project_id" uuid not null,
    "plan_id" uuid,
    "text" text not null,
    "rationale" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "created_by" uuid,
    "updated_by" uuid
);


alter table "public"."decision_questions" enable row level security;

create table "public"."interview_prompt_bias_checks" (
    "id" uuid not null default gen_random_uuid(),
    "project_id" uuid not null,
    "prompt_id" uuid not null,
    "text" text not null
);


alter table "public"."interview_prompt_bias_checks" enable row level security;

create table "public"."interview_prompt_followups" (
    "id" uuid not null default gen_random_uuid(),
    "project_id" uuid not null,
    "prompt_id" uuid not null,
    "text" text not null
);


alter table "public"."interview_prompt_followups" enable row level security;

create table "public"."interview_prompt_research_questions" (
    "id" uuid not null default gen_random_uuid(),
    "project_id" uuid not null,
    "prompt_id" uuid not null,
    "research_question_id" uuid not null
);


alter table "public"."interview_prompt_research_questions" enable row level security;

create table "public"."interview_prompts" (
    "id" uuid not null default gen_random_uuid(),
    "project_id" uuid not null,
    "plan_id" uuid,
    "text" text not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "created_by" uuid,
    "updated_by" uuid
);


alter table "public"."interview_prompts" enable row level security;

create table "public"."project_research_plans" (
    "id" uuid not null default gen_random_uuid(),
    "project_id" uuid not null,
    "goal" text not null,
    "status" text default 'draft'::text,
    "meta" jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "created_by" uuid,
    "updated_by" uuid
);


alter table "public"."project_research_plans" enable row level security;

create table "public"."research_plan_data_sources" (
    "id" uuid not null default gen_random_uuid(),
    "project_id" uuid not null,
    "plan_id" uuid not null,
    "source" text not null
);


alter table "public"."research_plan_data_sources" enable row level security;

create table "public"."research_question_evidence_types" (
    "id" uuid not null default gen_random_uuid(),
    "project_id" uuid not null,
    "research_question_id" uuid not null,
    "evidence_type" text not null
);


alter table "public"."research_question_evidence_types" enable row level security;

create table "public"."research_question_methods" (
    "id" uuid not null default gen_random_uuid(),
    "project_id" uuid not null,
    "research_question_id" uuid not null,
    "method" text not null
);


alter table "public"."research_question_methods" enable row level security;

create table "public"."research_questions" (
    "id" uuid not null default gen_random_uuid(),
    "project_id" uuid not null,
    "plan_id" uuid,
    "decision_question_id" uuid,
    "text" text not null,
    "rationale" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "created_by" uuid,
    "updated_by" uuid
);


alter table "public"."research_questions" enable row level security;

alter table "public"."personas" add column "behaviors" text[];

alter table "public"."personas" add column "color" text;

alter table "public"."personas" add column "differentiators" text[];

alter table "public"."personas" add column "goals" text[];

alter table "public"."personas" add column "kind" text default 'core'::text;

alter table "public"."personas" add column "pains" text[];

alter table "public"."personas" add column "roles" text[];

alter table "public"."personas" add column "spectra1d" jsonb;

alter table "public"."personas" add column "spectra2d" jsonb;

alter table "public"."personas" add column "tags" text[];

CREATE UNIQUE INDEX decision_question_metrics_pkey ON public.decision_question_metrics USING btree (id);

CREATE UNIQUE INDEX decision_question_risks_pkey ON public.decision_question_risks USING btree (id);

CREATE UNIQUE INDEX decision_questions_pkey ON public.decision_questions USING btree (id);

CREATE INDEX idx_decision_questions_plan ON public.decision_questions USING btree (plan_id);

CREATE INDEX idx_decision_questions_project ON public.decision_questions USING btree (project_id);

CREATE INDEX idx_dq_metrics_dq ON public.decision_question_metrics USING btree (decision_question_id);

CREATE INDEX idx_dq_risks_dq ON public.decision_question_risks USING btree (decision_question_id);

CREATE INDEX idx_plan_sources_plan ON public.research_plan_data_sources USING btree (plan_id);

CREATE INDEX idx_prompt_bias_prompt ON public.interview_prompt_bias_checks USING btree (prompt_id);

CREATE INDEX idx_prompt_followups_prompt ON public.interview_prompt_followups USING btree (prompt_id);

CREATE INDEX idx_prompt_rq_prompt ON public.interview_prompt_research_questions USING btree (prompt_id);

CREATE INDEX idx_prompt_rq_rq ON public.interview_prompt_research_questions USING btree (research_question_id);

CREATE INDEX idx_prompts_plan ON public.interview_prompts USING btree (plan_id);

CREATE INDEX idx_prompts_project ON public.interview_prompts USING btree (project_id);

CREATE INDEX idx_research_plans_project ON public.project_research_plans USING btree (project_id);

CREATE INDEX idx_research_questions_dq ON public.research_questions USING btree (decision_question_id);

CREATE INDEX idx_research_questions_plan ON public.research_questions USING btree (plan_id);

CREATE INDEX idx_research_questions_project ON public.research_questions USING btree (project_id);

CREATE INDEX idx_rq_evidence_rq ON public.research_question_evidence_types USING btree (research_question_id);

CREATE INDEX idx_rq_methods_rq ON public.research_question_methods USING btree (research_question_id);

CREATE UNIQUE INDEX interview_prompt_bias_checks_pkey ON public.interview_prompt_bias_checks USING btree (id);

CREATE UNIQUE INDEX interview_prompt_followups_pkey ON public.interview_prompt_followups USING btree (id);

CREATE UNIQUE INDEX interview_prompt_research_questions_pkey ON public.interview_prompt_research_questions USING btree (id);

CREATE UNIQUE INDEX interview_prompts_pkey ON public.interview_prompts USING btree (id);

CREATE UNIQUE INDEX project_research_plans_pkey ON public.project_research_plans USING btree (id);

CREATE UNIQUE INDEX research_plan_data_sources_pkey ON public.research_plan_data_sources USING btree (id);

CREATE UNIQUE INDEX research_question_evidence_types_pkey ON public.research_question_evidence_types USING btree (id);

CREATE UNIQUE INDEX research_question_methods_pkey ON public.research_question_methods USING btree (id);

CREATE UNIQUE INDEX research_questions_pkey ON public.research_questions USING btree (id);

alter table "public"."decision_question_metrics" add constraint "decision_question_metrics_pkey" PRIMARY KEY using index "decision_question_metrics_pkey";

alter table "public"."decision_question_risks" add constraint "decision_question_risks_pkey" PRIMARY KEY using index "decision_question_risks_pkey";

alter table "public"."decision_questions" add constraint "decision_questions_pkey" PRIMARY KEY using index "decision_questions_pkey";

alter table "public"."interview_prompt_bias_checks" add constraint "interview_prompt_bias_checks_pkey" PRIMARY KEY using index "interview_prompt_bias_checks_pkey";

alter table "public"."interview_prompt_followups" add constraint "interview_prompt_followups_pkey" PRIMARY KEY using index "interview_prompt_followups_pkey";

alter table "public"."interview_prompt_research_questions" add constraint "interview_prompt_research_questions_pkey" PRIMARY KEY using index "interview_prompt_research_questions_pkey";

alter table "public"."interview_prompts" add constraint "interview_prompts_pkey" PRIMARY KEY using index "interview_prompts_pkey";

alter table "public"."project_research_plans" add constraint "project_research_plans_pkey" PRIMARY KEY using index "project_research_plans_pkey";

alter table "public"."research_plan_data_sources" add constraint "research_plan_data_sources_pkey" PRIMARY KEY using index "research_plan_data_sources_pkey";

alter table "public"."research_question_evidence_types" add constraint "research_question_evidence_types_pkey" PRIMARY KEY using index "research_question_evidence_types_pkey";

alter table "public"."research_question_methods" add constraint "research_question_methods_pkey" PRIMARY KEY using index "research_question_methods_pkey";

alter table "public"."research_questions" add constraint "research_questions_pkey" PRIMARY KEY using index "research_questions_pkey";

alter table "public"."decision_question_metrics" add constraint "decision_question_metrics_decision_question_id_fkey" FOREIGN KEY (decision_question_id) REFERENCES decision_questions(id) ON DELETE CASCADE not valid;

alter table "public"."decision_question_metrics" validate constraint "decision_question_metrics_decision_question_id_fkey";

alter table "public"."decision_question_metrics" add constraint "decision_question_metrics_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."decision_question_metrics" validate constraint "decision_question_metrics_project_id_fkey";

alter table "public"."decision_question_risks" add constraint "decision_question_risks_decision_question_id_fkey" FOREIGN KEY (decision_question_id) REFERENCES decision_questions(id) ON DELETE CASCADE not valid;

alter table "public"."decision_question_risks" validate constraint "decision_question_risks_decision_question_id_fkey";

alter table "public"."decision_question_risks" add constraint "decision_question_risks_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."decision_question_risks" validate constraint "decision_question_risks_project_id_fkey";

alter table "public"."decision_questions" add constraint "decision_questions_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."decision_questions" validate constraint "decision_questions_created_by_fkey";

alter table "public"."decision_questions" add constraint "decision_questions_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES project_research_plans(id) ON DELETE CASCADE not valid;

alter table "public"."decision_questions" validate constraint "decision_questions_plan_id_fkey";

alter table "public"."decision_questions" add constraint "decision_questions_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."decision_questions" validate constraint "decision_questions_project_id_fkey";

alter table "public"."decision_questions" add constraint "decision_questions_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."decision_questions" validate constraint "decision_questions_updated_by_fkey";

alter table "public"."interview_prompt_bias_checks" add constraint "interview_prompt_bias_checks_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."interview_prompt_bias_checks" validate constraint "interview_prompt_bias_checks_project_id_fkey";

alter table "public"."interview_prompt_bias_checks" add constraint "interview_prompt_bias_checks_prompt_id_fkey" FOREIGN KEY (prompt_id) REFERENCES interview_prompts(id) ON DELETE CASCADE not valid;

alter table "public"."interview_prompt_bias_checks" validate constraint "interview_prompt_bias_checks_prompt_id_fkey";

alter table "public"."interview_prompt_followups" add constraint "interview_prompt_followups_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."interview_prompt_followups" validate constraint "interview_prompt_followups_project_id_fkey";

alter table "public"."interview_prompt_followups" add constraint "interview_prompt_followups_prompt_id_fkey" FOREIGN KEY (prompt_id) REFERENCES interview_prompts(id) ON DELETE CASCADE not valid;

alter table "public"."interview_prompt_followups" validate constraint "interview_prompt_followups_prompt_id_fkey";

alter table "public"."interview_prompt_research_questions" add constraint "interview_prompt_research_questions_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."interview_prompt_research_questions" validate constraint "interview_prompt_research_questions_project_id_fkey";

alter table "public"."interview_prompt_research_questions" add constraint "interview_prompt_research_questions_prompt_id_fkey" FOREIGN KEY (prompt_id) REFERENCES interview_prompts(id) ON DELETE CASCADE not valid;

alter table "public"."interview_prompt_research_questions" validate constraint "interview_prompt_research_questions_prompt_id_fkey";

alter table "public"."interview_prompt_research_questions" add constraint "interview_prompt_research_questions_research_question_id_fkey" FOREIGN KEY (research_question_id) REFERENCES research_questions(id) ON DELETE CASCADE not valid;

alter table "public"."interview_prompt_research_questions" validate constraint "interview_prompt_research_questions_research_question_id_fkey";

alter table "public"."interview_prompts" add constraint "interview_prompts_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."interview_prompts" validate constraint "interview_prompts_created_by_fkey";

alter table "public"."interview_prompts" add constraint "interview_prompts_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES project_research_plans(id) ON DELETE CASCADE not valid;

alter table "public"."interview_prompts" validate constraint "interview_prompts_plan_id_fkey";

alter table "public"."interview_prompts" add constraint "interview_prompts_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."interview_prompts" validate constraint "interview_prompts_project_id_fkey";

alter table "public"."interview_prompts" add constraint "interview_prompts_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."interview_prompts" validate constraint "interview_prompts_updated_by_fkey";

alter table "public"."personas" add constraint "personas_kind_check" CHECK ((kind = ANY (ARRAY['core'::text, 'provisional'::text, 'contrast'::text]))) not valid;

alter table "public"."personas" validate constraint "personas_kind_check";

alter table "public"."project_research_plans" add constraint "project_research_plans_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."project_research_plans" validate constraint "project_research_plans_created_by_fkey";

alter table "public"."project_research_plans" add constraint "project_research_plans_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."project_research_plans" validate constraint "project_research_plans_project_id_fkey";

alter table "public"."project_research_plans" add constraint "project_research_plans_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."project_research_plans" validate constraint "project_research_plans_updated_by_fkey";

alter table "public"."research_plan_data_sources" add constraint "research_plan_data_sources_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES project_research_plans(id) ON DELETE CASCADE not valid;

alter table "public"."research_plan_data_sources" validate constraint "research_plan_data_sources_plan_id_fkey";

alter table "public"."research_plan_data_sources" add constraint "research_plan_data_sources_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."research_plan_data_sources" validate constraint "research_plan_data_sources_project_id_fkey";

alter table "public"."research_question_evidence_types" add constraint "research_question_evidence_types_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."research_question_evidence_types" validate constraint "research_question_evidence_types_project_id_fkey";

alter table "public"."research_question_evidence_types" add constraint "research_question_evidence_types_research_question_id_fkey" FOREIGN KEY (research_question_id) REFERENCES research_questions(id) ON DELETE CASCADE not valid;

alter table "public"."research_question_evidence_types" validate constraint "research_question_evidence_types_research_question_id_fkey";

alter table "public"."research_question_methods" add constraint "research_question_methods_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."research_question_methods" validate constraint "research_question_methods_project_id_fkey";

alter table "public"."research_question_methods" add constraint "research_question_methods_research_question_id_fkey" FOREIGN KEY (research_question_id) REFERENCES research_questions(id) ON DELETE CASCADE not valid;

alter table "public"."research_question_methods" validate constraint "research_question_methods_research_question_id_fkey";

alter table "public"."research_questions" add constraint "research_questions_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."research_questions" validate constraint "research_questions_created_by_fkey";

alter table "public"."research_questions" add constraint "research_questions_decision_question_id_fkey" FOREIGN KEY (decision_question_id) REFERENCES decision_questions(id) ON DELETE SET NULL not valid;

alter table "public"."research_questions" validate constraint "research_questions_decision_question_id_fkey";

alter table "public"."research_questions" add constraint "research_questions_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES project_research_plans(id) ON DELETE CASCADE not valid;

alter table "public"."research_questions" validate constraint "research_questions_plan_id_fkey";

alter table "public"."research_questions" add constraint "research_questions_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."research_questions" validate constraint "research_questions_project_id_fkey";

alter table "public"."research_questions" add constraint "research_questions_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."research_questions" validate constraint "research_questions_updated_by_fkey";

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


grant delete on table "public"."decision_question_metrics" to "anon";

grant insert on table "public"."decision_question_metrics" to "anon";

grant references on table "public"."decision_question_metrics" to "anon";

grant select on table "public"."decision_question_metrics" to "anon";

grant trigger on table "public"."decision_question_metrics" to "anon";

grant truncate on table "public"."decision_question_metrics" to "anon";

grant update on table "public"."decision_question_metrics" to "anon";

grant delete on table "public"."decision_question_metrics" to "authenticated";

grant insert on table "public"."decision_question_metrics" to "authenticated";

grant references on table "public"."decision_question_metrics" to "authenticated";

grant select on table "public"."decision_question_metrics" to "authenticated";

grant trigger on table "public"."decision_question_metrics" to "authenticated";

grant truncate on table "public"."decision_question_metrics" to "authenticated";

grant update on table "public"."decision_question_metrics" to "authenticated";

grant delete on table "public"."decision_question_metrics" to "service_role";

grant insert on table "public"."decision_question_metrics" to "service_role";

grant references on table "public"."decision_question_metrics" to "service_role";

grant select on table "public"."decision_question_metrics" to "service_role";

grant trigger on table "public"."decision_question_metrics" to "service_role";

grant truncate on table "public"."decision_question_metrics" to "service_role";

grant update on table "public"."decision_question_metrics" to "service_role";

grant delete on table "public"."decision_question_risks" to "anon";

grant insert on table "public"."decision_question_risks" to "anon";

grant references on table "public"."decision_question_risks" to "anon";

grant select on table "public"."decision_question_risks" to "anon";

grant trigger on table "public"."decision_question_risks" to "anon";

grant truncate on table "public"."decision_question_risks" to "anon";

grant update on table "public"."decision_question_risks" to "anon";

grant delete on table "public"."decision_question_risks" to "authenticated";

grant insert on table "public"."decision_question_risks" to "authenticated";

grant references on table "public"."decision_question_risks" to "authenticated";

grant select on table "public"."decision_question_risks" to "authenticated";

grant trigger on table "public"."decision_question_risks" to "authenticated";

grant truncate on table "public"."decision_question_risks" to "authenticated";

grant update on table "public"."decision_question_risks" to "authenticated";

grant delete on table "public"."decision_question_risks" to "service_role";

grant insert on table "public"."decision_question_risks" to "service_role";

grant references on table "public"."decision_question_risks" to "service_role";

grant select on table "public"."decision_question_risks" to "service_role";

grant trigger on table "public"."decision_question_risks" to "service_role";

grant truncate on table "public"."decision_question_risks" to "service_role";

grant update on table "public"."decision_question_risks" to "service_role";

grant delete on table "public"."decision_questions" to "anon";

grant insert on table "public"."decision_questions" to "anon";

grant references on table "public"."decision_questions" to "anon";

grant select on table "public"."decision_questions" to "anon";

grant trigger on table "public"."decision_questions" to "anon";

grant truncate on table "public"."decision_questions" to "anon";

grant update on table "public"."decision_questions" to "anon";

grant delete on table "public"."decision_questions" to "authenticated";

grant insert on table "public"."decision_questions" to "authenticated";

grant references on table "public"."decision_questions" to "authenticated";

grant select on table "public"."decision_questions" to "authenticated";

grant trigger on table "public"."decision_questions" to "authenticated";

grant truncate on table "public"."decision_questions" to "authenticated";

grant update on table "public"."decision_questions" to "authenticated";

grant delete on table "public"."decision_questions" to "service_role";

grant insert on table "public"."decision_questions" to "service_role";

grant references on table "public"."decision_questions" to "service_role";

grant select on table "public"."decision_questions" to "service_role";

grant trigger on table "public"."decision_questions" to "service_role";

grant truncate on table "public"."decision_questions" to "service_role";

grant update on table "public"."decision_questions" to "service_role";

grant delete on table "public"."interview_prompt_bias_checks" to "anon";

grant insert on table "public"."interview_prompt_bias_checks" to "anon";

grant references on table "public"."interview_prompt_bias_checks" to "anon";

grant select on table "public"."interview_prompt_bias_checks" to "anon";

grant trigger on table "public"."interview_prompt_bias_checks" to "anon";

grant truncate on table "public"."interview_prompt_bias_checks" to "anon";

grant update on table "public"."interview_prompt_bias_checks" to "anon";

grant delete on table "public"."interview_prompt_bias_checks" to "authenticated";

grant insert on table "public"."interview_prompt_bias_checks" to "authenticated";

grant references on table "public"."interview_prompt_bias_checks" to "authenticated";

grant select on table "public"."interview_prompt_bias_checks" to "authenticated";

grant trigger on table "public"."interview_prompt_bias_checks" to "authenticated";

grant truncate on table "public"."interview_prompt_bias_checks" to "authenticated";

grant update on table "public"."interview_prompt_bias_checks" to "authenticated";

grant delete on table "public"."interview_prompt_bias_checks" to "service_role";

grant insert on table "public"."interview_prompt_bias_checks" to "service_role";

grant references on table "public"."interview_prompt_bias_checks" to "service_role";

grant select on table "public"."interview_prompt_bias_checks" to "service_role";

grant trigger on table "public"."interview_prompt_bias_checks" to "service_role";

grant truncate on table "public"."interview_prompt_bias_checks" to "service_role";

grant update on table "public"."interview_prompt_bias_checks" to "service_role";

grant delete on table "public"."interview_prompt_followups" to "anon";

grant insert on table "public"."interview_prompt_followups" to "anon";

grant references on table "public"."interview_prompt_followups" to "anon";

grant select on table "public"."interview_prompt_followups" to "anon";

grant trigger on table "public"."interview_prompt_followups" to "anon";

grant truncate on table "public"."interview_prompt_followups" to "anon";

grant update on table "public"."interview_prompt_followups" to "anon";

grant delete on table "public"."interview_prompt_followups" to "authenticated";

grant insert on table "public"."interview_prompt_followups" to "authenticated";

grant references on table "public"."interview_prompt_followups" to "authenticated";

grant select on table "public"."interview_prompt_followups" to "authenticated";

grant trigger on table "public"."interview_prompt_followups" to "authenticated";

grant truncate on table "public"."interview_prompt_followups" to "authenticated";

grant update on table "public"."interview_prompt_followups" to "authenticated";

grant delete on table "public"."interview_prompt_followups" to "service_role";

grant insert on table "public"."interview_prompt_followups" to "service_role";

grant references on table "public"."interview_prompt_followups" to "service_role";

grant select on table "public"."interview_prompt_followups" to "service_role";

grant trigger on table "public"."interview_prompt_followups" to "service_role";

grant truncate on table "public"."interview_prompt_followups" to "service_role";

grant update on table "public"."interview_prompt_followups" to "service_role";

grant delete on table "public"."interview_prompt_research_questions" to "anon";

grant insert on table "public"."interview_prompt_research_questions" to "anon";

grant references on table "public"."interview_prompt_research_questions" to "anon";

grant select on table "public"."interview_prompt_research_questions" to "anon";

grant trigger on table "public"."interview_prompt_research_questions" to "anon";

grant truncate on table "public"."interview_prompt_research_questions" to "anon";

grant update on table "public"."interview_prompt_research_questions" to "anon";

grant delete on table "public"."interview_prompt_research_questions" to "authenticated";

grant insert on table "public"."interview_prompt_research_questions" to "authenticated";

grant references on table "public"."interview_prompt_research_questions" to "authenticated";

grant select on table "public"."interview_prompt_research_questions" to "authenticated";

grant trigger on table "public"."interview_prompt_research_questions" to "authenticated";

grant truncate on table "public"."interview_prompt_research_questions" to "authenticated";

grant update on table "public"."interview_prompt_research_questions" to "authenticated";

grant delete on table "public"."interview_prompt_research_questions" to "service_role";

grant insert on table "public"."interview_prompt_research_questions" to "service_role";

grant references on table "public"."interview_prompt_research_questions" to "service_role";

grant select on table "public"."interview_prompt_research_questions" to "service_role";

grant trigger on table "public"."interview_prompt_research_questions" to "service_role";

grant truncate on table "public"."interview_prompt_research_questions" to "service_role";

grant update on table "public"."interview_prompt_research_questions" to "service_role";

grant delete on table "public"."interview_prompts" to "anon";

grant insert on table "public"."interview_prompts" to "anon";

grant references on table "public"."interview_prompts" to "anon";

grant select on table "public"."interview_prompts" to "anon";

grant trigger on table "public"."interview_prompts" to "anon";

grant truncate on table "public"."interview_prompts" to "anon";

grant update on table "public"."interview_prompts" to "anon";

grant delete on table "public"."interview_prompts" to "authenticated";

grant insert on table "public"."interview_prompts" to "authenticated";

grant references on table "public"."interview_prompts" to "authenticated";

grant select on table "public"."interview_prompts" to "authenticated";

grant trigger on table "public"."interview_prompts" to "authenticated";

grant truncate on table "public"."interview_prompts" to "authenticated";

grant update on table "public"."interview_prompts" to "authenticated";

grant delete on table "public"."interview_prompts" to "service_role";

grant insert on table "public"."interview_prompts" to "service_role";

grant references on table "public"."interview_prompts" to "service_role";

grant select on table "public"."interview_prompts" to "service_role";

grant trigger on table "public"."interview_prompts" to "service_role";

grant truncate on table "public"."interview_prompts" to "service_role";

grant update on table "public"."interview_prompts" to "service_role";

grant delete on table "public"."project_research_plans" to "anon";

grant insert on table "public"."project_research_plans" to "anon";

grant references on table "public"."project_research_plans" to "anon";

grant select on table "public"."project_research_plans" to "anon";

grant trigger on table "public"."project_research_plans" to "anon";

grant truncate on table "public"."project_research_plans" to "anon";

grant update on table "public"."project_research_plans" to "anon";

grant delete on table "public"."project_research_plans" to "authenticated";

grant insert on table "public"."project_research_plans" to "authenticated";

grant references on table "public"."project_research_plans" to "authenticated";

grant select on table "public"."project_research_plans" to "authenticated";

grant trigger on table "public"."project_research_plans" to "authenticated";

grant truncate on table "public"."project_research_plans" to "authenticated";

grant update on table "public"."project_research_plans" to "authenticated";

grant delete on table "public"."project_research_plans" to "service_role";

grant insert on table "public"."project_research_plans" to "service_role";

grant references on table "public"."project_research_plans" to "service_role";

grant select on table "public"."project_research_plans" to "service_role";

grant trigger on table "public"."project_research_plans" to "service_role";

grant truncate on table "public"."project_research_plans" to "service_role";

grant update on table "public"."project_research_plans" to "service_role";

grant delete on table "public"."research_plan_data_sources" to "anon";

grant insert on table "public"."research_plan_data_sources" to "anon";

grant references on table "public"."research_plan_data_sources" to "anon";

grant select on table "public"."research_plan_data_sources" to "anon";

grant trigger on table "public"."research_plan_data_sources" to "anon";

grant truncate on table "public"."research_plan_data_sources" to "anon";

grant update on table "public"."research_plan_data_sources" to "anon";

grant delete on table "public"."research_plan_data_sources" to "authenticated";

grant insert on table "public"."research_plan_data_sources" to "authenticated";

grant references on table "public"."research_plan_data_sources" to "authenticated";

grant select on table "public"."research_plan_data_sources" to "authenticated";

grant trigger on table "public"."research_plan_data_sources" to "authenticated";

grant truncate on table "public"."research_plan_data_sources" to "authenticated";

grant update on table "public"."research_plan_data_sources" to "authenticated";

grant delete on table "public"."research_plan_data_sources" to "service_role";

grant insert on table "public"."research_plan_data_sources" to "service_role";

grant references on table "public"."research_plan_data_sources" to "service_role";

grant select on table "public"."research_plan_data_sources" to "service_role";

grant trigger on table "public"."research_plan_data_sources" to "service_role";

grant truncate on table "public"."research_plan_data_sources" to "service_role";

grant update on table "public"."research_plan_data_sources" to "service_role";

grant delete on table "public"."research_question_evidence_types" to "anon";

grant insert on table "public"."research_question_evidence_types" to "anon";

grant references on table "public"."research_question_evidence_types" to "anon";

grant select on table "public"."research_question_evidence_types" to "anon";

grant trigger on table "public"."research_question_evidence_types" to "anon";

grant truncate on table "public"."research_question_evidence_types" to "anon";

grant update on table "public"."research_question_evidence_types" to "anon";

grant delete on table "public"."research_question_evidence_types" to "authenticated";

grant insert on table "public"."research_question_evidence_types" to "authenticated";

grant references on table "public"."research_question_evidence_types" to "authenticated";

grant select on table "public"."research_question_evidence_types" to "authenticated";

grant trigger on table "public"."research_question_evidence_types" to "authenticated";

grant truncate on table "public"."research_question_evidence_types" to "authenticated";

grant update on table "public"."research_question_evidence_types" to "authenticated";

grant delete on table "public"."research_question_evidence_types" to "service_role";

grant insert on table "public"."research_question_evidence_types" to "service_role";

grant references on table "public"."research_question_evidence_types" to "service_role";

grant select on table "public"."research_question_evidence_types" to "service_role";

grant trigger on table "public"."research_question_evidence_types" to "service_role";

grant truncate on table "public"."research_question_evidence_types" to "service_role";

grant update on table "public"."research_question_evidence_types" to "service_role";

grant delete on table "public"."research_question_methods" to "anon";

grant insert on table "public"."research_question_methods" to "anon";

grant references on table "public"."research_question_methods" to "anon";

grant select on table "public"."research_question_methods" to "anon";

grant trigger on table "public"."research_question_methods" to "anon";

grant truncate on table "public"."research_question_methods" to "anon";

grant update on table "public"."research_question_methods" to "anon";

grant delete on table "public"."research_question_methods" to "authenticated";

grant insert on table "public"."research_question_methods" to "authenticated";

grant references on table "public"."research_question_methods" to "authenticated";

grant select on table "public"."research_question_methods" to "authenticated";

grant trigger on table "public"."research_question_methods" to "authenticated";

grant truncate on table "public"."research_question_methods" to "authenticated";

grant update on table "public"."research_question_methods" to "authenticated";

grant delete on table "public"."research_question_methods" to "service_role";

grant insert on table "public"."research_question_methods" to "service_role";

grant references on table "public"."research_question_methods" to "service_role";

grant select on table "public"."research_question_methods" to "service_role";

grant trigger on table "public"."research_question_methods" to "service_role";

grant truncate on table "public"."research_question_methods" to "service_role";

grant update on table "public"."research_question_methods" to "service_role";

grant delete on table "public"."research_questions" to "anon";

grant insert on table "public"."research_questions" to "anon";

grant references on table "public"."research_questions" to "anon";

grant select on table "public"."research_questions" to "anon";

grant trigger on table "public"."research_questions" to "anon";

grant truncate on table "public"."research_questions" to "anon";

grant update on table "public"."research_questions" to "anon";

grant delete on table "public"."research_questions" to "authenticated";

grant insert on table "public"."research_questions" to "authenticated";

grant references on table "public"."research_questions" to "authenticated";

grant select on table "public"."research_questions" to "authenticated";

grant trigger on table "public"."research_questions" to "authenticated";

grant truncate on table "public"."research_questions" to "authenticated";

grant update on table "public"."research_questions" to "authenticated";

grant delete on table "public"."research_questions" to "service_role";

grant insert on table "public"."research_questions" to "service_role";

grant references on table "public"."research_questions" to "service_role";

grant select on table "public"."research_questions" to "service_role";

grant trigger on table "public"."research_questions" to "service_role";

grant truncate on table "public"."research_questions" to "service_role";

grant update on table "public"."research_questions" to "service_role";

create policy "Account members can read DQ metrics"
on "public"."decision_question_metrics"
as permissive
for select
to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = decision_question_metrics.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can write DQ metrics"
on "public"."decision_question_metrics"
as permissive
for all
to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = decision_question_metrics.project_id) AND (au.user_id = auth.uid()))))))
with check (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = decision_question_metrics.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can read DQ risks"
on "public"."decision_question_risks"
as permissive
for select
to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = decision_question_risks.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can write DQ risks"
on "public"."decision_question_risks"
as permissive
for all
to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = decision_question_risks.project_id) AND (au.user_id = auth.uid()))))))
with check (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = decision_question_risks.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can delete DQ"
on "public"."decision_questions"
as permissive
for delete
to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = decision_questions.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can insert DQ"
on "public"."decision_questions"
as permissive
for insert
to public
with check (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = decision_questions.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can read DQ"
on "public"."decision_questions"
as permissive
for select
to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = decision_questions.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can update DQ"
on "public"."decision_questions"
as permissive
for update
to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = decision_questions.project_id) AND (au.user_id = auth.uid()))))))
with check (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = decision_questions.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can read prompt bias"
on "public"."interview_prompt_bias_checks"
as permissive
for select
to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = interview_prompt_bias_checks.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can write prompt bias"
on "public"."interview_prompt_bias_checks"
as permissive
for all
to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = interview_prompt_bias_checks.project_id) AND (au.user_id = auth.uid()))))))
with check (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = interview_prompt_bias_checks.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can read prompt followups"
on "public"."interview_prompt_followups"
as permissive
for select
to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = interview_prompt_followups.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can write prompt followups"
on "public"."interview_prompt_followups"
as permissive
for all
to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = interview_prompt_followups.project_id) AND (au.user_id = auth.uid()))))))
with check (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = interview_prompt_followups.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can read prompt↔rq"
on "public"."interview_prompt_research_questions"
as permissive
for select
to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = interview_prompt_research_questions.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can write prompt↔rq"
on "public"."interview_prompt_research_questions"
as permissive
for all
to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = interview_prompt_research_questions.project_id) AND (au.user_id = auth.uid()))))))
with check (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = interview_prompt_research_questions.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can delete prompts"
on "public"."interview_prompts"
as permissive
for delete
to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = interview_prompts.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can insert prompts"
on "public"."interview_prompts"
as permissive
for insert
to public
with check (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = interview_prompts.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can read prompts"
on "public"."interview_prompts"
as permissive
for select
to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = interview_prompts.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can update prompts"
on "public"."interview_prompts"
as permissive
for update
to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = interview_prompts.project_id) AND (au.user_id = auth.uid()))))))
with check (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = interview_prompts.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can delete research plans"
on "public"."project_research_plans"
as permissive
for delete
to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = project_research_plans.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can insert research plans"
on "public"."project_research_plans"
as permissive
for insert
to public
with check (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = project_research_plans.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can read research plans"
on "public"."project_research_plans"
as permissive
for select
to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = project_research_plans.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can update research plans"
on "public"."project_research_plans"
as permissive
for update
to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = project_research_plans.project_id) AND (au.user_id = auth.uid()))))))
with check (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = project_research_plans.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can read plan sources"
on "public"."research_plan_data_sources"
as permissive
for select
to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = research_plan_data_sources.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can write plan sources"
on "public"."research_plan_data_sources"
as permissive
for all
to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = research_plan_data_sources.project_id) AND (au.user_id = auth.uid()))))))
with check (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = research_plan_data_sources.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can read RQ evidence"
on "public"."research_question_evidence_types"
as permissive
for select
to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = research_question_evidence_types.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can write RQ evidence"
on "public"."research_question_evidence_types"
as permissive
for all
to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = research_question_evidence_types.project_id) AND (au.user_id = auth.uid()))))))
with check (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = research_question_evidence_types.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can read RQ methods"
on "public"."research_question_methods"
as permissive
for select
to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = research_question_methods.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can write RQ methods"
on "public"."research_question_methods"
as permissive
for all
to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = research_question_methods.project_id) AND (au.user_id = auth.uid()))))))
with check (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = research_question_methods.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can delete RQ"
on "public"."research_questions"
as permissive
for delete
to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = research_questions.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can insert RQ"
on "public"."research_questions"
as permissive
for insert
to public
with check (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = research_questions.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can read RQ"
on "public"."research_questions"
as permissive
for select
to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = research_questions.project_id) AND (au.user_id = auth.uid()))))));


create policy "Account members can update RQ"
on "public"."research_questions"
as permissive
for update
to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = research_questions.project_id) AND (au.user_id = auth.uid()))))))
with check (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM (projects p
     JOIN accounts.account_user au ON ((au.account_id = p.account_id)))
  WHERE ((p.id = research_questions.project_id) AND (au.user_id = auth.uid()))))));


CREATE TRIGGER set_decision_questions_timestamp BEFORE INSERT OR UPDATE ON public.decision_questions FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();

CREATE TRIGGER set_decision_questions_user_tracking BEFORE INSERT OR UPDATE ON public.decision_questions FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_user_tracking();

CREATE TRIGGER set_interview_prompts_timestamp BEFORE INSERT OR UPDATE ON public.interview_prompts FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();

CREATE TRIGGER set_interview_prompts_user_tracking BEFORE INSERT OR UPDATE ON public.interview_prompts FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_user_tracking();

CREATE TRIGGER set_project_research_plans_timestamp BEFORE INSERT OR UPDATE ON public.project_research_plans FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();

CREATE TRIGGER set_project_research_plans_user_tracking BEFORE INSERT OR UPDATE ON public.project_research_plans FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_user_tracking();

CREATE TRIGGER set_research_questions_timestamp BEFORE INSERT OR UPDATE ON public.research_questions FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();

CREATE TRIGGER set_research_questions_user_tracking BEFORE INSERT OR UPDATE ON public.research_questions FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_user_tracking();


