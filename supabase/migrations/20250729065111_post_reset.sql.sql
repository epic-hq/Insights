create extension if not exists "pg_net" with schema "public" version '0.14.0';


create table if not exists "pgmq"."a_insight_embedding" (
    "msg_id" bigint not null,
    "read_ct" integer not null default 0,
    "enqueued_at" timestamp with time zone not null default now(),
    "archived_at" timestamp with time zone not null default now(),
    "vt" timestamp with time zone not null,
    "message" jsonb
);


create table if not exists "pgmq"."a_transcribe" (
    "msg_id" bigint not null,
    "read_ct" integer not null default 0,
    "enqueued_at" timestamp with time zone not null default now(),
    "archived_at" timestamp with time zone not null default now(),
    "vt" timestamp with time zone not null,
    "message" jsonb
);


create table if not exists "pgmq"."a_transcribe_interview_queue" (
    "msg_id" bigint not null,
    "read_ct" integer not null default 0,
    "enqueued_at" timestamp with time zone not null default now(),
    "archived_at" timestamp with time zone not null default now(),
    "vt" timestamp with time zone not null,
    "message" jsonb
);


create table if not exists "pgmq"."q_insight_embedding" (
    "msg_id" bigint generated always as identity not null,
    "read_ct" integer not null default 0,
    "enqueued_at" timestamp with time zone not null default now(),
    "vt" timestamp with time zone not null,
    "message" jsonb
);


alter table "pgmq"."q_insight_embedding" enable row level security;

create table if not exists "pgmq"."q_transcribe" (
    "msg_id" bigint generated always as identity not null,
    "read_ct" integer not null default 0,
    "enqueued_at" timestamp with time zone not null default now(),
    "vt" timestamp with time zone not null,
    "message" jsonb
);


alter table "pgmq"."q_transcribe" enable row level security;

create table if not exists "pgmq"."q_transcribe_interview_queue" (
    "msg_id" bigint generated always as identity not null,
    "read_ct" integer not null default 0,
    "enqueued_at" timestamp with time zone not null default now(),
    "vt" timestamp with time zone not null,
    "message" jsonb
);


alter table "pgmq"."q_transcribe_interview_queue" enable row level security;

CREATE UNIQUE INDEX IF NOT EXISTS a_insight_embedding_pkey ON pgmq.a_insight_embedding USING btree (msg_id);

CREATE UNIQUE INDEX IF NOT EXISTS a_transcribe_interview_queue_pkey ON pgmq.a_transcribe_interview_queue USING btree (msg_id);

CREATE UNIQUE INDEX IF NOT EXISTS a_transcribe_pkey ON pgmq.a_transcribe USING btree (msg_id);

CREATE INDEX IF NOT EXISTS archived_at_idx_insight_embedding ON pgmq.a_insight_embedding USING btree (archived_at);

CREATE INDEX IF NOT EXISTS archived_at_idx_transcribe ON pgmq.a_transcribe USING btree (archived_at);

CREATE INDEX IF NOT EXISTS archived_at_idx_transcribe_interview_queue ON pgmq.a_transcribe_interview_queue USING btree (archived_at);

CREATE UNIQUE INDEX IF NOT EXISTS q_insight_embedding_pkey ON pgmq.q_insight_embedding USING btree (msg_id);

CREATE INDEX IF NOT EXISTS q_insight_embedding_vt_idx ON pgmq.q_insight_embedding USING btree (vt);

CREATE UNIQUE INDEX IF NOT EXISTS q_transcribe_interview_queue_pkey ON pgmq.q_transcribe_interview_queue USING btree (msg_id);

CREATE INDEX IF NOT EXISTS q_transcribe_interview_queue_vt_idx ON pgmq.q_transcribe_interview_queue USING btree (vt);

CREATE UNIQUE INDEX IF NOT EXISTS q_transcribe_pkey ON pgmq.q_transcribe USING btree (msg_id);

CREATE INDEX IF NOT EXISTS q_transcribe_vt_idx ON pgmq.q_transcribe USING btree (vt);

-- Skip adding constraints if they already exist (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'a_insight_embedding_pkey') THEN
        ALTER TABLE "pgmq"."a_insight_embedding" ADD CONSTRAINT "a_insight_embedding_pkey" PRIMARY KEY USING INDEX "a_insight_embedding_pkey";
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'a_transcribe_pkey') THEN
        ALTER TABLE "pgmq"."a_transcribe" ADD CONSTRAINT "a_transcribe_pkey" PRIMARY KEY USING INDEX "a_transcribe_pkey";
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'a_transcribe_interview_queue_pkey') THEN
        ALTER TABLE "pgmq"."a_transcribe_interview_queue" ADD CONSTRAINT "a_transcribe_interview_queue_pkey" PRIMARY KEY USING INDEX "a_transcribe_interview_queue_pkey";
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'q_insight_embedding_pkey') THEN
        ALTER TABLE "pgmq"."q_insight_embedding" ADD CONSTRAINT "q_insight_embedding_pkey" PRIMARY KEY USING INDEX "q_insight_embedding_pkey";
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'q_transcribe_pkey') THEN
        ALTER TABLE "pgmq"."q_transcribe" ADD CONSTRAINT "q_transcribe_pkey" PRIMARY KEY USING INDEX "q_transcribe_pkey";
    END IF;
END $$;

-- Add remaining constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'q_transcribe_interview_queue_pkey') THEN
        ALTER TABLE "pgmq"."q_transcribe_interview_queue" ADD CONSTRAINT "q_transcribe_interview_queue_pkey" PRIMARY KEY USING INDEX "q_transcribe_interview_queue_pkey";
    END IF;
END $$;

grant select on table "pgmq"."a_insight_embedding" to "pg_monitor";

grant delete on table "pgmq"."a_insight_embedding" to "service_role";

grant insert on table "pgmq"."a_insight_embedding" to "service_role";

grant references on table "pgmq"."a_insight_embedding" to "service_role";

grant select on table "pgmq"."a_insight_embedding" to "service_role";

grant trigger on table "pgmq"."a_insight_embedding" to "service_role";

grant truncate on table "pgmq"."a_insight_embedding" to "service_role";

grant update on table "pgmq"."a_insight_embedding" to "service_role";

grant delete on table "pgmq"."a_insights_embedding_queue" to "service_role";

grant insert on table "pgmq"."a_insights_embedding_queue" to "service_role";

grant references on table "pgmq"."a_insights_embedding_queue" to "service_role";

grant select on table "pgmq"."a_insights_embedding_queue" to "service_role";

grant trigger on table "pgmq"."a_insights_embedding_queue" to "service_role";

grant truncate on table "pgmq"."a_insights_embedding_queue" to "service_role";

grant update on table "pgmq"."a_insights_embedding_queue" to "service_role";

grant select on table "pgmq"."a_transcribe" to "pg_monitor";

grant delete on table "pgmq"."a_transcribe" to "service_role";

grant insert on table "pgmq"."a_transcribe" to "service_role";

grant references on table "pgmq"."a_transcribe" to "service_role";

grant select on table "pgmq"."a_transcribe" to "service_role";

grant trigger on table "pgmq"."a_transcribe" to "service_role";

grant truncate on table "pgmq"."a_transcribe" to "service_role";

grant update on table "pgmq"."a_transcribe" to "service_role";

grant select on table "pgmq"."a_transcribe_interview_queue" to "pg_monitor";

grant delete on table "pgmq"."a_transcribe_interview_queue" to "service_role";

grant insert on table "pgmq"."a_transcribe_interview_queue" to "service_role";

grant references on table "pgmq"."a_transcribe_interview_queue" to "service_role";

grant select on table "pgmq"."a_transcribe_interview_queue" to "service_role";

grant trigger on table "pgmq"."a_transcribe_interview_queue" to "service_role";

grant truncate on table "pgmq"."a_transcribe_interview_queue" to "service_role";

grant update on table "pgmq"."a_transcribe_interview_queue" to "service_role";

grant delete on table "pgmq"."meta" to "service_role";

grant insert on table "pgmq"."meta" to "service_role";

grant references on table "pgmq"."meta" to "service_role";

grant select on table "pgmq"."meta" to "service_role";

grant trigger on table "pgmq"."meta" to "service_role";

grant truncate on table "pgmq"."meta" to "service_role";

grant update on table "pgmq"."meta" to "service_role";

grant select on table "pgmq"."q_insight_embedding" to "pg_monitor";

grant delete on table "pgmq"."q_insight_embedding" to "service_role";

grant insert on table "pgmq"."q_insight_embedding" to "service_role";

grant references on table "pgmq"."q_insight_embedding" to "service_role";

grant select on table "pgmq"."q_insight_embedding" to "service_role";

grant trigger on table "pgmq"."q_insight_embedding" to "service_role";

grant truncate on table "pgmq"."q_insight_embedding" to "service_role";

grant update on table "pgmq"."q_insight_embedding" to "service_role";

grant delete on table "pgmq"."q_insights_embedding_queue" to "service_role";

grant insert on table "pgmq"."q_insights_embedding_queue" to "service_role";

grant references on table "pgmq"."q_insights_embedding_queue" to "service_role";

grant select on table "pgmq"."q_insights_embedding_queue" to "service_role";

grant trigger on table "pgmq"."q_insights_embedding_queue" to "service_role";

grant truncate on table "pgmq"."q_insights_embedding_queue" to "service_role";

grant update on table "pgmq"."q_insights_embedding_queue" to "service_role";

grant select on table "pgmq"."q_transcribe" to "pg_monitor";

grant delete on table "pgmq"."q_transcribe" to "service_role";

grant insert on table "pgmq"."q_transcribe" to "service_role";

grant references on table "pgmq"."q_transcribe" to "service_role";

grant select on table "pgmq"."q_transcribe" to "service_role";

grant trigger on table "pgmq"."q_transcribe" to "service_role";

grant truncate on table "pgmq"."q_transcribe" to "service_role";

grant update on table "pgmq"."q_transcribe" to "service_role";

grant delete on table "pgmq"."q_transcribe_interview_queue" to "authenticated";

grant insert on table "pgmq"."q_transcribe_interview_queue" to "authenticated";

grant select on table "pgmq"."q_transcribe_interview_queue" to "authenticated";

grant select on table "pgmq"."q_transcribe_interview_queue" to "pg_monitor";

grant delete on table "pgmq"."q_transcribe_interview_queue" to "service_role";

grant insert on table "pgmq"."q_transcribe_interview_queue" to "service_role";

grant references on table "pgmq"."q_transcribe_interview_queue" to "service_role";

grant select on table "pgmq"."q_transcribe_interview_queue" to "service_role";

grant trigger on table "pgmq"."q_transcribe_interview_queue" to "service_role";

grant truncate on table "pgmq"."q_transcribe_interview_queue" to "service_role";

grant update on table "pgmq"."q_transcribe_interview_queue" to "service_role";


