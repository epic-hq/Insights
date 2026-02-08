/**
 * storeImage - Upload images to Cloudflare R2
 *
 * Handles image uploads for avatars, thumbnails, and other image assets.
 * Returns an R2 key that can be used with signed URLs for access.
 */

import consola from "consola";
import { createR2PresignedUrl, uploadToR2 } from "~/utils/r2.server";

interface StoreImageResult {
	imageKey: string | null; // R2 key for storage (store this in DB)
	presignedUrl?: string; // Temporary presigned URL for immediate use
	error?: string;
}

interface StoreImageParams {
	/** Category/folder for the image (e.g., "avatars", "thumbnails", "uploads") */
	category: string;
	/** Entity ID to associate with the image (e.g., personId, projectId) */
	entityId: string;
	/** The image file or blob to upload */
	source: File | Blob;
	/** Original filename (optional, used for extension detection) */
	originalFilename?: string;
	/** Override content type (optional) */
	contentType?: string;
	/** Custom filename suffix (optional, defaults to timestamp) */
	suffix?: string;
}

// Allowed image MIME types
const ALLOWED_IMAGE_TYPES = new Set([
	"image/jpeg",
	"image/jpg",
	"image/png",
	"image/gif",
	"image/webp",
	"image/svg+xml",
	"image/avif",
	"image/heic",
	"image/heif",
]);

// Max file size: 10MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/**
 * Store an image file in Cloudflare R2
 *
 * @example
 * // Store an avatar
 * const result = await storeImage({
 *   category: "avatars",
 *   entityId: personId,
 *   source: avatarFile,
 * })
 *
 * // Store a project thumbnail
 * const result = await storeImage({
 *   category: "thumbnails",
 *   entityId: projectId,
 *   source: thumbnailBlob,
 *   suffix: "cover",
 * })
 */
export async function storeImage({
	category,
	entityId,
	source,
	originalFilename,
	contentType,
	suffix,
}: StoreImageParams): Promise<StoreImageResult> {
	try {
		// Validate file size
		if (source.size > MAX_IMAGE_SIZE) {
			return {
				imageKey: null,
				error: `Image too large. Maximum size is ${MAX_IMAGE_SIZE / 1024 / 1024}MB`,
			};
		}

		if (source.size === 0) {
			return { imageKey: null, error: "Image file is empty" };
		}

		// Detect content type
		const detectedType = contentType || source.type || detectContentTypeFromFilename(originalFilename);
		if (!detectedType || !ALLOWED_IMAGE_TYPES.has(detectedType)) {
			return {
				imageKey: null,
				error: `Invalid image type: ${detectedType || "unknown"}. Allowed types: JPEG, PNG, GIF, WebP, SVG, AVIF, HEIC`,
			};
		}

		// Generate file key
		const timestamp = Date.now();
		const extension = getExtensionFromContentType(detectedType) || getExtensionFromFilename(originalFilename) || "jpg";
		const fileSuffix = suffix || timestamp.toString();
		const imageKey = `images/${category}/${entityId}/${fileSuffix}.${extension}`;

		// Convert to Uint8Array
		const arrayBuffer = await source.arrayBuffer();
		const payload = new Uint8Array(arrayBuffer);

		consola.log("Uploading image to Cloudflare R2:", imageKey, {
			size: source.size,
			contentType: detectedType,
		});

		// Upload to R2
		const uploadResult = await uploadToR2({
			key: imageKey,
			body: payload,
			contentType: detectedType,
		});

		if (!uploadResult.success) {
			consola.error("Image upload to R2 failed:", uploadResult.error);
			return { imageKey: null, error: uploadResult.error ?? "Failed to upload image" };
		}

		// Generate a presigned URL for immediate use (1 hour)
		const presignedResult = createR2PresignedUrl({
			key: imageKey,
			expiresInSeconds: 60 * 60, // 1 hour
			responseContentType: detectedType,
		});

		consola.log("Image stored successfully in R2:", imageKey);

		return {
			imageKey,
			presignedUrl: presignedResult?.url,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		consola.error("Error storing image in R2:", error);
		return { imageKey: null, error: message };
	}
}

/**
 * Get a presigned URL for an existing image
 *
 * @param imageKey - The R2 key for the image
 * @param expiresInSeconds - URL expiry time (default: 1 hour)
 */
export function getImageUrl(imageKey: string, expiresInSeconds = 3600): string | null {
	const result = createR2PresignedUrl({
		key: imageKey,
		expiresInSeconds,
	});
	return result?.url ?? null;
}

/**
 * Get multiple presigned URLs for images
 */
export function getImageUrls(imageKeys: string[], expiresInSeconds = 3600): Record<string, string> {
	const urls: Record<string, string> = {};
	for (const key of imageKeys) {
		const url = getImageUrl(key, expiresInSeconds);
		if (url) {
			urls[key] = url;
		}
	}
	return urls;
}

// Helper functions

function detectContentTypeFromFilename(filename?: string): string | undefined {
	if (!filename) return undefined;
	const ext = filename.split(".").pop()?.toLowerCase();
	return ext ? EXTENSION_TO_CONTENT_TYPE[ext] : undefined;
}

function getExtensionFromContentType(contentType: string): string | undefined {
	return CONTENT_TYPE_TO_EXTENSION[contentType];
}

function getExtensionFromFilename(filename?: string): string | undefined {
	if (!filename) return undefined;
	const ext = filename.split(".").pop()?.toLowerCase();
	return ext && EXTENSION_TO_CONTENT_TYPE[ext] ? ext : undefined;
}

const EXTENSION_TO_CONTENT_TYPE: Record<string, string> = {
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	gif: "image/gif",
	webp: "image/webp",
	svg: "image/svg+xml",
	avif: "image/avif",
	heic: "image/heic",
	heif: "image/heif",
};

const CONTENT_TYPE_TO_EXTENSION: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/jpg": "jpg",
	"image/png": "png",
	"image/gif": "gif",
	"image/webp": "webp",
	"image/svg+xml": "svg",
	"image/avif": "avif",
	"image/heic": "heic",
	"image/heif": "heif",
};
