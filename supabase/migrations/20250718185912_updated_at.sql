drop materialized view if exists "public"."theme_counts_mv";

alter table "public"."insights" add column "updated_at" timestamp with time zone not null default now();

alter table "public"."interviewee" add column "updated_at" timestamp with time zone not null default now();

alter table "public"."interviews" add column "updated_at" timestamp with time zone not null default now();

alter table "public"."opportunities" add column "updated_at" timestamp with time zone not null default now();

alter table "public"."organizations" add column "updated_at" timestamp with time zone not null default now();

alter table "public"."personas" add column "updated_at" timestamp with time zone not null default now();

alter table "public"."quotes" add column "updated_at" timestamp with time zone not null default now();

alter table "public"."research_projects" add column "updated_at" timestamp with time zone not null default now();

alter table "public"."themes" add column "updated_at" timestamp with time zone not null default now();

create materialized view "public"."theme_counts_mv" as  SELECT t.id AS theme_id,
    t.name,
    count(*) AS insight_count
   FROM (themes t
     LEFT JOIN insights i ON (((i.category = t.name) AND (i.org_id = t.org_id))))
  GROUP BY t.id, t.name;



