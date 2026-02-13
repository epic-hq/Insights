/**
 * Backward-compatibility shim.
 *
 * Legacy callers may still trigger `interview.upload-media-and-transcribe`.
 * Route everything through the v2 orchestrator so only one extraction pipeline runs.
 */

import { task } from "@trigger.dev/sdk";
import { processInterviewOrchestratorV2 } from "./v2/orchestrator";
import type { ProcessInterviewOrchestratorPayload } from "./v2/types";

export type UploadMediaAndTranscribePayload = ProcessInterviewOrchestratorPayload;

export const uploadMediaAndTranscribeTask = task({
  id: "interview.upload-media-and-transcribe",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1_000,
    maxTimeoutInMs: 10_000,
    randomize: true,
  },
  run: async (payload: UploadMediaAndTranscribePayload) => {
    const run = await processInterviewOrchestratorV2.triggerAndWait(payload);
    if (!run.ok) {
      throw new Error(run.error?.message || "Failed to run v2 orchestrator");
    }
    return run.output;
  },
});
