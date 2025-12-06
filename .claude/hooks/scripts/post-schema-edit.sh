#!/bin/bash
# Runs after editing supabase/schemas/*.sql
# Reminds about the full migration loop

echo ""
echo "📝 Schema file updated!"
echo ""
echo "Next steps to complete migration:"
echo "  1. supabase db diff -f <brief_name>"
echo "  2. supabase migrations up"
echo "  3. supabase db push --linked"
echo "  4. supabase gen types --project-id rbginqvgkonnoktrttqv --schema public,accounts typescript > supabase/types.ts"
echo ""
