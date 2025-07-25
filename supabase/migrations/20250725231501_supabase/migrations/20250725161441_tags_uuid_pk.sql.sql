alter table "public"."insight_tags" drop constraint "insight_tags_insight_id_tag_account_id_key";

alter table "public"."interview_tags" drop constraint "interview_tags_interview_id_tag_account_id_key";

drop function if exists "public"."link_insight_to_personas"(p_insight_id uuid);

alter table "public"."tags" drop constraint "tags_pkey";

drop index if exists "public"."idx_insight_tags_tag";

drop index if exists "public"."idx_interview_tags_tag";

drop index if exists "public"."insight_tags_insight_id_tag_account_id_key";

drop index if exists "public"."interview_tags_interview_id_tag_account_id_key";

drop index if exists "public"."tags_pkey";

alter table "public"."insight_tags" drop column "tag";

alter table "public"."insight_tags" add column "tag_id" uuid not null;

alter table "public"."interview_tags" drop column "tag";

alter table "public"."interview_tags" add column "tag_id" uuid not null;

alter table "public"."tags" add column "id" uuid not null default gen_random_uuid();

CREATE INDEX idx_insight_tags_tag_id ON public.insight_tags USING btree (tag_id);

CREATE INDEX idx_interview_tags_tag_id ON public.interview_tags USING btree (tag_id);

CREATE UNIQUE INDEX insight_tags_insight_id_tag_id_account_id_key ON public.insight_tags USING btree (insight_id, tag_id, account_id);

CREATE UNIQUE INDEX interview_tags_interview_id_tag_id_account_id_key ON public.interview_tags USING btree (interview_id, tag_id, account_id);

CREATE UNIQUE INDEX tags_pkey ON public.tags USING btree (id);

alter table "public"."tags" add constraint "tags_pkey" PRIMARY KEY using index "tags_pkey";

alter table "public"."insight_tags" add constraint "insight_tags_insight_id_tag_id_account_id_key" UNIQUE using index "insight_tags_insight_id_tag_id_account_id_key";

alter table "public"."insight_tags" add constraint "insight_tags_tag_id_fkey" FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE not valid;

alter table "public"."insight_tags" validate constraint "insight_tags_tag_id_fkey";

alter table "public"."interview_tags" add constraint "interview_tags_interview_id_tag_id_account_id_key" UNIQUE using index "interview_tags_interview_id_tag_id_account_id_key";

alter table "public"."interview_tags" add constraint "interview_tags_tag_id_fkey" FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE not valid;

alter table "public"."interview_tags" validate constraint "interview_tags_tag_id_fkey";


