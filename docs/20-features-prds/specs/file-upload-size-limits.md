# Feature Spec: File Upload Size Limits by Plan Tier

**Status:** Draft
**Priority:** P1
**Author:** Mary (Business Analyst Agent) + Rick
**Date:** 2026-02-13

---

## Problem

There are currently **zero file size limits** on the upload path. Any user — including free tier — can upload files of any size (tested up to 980MB in production). This creates:

1. **Uncontrolled AI processing costs**: Each interview costs $1.43-4.73 to process (transcription + evidence extraction + insights). Large files = longer transcripts = higher cost.
2. **No natural upgrade trigger**: Free users get the same upload capability as paying customers.
3. **Infrastructure risk**: Large uploads consume R2 storage, bandwidth, and Trigger.dev compute without revenue to offset.
4. **Production failures**: A 980MB upload failed at part 74/91 due to a transient network error on 2026-02-13 ~2am PT.

## Competitive Landscape

| Platform | Free Tier | Paid Tier | Source |
|----------|-----------|-----------|--------|
| **Fireflies.ai** | 100 MB | 2 GB video / 500 MB audio | [Fireflies Upload Guide](https://guide.fireflies.ai/articles/3893959957-learn-about-the-uploads-feature-in-fireflies) |
| **Grain** | Uploads **disabled** | 10 uploads/month | [Grain Free Plan Limits](https://support.grain.com/en/articles/10459468-file-upload-limits-on-grain-s-free-plan) |
| **Otter.ai** | 3 imports total (lifetime) | Unlimited on Pro | [Otter Basic Plan Limits](https://help.otter.ai/hc/en-us/articles/360047538094) |
| **Dovetail** | Gated behind paid plan | 10 GB bulk import | [Dovetail Bulk Import](https://docs.dovetail.com/help/bulk-import-settings) |
| **Notion** | 5 MB | Unlimited | — |
| **Perplexity** | 40 MB | 1 GB (Enterprise) | — |

**Key insight:** UpSight currently offers unlimited uploads on free — more generous than every direct competitor. Even Grain disables uploads entirely on free.

## Typical File Sizes (Interview Recordings)

| Recording Length | Audio (MP3/M4A) | Video (MP4 720p) | Video (MP4 1080p) |
|-----------------|-----------------|-------------------|---------------------|
| 30 min | ~30 MB | ~250 MB | ~500 MB |
| 60 min | ~60 MB | ~500 MB | ~1 GB |
| 90 min | ~90 MB | ~750 MB | ~1.5 GB |
| 120 min | ~120 MB | ~1 GB | ~2 GB |

---

## Proposed Limits

| Tier | Max Upload Size | Rationale |
|------|----------------|-----------|
| **Free** | **250 MB** | Covers all audio + 30-min 720p video. More generous than Fireflies (100 MB). Natural gate at 1-hour video. |
| **Starter** ($12-15/mo) | **1 GB** | Covers 60-min 1080p calls — the bread-and-butter use case. |
| **Pro** ($23-29/mo) | **2 GB** | Covers 90+ min workshops, panels, long sessions. Matches Fireflies paid. |
| **Team** ($31-39/user/mo) | **5 GB** | Power users, bulk imports, multi-hour sessions. |

### Why 250 MB for Free (not 100 MB)

- Fireflies charges $10/mo for 2 GB. Our free tier at 250 MB is generous but bounded.
- 250 MB comfortably covers audio-only recordings of any length (a 2-hour MP3 is ~120 MB).
- The upgrade trigger fires exactly when users upload their first 1080p Zoom recording (30+ min) — proof they're getting value.

---

## Pricing Page Copy

### Comparison Row

```
Upload size    |  250 MB  |  1 GB  |  2 GB  |  5 GB
```

### Tier Descriptions (for feature list)

**Free:**
> Upload recordings up to 250 MB — enough for any audio file or short video clips

**Starter:**
> Upload recordings up to 1 GB — room for hour-long HD video calls

**Pro:**
> Upload recordings up to 2 GB — extended workshops, panels, and long sessions

**Team:**
> Upload recordings up to 5 GB — bulk imports and multi-hour recordings

### Upgrade Prompt (shown when limit exceeded)

> **File too large for your plan**
> Your current plan supports uploads up to {limit}. This file is {fileSize}.
> Upgrade to {nextPlan} for uploads up to {nextLimit}.
> [Upgrade Now] [Choose a smaller file]

---

## Technical Implementation

### Enforcement Points

**1. Client-side (fast feedback)** — `app/features/onboarding/components/UploadScreen.tsx`
- Check `file.size` in `handleFileSelect()` (line ~166) before upload starts
- Show toast error with upgrade link if exceeded
- Prevents wasted bandwidth

**2. Server-side (security enforcement)** — `app/routes/api.upload.presigned-url.tsx`
- `fileSize` is already in the request schema (line 28)
- Before generating presigned URLs, check against plan limit
- Return 403 with `file_size_limit_exceeded` error
- Follow existing pattern from `api.upload-file.tsx` which already checks `ai_analyses` limit

**3. Plan config** — `app/config/plans.ts`
- Add `upload_size_bytes` to `PlanLimits` interface
- Set values: free=250MB, starter=1GB, pro=2GB, team=5GB

### Implementation Steps

1. Add `upload_size_bytes: number` to `PlanLimits` in `app/config/plans.ts`
2. Set values per tier (in bytes)
3. Server gate in `api.upload.presigned-url.tsx`:
   - Resolve `accountId` from `projectId`
   - Call `buildFeatureGateContext(accountId, userId)`
   - Compare `fileSize` to plan limit
   - Return 403 with upgrade prompt if exceeded
4. Client gate in `UploadScreen.tsx`:
   - Pass plan limit from loader/context
   - Check in `handleFileSelect` before proceeding
   - Show error UI with upgrade CTA
5. Update pricing page comparison table

### Files to Modify

| File | Change |
|------|--------|
| `app/config/plans.ts` | Add `upload_size_bytes` to PlanLimits + set per-tier values |
| `app/routes/api.upload.presigned-url.tsx` | Server-side enforcement before presigned URL generation |
| `app/features/onboarding/components/UploadScreen.tsx` | Client-side validation in file select handler |
| Pricing page component | Add "Upload size" row to comparison table |

---

## Acceptance Criteria

- [ ] Free users cannot upload files > 250 MB
- [ ] Starter users cannot upload files > 1 GB
- [ ] Pro users cannot upload files > 2 GB
- [ ] Team users cannot upload files > 5 GB
- [ ] Server rejects presigned URL requests for oversized files (403)
- [ ] Client shows error with upgrade CTA before upload starts
- [ ] Trial users get Pro-level limits (2 GB) during trial period
- [ ] Pricing page shows upload size in comparison table
- [ ] Existing uploads are not affected (no retroactive enforcement)

---

## Open Questions

1. Should trial users get Pro limits (2 GB) or Team limits (5 GB)?
2. Should we show the limit in the upload UI proactively (e.g., "Upload up to 250 MB")?
3. Do we need a separate limit for audio vs video, or is a single byte limit sufficient?
