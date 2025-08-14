alter table "public"."project_sections" add column "created_by" uuid not null;

alter table "public"."project_sections" add column "updated_by" uuid not null;

alter table "public"."project_sections" add constraint "project_sections_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."project_sections" validate constraint "project_sections_created_by_fkey";

alter table "public"."project_sections" add constraint "project_sections_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."project_sections" validate constraint "project_sections_updated_by_fkey";

CREATE TRIGGER set_project_sections_user_tracking BEFORE INSERT OR UPDATE ON public.project_sections FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_user_tracking();


