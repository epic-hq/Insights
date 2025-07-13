create extension if not exists "vector" with schema "public" version '0.8.0';

create table "public"."insight_tags" (
    "insight_id" uuid not null,
    "tag" text not null
);


create table "public"."insights" (
    "id" uuid not null default gen_random_uuid(),
    "org_id" uuid not null,
    "interview_id" uuid,
    "tag" text not null,
    "category" text not null,
    "journey_stage" text,
    "impact" smallint,
    "novelty" smallint,
    "jtbd" text,
    "motivation" text,
    "pain" text,
    "desired_outcome" text,
    "emotional_response" text,
    "opportunity_ideas" text[],
    "confidence" text,
    "contradictions" text,
    "embedding" vector(1536),
    "created_at" timestamp with time zone not null default now()
);


create table "public"."interviews" (
    "id" uuid not null default gen_random_uuid(),
    "org_id" uuid not null,
    "project_id" uuid not null,
    "title" text,
    "interview_date" date,
    "interviewer_id" uuid,
    "participant_pseudonym" text,
    "segment" text,
    "duration_min" integer,
    "status" text not null,
    "created_at" timestamp with time zone not null default now()
);


create table "public"."media_files" (
    "id" uuid not null default gen_random_uuid(),
    "org_id" uuid not null,
    "interview_id" uuid,
    "r2_path" text not null,
    "file_name" text not null,
    "mime_type" text not null,
    "size_bytes" bigint,
    "uploaded_by" uuid,
    "uploaded_at" timestamp with time zone not null default now()
);


create table "public"."opportunities" (
    "id" uuid not null default gen_random_uuid(),
    "org_id" uuid not null,
    "title" text not null,
    "owner_id" uuid,
    "kanban_status" text,
    "related_insight_ids" uuid[],
    "created_at" timestamp with time zone not null default now()
);


create table "public"."organizations" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "created_at" timestamp with time zone not null default now()
);


create table "public"."personas" (
    "id" uuid not null default gen_random_uuid(),
    "org_id" uuid not null,
    "name" text not null,
    "description" text,
    "percentage" numeric,
    "color_hex" text,
    "created_at" timestamp with time zone not null default now()
);


create table "public"."quotes" (
    "id" uuid not null default gen_random_uuid(),
    "org_id" uuid not null,
    "insight_id" uuid not null,
    "quote" text not null,
    "timestamp_sec" integer,
    "created_at" timestamp with time zone not null default now()
);


create table "public"."research_projects" (
    "id" uuid not null default gen_random_uuid(),
    "org_id" uuid not null,
    "code" text,
    "title" text not null,
    "description" text,
    "created_at" timestamp with time zone not null default now()
);


create table "public"."tags" (
    "tag" text not null,
    "description" text
);


create table "public"."themes" (
    "id" uuid not null default gen_random_uuid(),
    "org_id" uuid not null,
    "name" text not null,
    "category" text,
    "color_hex" text,
    "embedding" vector(1536),
    "created_at" timestamp with time zone not null default now()
);


create table "public"."transcripts" (
    "id" uuid not null default gen_random_uuid(),
    "org_id" uuid not null,
    "interview_id" uuid not null,
    "text" text,
    "source_json" jsonb,
    "created_at" timestamp with time zone not null default now()
);


create table "public"."user_org_memberships" (
    "user_id" uuid not null,
    "org_id" uuid not null,
    "role" text not null,
    "joined_at" timestamp with time zone not null default now()
);


CREATE UNIQUE INDEX insight_tags_pkey ON public.insight_tags USING btree (insight_id, tag);

CREATE UNIQUE INDEX insights_pkey ON public.insights USING btree (id);

CREATE UNIQUE INDEX interviews_pkey ON public.interviews USING btree (id);

CREATE UNIQUE INDEX media_files_pkey ON public.media_files USING btree (id);

CREATE UNIQUE INDEX opportunities_pkey ON public.opportunities USING btree (id);

CREATE UNIQUE INDEX organizations_pkey ON public.organizations USING btree (id);

CREATE UNIQUE INDEX personas_pkey ON public.personas USING btree (id);

CREATE UNIQUE INDEX quotes_pkey ON public.quotes USING btree (id);

CREATE UNIQUE INDEX research_projects_code_key ON public.research_projects USING btree (code);

CREATE UNIQUE INDEX research_projects_pkey ON public.research_projects USING btree (id);

CREATE UNIQUE INDEX tags_pkey ON public.tags USING btree (tag);

CREATE UNIQUE INDEX themes_pkey ON public.themes USING btree (id);

CREATE UNIQUE INDEX transcripts_pkey ON public.transcripts USING btree (id);

CREATE UNIQUE INDEX user_org_memberships_pkey ON public.user_org_memberships USING btree (user_id, org_id);

alter table "public"."insight_tags" add constraint "insight_tags_pkey" PRIMARY KEY using index "insight_tags_pkey";

alter table "public"."insights" add constraint "insights_pkey" PRIMARY KEY using index "insights_pkey";

alter table "public"."interviews" add constraint "interviews_pkey" PRIMARY KEY using index "interviews_pkey";

alter table "public"."media_files" add constraint "media_files_pkey" PRIMARY KEY using index "media_files_pkey";

alter table "public"."opportunities" add constraint "opportunities_pkey" PRIMARY KEY using index "opportunities_pkey";

alter table "public"."organizations" add constraint "organizations_pkey" PRIMARY KEY using index "organizations_pkey";

alter table "public"."personas" add constraint "personas_pkey" PRIMARY KEY using index "personas_pkey";

alter table "public"."quotes" add constraint "quotes_pkey" PRIMARY KEY using index "quotes_pkey";

alter table "public"."research_projects" add constraint "research_projects_pkey" PRIMARY KEY using index "research_projects_pkey";

alter table "public"."tags" add constraint "tags_pkey" PRIMARY KEY using index "tags_pkey";

alter table "public"."themes" add constraint "themes_pkey" PRIMARY KEY using index "themes_pkey";

alter table "public"."transcripts" add constraint "transcripts_pkey" PRIMARY KEY using index "transcripts_pkey";

alter table "public"."user_org_memberships" add constraint "user_org_memberships_pkey" PRIMARY KEY using index "user_org_memberships_pkey";

alter table "public"."insight_tags" add constraint "insight_tags_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES insights(id) ON DELETE CASCADE not valid;

alter table "public"."insight_tags" validate constraint "insight_tags_insight_id_fkey";

alter table "public"."insight_tags" add constraint "insight_tags_tag_fkey" FOREIGN KEY (tag) REFERENCES tags(tag) ON DELETE CASCADE not valid;

alter table "public"."insight_tags" validate constraint "insight_tags_tag_fkey";

alter table "public"."insights" add constraint "insights_confidence_check" CHECK ((confidence = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))) not valid;

alter table "public"."insights" validate constraint "insights_confidence_check";

alter table "public"."insights" add constraint "insights_impact_check" CHECK (((impact >= 1) AND (impact <= 5))) not valid;

alter table "public"."insights" validate constraint "insights_impact_check";

alter table "public"."insights" add constraint "insights_interview_id_fkey" FOREIGN KEY (interview_id) REFERENCES interviews(id) not valid;

alter table "public"."insights" validate constraint "insights_interview_id_fkey";

alter table "public"."insights" add constraint "insights_novelty_check" CHECK (((novelty >= 1) AND (novelty <= 5))) not valid;

alter table "public"."insights" validate constraint "insights_novelty_check";

alter table "public"."insights" add constraint "insights_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE not valid;

alter table "public"."insights" validate constraint "insights_org_id_fkey";

alter table "public"."interviews" add constraint "interviews_interviewer_id_fkey" FOREIGN KEY (interviewer_id) REFERENCES auth.users(id) not valid;

alter table "public"."interviews" validate constraint "interviews_interviewer_id_fkey";

alter table "public"."interviews" add constraint "interviews_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE not valid;

alter table "public"."interviews" validate constraint "interviews_org_id_fkey";

alter table "public"."interviews" add constraint "interviews_project_id_fkey" FOREIGN KEY (project_id) REFERENCES research_projects(id) ON DELETE CASCADE not valid;

alter table "public"."interviews" validate constraint "interviews_project_id_fkey";

alter table "public"."interviews" add constraint "interviews_status_check" CHECK ((status = ANY (ARRAY['uploaded'::text, 'transcribed'::text, 'processed'::text]))) not valid;

alter table "public"."interviews" validate constraint "interviews_status_check";

alter table "public"."media_files" add constraint "media_files_interview_id_fkey" FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE SET NULL not valid;

alter table "public"."media_files" validate constraint "media_files_interview_id_fkey";

alter table "public"."media_files" add constraint "media_files_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE not valid;

alter table "public"."media_files" validate constraint "media_files_org_id_fkey";

alter table "public"."media_files" add constraint "media_files_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) not valid;

alter table "public"."media_files" validate constraint "media_files_uploaded_by_fkey";

alter table "public"."opportunities" add constraint "opportunities_kanban_status_check" CHECK ((kanban_status = ANY (ARRAY['Explore'::text, 'Validate'::text, 'Build'::text]))) not valid;

alter table "public"."opportunities" validate constraint "opportunities_kanban_status_check";

alter table "public"."opportunities" add constraint "opportunities_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE not valid;

alter table "public"."opportunities" validate constraint "opportunities_org_id_fkey";

alter table "public"."opportunities" add constraint "opportunities_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) not valid;

alter table "public"."opportunities" validate constraint "opportunities_owner_id_fkey";

alter table "public"."personas" add constraint "personas_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE not valid;

alter table "public"."personas" validate constraint "personas_org_id_fkey";

alter table "public"."quotes" add constraint "quotes_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES insights(id) ON DELETE CASCADE not valid;

alter table "public"."quotes" validate constraint "quotes_insight_id_fkey";

alter table "public"."quotes" add constraint "quotes_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE not valid;

alter table "public"."quotes" validate constraint "quotes_org_id_fkey";

alter table "public"."research_projects" add constraint "research_projects_code_key" UNIQUE using index "research_projects_code_key";

alter table "public"."research_projects" add constraint "research_projects_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE not valid;

alter table "public"."research_projects" validate constraint "research_projects_org_id_fkey";

alter table "public"."themes" add constraint "themes_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE not valid;

alter table "public"."themes" validate constraint "themes_org_id_fkey";

alter table "public"."transcripts" add constraint "transcripts_interview_id_fkey" FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE not valid;

alter table "public"."transcripts" validate constraint "transcripts_interview_id_fkey";

alter table "public"."transcripts" add constraint "transcripts_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE not valid;

alter table "public"."transcripts" validate constraint "transcripts_org_id_fkey";

alter table "public"."user_org_memberships" add constraint "user_org_memberships_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE not valid;

alter table "public"."user_org_memberships" validate constraint "user_org_memberships_org_id_fkey";

alter table "public"."user_org_memberships" add constraint "user_org_memberships_role_check" CHECK ((role = ANY (ARRAY['owner'::text, 'member'::text]))) not valid;

alter table "public"."user_org_memberships" validate constraint "user_org_memberships_role_check";

alter table "public"."user_org_memberships" add constraint "user_org_memberships_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_org_memberships" validate constraint "user_org_memberships_user_id_fkey";

create materialized view "public"."theme_counts_mv" as  SELECT t.id AS theme_id,
    t.name,
    count(*) AS insight_count
   FROM (themes t
     LEFT JOIN insights i ON (((i.category = t.name) AND (i.org_id = t.org_id))))
  GROUP BY t.id, t.name;


grant delete on table "public"."insight_tags" to "anon";

grant insert on table "public"."insight_tags" to "anon";

grant references on table "public"."insight_tags" to "anon";

grant select on table "public"."insight_tags" to "anon";

grant trigger on table "public"."insight_tags" to "anon";

grant truncate on table "public"."insight_tags" to "anon";

grant update on table "public"."insight_tags" to "anon";

grant delete on table "public"."insight_tags" to "authenticated";

grant insert on table "public"."insight_tags" to "authenticated";

grant references on table "public"."insight_tags" to "authenticated";

grant select on table "public"."insight_tags" to "authenticated";

grant trigger on table "public"."insight_tags" to "authenticated";

grant truncate on table "public"."insight_tags" to "authenticated";

grant update on table "public"."insight_tags" to "authenticated";

grant delete on table "public"."insight_tags" to "service_role";

grant insert on table "public"."insight_tags" to "service_role";

grant references on table "public"."insight_tags" to "service_role";

grant select on table "public"."insight_tags" to "service_role";

grant trigger on table "public"."insight_tags" to "service_role";

grant truncate on table "public"."insight_tags" to "service_role";

grant update on table "public"."insight_tags" to "service_role";

grant delete on table "public"."insights" to "anon";

grant insert on table "public"."insights" to "anon";

grant references on table "public"."insights" to "anon";

grant select on table "public"."insights" to "anon";

grant trigger on table "public"."insights" to "anon";

grant truncate on table "public"."insights" to "anon";

grant update on table "public"."insights" to "anon";

grant delete on table "public"."insights" to "authenticated";

grant insert on table "public"."insights" to "authenticated";

grant references on table "public"."insights" to "authenticated";

grant select on table "public"."insights" to "authenticated";

grant trigger on table "public"."insights" to "authenticated";

grant truncate on table "public"."insights" to "authenticated";

grant update on table "public"."insights" to "authenticated";

grant delete on table "public"."insights" to "service_role";

grant insert on table "public"."insights" to "service_role";

grant references on table "public"."insights" to "service_role";

grant select on table "public"."insights" to "service_role";

grant trigger on table "public"."insights" to "service_role";

grant truncate on table "public"."insights" to "service_role";

grant update on table "public"."insights" to "service_role";

grant delete on table "public"."interviews" to "anon";

grant insert on table "public"."interviews" to "anon";

grant references on table "public"."interviews" to "anon";

grant select on table "public"."interviews" to "anon";

grant trigger on table "public"."interviews" to "anon";

grant truncate on table "public"."interviews" to "anon";

grant update on table "public"."interviews" to "anon";

grant delete on table "public"."interviews" to "authenticated";

grant insert on table "public"."interviews" to "authenticated";

grant references on table "public"."interviews" to "authenticated";

grant select on table "public"."interviews" to "authenticated";

grant trigger on table "public"."interviews" to "authenticated";

grant truncate on table "public"."interviews" to "authenticated";

grant update on table "public"."interviews" to "authenticated";

grant delete on table "public"."interviews" to "service_role";

grant insert on table "public"."interviews" to "service_role";

grant references on table "public"."interviews" to "service_role";

grant select on table "public"."interviews" to "service_role";

grant trigger on table "public"."interviews" to "service_role";

grant truncate on table "public"."interviews" to "service_role";

grant update on table "public"."interviews" to "service_role";

grant delete on table "public"."media_files" to "anon";

grant insert on table "public"."media_files" to "anon";

grant references on table "public"."media_files" to "anon";

grant select on table "public"."media_files" to "anon";

grant trigger on table "public"."media_files" to "anon";

grant truncate on table "public"."media_files" to "anon";

grant update on table "public"."media_files" to "anon";

grant delete on table "public"."media_files" to "authenticated";

grant insert on table "public"."media_files" to "authenticated";

grant references on table "public"."media_files" to "authenticated";

grant select on table "public"."media_files" to "authenticated";

grant trigger on table "public"."media_files" to "authenticated";

grant truncate on table "public"."media_files" to "authenticated";

grant update on table "public"."media_files" to "authenticated";

grant delete on table "public"."media_files" to "service_role";

grant insert on table "public"."media_files" to "service_role";

grant references on table "public"."media_files" to "service_role";

grant select on table "public"."media_files" to "service_role";

grant trigger on table "public"."media_files" to "service_role";

grant truncate on table "public"."media_files" to "service_role";

grant update on table "public"."media_files" to "service_role";

grant delete on table "public"."opportunities" to "anon";

grant insert on table "public"."opportunities" to "anon";

grant references on table "public"."opportunities" to "anon";

grant select on table "public"."opportunities" to "anon";

grant trigger on table "public"."opportunities" to "anon";

grant truncate on table "public"."opportunities" to "anon";

grant update on table "public"."opportunities" to "anon";

grant delete on table "public"."opportunities" to "authenticated";

grant insert on table "public"."opportunities" to "authenticated";

grant references on table "public"."opportunities" to "authenticated";

grant select on table "public"."opportunities" to "authenticated";

grant trigger on table "public"."opportunities" to "authenticated";

grant truncate on table "public"."opportunities" to "authenticated";

grant update on table "public"."opportunities" to "authenticated";

grant delete on table "public"."opportunities" to "service_role";

grant insert on table "public"."opportunities" to "service_role";

grant references on table "public"."opportunities" to "service_role";

grant select on table "public"."opportunities" to "service_role";

grant trigger on table "public"."opportunities" to "service_role";

grant truncate on table "public"."opportunities" to "service_role";

grant update on table "public"."opportunities" to "service_role";

grant delete on table "public"."organizations" to "anon";

grant insert on table "public"."organizations" to "anon";

grant references on table "public"."organizations" to "anon";

grant select on table "public"."organizations" to "anon";

grant trigger on table "public"."organizations" to "anon";

grant truncate on table "public"."organizations" to "anon";

grant update on table "public"."organizations" to "anon";

grant delete on table "public"."organizations" to "authenticated";

grant insert on table "public"."organizations" to "authenticated";

grant references on table "public"."organizations" to "authenticated";

grant select on table "public"."organizations" to "authenticated";

grant trigger on table "public"."organizations" to "authenticated";

grant truncate on table "public"."organizations" to "authenticated";

grant update on table "public"."organizations" to "authenticated";

grant delete on table "public"."organizations" to "service_role";

grant insert on table "public"."organizations" to "service_role";

grant references on table "public"."organizations" to "service_role";

grant select on table "public"."organizations" to "service_role";

grant trigger on table "public"."organizations" to "service_role";

grant truncate on table "public"."organizations" to "service_role";

grant update on table "public"."organizations" to "service_role";

grant delete on table "public"."personas" to "anon";

grant insert on table "public"."personas" to "anon";

grant references on table "public"."personas" to "anon";

grant select on table "public"."personas" to "anon";

grant trigger on table "public"."personas" to "anon";

grant truncate on table "public"."personas" to "anon";

grant update on table "public"."personas" to "anon";

grant delete on table "public"."personas" to "authenticated";

grant insert on table "public"."personas" to "authenticated";

grant references on table "public"."personas" to "authenticated";

grant select on table "public"."personas" to "authenticated";

grant trigger on table "public"."personas" to "authenticated";

grant truncate on table "public"."personas" to "authenticated";

grant update on table "public"."personas" to "authenticated";

grant delete on table "public"."personas" to "service_role";

grant insert on table "public"."personas" to "service_role";

grant references on table "public"."personas" to "service_role";

grant select on table "public"."personas" to "service_role";

grant trigger on table "public"."personas" to "service_role";

grant truncate on table "public"."personas" to "service_role";

grant update on table "public"."personas" to "service_role";

grant delete on table "public"."quotes" to "anon";

grant insert on table "public"."quotes" to "anon";

grant references on table "public"."quotes" to "anon";

grant select on table "public"."quotes" to "anon";

grant trigger on table "public"."quotes" to "anon";

grant truncate on table "public"."quotes" to "anon";

grant update on table "public"."quotes" to "anon";

grant delete on table "public"."quotes" to "authenticated";

grant insert on table "public"."quotes" to "authenticated";

grant references on table "public"."quotes" to "authenticated";

grant select on table "public"."quotes" to "authenticated";

grant trigger on table "public"."quotes" to "authenticated";

grant truncate on table "public"."quotes" to "authenticated";

grant update on table "public"."quotes" to "authenticated";

grant delete on table "public"."quotes" to "service_role";

grant insert on table "public"."quotes" to "service_role";

grant references on table "public"."quotes" to "service_role";

grant select on table "public"."quotes" to "service_role";

grant trigger on table "public"."quotes" to "service_role";

grant truncate on table "public"."quotes" to "service_role";

grant update on table "public"."quotes" to "service_role";

grant delete on table "public"."research_projects" to "anon";

grant insert on table "public"."research_projects" to "anon";

grant references on table "public"."research_projects" to "anon";

grant select on table "public"."research_projects" to "anon";

grant trigger on table "public"."research_projects" to "anon";

grant truncate on table "public"."research_projects" to "anon";

grant update on table "public"."research_projects" to "anon";

grant delete on table "public"."research_projects" to "authenticated";

grant insert on table "public"."research_projects" to "authenticated";

grant references on table "public"."research_projects" to "authenticated";

grant select on table "public"."research_projects" to "authenticated";

grant trigger on table "public"."research_projects" to "authenticated";

grant truncate on table "public"."research_projects" to "authenticated";

grant update on table "public"."research_projects" to "authenticated";

grant delete on table "public"."research_projects" to "service_role";

grant insert on table "public"."research_projects" to "service_role";

grant references on table "public"."research_projects" to "service_role";

grant select on table "public"."research_projects" to "service_role";

grant trigger on table "public"."research_projects" to "service_role";

grant truncate on table "public"."research_projects" to "service_role";

grant update on table "public"."research_projects" to "service_role";

grant delete on table "public"."tags" to "anon";

grant insert on table "public"."tags" to "anon";

grant references on table "public"."tags" to "anon";

grant select on table "public"."tags" to "anon";

grant trigger on table "public"."tags" to "anon";

grant truncate on table "public"."tags" to "anon";

grant update on table "public"."tags" to "anon";

grant delete on table "public"."tags" to "authenticated";

grant insert on table "public"."tags" to "authenticated";

grant references on table "public"."tags" to "authenticated";

grant select on table "public"."tags" to "authenticated";

grant trigger on table "public"."tags" to "authenticated";

grant truncate on table "public"."tags" to "authenticated";

grant update on table "public"."tags" to "authenticated";

grant delete on table "public"."tags" to "service_role";

grant insert on table "public"."tags" to "service_role";

grant references on table "public"."tags" to "service_role";

grant select on table "public"."tags" to "service_role";

grant trigger on table "public"."tags" to "service_role";

grant truncate on table "public"."tags" to "service_role";

grant update on table "public"."tags" to "service_role";

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

grant delete on table "public"."transcripts" to "anon";

grant insert on table "public"."transcripts" to "anon";

grant references on table "public"."transcripts" to "anon";

grant select on table "public"."transcripts" to "anon";

grant trigger on table "public"."transcripts" to "anon";

grant truncate on table "public"."transcripts" to "anon";

grant update on table "public"."transcripts" to "anon";

grant delete on table "public"."transcripts" to "authenticated";

grant insert on table "public"."transcripts" to "authenticated";

grant references on table "public"."transcripts" to "authenticated";

grant select on table "public"."transcripts" to "authenticated";

grant trigger on table "public"."transcripts" to "authenticated";

grant truncate on table "public"."transcripts" to "authenticated";

grant update on table "public"."transcripts" to "authenticated";

grant delete on table "public"."transcripts" to "service_role";

grant insert on table "public"."transcripts" to "service_role";

grant references on table "public"."transcripts" to "service_role";

grant select on table "public"."transcripts" to "service_role";

grant trigger on table "public"."transcripts" to "service_role";

grant truncate on table "public"."transcripts" to "service_role";

grant update on table "public"."transcripts" to "service_role";

grant delete on table "public"."user_org_memberships" to "anon";

grant insert on table "public"."user_org_memberships" to "anon";

grant references on table "public"."user_org_memberships" to "anon";

grant select on table "public"."user_org_memberships" to "anon";

grant trigger on table "public"."user_org_memberships" to "anon";

grant truncate on table "public"."user_org_memberships" to "anon";

grant update on table "public"."user_org_memberships" to "anon";

grant delete on table "public"."user_org_memberships" to "authenticated";

grant insert on table "public"."user_org_memberships" to "authenticated";

grant references on table "public"."user_org_memberships" to "authenticated";

grant select on table "public"."user_org_memberships" to "authenticated";

grant trigger on table "public"."user_org_memberships" to "authenticated";

grant truncate on table "public"."user_org_memberships" to "authenticated";

grant update on table "public"."user_org_memberships" to "authenticated";

grant delete on table "public"."user_org_memberships" to "service_role";

grant insert on table "public"."user_org_memberships" to "service_role";

grant references on table "public"."user_org_memberships" to "service_role";

grant select on table "public"."user_org_memberships" to "service_role";

grant trigger on table "public"."user_org_memberships" to "service_role";

grant truncate on table "public"."user_org_memberships" to "service_role";

grant update on table "public"."user_org_memberships" to "service_role";


