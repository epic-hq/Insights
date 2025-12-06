#!/bin/bash
# Runs BEFORE supabase db push
# Validates that migrations have been applied locally first

echo "🔍 Pre-push validation..."

# Check if supabase is running locally
if ! supabase status &>/dev/null; then
    echo "⚠️  WARNING: Local Supabase doesn't appear to be running"
    echo "   Run 'supabase start' first to test migrations locally"
    echo ""
fi

# Check for pending migrations that haven't been generated
SCHEMA_DIR="supabase/schemas"
if [ -d "$SCHEMA_DIR" ]; then
    # Get latest schema modification time
    LATEST_SCHEMA=$(find "$SCHEMA_DIR" -name "*.sql" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)
    
    if [ -n "$LATEST_SCHEMA" ]; then
        LATEST_MIGRATION=$(find supabase/migrations -name "[0-9]*.sql" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)
        
        if [ -n "$LATEST_MIGRATION" ]; then
            if [ "$LATEST_SCHEMA" -nt "$LATEST_MIGRATION" ]; then
                echo "⚠️  WARNING: Schema files modified after last migration"
                echo "   Did you run 'supabase db diff' first?"
                echo ""
            fi
        fi
    fi
fi

echo "✅ Pre-push checks complete"
echo ""
