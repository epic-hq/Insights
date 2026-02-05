# Processing Tier Selection - Technical Implementation Plan

> **Status:** Planned | **Estimated:** 3-4 days
> **Created:** January 2026
> **Related:** [PRD](./processing-tier-selection-prd.md) | [LLM Cost Analysis](../../../70-roadmap/llm-cost-analysis-2025-01.md)

---

## Overview

This document outlines the technical implementation for user-controlled processing tier selection. Users can choose between "Standard" (GPT-4o, faster) and "Enhanced" (GPT-5, deeper analysis) when uploading interviews.

---

## Phase 1: Database Schema (Day 1 - Morning)

### 1.1 Schema Changes

Add to `supabase/schemas/20_interviews.sql`:

```sql
-- Processing tier enum
CREATE TYPE processing_tier AS ENUM ('standard', 'enhanced');

-- Add to interviews table
ALTER TABLE interviews
  ADD COLUMN processing_tier processing_tier DEFAULT 'standard',
  ADD COLUMN credits_used integer DEFAULT 1;

-- Add to analysis_jobs table for tracking
ALTER TABLE analysis_jobs
  ADD COLUMN processing_tier processing_tier DEFAULT 'standard',
  ADD COLUMN credits_used integer DEFAULT 1;

-- Index for reporting
CREATE INDEX idx_interviews_processing_tier ON interviews(processing_tier);
CREATE INDEX idx_interviews_account_tier ON interviews(account_id, processing_tier);
```

### 1.2 Migration File

Create `supabase/migrations/YYYYMMDDHHMMSS_add_processing_tiers.sql`:

```sql
-- Add processing tier support
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'processing_tier') THEN
    CREATE TYPE processing_tier AS ENUM ('standard', 'enhanced');
  END IF;
END $$;

ALTER TABLE interviews
  ADD COLUMN IF NOT EXISTS processing_tier processing_tier DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS credits_used integer DEFAULT 1;

ALTER TABLE analysis_jobs
  ADD COLUMN IF NOT EXISTS processing_tier processing_tier DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS credits_used integer DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_interviews_processing_tier
  ON interviews(processing_tier);
CREATE INDEX IF NOT EXISTS idx_interviews_account_tier
  ON interviews(account_id, processing_tier);

COMMENT ON COLUMN interviews.processing_tier IS
  'Processing quality tier: standard (GPT-4o) or enhanced (GPT-5)';
COMMENT ON COLUMN interviews.credits_used IS
  'Credits consumed for processing: 1 (standard) or 3 (enhanced)';
```

### 1.3 TypeScript Types

After migration, regenerate types:

```bash
pnpm supabase gen types typescript --local > app/database.types.ts
```

Add helper type in `app/types/processing.ts`:

```typescript
export type ProcessingTier = 'standard' | 'enhanced';

export const PROCESSING_TIER_CONFIG = {
  standard: {
    label: 'Standard',
    description: 'Fast processing (5-7 min)',
    credits: 1,
    model: 'gpt-4o',
    bamlClient: 'CustomGPT4o',
  },
  enhanced: {
    label: 'Enhanced',
    description: 'Deep analysis (12-15 min)',
    credits: 3,
    model: 'gpt-5',
    bamlClient: 'CustomGPT5',
  },
} as const;

export function getCreditsForTier(tier: ProcessingTier): number {
  return PROCESSING_TIER_CONFIG[tier].credits;
}
```

---

## Phase 2: Backend Pipeline Updates (Day 1 - Afternoon)

### 2.1 Update Orchestrator Payload

Modify `src/trigger/interview/v2/orchestrator.ts`:

```typescript
// Add to ProcessInterviewPayload type
export interface ProcessInterviewPayload {
  interviewId: string;
  accountId: string;
  projectId: string;
  processingTier?: ProcessingTier; // NEW
  // ... existing fields
}

// Pass tier through to child tasks
const evidenceResult = await extractEvidenceTaskV2.triggerAndWait({
  ...payload,
  processingTier: payload.processingTier ?? 'standard',
});
```

### 2.2 Update Evidence Extraction

Modify `src/trigger/interview/v2/extractEvidenceCore.ts`:

```typescript
import { PROCESSING_TIER_CONFIG, type ProcessingTier } from '~/types/processing';

interface ExtractEvidenceCoreOptions {
  // ... existing options
  processingTier?: ProcessingTier;
}

export async function extractEvidenceCore(options: ExtractEvidenceCoreOptions) {
  const tier = options.processingTier ?? 'standard';
  const config = PROCESSING_TIER_CONFIG[tier];

  // Create instrumented client with tier-specific model
  const instrumentedClient = createInstrumentedBamlClient({
    clientOverride: config.bamlClient,
  });

  // Use the tier-appropriate client for extraction
  evidenceResponse = await batchExtractEvidence(
    speakerTranscripts,
    async (batch) => {
      return await instrumentedClient.ExtractEvidenceFromTranscriptV2(
        batch,
        chapters,
        language,
        facetCatalog,
      );
    },
    onProgress,
  );

  // ... rest of function
}
```

### 2.3 BAML Client Selection

Option A: Runtime client override (preferred):

```typescript
// In baml_client wrapper
export function createInstrumentedBamlClient(options?: {
  clientOverride?: string
}) {
  const client = options?.clientOverride ?? 'CustomGPT5';

  return {
    ExtractEvidenceFromTranscriptV2: async (...args) => {
      // Use dynamic client selection
      return b.ExtractEvidenceFromTranscriptV2.withClient(client)(...args);
    },
  };
}
```

Option B: Duplicate BAML functions (simpler but more maintenance):

```baml
// baml_src/extract_evidence.baml
function ExtractEvidenceFromTranscriptV2Standard(...) -> Extraction {
  client "CustomGPT4o"
  // same prompt
}

function ExtractEvidenceFromTranscriptV2Enhanced(...) -> Extraction {
  client "CustomGPT5"
  // same prompt
}
```

### 2.4 Update Credits Tracking

After processing completes, update credits in `finalizeInterview.ts`:

```typescript
import { getCreditsForTier } from '~/types/processing';

// In finalizeInterviewTaskV2
const credits = getCreditsForTier(payload.processingTier ?? 'standard');

await supabase
  .from('interviews')
  .update({
    processing_tier: payload.processingTier ?? 'standard',
    credits_used: credits,
    status: 'completed',
  })
  .eq('id', payload.interviewId);

// Track usage (for future billing integration)
await trackUsage({
  account_id: payload.accountId,
  action: 'interview_processing',
  tier: payload.processingTier ?? 'standard',
  credits,
  interview_id: payload.interviewId,
});
```

---

## Phase 3: Upload API Updates (Day 2 - Morning)

### 3.1 Update Upload Endpoint

Modify `app/routes/api.upload-file.tsx`:

```typescript
import { ProcessingTier } from '~/types/processing';

// Add to request body schema
const UploadSchema = z.object({
  // ... existing fields
  processingTier: z.enum(['standard', 'enhanced']).default('standard'),
});

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const processingTier = formData.get('processingTier') as ProcessingTier ?? 'standard';

  // ... file handling

  // Trigger processing with tier
  await processInterviewOrchestrator.trigger({
    interviewId: interview.id,
    accountId,
    projectId,
    processingTier,
  });

  return json({
    success: true,
    interviewId: interview.id,
    processingTier,
  });
}
```

### 3.2 Update Interview Creation

When creating the interview record:

```typescript
const { data: interview } = await supabase
  .from('interviews')
  .insert({
    account_id: accountId,
    project_id: projectId,
    title: fileName,
    processing_tier: processingTier,
    credits_used: getCreditsForTier(processingTier),
    status: 'processing',
  })
  .select()
  .single();
```

---

## Phase 4: Frontend UI (Day 2 - Afternoon)

### 4.1 Processing Tier Selector Component

Create `app/components/upload/ProcessingTierSelector.tsx`:

```tsx
import { PROCESSING_TIER_CONFIG, type ProcessingTier } from '~/types/processing';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { Label } from '~/components/ui/label';
import { Badge } from '~/components/ui/badge';
import { Zap, Sparkles } from 'lucide-react';

interface ProcessingTierSelectorProps {
  value: ProcessingTier;
  onChange: (tier: ProcessingTier) => void;
  disabled?: boolean;
}

export function ProcessingTierSelector({
  value,
  onChange,
  disabled
}: ProcessingTierSelectorProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Processing Mode</Label>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as ProcessingTier)}
        disabled={disabled}
        className="space-y-2"
      >
        {/* Standard Tier */}
        <label
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
            value === 'standard'
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          )}
        >
          <RadioGroupItem value="standard" className="mt-0.5" />
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="font-medium">Standard</span>
              <Badge variant="secondary" className="ml-auto">
                1 credit
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Fast processing (5-7 min). Good for sales calls, quick reviews.
            </p>
          </div>
        </label>

        {/* Enhanced Tier */}
        <label
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
            value === 'enhanced'
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          )}
        >
          <RadioGroupItem value="enhanced" className="mt-0.5" />
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span className="font-medium">Enhanced</span>
              <Badge variant="secondary" className="ml-auto">
                3 credits
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Deep analysis (12-15 min). Better for research interviews, complex topics.
            </p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li>• More accurate speaker attribution</li>
              <li>• Deeper behavioral signal extraction</li>
              <li>• Recommended for 3+ participants</li>
            </ul>
          </div>
        </label>
      </RadioGroup>
    </div>
  );
}
```

### 4.2 Integrate into Upload Modal

Update `app/features/interviews/components/UploadInterviewModal.tsx`:

```tsx
import { ProcessingTierSelector } from '~/components/upload/ProcessingTierSelector';
import type { ProcessingTier } from '~/types/processing';

export function UploadInterviewModal({ ... }) {
  const [processingTier, setProcessingTier] = useState<ProcessingTier>('standard');

  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('processingTier', processingTier);

    const response = await fetch('/api/upload-file', {
      method: 'POST',
      body: formData,
    });
    // ... handle response
  };

  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Interview</DialogTitle>
        </DialogHeader>

        {/* File dropzone */}
        <FileDropzone onDrop={handleFileDrop} />

        {/* Processing tier selector */}
        <ProcessingTierSelector
          value={processingTier}
          onChange={setProcessingTier}
          disabled={isUploading}
        />

        <DialogFooter>
          <Button onClick={handleUpload} disabled={!file || isUploading}>
            {isUploading ? 'Uploading...' : 'Upload & Process'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 4.3 Tier Badge on Interview Detail

Update `app/routes/_protected.projects.$projectId.interviews.$interviewId.tsx`:

```tsx
import { Badge } from '~/components/ui/badge';
import { Zap, Sparkles } from 'lucide-react';

function TierBadge({ tier }: { tier: ProcessingTier }) {
  if (tier === 'enhanced') {
    return (
      <Badge variant="secondary" className="gap-1">
        <Sparkles className="h-3 w-3" />
        Enhanced
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <Zap className="h-3 w-3" />
      Standard
    </Badge>
  );
}

// In the interview header
<div className="flex items-center gap-2">
  <h1>{interview.title}</h1>
  <TierBadge tier={interview.processing_tier} />
</div>
```

---

## Phase 5: Re-Processing (Day 3)

### 5.1 Upgrade Endpoint

Create `app/routes/api.interviews.$interviewId.upgrade.tsx`:

```typescript
import { getCreditsForTier } from '~/types/processing';

export async function action({ request, params }: ActionFunctionArgs) {
  const { interviewId } = params;
  const user = await requireUser(request);

  // Verify interview exists and user has access
  const { data: interview } = await supabase
    .from('interviews')
    .select('id, account_id, processing_tier, credits_used')
    .eq('id', interviewId)
    .single();

  if (!interview) {
    return json({ error: 'Interview not found' }, { status: 404 });
  }

  if (interview.processing_tier === 'enhanced') {
    return json({ error: 'Already using Enhanced tier' }, { status: 400 });
  }

  // Calculate additional credits needed
  const additionalCredits = getCreditsForTier('enhanced') - interview.credits_used;

  // Check credit balance (future: integrate with billing)
  // const hasCredits = await checkCreditBalance(interview.account_id, additionalCredits);

  // Trigger re-processing
  await processInterviewOrchestrator.trigger({
    interviewId,
    accountId: interview.account_id,
    processingTier: 'enhanced',
    isReprocess: true,
  });

  return json({
    success: true,
    additionalCredits,
  });
}
```

### 5.2 Upgrade Button Component

Create `app/components/interviews/UpgradeTierButton.tsx`:

```tsx
export function UpgradeTierButton({
  interviewId,
  currentTier
}: {
  interviewId: string;
  currentTier: ProcessingTier;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  if (currentTier === 'enhanced') return null;

  const handleUpgrade = async () => {
    setIsUpgrading(true);
    try {
      await fetch(`/api/interviews/${interviewId}/upgrade`, {
        method: 'POST',
      });
      toast.success('Upgrade started! Processing will take 12-15 minutes.');
      setIsOpen(false);
    } catch (error) {
      toast.error('Failed to upgrade. Please try again.');
    } finally {
      setIsUpgrading(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
        Upgrade to Enhanced
      </Button>

      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Upgrade to Enhanced Analysis?</AlertDialogTitle>
            <AlertDialogDescription>
              This will re-process the interview with deeper analysis.
              Your existing insights will be preserved and enhanced.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Processing time: ~12-15 minutes</span>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span>Additional cost: 2 credits</span>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUpgrade} disabled={isUpgrading}>
              {isUpgrading ? 'Upgrading...' : 'Upgrade (+2 credits)'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

---

## Phase 6: Usage Tracking Integration (Day 3-4)

### 6.1 Usage Tracking Function

Create `app/lib/usage/track.server.ts`:

```typescript
interface UsageEvent {
  account_id: string;
  action: 'interview_processing' | 'lens_application' | 'embedding_generation';
  tier?: ProcessingTier;
  credits: number;
  metadata?: Record<string, unknown>;
}

export async function trackUsage(event: UsageEvent) {
  const supabase = createSupabaseAdminClient();

  // Insert usage record
  await supabase.from('usage_events').insert({
    account_id: event.account_id,
    action: event.action,
    tier: event.tier,
    credits: event.credits,
    metadata: event.metadata,
    created_at: new Date().toISOString(),
  });

  // Update account credit balance (when billing is implemented)
  // await supabase.rpc('deduct_credits', {
  //   account_id: event.account_id,
  //   amount: event.credits
  // });
}
```

### 6.2 Usage Events Table

```sql
CREATE TABLE usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) NOT NULL,
  action text NOT NULL,
  tier processing_tier,
  credits integer NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_usage_events_account ON usage_events(account_id);
CREATE INDEX idx_usage_events_created ON usage_events(created_at);

-- RLS
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own account usage"
  ON usage_events FOR SELECT
  USING (account_id IN (
    SELECT account_id FROM account_users WHERE user_id = auth.uid()
  ));
```

---

## Testing Checklist

### Unit Tests

- [ ] `getCreditsForTier()` returns correct values
- [ ] `PROCESSING_TIER_CONFIG` has all required fields
- [ ] Schema validation accepts valid tiers, rejects invalid

### Integration Tests

- [ ] Upload with `standard` tier uses GPT-4o
- [ ] Upload with `enhanced` tier uses GPT-5
- [ ] Credits are correctly recorded in database
- [ ] Upgrade endpoint triggers re-processing
- [ ] Usage events are created correctly

### E2E Tests

- [ ] Upload flow shows tier selector
- [ ] Default tier is `standard`
- [ ] Tier badge displays correctly on interview detail
- [ ] Upgrade button appears for `standard` interviews
- [ ] Upgrade confirmation modal works

---

## Rollout Plan

### Phase 1: Internal Testing (1 day)

- Deploy to staging
- Team tests both tiers
- Verify quality differences
- Check credit tracking

### Phase 2: Beta Users (3 days)

- Enable for 10% of users
- Monitor processing times
- Collect feedback on UX
- Track tier selection rates

### Phase 3: Full Rollout

- Enable for all users
- Monitor support tickets
- Track cost savings
- Adjust defaults if needed

---

## Monitoring

### Key Metrics to Track

```sql
-- Tier distribution
SELECT
  processing_tier,
  COUNT(*) as count,
  AVG(credits_used) as avg_credits
FROM interviews
WHERE created_at > now() - interval '7 days'
GROUP BY processing_tier;

-- Processing time by tier
SELECT
  processing_tier,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_seconds
FROM analysis_jobs
WHERE status = 'completed'
  AND created_at > now() - interval '7 days'
GROUP BY processing_tier;

-- Upgrade rate
SELECT
  COUNT(*) FILTER (WHERE is_reprocess = true) as upgrades,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_reprocess = true) / COUNT(*), 2) as upgrade_rate
FROM analysis_jobs
WHERE created_at > now() - interval '7 days';
```

### Alerts

- Processing time > 20 min for Enhanced tier
- Processing time > 10 min for Standard tier
- Error rate > 5% for either tier
- Credit tracking discrepancies

---

## Files to Create/Modify

### New Files

- `app/types/processing.ts` - Type definitions and config
- `app/components/upload/ProcessingTierSelector.tsx` - UI component
- `app/components/interviews/UpgradeTierButton.tsx` - Upgrade UI
- `app/routes/api.interviews.$interviewId.upgrade.tsx` - Upgrade endpoint
- `app/lib/usage/track.server.ts` - Usage tracking
- `supabase/migrations/YYYYMMDDHHMMSS_add_processing_tiers.sql` - Migration

### Modified Files

- `src/trigger/interview/v2/orchestrator.ts` - Add tier to payload
- `src/trigger/interview/v2/extractEvidence.ts` - Pass tier to core
- `src/trigger/interview/v2/extractEvidenceCore.ts` - Model selection
- `src/trigger/interview/v2/finalizeInterview.ts` - Credit tracking
- `app/routes/api.upload-file.tsx` - Accept tier param
- `app/features/interviews/components/UploadInterviewModal.tsx` - Tier selector
- `app/routes/_protected.projects.$projectId.interviews.$interviewId.tsx` - Tier badge
