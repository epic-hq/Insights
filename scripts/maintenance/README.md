# Maintenance Scripts

These are one-time or occasional maintenance scripts that should be run manually when needed. They are **not** part of the Mastra tools directory to avoid auto-execution on dev server startup.

## Available Scripts

### Data Migration
- `migrate-people-to-facets.ts` - Migrate people segment data to facets system
- `migrate-pain-array-to-facets.ts` - Migrate pain array data to facets

### Data Backfill
- `backfill-pain-embeddings.ts` - Generate embeddings for existing pain facets

### Testing & Verification
- `test-bant-extraction.ts` - Test BANT framework extraction
- `test-semantic-clustering.ts` - Test semantic clustering functionality
- `verify-bant-data.ts` - Verify BANT data integrity

### Debugging
- `check-database-state.ts` - Check database state and schema
- `check-segment-data.ts` - Check segment data integrity
- `debug-bant-query.ts` - Debug BANT queries
- `fix-bant-slots.ts` - Fix BANT slot data issues

### Test Data
- `create-test-opportunities.ts` - Create test opportunities for development

## Running Scripts

```bash
# Run with dotenvx to load environment variables
dotenvx run -- npx tsx scripts/maintenance/script-name.ts

# Example: backfill pain embeddings
dotenvx run -- npx tsx scripts/maintenance/backfill-pain-embeddings.ts

# Example: migrate with options
dotenvx run -- npx tsx scripts/maintenance/migrate-people-to-facets.ts --dry-run --limit=100
```

## Note

These scripts auto-execute when imported. Do not import them in application code - they are meant to be run directly via CLI only.
