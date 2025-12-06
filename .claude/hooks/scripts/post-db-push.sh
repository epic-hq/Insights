#!/bin/bash
# Runs AFTER supabase db push
# Reminds to regenerate TypeScript types

echo ""
echo "✅ Database pushed to remote!"
echo ""
echo "🔄 Don't forget to regenerate types:"
echo "   supabase gen types --project-id rbginqvgkonnoktrttqv --schema public,accounts typescript > supabase/types.ts"
echo ""
