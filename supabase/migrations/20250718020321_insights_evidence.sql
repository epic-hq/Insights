drop materialized view if exists "public"."theme_counts_mv";

alter table "public"."insights" add column "evidence" text;

create materialized view "public"."theme_counts_mv" as  SELECT t.id AS theme_id,
    t.name,
    count(*) AS insight_count
   FROM (themes t
     LEFT JOIN insights i ON (((i.category = t.name) AND (i.org_id = t.org_id))))
  GROUP BY t.id, t.name;



