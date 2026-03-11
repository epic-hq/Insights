-- Fix: All enqueue trigger functions must be SECURITY DEFINER so they execute
-- as the function owner (postgres) rather than the calling role (service_role).
-- Without this, service_role gets "permission denied for table q_*" when any
-- trigger fires on insert/update of the affected tables.
-- Affected: enqueue_insight_embedding, enqueue_evidence_embedding,
--           enqueue_person_facet_embedding, enqueue_transcribe_interview

create or replace function public.enqueue_insight_embedding()
returns trigger language plpgsql
security definer
set search_path = public, pgmq
as $$
begin
  if (TG_OP = 'INSERT'
      or (TG_OP = 'UPDATE' and old.pain is distinct from new.pain)) then
    perform pgmq.send(
      'insights_embedding_queue',
      json_build_object(
        'table', TG_TABLE_NAME,
        'id',    new.id::text,
        'name',  new.name,
        'pain',  new.pain
      )::jsonb
    );
  end if;
  return new;
end;
$$;

create or replace function public.enqueue_evidence_embedding()
returns trigger language plpgsql
security definer
set search_path = public, pgmq
as $$
begin
  if new.embedding is null then
    perform pgmq.send(
      'insights_embedding_queue',
      json_build_object(
        'table', 'evidence',
        'id', new.id::text,
        'name', coalesce(new.gist, substring(new.verbatim from 1 for 100)),
        'pain', new.verbatim
      )::jsonb
    );
  end if;
  return new;
end;
$$;

create or replace function public.enqueue_person_facet_embedding()
returns trigger language plpgsql
security definer
set search_path = public, pgmq
as $$
declare
  facet_label text;
  kind_slug text;
begin
  if (TG_OP = 'INSERT' and new.embedding is null) or
     (TG_OP = 'UPDATE' and new.embedding is null and old.embedding is null) then
    select fa.label, fkg.slug
    into facet_label, kind_slug
    from facet_account fa
    join facet_kind_global fkg on fkg.id = fa.kind_id
    where fa.id = new.facet_account_id;

    if facet_label is not null then
      perform pgmq.send(
        'person_facet_embedding_queue',
        json_build_object(
          'person_id', new.person_id::text,
          'facet_account_id', new.facet_account_id,
          'label', facet_label,
          'kind_slug', kind_slug
        )::jsonb
      );
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.enqueue_transcribe_interview()
returns trigger language plpgsql
security definer
set search_path = public, pgmq
as $$
begin
  if (TG_OP = 'INSERT'
      or (TG_OP = 'UPDATE' and old.media_url is distinct from new.media_url)) then
    perform pgmq.send(
      'transcribe_interview_queue',
      json_build_object(
        'table', TG_TABLE_NAME,
        'id',    new.id::text,
        'media_url',  new.media_url
      )::jsonb
    );
  end if;
  return new;
end;
$$;
