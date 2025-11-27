-- Fix infinite loop: only enqueue person facets that need embeddings
CREATE OR REPLACE FUNCTION public.enqueue_person_facet_embedding()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  facet_label text;
  kind_slug text;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.embedding IS NULL) OR 
     (TG_OP = 'UPDATE' AND NEW.embedding IS NULL AND OLD.embedding IS NULL) THEN
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

COMMENT ON FUNCTION public.enqueue_person_facet_embedding IS 'Enqueue person facet for embedding generation only if embedding is NULL (prevents infinite loop)';
