/**
 * Batch generate per-evidence video thumbnails for an interview.
 *
 * For each evidence item that has a start_ms anchor and no thumbnail yet,
 * extracts a frame from the interview video at that timestamp and uploads
 * to R2.  Only probes the video once (to check for a video stream) and
 * reuses the signed source URL across all frames.
 */

import { randomUUID } from "node:crypto";
import { createReadStream, statSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@supabase/supabase-js";
import { schemaTask } from "@trigger.dev/sdk";
import { execa } from "execa";
import ffmpeg from "ffmpeg-static";
import { z } from "zod";

function getS3Client() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY must be configured",
    );
  }
  return new S3Client({
    region: process.env.R2_REGION ?? "auto",
    endpoint: process.env.R2_S3_ENDPOINT || process.env.R2_ENDPOINT,
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function makeSignedReadUrl(
  key: string,
  expiresInSeconds: number,
): Promise<string> {
  const bucket = process.env.R2_BUCKET || process.env.R2_BUCKET_NAME;
  if (!bucket) {
    throw new Error("R2_BUCKET or R2_BUCKET_NAME must be configured");
  }
  return getSignedUrl(
    getS3Client(),
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: expiresInSeconds },
  );
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  return createClient(url, key);
}

const Payload = z.object({
  interviewId: z.string().uuid(),
  /** Force regeneration even if thumbnail already exists */
  force: z.boolean().optional().default(false),
});

export const generateEvidenceThumbnails = schemaTask({
  id: "generate-evidence-thumbnails",
  schema: Payload,
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 2000,
    maxTimeoutInMs: 60000,
  },
  run: async (payload) => {
    const { interviewId, force } = payload;
    if (!ffmpeg) throw new Error("ffmpeg binary not found");

    const supabase = getSupabase();

    // 1. Fetch interview media_url (R2 object key)
    const { data: interview, error: intErr } = await supabase
      .from("interviews")
      .select("id, media_url")
      .eq("id", interviewId)
      .single();
    if (intErr || !interview) {
      throw new Error(`Interview not found: ${interviewId}`);
    }

    const mediaKey = interview.media_url;
    if (!mediaKey) {
      return {
        success: false,
        skipped: true,
        reason: "no-media-url",
        interviewId,
      };
    }

    // 2. Fetch evidence with anchors (only those missing thumbnails unless force)
    let query = supabase
      .from("evidence")
      .select("id, anchors")
      .eq("interview_id", interviewId)
      .not("anchors", "eq", "[]");
    if (!force) {
      query = query.is("thumbnail_url", null);
    }
    const { data: evidenceRows, error: evErr } = await query;
    if (evErr) throw new Error(`Failed to fetch evidence: ${evErr.message}`);
    if (!evidenceRows || evidenceRows.length === 0) {
      return {
        success: true,
        skipped: true,
        reason: "no-evidence-to-process",
        interviewId,
      };
    }

    // 3. Probe video for video stream (once)
    const signedSourceUrl = await makeSignedReadUrl(mediaKey, 7200);
    try {
      const probeResult = await execa(
        ffmpeg,
        ["-hide_banner", "-i", signedSourceUrl, "-f", "null", "-"],
        { timeout: 30000, reject: false },
      );
      const hasVideo = /Stream.*Video:/i.test(probeResult.stderr || "");
      if (!hasVideo) {
        return {
          success: false,
          skipped: true,
          reason: "audio-only",
          interviewId,
        };
      }
    } catch {
      console.warn("Video probe failed, attempting thumbnails anyway");
    }

    // 4. Generate thumbnails
    const bucket = process.env.R2_BUCKET || process.env.R2_BUCKET_NAME;
    if (!bucket) throw new Error("R2_BUCKET not configured");
    const s3 = getS3Client();
    const results: Array<{
      evidenceId: string;
      ok: boolean;
      thumbnailKey?: string;
    }> = [];

    for (const row of evidenceRows) {
      const anchors = row.anchors as Array<{ start_ms?: number }> | null;
      const startMs = anchors?.[0]?.start_ms;
      if (typeof startMs !== "number") {
        results.push({ evidenceId: row.id, ok: false });
        continue;
      }

      const timestampSec = Math.max(0, startMs / 1000);
      const outputPath = join(tmpdir(), `ev-thumb-${randomUUID()}.jpg`);

      try {
        await execa(
          ffmpeg,
          [
            "-hide_banner",
            "-y",
            "-ss",
            String(timestampSec),
            "-i",
            signedSourceUrl,
            "-vframes",
            "1",
            "-q:v",
            "3",
            "-vf",
            "scale=320:-1",
            outputPath,
          ],
          { timeout: 30000 },
        );

        const stats = statSync(outputPath);
        if (stats.size === 0) {
          results.push({ evidenceId: row.id, ok: false });
          continue;
        }

        const thumbnailKey = `thumbnails/evidence/${row.id}.jpg`;
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: thumbnailKey,
            Body: createReadStream(outputPath),
            ContentType: "image/jpeg",
            Metadata: {
              evidenceId: row.id,
              interviewId,
              timestampSec: String(timestampSec),
            },
          }),
        );

        // Update evidence row
        await supabase
          .from("evidence")
          .update({ thumbnail_url: thumbnailKey })
          .eq("id", row.id);

        results.push({ evidenceId: row.id, ok: true, thumbnailKey });
      } catch (err) {
        console.warn(`Failed thumbnail for evidence ${row.id}:`, err);
        results.push({ evidenceId: row.id, ok: false });
      } finally {
        await unlink(outputPath).catch(() => {});
      }
    }

    const succeeded = results.filter((r) => r.ok).length;
    console.log(
      `Generated ${succeeded}/${results.length} evidence thumbnails for interview ${interviewId}`,
    );

    return {
      success: true,
      interviewId,
      total: results.length,
      succeeded,
      results,
    };
  },
});
