-- Add is_question column to evidence table
ALTER TABLE evidence ADD COLUMN is_question boolean DEFAULT false;

-- Add comment
COMMENT ON COLUMN evidence.is_question IS 'TRUE if this evidence contains a question from any speaker. Useful for filtering question-response patterns.';