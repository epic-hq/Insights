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
import { execa } from "execa";
import { promises as fs, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { ensureInterviewInterviewerLink } from "~/features/people/services/internalPeople.server";
import type { processInterviewOrchestratorV2 } from "~/trigger/interview/v2/orchestrator";
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
 * Supports two formats:
 * - Old: https://app.apollo.io/#/conversation-shares/{id1}-{id2}
 * - New: https://app.apollo.io/#/public/conversations/{conversationId}?shareId={shareId}
 */
function extractApolloId(url: string): string | null {
  // Try old format first: conversation-shares/{id1}-{id2}
  const oldMatch = url.match(/conversation-shares\/([a-f0-9-]+)/i);
  if (oldMatch?.[1]) return oldMatch[1];

  // Try new format: /public/conversations/{conversationId}?shareId={shareId}
  const conversationMatch = url.match(
    /\/public\/conversations\/([a-f0-9]+)\?.*shareId=([a-f0-9]+)/i,
  );
  if (conversationMatch?.[1] && conversationMatch?.[2]) {
    // Combine into the same format as old URLs
    return `${conversationMatch[1]}-${conversationMatch[2]}`;
  }

  return null;
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
    // Try the public share API - don't auto-follow redirects so we can see where it goes
    const response = await fetch(
      `https://app.apollo.io/api/v1/conversation_shares/${shareId}`,
      { redirect: "manual" },
    );

    // Handle redirects - Apollo often redirects to the actual media
    if (response.status === 303 || response.status === 302) {
      const location = response.headers.get("location");
      consola.info(`Apollo redirecting to: ${location}`);

      if (location) {
        // If it's redirecting to a media URL, return that
        if (
          location.includes(".mp4") ||
          location.includes(".mp3") ||
          location.includes(".m3u8") ||
          location.includes(".webm")
        ) {
          return {
            provider: "apollo",
            title: `Apollo Recording ${shareId.slice(0, 8)}`,
            videoUrl: location,
            isHls: location.includes(".m3u8"),
          };
        }

        // If it's redirecting to another API endpoint, follow it
        if (location.startsWith("http")) {
          const redirectResponse = await fetch(location);
          if (redirectResponse.ok) {
            const data = await redirectResponse.json();
            return {
              provider: "apollo",
              title:
                data.title ||
                data.name ||
                `Apollo Recording ${shareId.slice(0, 8)}`,
              duration: data.duration,
              videoUrl: data.video_url || data.videoUrl || data.recording_url,
              audioUrl: data.audio_url || data.audioUrl,
              isHls: data.video_url?.includes(".m3u8") ?? false,
            };
          }
        }
      }

      consola.warn(
        `Apollo redirect not handled. Status: ${response.status}, Location: ${location}`,
      );
      return null;
    }

    if (!response.ok) {
      consola.warn(`Apollo API returned ${response.status} for ${shareId}`);
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
 * Download HLS stream using system ffmpeg and convert to MP4
 * Uses system ffmpeg installed via Trigger.dev ffmpeg() extension
 * (ffmpeg-static crashes with SIGSEGV on HLS streams in cloud environment)
 */
async function downloadHlsStream(
  hlsUrl: string,
  outputPath: string,
): Promise<DownloadResult> {
  consola.info(`Downloading HLS stream: ${hlsUrl}`);

  try {
    const args = [
      // Pretend to be a browser to avoid CDN throttling
      "-user_agent",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      // Network reliability options for HLS
      "-reconnect",
      "1",
      "-reconnect_streamed",
      "1",
      "-reconnect_delay_max",
      "5",
      // Handle non-standard HLS formats
      "-protocol_whitelist",
      "file,http,https,tcp,tls,crypto",
      "-allowed_extensions",
      "ALL",
      "-i",
      hlsUrl,
      "-c",
      "copy", // Copy without re-encoding (fastest)
      "-bsf:a",
      "aac_adtstoasc", // Fix AAC audio for MP4 container
      "-y", // Overwrite output
      outputPath,
    ];

    consola.info(
      `Running ffmpeg with args: ${args.join(" ").substring(0, 100)}...`,
    );

    // Use system ffmpeg (installed via trigger.config.ts ffmpeg() extension)
    // Long timeout for HLS downloads - a 2-hour video at 4x speed = 30 min download
    // Add buffer for slow CDNs and network variability
    await execa("ffmpeg", args, {
      timeout: 3 * 60 * 60 * 1000, // 3 hours max - handles very long videos
      reject: true,
    });

    consola.success(`Downloaded HLS to ${outputPath}`);
    return {
      success: true,
      filePath: outputPath,
      contentType: "video/mp4",
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "ffmpeg failed";
    consola.error(`ffmpeg error: ${errorMessage}`);
    return {
      success: false,
      error: errorMessage,
    };
  }
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
  // Allow up to 3 hours for downloading very long HLS streams (80+ min videos)
  // A 2-hour video at 4x download speed = 30 min, but CDN variability adds more
  maxDuration: 10800, // 3 hours
  retry: {
    maxAttempts: 1, // Don't retry long downloads - they're expensive
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

      // Generate identifiers upfront for interview record
      const timestamp = Date.now();
      const r2Key = `interviews/${projectId}/import-${timestamp}.mp4`;
      const defaultTitle =
        userTitle || `Imported from URL - ${format(new Date(), "yyyy-MM-dd")}`;

      // 1. Create interview record FIRST before any external API calls
      // This ensures user always sees the import attempt in the UI
      consola.info(`\n📥 Processing URL: ${url}`);
      consola.info(`Creating interview record: ${defaultTitle}`);

      const { data: interview, error: insertError } = await client
        .from("interviews")
        .insert({
          account_id: accountId,
          project_id: projectId,
          title: defaultTitle,
          participant_pseudonym: speakerNames?.[0] || "Unknown participant",
          status: "uploading",
          source_type: "video_url",
          media_url: r2Key,
          original_filename: `url-import-${timestamp}.mp4`,
          created_by: userId,
        })
        .select()
        .single();

      if (insertError || !interview) {
        consola.error(`Failed to create interview: ${insertError?.message}`);
        results.push({
          url,
          success: false,
          error: `Failed to create interview: ${insertError?.message}`,
        });
        continue;
      }

      consola.info(`Interview record created: ${interview.id}`);

      // Link interviewer if userId provided
      if (userId) {
        await ensureInterviewInterviewerLink({
          supabase: client,
          accountId,
          projectId,
          interviewId: interview.id,
          userId,
        });
      }

      try {
        // 2. Resolve URL to media URL
        // Supports: direct media URLs, HLS/DASH streams, and webpages with embedded media
        let mediaUrl: string;
        let mediaType: MediaUrlType;
        let mediaTitle = userTitle || `Import from URL`;
        const provider = detectProvider(url);

        // Check if it's a known provider (vento, apollo) with API endpoints
        if (provider === "vento") {
          const ventoId = extractVentoId(url);
          if (!ventoId) {
            await client
              .from("interviews")
              .update({
                status: "error",
                error_message: "Could not extract Vento recording ID from URL",
              })
              .eq("id", interview.id);
            results.push({
              url,
              success: false,
              interviewId: interview.id,
              error: "Could not extract Vento recording ID",
            });
            continue;
          }
          const mediaInfo = await fetchVentoMedia(ventoId);
          if (!mediaInfo || !mediaInfo.videoUrl) {
            await client
              .from("interviews")
              .update({
                status: "error",
                error_message: "Could not fetch media info from Vento",
              })
              .eq("id", interview.id);
            results.push({
              url,
              success: false,
              interviewId: interview.id,
              error: "Could not fetch Vento media info",
            });
            continue;
          }
          mediaUrl = mediaInfo.videoUrl;
          mediaType = mediaInfo.isHls ? "hls" : "progressive";
          mediaTitle = userTitle || mediaInfo.title || `Vento Recording`;
          // Update title with info from Vento
          if (mediaInfo.title && !userTitle) {
            await client
              .from("interviews")
              .update({ title: mediaTitle })
              .eq("id", interview.id);
          }
        } else if (provider === "apollo") {
          const apolloId = extractApolloId(url);
          if (!apolloId) {
            await client
              .from("interviews")
              .update({
                status: "error",
                error_message: "Could not extract Apollo share ID from URL",
              })
              .eq("id", interview.id);
            results.push({
              url,
              success: false,
              interviewId: interview.id,
              error: "Could not extract Apollo share ID",
            });
            continue;
          }
          const mediaInfo = await fetchApolloMedia(apolloId);
          if (!mediaInfo || (!mediaInfo.videoUrl && !mediaInfo.audioUrl)) {
            await client
              .from("interviews")
              .update({
                status: "error",
                error_message:
                  "Apollo recordings require authentication. Please download manually and upload.",
              })
              .eq("id", interview.id);
            results.push({
              url,
              success: false,
              interviewId: interview.id,
              error:
                "Apollo recordings require authentication. Please download manually and upload.",
            });
            continue;
          }
          mediaUrl = mediaInfo.videoUrl || mediaInfo.audioUrl!;
          mediaType = mediaInfo.isHls ? "hls" : "progressive";
          mediaTitle = userTitle || mediaInfo.title || `Apollo Recording`;
          // Update title with info from Apollo
          if (mediaInfo.title && !userTitle) {
            await client
              .from("interviews")
              .update({ title: mediaTitle })
              .eq("id", interview.id);
          }
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
            await client
              .from("interviews")
              .update({
                status: "error",
                error_message:
                  "Could not find video/audio content on this page",
              })
              .eq("id", interview.id);
            results.push({
              url,
              success: false,
              interviewId: interview.id,
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

        // Update interview record with resolved media details
        const isAudio = mediaUrl.match(/\.(mp3|m4a|wav|ogg|flac|aac)($|\?)/i);
        const r2Ext = isAudio ? "mp3" : "mp4";
        const actualR2Key = `interviews/${projectId}/import-${timestamp}.${r2Ext}`;
        const sourceType = isAudio ? "audio_url" : "video_url";
        const fileExt = isAudio ? "mp3" : "mp4";

        await client
          .from("interviews")
          .update({
            source_type: sourceType,
            media_url: actualR2Key,
            original_filename: `url-import-${timestamp}.${fileExt}`,
          })
          .eq("id", interview.id);

        consola.info(`Media resolved: ${mediaUrl} (${mediaType})`);

        // 3. Download media to temp file
        const tempDir = tmpdir();
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
          // Update interview status to error
          await client
            .from("interviews")
            .update({
              status: "error",
              error_message: downloadResult.error || "Download failed",
            })
            .eq("id", interview.id);

          results.push({
            url,
            success: false,
            interviewId: interview.id,
            error: downloadResult.error || "Download failed",
          });
          continue;
        }

        // 4. Upload to R2
        const fileStats = statSync(downloadResult.filePath);
        const fileBuffer = await fs.readFile(downloadResult.filePath);

        consola.info(
          `Uploading to R2: ${actualR2Key} (${(fileStats.size / 1024 / 1024).toFixed(2)} MB)`,
        );

        const uploadResult = await uploadToR2({
          key: actualR2Key,
          body: new Uint8Array(fileBuffer),
          contentType: downloadResult.contentType || "video/mp4",
        });

        // Clean up temp file
        await fs.unlink(downloadResult.filePath).catch(() => {});

        if (!uploadResult.success) {
          // Update interview status to error
          await client
            .from("interviews")
            .update({
              status: "error",
              error_message: "Failed to upload to R2",
            })
            .eq("id", interview.id);

          results.push({
            url,
            success: false,
            interviewId: interview.id,
            error: "Failed to upload to R2",
          });
          continue;
        }

        // Update status to processing
        await client
          .from("interviews")
          .update({ status: "processing" })
          .eq("id", interview.id);

        // 5. Create/link participant to interview
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
                mediaKey: actualR2Key,
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

        // 6. Trigger the v2 interview processing workflow directly
        consola.info(`Triggering interview workflow for: ${defaultTitle}`);

        const handle = await tasks.trigger<typeof processInterviewOrchestratorV2>(
          "interview.v2.orchestrator",
          {
            analysisJobId: interview.id,
            existingInterviewId: interview.id,
            metadata: {
              accountId,
              projectId,
              userId: userId ?? undefined,
              interviewTitle: interview.title ?? undefined,
              fileName: interview.original_filename ?? undefined,
              participantName: participantName ?? undefined,
              participantOrganization: participantOrganization ?? undefined,
              segment: participantSegment ?? undefined,
            },
            transcriptData: { needs_transcription: true },
            mediaUrl: actualR2Key,
            userCustomInstructions: "",
          },
        );

        consola.success(`✅ Import complete: ${defaultTitle}`);
        results.push({
          url,
          success: true,
          interviewId: interview.id,
          triggerRunId: handle.id,
        });
      } catch (error) {
        consola.error(`Error processing ${url}:`, error);
        // Update interview status to error since it was created at start
        await client
          .from("interviews")
          .update({
            status: "error",
            error_message:
              error instanceof Error ? error.message : "Unknown error",
          })
          .eq("id", interview.id);
        results.push({
          url,
          success: false,
          interviewId: interview.id,
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
