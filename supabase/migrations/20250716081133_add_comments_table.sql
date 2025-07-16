drop trigger if exists "update_comments_modtime" on "public"."comments";

drop policy "Enable delete for users based on user_id" on "public"."comments";

drop policy "Enable insert for authenticated users" on "public"."comments";

drop policy "Enable read access for all users" on "public"."comments";

drop policy "Enable update for users based on user_id" on "public"."comments";

drop function if exists "public"."update_modified_column"();

drop index if exists "public"."comments_created_at_idx";

drop index if exists "public"."comments_insight_id_idx";

drop index if exists "public"."comments_org_id_idx";

drop index if exists "public"."comments_user_id_idx";

alter table "public"."comments" add constraint "comments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."comments" validate constraint "comments_user_id_fkey";


