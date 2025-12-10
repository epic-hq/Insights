# People Linking Documentation

This directory contains documentation for linking people to interviews and mapping speaker labels.

## Contents

| File | Description |
|------|-------------|
| [implementation.md](./implementation.md) | Technical implementation details, data model, and key files |

## Overview

The people-linking system connects person records to interviews with support for:

1. **Upload-time linking** - Associate a person during media upload
2. **Speaker label mapping** - Map AssemblyAI speaker labels (Speaker A, B, etc.) to people
3. **Post-upload linking** - Add or modify participant associations after upload

## Data Model

```
interviews ←→ interview_people ←→ people
                    ↓
              transcript_key (Speaker A, B, etc.)
```

### Key Tables

- **`interviews`** - Interview/conversation records with `participant_pseudonym` fallback
- **`people`** - Person records with name, company, segment
- **`interview_people`** - Junction table linking interviews to people with:
  - `role` - participant, interviewer, etc.
  - `transcript_key` - AssemblyAI speaker label (e.g., "SPEAKER A")
  - `display_name` - Optional override name for this interview

## Key Files

```text
app/routes/api.onboarding-start.tsx              # Upload flow person resolution
app/features/interviews/pages/detail.tsx          # Interview detail with participant display
app/features/interviews/db.ts                     # Database queries for participants
app/features/interviews/components/ManagePeopleAssociations.tsx  # Speaker mapping UI
baml_src/extract_evidence.baml                   # AI evidence extraction with Person class
```

## User Flows

### 1. Upload with Person

When uploading media, users can:
- Select an existing person from the dropdown
- Create a new contact (name + organization) via the New Contact dialog

The `entityId` from the new contact dialog is resolved to link the person.

### 2. Speaker Label Mapping

After transcription, users can map speaker labels to people:
- View transcript with speaker labels (Speaker A, Speaker B, etc.)
- Click to assign each speaker to an existing or new person
- Mappings stored in `interview_people.transcript_key`

See [implementation.md](./implementation.md) for technical details.
