# Insights

## What

Insights are patterns we find across your interviews. Like "users hate the signup flow" - backed by actual video clips of people saying it.

## Why

When you interview 20 people, you can't remember everything. Insights collect similar things people said and let you **play the exact video moment** where they said it. This is your proof when presenting findings.

## How It Works

```
You upload interviews
       ↓
AI extracts quotes (with video timestamps)
       ↓
AI groups similar quotes into themes
       ↓
You click a theme → see all quotes → play video clips
```

**The key**: every insight links back to playable video/audio. You can always verify what someone actually said.

## Using It

**View insights**: Go to Insights page. See themes grouped by category.

**Dig deeper**: Click a theme to see all the evidence. Each quote has a play button.

**Keep it fresh**: Click **Actions → Refresh All** after adding new interviews. This merges similar themes and cleans things up.

## Common Questions

**How do I get more themes?**
Add more interviews. Each interview adds evidence, and Refresh All will find new patterns. More data = better themes.

**What if a theme is missing evidence that should be there?**
The linking uses semantic similarity with a threshold (currently 0.40). If good evidence isn't linking, the threshold may need lowering, or the theme's description needs to better match how people actually talk.

**What if evidence is linked to the wrong theme?**
Currently no manual unlink in UI. The confidence score (shown as %) indicates how sure the system is. Low confidence = weaker match.

**Can I manually create themes or link evidence?**
Not yet. Themes come from AI analysis. Manual curation is a future feature.

**Why do some themes have no evidence?**
After consolidation, some themes may not match any evidence strongly enough. Refresh All cleans these up automatically.

## Future Features

- **Manual theme creation** - Add your own themes, not just AI-generated
- **Manual evidence linking** - Drag evidence to themes, unlink bad matches
- **Threshold tuning** - Adjust how strict the similarity matching is
- **Theme merging UI** - Manually combine similar themes
- **Evidence exclusion** - Mark evidence as "not useful" to exclude from analysis

## Files

| What | Where |
|------|-------|
| Pages | `app/features/insights/pages/` |
| Evidence card (with video player) | `app/features/evidence/components/EvidenceCard.tsx` |
| Theme logic | `app/features/themes/db.autoThemes.server.ts` |
