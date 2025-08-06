alter table "public"."insight_tags" add column "project_id" uuid;

alter table "public"."interview_tags" add column "project_id" uuid;

alter table "public"."opportunity_insights" add column "project_id" uuid;

alter table "public"."persona_insights" add column "project_id" uuid;

alter table "public"."insight_tags" add constraint "insight_tags_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."insight_tags" validate constraint "insight_tags_project_id_fkey";

alter table "public"."interview_tags" add constraint "interview_tags_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."interview_tags" validate constraint "interview_tags_project_id_fkey";

alter table "public"."opportunity_insights" add constraint "opportunity_insights_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."opportunity_insights" validate constraint "opportunity_insights_project_id_fkey";

alter table "public"."persona_insights" add constraint "persona_insights_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."persona_insights" validate constraint "persona_insights_project_id_fkey";


