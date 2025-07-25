drop function if exists "public"."link_insight_to_personas"(p_insight_id uuid);

CREATE UNIQUE INDEX tags_account_tag_unique ON public.tags USING btree (account_id, tag);

alter table "public"."tags" add constraint "tags_account_tag_unique" UNIQUE using index "tags_account_tag_unique";


