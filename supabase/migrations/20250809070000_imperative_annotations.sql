-- Imperative migration for annotations system grants and permissions
-- This handles the imperative aspects that can't be in declarative schemas

-- Grant execute permissions on annotation functions
GRANT EXECUTE ON FUNCTION public.get_annotation_counts(TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vote_counts(TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_vote(TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_flags(TEXT, UUID, UUID) TO authenticated;

-- Grant table permissions for authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.annotations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.votes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entity_flags TO authenticated;

-- Grant usage on sequences (if any are created)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
