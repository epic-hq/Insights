drop function if exists "pgmq_public"."pop"(queue_name text);

drop function if exists "pgmq_public"."read"(queue_name text, sleep_seconds integer, n integer);


create extension if not exists "pg_net" with schema "public" version '0.14.0';


