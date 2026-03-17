/**
 * Server-side video optimization task
 *
 * Takes an uploaded video from R2, re-encodes it at 720p with H.264/AAC
 * using ffmpeg, uploads the optimized version back to R2, and updates the
 * interview record. The original file is preserved in R2 and its key is
 * stored in processing_metadata for reference.
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
import { schemaTask } from "@trigger.dev/sdk";
import { execa } from "execa";
import { z } from "zod";

// ---------------------------------------------------------------------------
// S3/R2 helpers (lazily initialized to avoid env-var errors at import time)
// ---------------------------------------------------------------------------

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

function getBucket(): string {
  const bucket = process.env.R2_BUCKET || process.env.R2_BUCKET_NAME;
  if (!bucket)
    throw new Error("R2_BUCKET or R2_BUCKET_NAME must be configured");
  return bucket;
}

async function makeSignedReadUrl(
  key: string,
  expiresInSeconds: number,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
  });
  return getSignedUrl(getS3Client(), command, {
    expiresIn: expiresInSeconds,
  });
}

// ---------------------------------------------------------------------------
// Supabase REST helper (avoids importing app-level modules in Trigger context)
// ---------------------------------------------------------------------------

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured",
    );
  }
  return { url, key };
}

async function patchInterview(
  interviewId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(
    `${url}/rest/v1/interviews?id=eq.${interviewId}`,
    {
      method: "PATCH",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(patch),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to update interview: ${response.status} ${errorText}`,
    );
  }
}

async function getInterview(
  interviewId: string,
): Promise<Record<string, unknown> | null> {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(
    `${url}/rest/v1/interviews?id=eq.${interviewId}&select=thumbnail_url,processing_metadata`,
    {
      method: "GET",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) return null;
  const rows = (await response.json()) as Record<string, unknown>[];
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// R2 key helpers
// ---------------------------------------------------------------------------

/** Derive the optimized video key from the original key. */
function deriveOptimizedKey(sourceKey: string): string {
  // e.g. "originals/abc123.mp4" → "optimized/abc123.mp4"
  // or   "interviews/xyz/video.webm" → "optimized/interviews/xyz/video.mp4"
  const baseName = sourceKey.replace(/\.[^.]+$/, "");
  return `optimized/${baseName}.mp4`;
}

// ---------------------------------------------------------------------------
// Task definition
// ---------------------------------------------------------------------------

const OptimizeVideoPayload = z.object({
  interviewId: z.string().uuid(),
  sourceR2Key: z.string(),
  accountId: z.string().uuid(),
  projectId: z.string().uuid(),
});

export const optimizeVideo = schemaTask({
  id: "interview.optimize-video",
  schema: OptimizeVideoPayload,
  machine: {
    preset: "medium-1x", // 2GB RAM — ffmpeg needs ~500MB+ even for small files
  },
  maxDuration: 1800, // 30 minutes for very long videos
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 60000,
  },
  run: async (payload) => {
    const { interviewId, sourceR2Key, accountId, projectId } = payload;

    console.log(
      `[optimize-video] Starting optimization for interview ${interviewId}`,
      { sourceR2Key, accountId, projectId },
    );

    // 1. Generate presigned read URL for source video
    const signedSourceUrl = await makeSignedReadUrl(sourceR2Key, 3600);

    // 2. Probe the source file to get original size info
    let sourceSize: number | undefined;
    try {
      const headCommand = new GetObjectCommand({
        Bucket: getBucket(),
        Key: sourceR2Key,
      });
      const s3 = getS3Client();
      const headResult = await s3.send(headCommand);
      sourceSize = headResult.ContentLength ?? undefined;
      console.log(
        `[optimize-video] Source file size: ${sourceSize ? Math.round(sourceSize / 1024 / 1024) : "unknown"} MB`,
      );
    } catch (err) {
      console.warn(
        "[optimize-video] Could not determine source file size:",
        err,
      );
    }

    // 3. Run ffmpeg to optimize the video
    const outputPath = join(tmpdir(), `optimized-${randomUUID()}.mp4`);

    try {
      const ffmpegArgs = [
        "-hide_banner",
        "-y",
        "-i",
        signedSourceUrl,
        // Video: scale to 720p, 30fps, H.264 with medium preset
        "-vf",
        "scale=-2:720,fps=30",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "28",
        // Audio: AAC at 128kbps
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        // Enable fast start for web playback
        "-movflags",
        "+faststart",
        outputPath,
      ];

      console.log(
        `[optimize-video] Running ffmpeg optimization for ${sourceR2Key}`,
      );
      await execa("ffmpeg", ffmpegArgs, {
        timeout: 1500000, // 25 minutes timeout for ffmpeg itself
      });

      // Verify output
      const outputStats = statSync(outputPath);
      if (outputStats.size === 0) {
        throw new Error("Optimized video file is empty");
      }

      const optimizedSize = outputStats.size;
      const reductionPct =
        sourceSize != null
          ? Math.round((1 - optimizedSize / sourceSize) * 100)
          : null;

      console.log(`[optimize-video] Optimization complete`, {
        optimizedSizeMB: Math.round(optimizedSize / 1024 / 1024),
        sourceSizeMB: sourceSize
          ? Math.round(sourceSize / 1024 / 1024)
          : "unknown",
        reductionPct: reductionPct != null ? `${reductionPct}%` : "unknown",
      });

      // 4. Upload optimized video to R2
      const optimizedKey = deriveOptimizedKey(sourceR2Key);
      const bucket = getBucket();

      console.log(
        `[optimize-video] Uploading optimized video to ${optimizedKey}`,
      );
      await getS3Client().send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: optimizedKey,
          Body: createReadStream(outputPath),
          ContentType: "video/mp4",
          Metadata: {
            interviewId,
            accountId,
            projectId,
            sourceKey: sourceR2Key,
            optimizedAt: new Date().toISOString(),
          },
        }),
      );

      console.log(
        `[optimize-video] Uploaded optimized video to ${optimizedKey}`,
      );

      // 5. Fetch current interview to check thumbnail status
      const interview = await getInterview(interviewId);
      const existingThumbnail = interview?.thumbnail_url as string | null;
      const existingMetadata = (interview?.processing_metadata ?? {}) as Record<
        string,
        unknown
      >;

      // 6. Generate thumbnail if one doesn't already exist
      let thumbnailKey: string | undefined;
      if (!existingThumbnail) {
        const thumbOutputPath = join(tmpdir(), `thumb-${randomUUID()}.jpg`);
        try {
          // Use the local optimized file (faster than re-downloading)
          await execa(
            "ffmpeg",
            [
              "-hide_banner",
              "-y",
              "-ss",
              "1",
              "-i",
              outputPath,
              "-vframes",
              "1",
              "-q:v",
              "2",
              "-vf",
              "scale=640:-1",
              thumbOutputPath,
            ],
            { timeout: 30000 },
          );

          const thumbStats = statSync(thumbOutputPath);
          if (thumbStats.size > 0) {
            thumbnailKey = `thumbnails/${interviewId}.jpg`;
            await getS3Client().send(
              new PutObjectCommand({
                Bucket: bucket,
                Key: thumbnailKey,
                Body: createReadStream(thumbOutputPath),
                ContentType: "image/jpeg",
                Metadata: {
                  interviewId,
                  sourceKey: optimizedKey,
                },
              }),
            );
            console.log(
              `[optimize-video] Generated and uploaded thumbnail to ${thumbnailKey}`,
            );
          }
        } catch (thumbErr) {
          console.warn(
            "[optimize-video] Thumbnail generation failed (non-fatal):",
            thumbErr,
          );
        } finally {
          await unlink(thumbOutputPath).catch(() => {});
        }
      }

      // 7. Update interviews table
      const updatedMetadata = {
        ...existingMetadata,
        original_video_r2_key: sourceR2Key,
        optimized_at: new Date().toISOString(),
        original_size_bytes: sourceSize ?? null,
        optimized_size_bytes: optimizedSize,
        size_reduction_pct: reductionPct,
      };

      const patch: Record<string, unknown> = {
        media_url: optimizedKey,
        processing_metadata: updatedMetadata,
      };

      if (thumbnailKey) {
        patch.thumbnail_url = thumbnailKey;
      }

      await patchInterview(interviewId, patch);

      console.log(
        `[optimize-video] Updated interview ${interviewId} with optimized media`,
      );

      return {
        success: true,
        interviewId,
        optimizedKey,
        thumbnailKey: thumbnailKey ?? existingThumbnail ?? null,
        originalSizeBytes: sourceSize ?? null,
        optimizedSizeBytes: optimizedSize,
        sizeReductionPct: reductionPct,
      };
    } finally {
      // Clean up temp file
      await unlink(outputPath).catch(() => {});
    }
  },
});
