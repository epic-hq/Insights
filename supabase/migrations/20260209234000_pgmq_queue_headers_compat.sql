-- Compatibility patch for pgmq queue tables created by older extension versions.
-- Newer pgmq.send() paths may write a `headers` column.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'pgmq' AND table_name = 'q_transcribe_interview_queue'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'pgmq'
        AND table_name = 'q_transcribe_interview_queue'
        AND column_name = 'headers'
    ) THEN
      ALTER TABLE pgmq.q_transcribe_interview_queue ADD COLUMN headers jsonb;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'pgmq' AND table_name = 'a_transcribe_interview_queue'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'pgmq'
        AND table_name = 'a_transcribe_interview_queue'
        AND column_name = 'headers'
    ) THEN
      ALTER TABLE pgmq.a_transcribe_interview_queue ADD COLUMN headers jsonb;
    END IF;
  END IF;
END
$$;
