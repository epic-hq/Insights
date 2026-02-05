# Docs Manager MCP Server

MCP server for documentation management and validation in the Insights project.

## Features

### 1. `find_docs` - Semantic Documentation Search
Search across all documentation using natural language queries. Returns ranked results with context.

**Example queries:**
- "authentication patterns"
- "trigger.dev background tasks"
- "PRD for decision reels"
- "how to add a new feature"

**Returns:**
- Ranked list of relevant docs (top 10)
- Relevance score
- Matching snippets with line numbers
- Document headings for context

### 2. `validate_doc_links` - Link Validation
Scans all markdown files for broken internal links.

**Checks:**
- Internal file references
- Relative path resolution
- Reports line numbers of broken links

**Skips:**
- External URLs (http/https)
- Anchor-only links (#section)

## Installation

```bash
cd mcp-servers/docs-manager
pnpm install
pnpm build
```

## Usage

### In Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "docs-manager": {
      "command": "node",
      "args": ["/Users/richardmoy/Code/ai/Insights/mcp-servers/docs-manager/dist/index.js"],
      "env": {
        "DOCS_ROOT": "/Users/richardmoy/Code/ai/Insights/docs"
      }
    }
  }
}
```

### In Windsurf (Claude Code)

Add to your Windsurf MCP config:

```json
{
  "mcpServers": {
    "docs-manager": {
      "command": "node",
      "args": ["./mcp-servers/docs-manager/dist/index.js"]
    }
  }
}
```

### Standalone

```bash
# Search docs
echo '{"method":"tools/call","params":{"name":"find_docs","arguments":{"query":"authentication"}}}' | node dist/index.js

# Validate links
echo '{"method":"tools/call","params":{"name":"validate_doc_links","arguments":{}}}' | node dist/index.js
```

## Example Interactions

**User:** "Where is authentication documented?"

**Claude:** [uses find_docs]
```
Found 3 relevant documents:
1. CLAUDE.md (score: 0.85)
   - Line 53: "Authentication uses Supabase Auth with RLS policies"
   - Headings: Quick Reference, Authentication & Authorization

2. docs/00-foundation/agents/implementation.md (score: 0.72)
   - Line 58: "Always check authentication in loaders/actions"

3. docs/30-howtos/supabase-howto.md (score: 0.65)
   - Line 42: "RLS policies enforce authentication at database level"
```

**User:** "Check if all doc links are valid"

**Claude:** [uses validate_doc_links]
```
✅ All links valid
- Scanned 87 markdown files
- Checked 342 internal links
- 0 broken links found
```

## Development

```bash
# Watch mode
pnpm dev

# Build
pnpm build

# Test locally
node dist/index.js
```

## Architecture

```
src/
  index.ts           # MCP server setup
  types.ts           # TypeScript interfaces
  utils.ts           # File reading, similarity scoring
  tools/
    findDocs.ts      # Semantic search implementation
    validateLinks.ts # Link validation logic
```

## Future Enhancements

- `check_coverage` - Analyze code-to-docs mapping
- `check_freshness` - Detect stale documentation
- `suggest_location` - Smart doc placement suggestions
- Embedding-based semantic search (vs current keyword matching)
- Integration with Mastra agents
