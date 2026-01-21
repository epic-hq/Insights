# Video Collections – Product Requirements Document

> **Status:** Draft | **Priority:** P3 (Backlog)
> **Scope:** v1 only – simple video galleries
> **Note:** Deprioritized in favor of Meeting Intelligence wedge

---

## Summary

Curate video responses from Ask links into shareable galleries for testimonials, feedback, and training.

**NOT building now:**
- AI-generated stories (v1.5)
- Block-based collaborative canvas (v2)
- Rich mixed-media narratives

These may come later based on user feedback from v1.

---

## Problem

- Video responses from Ask links are hidden in individual response pages
- No easy way to create testimonial galleries for marketing
- No way to embed customer voices on external sites

---

## Solution (v1)

Simple collections: curate videos → add metadata → embed or share.

### Core Features

1. **Collections** – Group videos by purpose (testimonials, feedback)
2. **Metadata overlay** – Display name, title, company, pull quote
3. **Embed widget** – Gallery on external sites
4. **Share links** – Internal/public gallery view

### What's NOT in v1

- No AI generation
- No block editor
- No complex layouts (just grid)
- No video compilation/stitching

---

## User Flow

```
Ask link responses page
    ↓
Click "Add to Collection" on video
    ↓
Edit metadata (name, title, quote)
    ↓
View collection → Get embed code
    ↓
Paste on marketing site
```

---

## Schema (Minimal)

```sql
CREATE TABLE video_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id),
    name TEXT NOT NULL,
    visibility TEXT DEFAULT 'private', -- 'private', 'public'
    share_token TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE video_collection_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES video_collections(id),
    response_id UUID NOT NULL REFERENCES research_link_responses(id),
    order_index INTEGER DEFAULT 0,
    display_name TEXT,
    display_title TEXT,
    display_company TEXT,
    pull_quote TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Implementation (When Prioritized)

| Phase | Scope | Effort |
|-------|-------|--------|
| 1 | Schema + "Add to Collection" UI | 1 week |
| 2 | Collection detail page + reorder | 1 week |
| 3 | Embed widget | 1 week |

**Total: ~3 weeks** (when prioritized)

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Collections created | 2+ per account/month |
| Embeds installed | 20% of accounts |

---

## Why Deprioritized

Meeting Intelligence (calendar + briefs + follow-ups) is higher leverage:
- Daily use vs periodic use
- Operational pain vs presentation polish
- Broader TAM (all customer-facing roles)

Video Collections can wait until Meeting Intelligence is proven.
