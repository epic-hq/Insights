/**
 * Media URL Extraction Utility
 *
 * Extracts direct media URLs from webpages. Used by both:
 * - The Mastra importVideoFromUrl tool
 * - The upload-from-url API route
 *
 * Supports extracting HLS (.m3u8), DASH (.mpd), and progressive media files.
 */

import consola from "consola";

const MEDIA_EXTENSIONS = [
  "mp4",
  "mp3",
  "m4a",
  "wav",
  "webm",
  "ogg",
  "mov",
  "avi",
  "mkv",
  "flac",
  "aac",
];
const STREAMING_EXTENSIONS = ["m3u8", "mpd"];

export interface MediaAsset {
  url: string;
  type: "video" | "audio" | "stream";
  format: string; // e.g., "mp4", "m3u8", "mp3"
  source: string; // where it was found: "og:video", "video-tag", "regex", "llm"
}

export interface ExtractionResult {
  assets: MediaAsset[];
  recommended: MediaAsset | null;
}

function deriveFileExtension(url: string): string | null {
  const match = url.match(/\.([a-zA-Z0-9]{2,5})(?:$|[?#])/);
  return match ? match[1].toLowerCase() : null;
}

export function isDirectMediaUrl(url: string): boolean {
  const extension = deriveFileExtension(url);
  return extension ? MEDIA_EXTENSIONS.includes(extension) : false;
}

export function isStreamingUrl(url: string): boolean {
  const extension = deriveFileExtension(url);
  return extension ? STREAMING_EXTENSIONS.includes(extension) : false;
}

export type MediaUrlType = "progressive" | "hls" | "dash" | "unknown";

export function detectMediaUrlType(url: string): MediaUrlType {
  const extension = deriveFileExtension(url);
  if (!extension) return "unknown";
  if (extension === "m3u8") return "hls";
  if (extension === "mpd") return "dash";
  if (MEDIA_EXTENSIONS.includes(extension)) return "progressive";
  return "unknown";
}

/**
 * Use LLM to extract video URL from complex HTML when regex fails
 */
async function extractVideoUrlWithLLM(
  html: string,
  pageUrl: string,
): Promise<string | null> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    consola.warn(
      "[extractMediaUrl] OPENAI_API_KEY not set, skipping LLM extraction",
    );
    return null;
  }

  // Truncate HTML to avoid token limits
  const truncatedHtml = html.slice(0, 50000);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a video/audio URL extractor. Given HTML content from a webpage, find and return the best URL to the media content.

PRIORITY ORDER (return the first one you find):
1. HLS manifest URLs (.m3u8) - these are streaming video playlists, often the highest quality
2. DASH manifest URLs (.mpd) - another streaming format
3. Direct video files (.mp4, .webm, .mov)
4. Direct audio files (.mp3, .m4a, .wav, .aac, .ogg)

LOOK IN:
- Script tags containing JSON data (look for "videoUrl", "video_url", "hlsUrl", "streamUrl", "mediaUrl", "src")
- Data attributes on video/audio elements
- JavaScript variables and config objects
- Meta tags (og:video, twitter:player:stream)
- Video/audio source tags
- API response data embedded in the page
- URLs containing patterns like "storage.googleapis.com", "cloudfront.net", "cdn"

For sites like Vento.so, look for URLs containing "vento-assets" or patterns like "/v0/video-1080p" or "/master.m3u8".
For Apollo.io, look for conversation recording URLs.

Return ONLY the URL, nothing else. If no media URL is found, return "NOT_FOUND".`,
          },
          {
            role: "user",
            content: `Find the video/audio file URL in this HTML from ${pageUrl}:\n\n${truncatedHtml}`,
          },
        ],
        max_tokens: 500,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      consola.error("[extractMediaUrl] LLM API error:", response.status);
      return null;
    }

    const data = await response.json();
    const extractedUrl = data.choices?.[0]?.message?.content?.trim();

    if (
      extractedUrl &&
      extractedUrl !== "NOT_FOUND" &&
      extractedUrl.startsWith("http")
    ) {
      consola.info(
        `[extractMediaUrl] LLM extracted media URL: ${extractedUrl}`,
      );
      return extractedUrl;
    }

    return null;
  } catch (error) {
    consola.error("[extractMediaUrl] LLM extraction error:", error);
    return null;
  }
}

/**
 * Fetch a webpage and extract all media URLs found in it
 */
export async function extractAllMediaUrls(
  pageUrl: string,
): Promise<ExtractionResult> {
  const assets: MediaAsset[] = [];
  const seenUrls = new Set<string>();

  const addAsset = (url: string, source: string) => {
    if (seenUrls.has(url)) return;
    seenUrls.add(url);

    const ext = deriveFileExtension(url) || "unknown";
    let type: "video" | "audio" | "stream" = "video";
    if (["mp3", "m4a", "wav", "ogg", "flac", "aac"].includes(ext)) {
      type = "audio";
    } else if (["m3u8", "mpd"].includes(ext)) {
      type = "stream";
    }
    assets.push({ url, type, format: ext, source });
  };

  try {
    // Determine referer based on the URL (needed for Vimeo, etc.)
    let referer = "";
    if (pageUrl.includes("vimeo.com")) {
      referer = "https://vimeo.com/";
    } else if (
      pageUrl.includes("zight.com") ||
      pageUrl.includes("share.zight.com")
    ) {
      referer = "https://zight.com/";
    }

    const response = await fetch(pageUrl, {
      headers: {
        // Use a real browser User-Agent - bot UAs get limited content from video sites
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...(referer && { Referer: referer }),
      },
    });

    if (!response.ok) {
      consola.warn(
        `[extractMediaUrl] Failed to fetch page: ${response.status}`,
      );
      return { assets: [], recommended: null };
    }

    const html = await response.text();

    // Try to find video URLs in common patterns
    const patterns: Array<{ pattern: RegExp; source: string }> = [
      // Open Graph video meta tags
      {
        pattern:
          /<meta[^>]+property=["']og:video(?::url)?["'][^>]+content=["']([^"']+)["']/gi,
        source: "og:video",
      },
      {
        pattern:
          /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video(?::url)?["']/gi,
        source: "og:video",
      },
      // Twitter video meta tags
      {
        pattern:
          /<meta[^>]+name=["']twitter:player:stream["'][^>]+content=["']([^"']+)["']/gi,
        source: "twitter:player",
      },
      {
        pattern:
          /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:player:stream["']/gi,
        source: "twitter:player",
      },
      // HTML5 video source tags
      {
        pattern:
          /<source[^>]+src=["']([^"']+)["'][^>]*type=["']video\/[^"']+["']/gi,
        source: "video-source",
      },
      { pattern: /<video[^>]+src=["']([^"']+)["']/gi, source: "video-tag" },
      // Audio tags
      { pattern: /<audio[^>]+src=["']([^"']+)["']/gi, source: "audio-tag" },
      {
        pattern:
          /<source[^>]+src=["']([^"']+)["'][^>]*type=["']audio\/[^"']+["']/gi,
        source: "audio-source",
      },
      // Direct links to media files in href
      {
        pattern:
          /<a[^>]+href=["']([^"']+\.(?:mp4|mp3|m4a|wav|webm|ogg|mov))["']/gi,
        source: "link-href",
      },
    ];

    for (const { pattern, source } of patterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        const url = match[1];
        if (url && (url.startsWith("http") || url.startsWith("//"))) {
          const absoluteUrl = url.startsWith("//") ? `https:${url}` : url;
          addAsset(absoluteUrl, source);
        }
      }
    }

    // Try JSON-LD structured data
    const jsonLdMatch = html.match(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i,
    );
    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1]);
        const contentUrl =
          jsonLd.contentUrl || jsonLd.embedUrl || jsonLd.video?.contentUrl;
        if (contentUrl && typeof contentUrl === "string") {
          addAsset(contentUrl, "json-ld");
        }
      } catch {
        // JSON parse failed, continue
      }
    }

    // Search for HLS/DASH manifests (higher quality streaming)
    const streamingUrlPattern =
      /https?:\/\/[^\s"'<>\\]+\.(?:m3u8|mpd)(?:[^\s"'<>\\]*)?/gi;
    const streamingUrls = html.match(streamingUrlPattern);
    if (streamingUrls) {
      for (const url of streamingUrls) {
        const cleanUrl = url.replace(/\\+$/, "");
        addAsset(cleanUrl, "regex-stream");
      }
    }

    // Search for progressive media files
    const mediaUrlPattern =
      /https?:\/\/[^\s"'<>\\]+\.(?:mp4|mp3|m4a|wav|webm|ogg|mov|avi|mkv|flac|aac)(?:[^\s"'<>\\]*)?/gi;
    const allMediaUrls = html.match(mediaUrlPattern);
    if (allMediaUrls) {
      for (const url of allMediaUrls) {
        const cleanUrl = url.replace(/\\+$/, "");
        addAsset(cleanUrl, "regex-media");
      }
    }

    // If no assets found, try LLM extraction
    if (assets.length === 0) {
      consola.info(
        "[extractMediaUrl] Regex patterns failed, trying LLM extraction...",
      );
      const llmUrl = await extractVideoUrlWithLLM(html, pageUrl);
      if (llmUrl) {
        addAsset(llmUrl, "llm");
      }
    }

    // Determine recommended asset (prefer streams > video > audio)
    let recommended: MediaAsset | null = null;
    const streams = assets.filter((a) => a.type === "stream");
    const videos = assets.filter((a) => a.type === "video");
    const audios = assets.filter((a) => a.type === "audio");

    if (streams.length > 0) {
      recommended = streams[0];
    } else if (videos.length > 0) {
      recommended = videos[0];
    } else if (audios.length > 0) {
      recommended = audios[0];
    }

    consola.info(`[extractMediaUrl] Found ${assets.length} media assets`, {
      streams: streams.length,
      videos: videos.length,
      audios: audios.length,
      recommended: recommended?.url,
    });

    return { assets, recommended };
  } catch (error) {
    consola.error("[extractMediaUrl] Error fetching page", error);
    return { assets: [], recommended: null };
  }
}

/**
 * Extract the best media URL from a webpage (convenience function)
 * Returns the recommended URL or null if none found
 */
export async function extractBestMediaUrl(
  pageUrl: string,
): Promise<string | null> {
  const result = await extractAllMediaUrls(pageUrl);
  return result.recommended?.url ?? null;
}

/**
 * Resolve a URL to a direct media URL
 * - If it's already a direct media URL, returns it as-is
 * - If it's a webpage, extracts the best media URL from it
 */
export async function resolveToMediaUrl(
  url: string,
): Promise<{
  mediaUrl: string | null;
  isStreaming: boolean;
  mediaType: MediaUrlType;
}> {
  // Check if it's already a direct media URL
  if (isDirectMediaUrl(url)) {
    return {
      mediaUrl: url,
      isStreaming: false,
      mediaType: detectMediaUrlType(url),
    };
  }

  // Check if it's a streaming URL
  if (isStreamingUrl(url)) {
    return {
      mediaUrl: url,
      isStreaming: true,
      mediaType: detectMediaUrlType(url),
    };
  }

  // It's a webpage - extract media URL
  consola.info(
    `[extractMediaUrl] URL is not direct media, scanning page: ${url}`,
  );
  const extracted = await extractBestMediaUrl(url);

  if (!extracted) {
    return {
      mediaUrl: null,
      isStreaming: false,
      mediaType: "unknown",
    };
  }

  return {
    mediaUrl: extracted,
    isStreaming: isStreamingUrl(extracted),
    mediaType: detectMediaUrlType(extracted),
  };
}
