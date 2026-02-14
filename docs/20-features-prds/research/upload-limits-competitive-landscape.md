# Competitive Research: File Upload Size Limits

**Date:** 2026-02-13
**Related Spec:** `docs/20-features-prds/specs/file-upload-size-limits.md`
**Bead:** Insights-tfjr

---

## Current State (UpSight)

- **Zero file size limits** on any tier
- Free users can upload files of any size (tested up to 980MB in production)
- A 980MB upload failed at part 74/91 due to transient network error (2026-02-13 ~2am PT)
- Each interview costs $1.43-4.73 to process (transcription + evidence extraction + insights)

---

## Competitor Analysis

### Fireflies.ai
- **Free:** 100 MB per file
- **Paid ($10/mo+):** 2 GB video / 500 MB audio
- **Source:** [Fireflies Upload Guide](https://guide.fireflies.ai/articles/3893959957-learn-about-the-uploads-feature-in-fireflies)
- **Notes:** Distinguishes between audio and video limits on paid plans

### Grain
- **Free:** Uploads **disabled entirely**
- **Paid:** 10 uploads/month (no explicit size cap mentioned)
- **Source:** [Grain Free Plan Limits](https://support.grain.com/en/articles/10459468-file-upload-limits-on-grain-s-free-plan)
- **Notes:** Most restrictive free tier — no uploads at all

### Otter.ai
- **Free (Basic):** 3 imports total (lifetime cap)
- **Paid (Pro):** Unlimited imports
- **Source:** [Otter Basic Plan Limits](https://help.otter.ai/hc/en-us/articles/360047538094)
- **Notes:** Limits by count rather than size; very restrictive on free

### Dovetail
- **Free:** Uploads gated behind paid plan entirely
- **Paid:** 10 GB bulk import
- **Source:** [Dovetail Bulk Import](https://docs.dovetail.com/help/bulk-import-settings)
- **Notes:** Enterprise-focused, generous on paid

### Notion
- **Free:** 5 MB per file (not interview-specific)
- **Paid:** Unlimited
- **Notes:** General productivity tool, not directly comparable

### Perplexity
- **Free:** 40 MB
- **Enterprise:** 1 GB
- **Notes:** AI search tool, not directly comparable

---

## Key Insights

1. **UpSight is currently the most generous free tier in the space** — unlimited uploads with no size cap
2. **Grain and Dovetail don't allow free uploads at all** — our proposed 250 MB free tier is still very generous
3. **Fireflies is the closest competitor** — 100 MB free, 2 GB paid. Our proposal (250 MB free) is more generous
4. **Count-based limits** (Otter, Grain) are common but we already have `ai_analyses` count limits
5. **Audio vs video distinction** not worth the complexity — a single byte limit covers both

---

## Typical File Sizes (Interview Recordings)

| Recording Length | Audio (MP3/M4A) | Video (MP4 720p) | Video (MP4 1080p) |
|-----------------|-----------------|-------------------|---------------------|
| 30 min | ~30 MB | ~250 MB | ~500 MB |
| 60 min | ~60 MB | ~500 MB | ~1 GB |
| 90 min | ~90 MB | ~750 MB | ~1.5 GB |
| 120 min | ~120 MB | ~1 GB | ~2 GB |

---

## Recommendation Summary

| Tier | Proposed Limit | vs Fireflies | Rationale |
|------|---------------|-------------|-----------|
| Free | 250 MB | 2.5x more generous | Covers all audio + 30-min 720p video |
| Starter | 1 GB | Comparable to paid | Covers 60-min 1080p — bread-and-butter use case |
| Pro | 2 GB | Matches paid tier | 90+ min workshops and panels |
| Team | 5 GB | More generous | Power users, bulk imports |

The upgrade trigger fires naturally when users try to upload their first 1080p Zoom recording (30+ min) — proof they're getting value from the product.
