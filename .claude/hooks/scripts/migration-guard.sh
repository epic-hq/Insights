#!/bin/bash
# Warns when directly editing generated migration files

FILE="$1"

echo ""
echo "⚠️  WARNING: Editing a generated migration file"
echo "   File: $FILE"
echo ""
echo "   Generated migrations should not be edited directly."
echo "   Instead:"
echo "   1. Edit the source schema in supabase/schemas/*.sql"
echo "   2. Run 'supabase db diff -f <name>' to generate a new migration"
echo ""
echo "   Only edit migrations for special cases (data fixes, etc.)"
echo ""

# Allow the edit but warn
exit 0
