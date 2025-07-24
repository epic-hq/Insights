alter table "public"."people" add column "name_hash" text generated always as (lower(name)) stored;

CREATE UNIQUE INDEX uniq_people_account_namehash ON public.people USING btree (account_id, name_hash);


