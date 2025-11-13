-- Person facet embedding queue setup (for semantic segment clustering)
-- Creates queue, triggers, and processor for automatic embedding generation

-- 1. Create the queue
SELECT pgmq.create('person_facet_embedding_queue');

-- 2. Grant access
GRANT INSERT, SELECT, DELETE ON TABLE pgmq.q_person_facet_embedding_queue TO authenticated;

-- 3. Enable RLS
ALTER TABLE pgmq.q_person_facet_embedding_queue ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies
CREATE POLICY "authenticated can enqueue person facets"
ON pgmq.q_person_facet_embedding_queue
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "authenticated can read person facets"
ON pgmq.q_person_facet_embedding_queue
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "authenticated can delete person facets"
ON pgmq.q_person_facet_embedding_queue
FOR DELETE
TO authenticated
USING (true);

-- 5. Trigger function to enqueue when person_facet created/updated
CREATE OR REPLACE FUNCTION public.enqueue_person_facet_embedding()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  facet_label text;
  kind_slug text;
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    -- Fetch label and kind_slug from facet_account via join
    SELECT fa.label, fkg.slug
    INTO facet_label, kind_slug
    FROM facet_account fa
    JOIN facet_kind_global fkg ON fkg.id = fa.kind_id
    WHERE fa.id = NEW.facet_account_id;

    IF facet_label IS NOT NULL THEN
      PERFORM pgmq.send(
        'person_facet_embedding_queue',
        json_build_object(
          'person_id', NEW.person_id::text,
          'facet_account_id', NEW.facet_account_id,
          'label', facet_label,
          'kind_slug', kind_slug
        )::jsonb
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 6. Create trigger
DROP TRIGGER IF EXISTS trg_enqueue_person_facet ON public.person_facet;
CREATE TRIGGER trg_enqueue_person_facet
  AFTER INSERT OR UPDATE ON public.person_facet
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_person_facet_embedding();

-- 7. Processor function
CREATE OR REPLACE FUNCTION public.process_person_facet_embedding_queue()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  job RECORD;
  count INT := 0;
BEGIN
  FOR job IN
    SELECT * FROM pgmq.read(
      'person_facet_embedding_queue',
      5,
      30
    )
  LOOP
    PERFORM public.invoke_edge_function('embed-person-facet', job.message::jsonb);
    PERFORM pgmq.delete(
      'person_facet_embedding_queue',
      job.msg_id
    );
    count := count + 1;
  END LOOP;

  RETURN format('Processed %s person facet message(s) from embedding queue.', count);
END;
$$;

-- 8. Cron job (every minute)
SELECT cron.schedule(
  'process-person-facet-embeddings',
  '*/1 * * * *',
  'SELECT public.process_person_facet_embedding_queue()'
);
