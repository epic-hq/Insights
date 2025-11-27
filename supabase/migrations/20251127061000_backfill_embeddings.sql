-- Backfill embeddings for existing themes and evidence
-- This will trigger the embedding queue for all rows that don't have embeddings yet

-- Enqueue all themes without embeddings (379 themes)
-- The trigger trg_enqueue_theme will fire on UPDATE and add them to the queue
DO $$
DECLARE
    theme_record RECORD;
    count_enqueued INTEGER := 0;
BEGIN
    FOR theme_record IN
        SELECT id, name, pain
        FROM themes
        WHERE embedding IS NULL
    LOOP
        -- Enqueue via direct pgmq call
        PERFORM pgmq.send(
            'insights_embedding_queue',
            json_build_object(
                'table', 'themes',
                'id', theme_record.id::text,
                'name', theme_record.name,
                'pain', theme_record.pain
            )::jsonb
        );
        count_enqueued := count_enqueued + 1;

        -- Add batch logging every 50 items
        IF count_enqueued % 50 = 0 THEN
            RAISE NOTICE 'Enqueued % themes for embedding generation', count_enqueued;
        END IF;
    END LOOP;

    RAISE NOTICE 'Backfill complete: Enqueued % themes for embedding generation', count_enqueued;
END $$;

-- Note: Evidence embeddings would be handled similarly if we add a trigger for them
-- For now, themes are the priority as they're the canonical insight source
