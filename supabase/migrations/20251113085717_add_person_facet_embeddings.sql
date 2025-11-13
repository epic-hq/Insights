-- Add embedding support to person_facet for semantic clustering
-- This enables grouping similar facets like "Product Manager" + "PM" + "Product Lead"

-- Add embedding columns to person_facet table
ALTER TABLE public.person_facet
  ADD COLUMN IF NOT EXISTS embedding vector(1536),
  ADD COLUMN IF NOT EXISTS embedding_model text DEFAULT 'text-embedding-3-small',
  ADD COLUMN IF NOT EXISTS embedding_generated_at timestamptz;

-- Create HNSW index for fast similarity search
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'person_facet' AND indexname = 'person_facet_embedding_idx'
  ) THEN
    CREATE INDEX person_facet_embedding_idx ON public.person_facet
    USING hnsw (embedding vector_cosine_ops);
  END IF;
END $$;

-- Comments
COMMENT ON COLUMN public.person_facet.embedding IS 'OpenAI text-embedding-3-small (1536 dims) for semantic clustering of similar facets';
COMMENT ON COLUMN public.person_facet.embedding_model IS 'Model used to generate the embedding';
COMMENT ON COLUMN public.person_facet.embedding_generated_at IS 'Timestamp when embedding was generated';
