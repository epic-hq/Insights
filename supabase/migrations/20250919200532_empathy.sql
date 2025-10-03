alter table "public"."evidence" add column if not exists "does" text[] default '{}'::text[];

alter table "public"."evidence" add column if not exists "feels" text[] default '{}'::text[];

alter table "public"."evidence" add column if not exists "gains" text[] default '{}'::text[];

alter table "public"."evidence" add column if not exists "pains" text[] default '{}'::text[];

alter table "public"."evidence" add column if not exists "says" text[] default '{}'::text[];

alter table "public"."evidence" add column if not exists "thinks" text[] default '{}'::text[];

