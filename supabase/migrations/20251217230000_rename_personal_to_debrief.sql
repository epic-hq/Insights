-- Rename 'personal' to 'debrief' in interaction_context enum
-- This better reflects the business use case: voice memos, call recaps, field notes
ALTER TYPE interaction_context RENAME VALUE 'personal' TO 'debrief';
