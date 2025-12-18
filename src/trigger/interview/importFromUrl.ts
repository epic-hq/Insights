/**
 * Import Interview from URL Task
 *
 * Fetches media from external URLs, uploads to R2, and triggers the interview
 * processing workflow. This is the single source of truth for all URL imports.
 *
 * Flow:
 * 1. Resolve URL → media URL (direct, HLS/DASH, or webpage extraction)
 * 2. Download media (ffmpeg for streaming, direct fetch for progressive)
 * 3. Upload to R2
 * 4. Create interview record
 * 5. Trigger thumbnail generation (for video files)
 * 6. Trigger transcription & analysis workflow
 *
 * Supported URL types:
 * - Direct media files (mp4, mp3, m4a, webm, mov, etc.)
 * - HLS streaming manifests (.m3u8) - converted to MP4 via ffmpeg
 * - DASH streaming manifests (.mpd) - converted to MP4 via ffmpeg
 * - Webpages with embedded media (auto-extracted via HTML parsing + LLM)
 *
 * Supported providers with API integration:
 * - Vento.so: Screen recordings with HLS streams
 * - Apollo.io: Sales call recordings (requires authentication)
 *
 * Used by:
 * - /api/upload-from-url API endpoint
 * - Mastra importVideoFromUrl tool (for chat agent)
 */

import { schemaTask, task, tasks } from "@trigger.dev/sdk";
import consola from "consola";
import { format } from "date-fns";
import { spawn } from "node:child_process";
import { promises as fs, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { ensureInterviewInterviewerLink } from "~/features/people/services/internalPeople.server";
import { createAndProcessAnalysisJob } from "~/utils/processInterviewAnalysis.server";
import { uploadToR2 } from "~/utils/r2.server";
import {
  isDirectMediaUrl,
  isStreamingUrl,
  extractBestMediaUrl,
  type MediaUrlType,
  detectMediaUrlType,
} from "~/utils/extractMediaUrl.server";
import type { generateThumbnail } from "../generate-thumbnail";

// =============================================================================
// Types & Schemas
// =============================================================================

const UrlImportItemSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  speakerNames: z.array(z.string()).optional(), // e.g., ["Speaker A", "John Smith"]
  personId: z.string().uuid().optional(), // Link to existing person
  // New: Participant info for person creation
  participantName: z.string().optional(), // Name of participant to create
  participantOrganization: z.string().optional(), // Organization name (will be created if doesn't exist)
  participantSegment: z.string().optional(), // Segment for the person
});

const ImportFromUrlPayloadSchema = z.object({
  urls: z.array(UrlImportItemSchema).min(1),
  projectId: z.string().uuid(),
  accountId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
});

export type ImportFromUrlPayload = z.infer<typeof ImportFromUrlPayloadSchema>;

type Provider = "vento" | "apollo" | "unknown";

interface MediaInfo {
  provider: Provider;
  title: string;
  duration?: number;
  videoUrl?: string; // Direct video URL or HLS manifest
  audioUrl?: string; // Direct audio URL
  thumbnailUrl?: string;
  isHls: boolean;
}

interface DownloadResult {
  success: boolean;
  filePath?: string;
  contentType?: string;
  error?: string;
}

// =============================================================================
// Provider Detection & Media Extraction
// =============================================================================

function detectProvider(url: string): Provider {
  const urlLower = url.toLowerCase();
  if (urlLower.includes("vento.so")) return "vento";
  if (urlLower.includes("apollo.io")) return "apollo";
  return "unknown";
}

/**
 * Extract recording ID from Vento URL
 * Format: https://vento.so/view/{uuid}
 */
function extractVentoId(url: string): string | null {
  const match = url.match(/vento\.so\/view\/([a-f0-9-]+)/i);
  return match?.[1] ?? null;
}

/**
 * Extract share ID from Apollo URL
 * Format: https://app.apollo.io/#/conversation-shares/{id1}-{id2}
 */
function extractApolloId(url: string): string | null {
  const match = url.match(/conversation-shares\/([a-f0-9-]+)/i);
  return match?.[1] ?? null;
}

/**
 * Fetch media info from Vento API
 */
async function fetchVentoMedia(recordingId: string): Promise<MediaInfo | null> {
  try {
    const response = await fetch(
      `https://vento.so/api/recording/${recordingId}`,
    );
    if (!response.ok) {
      consola.error(`Vento API returned ${response.status} for ${recordingId}`);
      return null;
    }

    const data = await response.json();

    // Vento returns video URL in format like:
    // https://storage.googleapis.com/vento-assets/{userId}/{recordingId}/v0/video-1080p_0.m3u8
    const videoUrl = data.videoUrl || data.video_url || data.url;
    const audioUrl = data.audioUrl || data.audio_url;
    const thumbnailUrl = data.thumbnailUrl || data.thumbnail_url;

    return {
      provider: "vento",
      title:
        data.title || data.name || `Vento Recording ${recordingId.slice(0, 8)}`,
      duration: data.duration || data.durationSeconds,
      videoUrl,
      audioUrl,
      thumbnailUrl,
      isHls: videoUrl?.includes(".m3u8") ?? false,
    };
  } catch (error) {
    consola.error("Failed to fetch Vento media info:", error);
    return null;
  }
}

/**
 * Fetch media info from Apollo API
 * Note: Apollo may require authentication for some endpoints
 */
async function fetchApolloMedia(shareId: string): Promise<MediaInfo | null> {
  try {
    // Try the public share API
    const response = await fetch(
      `https://app.apollo.io/api/v1/conversation_shares/${shareId}`,
    );
    if (!response.ok) {
      consola.warn(`Apollo API returned ${response.status} for ${shareId}`);
      // Apollo often requires authentication or redirects
      return null;
    }

    const data = await response.json();

    // Check if we need to follow a redirect
    if (data.message === "Redirect required" && data.type === "external") {
      consola.info(
        "Apollo requires external redirect - may need manual handling",
      );
      return null;
    }

    return {
      provider: "apollo",
      title:
        data.title || data.name || `Apollo Recording ${shareId.slice(0, 8)}`,
      duration: data.duration,
      videoUrl: data.video_url || data.videoUrl,
      audioUrl: data.audio_url || data.audioUrl,
      isHls: data.video_url?.includes(".m3u8") ?? false,
    };
  } catch (error) {
    consola.error("Failed to fetch Apollo media info:", error);
    return null;
  }
}

// =============================================================================
// Media Download
// =============================================================================

/**
 * Download HLS stream using ffmpeg and convert to MP4
 */
async function downloadHlsStream(
  hlsUrl: string,
  outputPath: string,
): Promise<DownloadResult> {
  return new Promise((resolve) => {
    consola.info(`Downloading HLS stream: ${hlsUrl}`);

    const ffmpeg = spawn("ffmpeg", [
      "-i",
      hlsUrl,
      "-c",
      "copy", // Copy without re-encoding (fastest)
      "-bsf:a",
      "aac_adtstoasc", // Fix AAC audio for MP4 container
      "-y", // Overwrite output
      outputPath,
    ]);

    let stderr = "";
    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        consola.success(`Downloaded HLS to ${outputPath}`);
        resolve({
          success: true,
          filePath: outputPath,
          contentType: "video/mp4",
        });
      } else {
        consola.error(`ffmpeg exited with code ${code}:`, stderr.slice(-500));
        resolve({
          success: false,
          error: `ffmpeg failed with code ${code}`,
        });
      }
    });

    ffmpeg.on("error", (err) => {
      consola.error("ffmpeg spawn error:", err);
      resolve({
        success: false,
        error: err.message,
      });
    });
  });
}

/**
 * Download direct media file
 */
async function downloadDirectMedia(
  url: string,
  outputPath: string,
): Promise<DownloadResult> {
  try {
    consola.info(`Downloading direct media: ${url}`);

    const response = await fetch(url, {
      headers: { "User-Agent": "Insights-Media-Fetcher/1.0" },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const contentType =
      response.headers.get("content-type") || "application/octet-stream";
    const buffer = await response.arrayBuffer();

    await fs.writeFile(outputPath, Buffer.from(buffer));

    consola.success(
      `Downloaded to ${outputPath} (${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB)`,
    );

    return {
      success: true,
      filePath: outputPath,
      contentType,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Download failed",
    };
  }
}

// =============================================================================
// Main Task
// =============================================================================

export const importFromUrlTask = schemaTask({
  id: "interview.import-from-url",
  schema: ImportFromUrlPayloadSchema,
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 60000,
  },
  run: async (payload) => {
    const { urls, projectId, accountId, userId } = payload;
    const client = createSupabaseAdminClient();

    const results: Array<{
      url: string;
      success: boolean;
      interviewId?: string;
      triggerRunId?: string;
      error?: string;
    }> = [];

    for (const item of urls) {
      const {
        url,
        title: userTitle,
        speakerNames,
        personId,
        participantName,
        participantOrganization,
        participantSegment,
      } = item;

      try {
        consola.info(`\n📥 Processing URL: ${url}`);

        // 1. Resolve URL to media URL
        // Supports: direct media URLs, HLS/DASH streams, and webpages with embedded media
        let mediaUrl: string;
        let mediaType: MediaUrlType;
        let mediaTitle = userTitle || `Import from URL`;
        const provider = detectProvider(url);

        // Check if it's a known provider (vento, apollo) with API endpoints
        if (provider === "vento") {
          const ventoId = extractVentoId(url);
          if (!ventoId) {
            results.push({
              url,
              success: false,
              error: "Could not extract Vento recording ID",
            });
            continue;
          }
          const mediaInfo = await fetchVentoMedia(ventoId);
          if (!mediaInfo || !mediaInfo.videoUrl) {
            results.push({
              url,
              success: false,
              error: "Could not fetch Vento media info",
            });
            continue;
          }
          mediaUrl = mediaInfo.videoUrl;
          mediaType = mediaInfo.isHls ? "hls" : "progressive";
          mediaTitle = userTitle || mediaInfo.title || `Vento Recording`;
        } else if (provider === "apollo") {
          const apolloId = extractApolloId(url);
          if (!apolloId) {
            results.push({
              url,
              success: false,
              error: "Could not extract Apollo share ID",
            });
            continue;
          }
          const mediaInfo = await fetchApolloMedia(apolloId);
          if (!mediaInfo || (!mediaInfo.videoUrl && !mediaInfo.audioUrl)) {
            results.push({
              url,
              success: false,
              error:
                "Apollo recordings require authentication. Please download manually and upload.",
            });
            continue;
          }
          mediaUrl = mediaInfo.videoUrl || mediaInfo.audioUrl!;
          mediaType = mediaInfo.isHls ? "hls" : "progressive";
          mediaTitle = userTitle || mediaInfo.title || `Apollo Recording`;
        } else if (isDirectMediaUrl(url)) {
          // Direct media file URL (mp4, mp3, etc.)
          consola.info(`[importFromUrl] Direct media URL detected: ${url}`);
          mediaUrl = url;
          mediaType = detectMediaUrlType(url);
        } else if (isStreamingUrl(url)) {
          // HLS or DASH streaming URL
          consola.info(`[importFromUrl] Streaming URL detected: ${url}`);
          mediaUrl = url;
          mediaType = detectMediaUrlType(url);
        } else {
          // Unknown provider - try to extract media URL from webpage
          consola.info(`[importFromUrl] Scanning webpage for media: ${url}`);
          const extracted = await extractBestMediaUrl(url);
          if (!extracted) {
            results.push({
              url,
              success: false,
              error:
                "Could not find video/audio content on this page. Please provide a direct link to the media file.",
            });
            continue;
          }
          mediaUrl = extracted;
          mediaType = detectMediaUrlType(extracted);
          consola.info(
            `[importFromUrl] Extracted media URL: ${mediaUrl} (type: ${mediaType})`,
          );
        }

        // 2. Download media to temp file
        const tempDir = tmpdir();
        const timestamp = Date.now();
        const isAudio = mediaUrl.match(/\.(mp3|m4a|wav|ogg|flac|aac)($|\?)/i);
        const tempFile = join(
          tempDir,
          `import-${timestamp}${isAudio ? ".mp3" : ".mp4"}`,
        );

        let downloadResult: DownloadResult;

        if (mediaType === "hls" || mediaType === "dash") {
          downloadResult = await downloadHlsStream(mediaUrl, tempFile);
        } else {
          downloadResult = await downloadDirectMedia(mediaUrl, tempFile);
        }

        if (!downloadResult.success || !downloadResult.filePath) {
          results.push({
            url,
            success: false,
            error: downloadResult.error || "Download failed",
          });
          continue;
        }

        // 3. Upload to R2
        const fileStats = statSync(downloadResult.filePath);
        const fileBuffer = await fs.readFile(downloadResult.filePath);
        const r2Ext = isAudio ? "mp3" : "mp4";
        const r2Key = `interviews/${projectId}/import-${timestamp}.${r2Ext}`;

        consola.info(
          `Uploading to R2: ${r2Key} (${(fileStats.size / 1024 / 1024).toFixed(2)} MB)`,
        );

        const uploadResult = await uploadToR2({
          key: r2Key,
          body: new Uint8Array(fileBuffer),
          contentType: downloadResult.contentType || "video/mp4",
        });

        // Clean up temp file
        await fs.unlink(downloadResult.filePath).catch(() => {});

        if (!uploadResult.success) {
          results.push({
            url,
            success: false,
            error: "Failed to upload to R2",
          });
          continue;
        }

        // 4. Create interview record
        const defaultTitle =
          mediaTitle ||
          `Imported interview - ${format(new Date(), "yyyy-MM-dd")}`;

        consola.info(`Creating interview record: ${defaultTitle}`);

        // Derive source type and filename from media type
        const sourceType = isAudio ? "audio_url" : "video_url";
        const fileExt = isAudio ? "mp3" : "mp4";

        const { data: interview, error: insertError } = await client
          .from("interviews")
          .insert({
            account_id: accountId,
            project_id: projectId,
            title: defaultTitle,
            participant_pseudonym: speakerNames?.[0] || "Unknown participant",
            status: "uploading",
            source_type: sourceType,
            media_url: r2Key,
            original_filename: `url-import-${timestamp}.${fileExt}`,
            created_by: userId, // Track which user created this interview
          })
          .select()
          .single();

        if (insertError || !interview) {
          results.push({
            url,
            success: false,
            error: `Failed to create interview: ${insertError?.message}`,
          });
          continue;
        }

        if (userId) {
          await ensureInterviewInterviewerLink({
            supabase: client,
            accountId,
            projectId,
            interviewId: interview.id,
            userId,
          });
        }

        // 4b. Create/link participant to interview
        // Priority: personId (existing) > participantName (create new)
        let linkedPersonId = personId;

        // If no existing personId but participantName provided, create new person
        if (!linkedPersonId && participantName?.trim()) {
          consola.info(`Creating person: ${participantName}`);

          // First, handle organization if provided
          let organizationId: string | null = null;
          if (participantOrganization?.trim()) {
            // Try to find existing organization by name (case-insensitive)
            const { data: existingOrg } = await client
              .from("organizations")
              .select("id")
              .eq("account_id", accountId)
              .ilike("name", participantOrganization.trim())
              .maybeSingle();

            if (existingOrg) {
              organizationId = existingOrg.id;
              consola.info(
                `Found existing organization: ${participantOrganization} (${organizationId})`,
              );
            } else {
              // Create new organization
              const { data: newOrg, error: orgError } = await client
                .from("organizations")
                .insert({
                  account_id: accountId,
                  name: participantOrganization.trim(),
                })
                .select("id")
                .single();

              if (orgError || !newOrg) {
                consola.warn(
                  `Failed to create organization: ${orgError?.message}`,
                );
              } else {
                organizationId = newOrg.id;
                consola.info(
                  `Created organization: ${participantOrganization} (${organizationId})`,
                );
              }
            }
          }

          // Create person
          const { data: newPerson, error: personError } = await client
            .from("people")
            .insert({
              account_id: accountId,
              project_id: projectId,
              name: participantName.trim(),
              segment: participantSegment?.trim() || null,
              created_by: userId,
            })
            .select("id")
            .single();

          if (personError || !newPerson) {
            consola.warn(`Failed to create person: ${personError?.message}`);
          } else {
            linkedPersonId = newPerson.id;
            consola.info(
              `Created person: ${participantName} (${linkedPersonId})`,
            );

            // Link person to organization if we have both
            if (organizationId) {
              const { error: linkOrgError } = await client
                .from("people_organizations")
                .insert({
                  person_id: linkedPersonId,
                  organization_id: organizationId,
                  is_primary: true,
                });
              if (linkOrgError) {
                consola.warn(
                  `Failed to link person to organization: ${linkOrgError.message}`,
                );
              } else {
                consola.info(
                  `Linked person ${linkedPersonId} to organization ${organizationId}`,
                );
              }
            }
          }
        }

        // Link person to interview with transcript_key for speaker resolution
        if (linkedPersonId) {
          consola.info(
            `Linking person ${linkedPersonId} to interview ${interview.id}`,
          );
          const { error: linkError } = await client
            .from("interview_people")
            .insert({
              interview_id: interview.id,
              person_id: linkedPersonId,
              project_id: projectId,
              role: "participant",
              transcript_key: "B", // Second speaker in conversation (participant)
              display_name:
                participantName?.trim() || speakerNames?.[0] || null,
            });
          if (linkError) {
            consola.warn(
              `Failed to link person to interview: ${linkError.message}`,
            );
          }
        }

        // 5. Trigger thumbnail generation for video files (non-blocking)
        // Only for video files, not audio
        if (!isAudio) {
          consola.info(
            `Triggering thumbnail generation for interview ${interview.id}`,
          );
          try {
            await tasks.trigger<typeof generateThumbnail>(
              "generate-thumbnail",
              {
                mediaKey: r2Key,
                interviewId: interview.id,
                accountId,
                timestampSec: 1, // Capture frame at 1 second
              },
            );
          } catch (thumbnailError) {
            // Don't fail the import if thumbnail generation fails to trigger
            consola.warn(
              `Failed to trigger thumbnail generation for ${interview.id}:`,
              thumbnailError,
            );
          }
        }

        // 6. Trigger the interview processing workflow using createAndProcessAnalysisJob
        // This uses the same code path as the upload screen and chat agent
        consola.info(`Triggering interview workflow for: ${defaultTitle}`);

        const runInfo = await createAndProcessAnalysisJob({
          interviewId: interview.id,
          transcriptData: { needs_transcription: true },
          customInstructions: "",
          adminClient: client,
          mediaUrl: r2Key,
          initiatingUserId: userId,
        });

        consola.success(`✅ Import complete: ${defaultTitle}`);
        results.push({
          url,
          success: true,
          interviewId: interview.id,
          triggerRunId: runInfo.runId,
        });
      } catch (error) {
        consola.error(`Error processing ${url}:`, error);
        results.push({
          url,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Summary
    const successCount = results.filter((r) => r.success).length;
    consola.info(
      `\n📊 Import Summary: ${successCount}/${urls.length} successful`,
    );

    return {
      totalUrls: urls.length,
      successCount,
      failedCount: urls.length - successCount,
      results,
    };
  },
});

// =============================================================================
// Utility: Test URL extraction without processing
// =============================================================================

export const testUrlExtractionTask = task({
  id: "interview.test-url-extraction",
  run: async (payload: { urls: string[] }) => {
    const results: Array<{
      url: string;
      provider: Provider;
      mediaInfo: MediaInfo | null;
    }> = [];

    for (const url of payload.urls) {
      const provider = detectProvider(url);
      let mediaInfo: MediaInfo | null = null;

      if (provider === "vento") {
        const ventoId = extractVentoId(url);
        if (ventoId) {
          mediaInfo = await fetchVentoMedia(ventoId);
        }
      } else if (provider === "apollo") {
        const apolloId = extractApolloId(url);
        if (apolloId) {
          mediaInfo = await fetchApolloMedia(apolloId);
        }
      }

      results.push({ url, provider, mediaInfo });
    }

    return { results };
  },
});
