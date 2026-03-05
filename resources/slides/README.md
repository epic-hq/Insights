# Slide Decks

Self-contained HTML presentations hosted on UpSight via the deck sharing system.

## How It Works

1. **Create** a slide deck as a single HTML file in this directory
2. **Upload** it with the upload script — assets go to R2, HTML to Supabase
3. **Share** the generated link (e.g. `https://getupsight.com/deck/<token>`)

## Upload Command

```bash
# New deck (generates a new URL)
npx tsx scripts/upload-deck.ts <html-file> [assets-dir] [--title "Deck Title"]

# Update existing deck (keeps the same URL)
npx tsx scripts/upload-deck.ts <html-file> [assets-dir] [--title "Deck Title"] --update <token>
```

### Examples

```bash
# Deck with no external assets (everything inline)
npx tsx scripts/upload-deck.ts resources/slides/my-deck.html --title "My Deck"

# Deck with image assets (QR codes, logos, etc.)
npx tsx scripts/upload-deck.ts resources/slides/openclaw-builders-roundtable.html resources/slides/openclaw-assets --title "OpenClaw Builders Roundtable"

# Update an existing deck in-place (same URL)
npx tsx scripts/upload-deck.ts resources/slides/openclaw-builders-roundtable.html resources/slides/openclaw-assets --update Xkh4gga79rw_ --title "OpenClaw Builders Roundtable"
```

### What the script does

1. Reads the HTML file
2. Uploads all files in the assets directory to R2 (Cloudflare)
3. Rewrites asset references in the HTML to point to `/deck/<token>/assets/<filename>`
4. Inserts (or updates with `--update`) the HTML in the `decks` Supabase table
5. Prints the shareable URL

### Requirements

- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`
- R2 credentials configured (see `app/utils/r2.server.ts`)

## Deck Architecture

| Component | Location |
|-----------|----------|
| Upload script | `scripts/upload-deck.ts` |
| Viewer route | `app/routes/deck.$token.tsx` |
| Upload API | `app/routes/api.deck.upload.tsx` |
| DB schema | `supabase/schemas/52_decks.sql` |

## Existing Decks

| Deck | File | Assets |
|------|------|--------|
| Consultants JTBD Battlecard | `consultants-jtbd-battlecard.html` | — |
| Product Teams JTBD Battlecard | `product-teams-jtbd-battlecard.html` | — |
| OpenClaw Builders Roundtable | `openclaw-builders-roundtable.html` | `openclaw-assets/` |

## Creating New Decks

Decks are single HTML files with inline CSS and JS. Key patterns:

- **Scroll-snap navigation**: Each `<section class="slide">` is one viewport-height slide
- **Reveal animations**: Add `class="reveal"` to elements for scroll-triggered fade-in
- **Responsive**: All sizing uses `clamp()` for mobile through desktop
- **Self-contained**: No external dependencies beyond fonts

Use the `/frontend-slides` skill in Claude Code to generate new decks.
