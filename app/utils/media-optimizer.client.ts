/**
 * Client-side media optimization using FFmpeg WASM.
 *
 * Attempts multi-threaded FFmpeg first (requires SharedArrayBuffer / cross-origin isolation),
 * falls back to single-threaded if unavailable.
 *
 * Optimizes audio → 128 kbps AAC in MP4 container
 * Optimizes video → 720p, 1.5 Mbps H.264, 128 kbps AAC
 * Skips files below the size threshold (default 10 MB).
 */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

/** Minimum file size to bother optimizing (default 10 MB) */
const DEFAULT_MIN_SIZE_BYTES = 10 * 1024 * 1024;

/** Audio bitrate target */
const AUDIO_BITRATE = "128k";

/** Video bitrate target */
const VIDEO_BITRATE = "1500k";

/** Video max height (720p) */
const VIDEO_MAX_HEIGHT = 720;

export interface OptimizationProgress {
	phase: "loading" | "optimizing" | "done" | "skipped" | "error";
	/** 0–100 */
	percent: number;
	/** Human-readable message */
	message: string;
	/** Original file size in bytes */
	originalSize: number;
	/** Optimized file size in bytes (0 until done) */
	optimizedSize: number;
	/** Whether multi-threaded mode is being used */
	multiThreaded: boolean;
}

export interface OptimizationResult {
	/** The optimized file (or original if skipped) */
	file: File;
	/** Whether the file was actually optimized */
	wasOptimized: boolean;
	/** Original size in bytes */
	originalSize: number;
	/** Final size in bytes */
	finalSize: number;
	/** Whether multi-threaded mode was used */
	multiThreaded: boolean;
}

export interface OptimizeOptions {
	/** Minimum file size to optimize (default 10 MB) */
	minSizeBytes?: number;
	/** Called with progress updates */
	onProgress?: (progress: OptimizationProgress) => void;
	/** Abort signal */
	signal?: AbortSignal;
}

// ── Singleton FFmpeg instance ──────────────────────────────────────────

let ffmpegInstance: FFmpeg | null = null;
let ffmpegReady = false;
let ffmpegMultiThreaded = false;
let loadingPromise: Promise<void> | null = null;

/**
 * Check if cross-origin isolation is enabled (required for SharedArrayBuffer / multi-threaded).
 */
function isCrossOriginIsolated(): boolean {
	return typeof window !== "undefined" && window.crossOriginIsolated === true;
}

/**
 * Load the FFmpeg WASM instance. Tries multi-threaded first, falls back to single-threaded.
 */
async function ensureFFmpeg(
	onProgress?: (progress: OptimizationProgress) => void,
	originalSize = 0,
): Promise<FFmpeg> {
	if (ffmpegInstance && ffmpegReady) return ffmpegInstance;

	if (loadingPromise) {
		await loadingPromise;
		if (ffmpegInstance && ffmpegReady) return ffmpegInstance;
	}

	loadingPromise = (async () => {
		const ffmpeg = new FFmpeg();

		ffmpeg.on("log", ({ message }) => {
			// FFmpeg logs contain duration/time info we can parse for progress
			if (process.env.NODE_ENV === "development") {
				// Only log in dev to avoid console noise in production
				console.debug("[FFmpeg]", message);
			}
		});

		const reportLoading = (msg: string) => {
			onProgress?.({
				phase: "loading",
				percent: 0,
				message: msg,
				originalSize,
				optimizedSize: 0,
				multiThreaded: false,
			});
		};

		// Try multi-threaded first if cross-origin isolation is available
		if (isCrossOriginIsolated()) {
			try {
				reportLoading("Loading optimizer (multi-threaded)...");

				const baseURL = "https://unpkg.com/@ffmpeg/core-mt@0.12.9/dist/esm";
				await ffmpeg.load({
					coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
					wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
					workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, "text/javascript"),
				});

				ffmpegMultiThreaded = true;
				ffmpegInstance = ffmpeg;
				ffmpegReady = true;
				return;
			} catch (err) {
				console.warn("[MediaOptimizer] Multi-threaded load failed, falling back to single-threaded:", err);
			}
		}

		// Single-threaded fallback
		reportLoading("Loading optimizer...");

		const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.9/dist/esm";
		await ffmpeg.load({
			coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
			wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
		});

		ffmpegMultiThreaded = false;
		ffmpegInstance = ffmpeg;
		ffmpegReady = true;
	})();

	await loadingPromise;
	loadingPromise = null;

	if (!ffmpegInstance) {
		throw new Error("Failed to load FFmpeg WASM");
	}

	return ffmpegInstance;
}

// ── File type helpers ──────────────────────────────────────────────────

function isAudioFile(file: File): boolean {
	if (file.type.startsWith("audio/")) return true;
	const ext = file.name.split(".").pop()?.toLowerCase() || "";
	return ["mp3", "wav", "m4a", "ogg", "flac", "aac", "wma", "opus"].includes(ext);
}

function isVideoFile(file: File): boolean {
	if (file.type.startsWith("video/")) return true;
	const ext = file.name.split(".").pop()?.toLowerCase() || "";
	return ["mp4", "mov", "avi", "mkv", "webm", "m4v", "wmv", "flv"].includes(ext);
}

function isMediaFile(file: File): boolean {
	return isAudioFile(file) || isVideoFile(file);
}

/**
 * Determine the input filename extension for FFmpeg.
 */
function getInputExtension(file: File): string {
	const ext = file.name.split(".").pop()?.toLowerCase();
	if (ext) return ext;
	// Fallback from MIME type
	if (file.type.includes("mp4")) return "mp4";
	if (file.type.includes("webm")) return "webm";
	if (file.type.includes("mp3") || file.type.includes("mpeg")) return "mp3";
	if (file.type.includes("wav")) return "wav";
	if (file.type.includes("m4a")) return "m4a";
	return "mp4";
}

// ── Progress parsing ───────────────────────────────────────────────────

/**
 * Parse FFmpeg progress events to estimate completion percentage.
 * FFmpeg reports time in microseconds via the progress event.
 */
function setupProgressTracking(
	ffmpeg: FFmpeg,
	onProgress: (progress: OptimizationProgress) => void,
	originalSize: number,
): () => void {
	let duration = 0;

	const logHandler = ({ message }: { message: string }) => {
		// Extract duration from "Duration: HH:MM:SS.ms" log line
		const durationMatch = message.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
		if (durationMatch) {
			const [, h, m, s] = durationMatch;
			duration = Number(h) * 3600 + Number(m) * 60 + Number(s);
		}
	};

	const progressHandler = ({ progress: pct, time }: { progress: number; time: number }) => {
		// `time` is in microseconds, `progress` is 0..1 (but can be unreliable)
		let percent = 0;
		if (duration > 0 && time > 0) {
			const currentTimeSec = time / 1_000_000;
			percent = Math.min(99, Math.round((currentTimeSec / duration) * 100));
		} else if (pct > 0) {
			percent = Math.min(99, Math.round(pct * 100));
		}

		onProgress({
			phase: "optimizing",
			percent,
			message: `Optimizing... ${percent}%`,
			originalSize,
			optimizedSize: 0,
			multiThreaded: ffmpegMultiThreaded,
		});
	};

	ffmpeg.on("log", logHandler);
	ffmpeg.on("progress", progressHandler);

	return () => {
		ffmpeg.off("log", logHandler);
		ffmpeg.off("progress", progressHandler);
	};
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Check if a file should be optimized (media file above size threshold).
 */
export function shouldOptimize(file: File, minSizeBytes = DEFAULT_MIN_SIZE_BYTES): boolean {
	return isMediaFile(file) && file.size >= minSizeBytes;
}

/**
 * Optimize a media file. Returns the optimized file or the original if skipped.
 */
export async function optimizeMediaFile(
	file: File,
	options: OptimizeOptions = {},
): Promise<OptimizationResult> {
	const { minSizeBytes = DEFAULT_MIN_SIZE_BYTES, onProgress, signal } = options;

	const originalSize = file.size;

	// Skip non-media or small files
	if (!shouldOptimize(file, minSizeBytes)) {
		onProgress?.({
			phase: "skipped",
			percent: 100,
			message: "No optimization needed",
			originalSize,
			optimizedSize: originalSize,
			multiThreaded: false,
		});

		return {
			file,
			wasOptimized: false,
			originalSize,
			finalSize: originalSize,
			multiThreaded: false,
		};
	}

	// Check for abort before starting expensive work
	if (signal?.aborted) {
		throw new DOMException("Optimization aborted", "AbortError");
	}

	try {
		const ffmpeg = await ensureFFmpeg(onProgress, originalSize);

		if (signal?.aborted) {
			throw new DOMException("Optimization aborted", "AbortError");
		}

		// Set up progress tracking
		let cleanupProgress: (() => void) | undefined;
		if (onProgress) {
			cleanupProgress = setupProgressTracking(ffmpeg, onProgress, originalSize);
		}

		onProgress?.({
			phase: "optimizing",
			percent: 0,
			message: "Preparing file...",
			originalSize,
			optimizedSize: 0,
			multiThreaded: ffmpegMultiThreaded,
		});

		const inputExt = getInputExtension(file);
		const inputFile = `input.${inputExt}`;
		const outputFile = isVideoFile(file) ? "output.mp4" : "output.mp4"; // AAC in MP4 container for both

		// Write input file to FFmpeg virtual filesystem
		const fileData = await fetchFile(file);
		await ffmpeg.writeFile(inputFile, fileData);

		// Build FFmpeg arguments
		const args = buildFFmpegArgs(inputFile, outputFile, file);

		// Run FFmpeg
		await ffmpeg.exec(args);

		// Read output
		const outputData = await ffmpeg.readFile(outputFile);

		// Clean up virtual filesystem
		await ffmpeg.deleteFile(inputFile).catch(() => {});
		await ffmpeg.deleteFile(outputFile).catch(() => {});

		cleanupProgress?.();

		// Ensure output is a Uint8Array
		if (typeof outputData === "string") {
			throw new Error("FFmpeg produced string output instead of binary data");
		}

		const optimizedBlob = new Blob([outputData], { type: "video/mp4" });
		const optimizedSize = optimizedBlob.size;

		// If the "optimized" file is larger or barely smaller, use the original
		if (optimizedSize >= originalSize * 0.95) {
			onProgress?.({
				phase: "done",
				percent: 100,
				message: "Original file is already well-optimized",
				originalSize,
				optimizedSize: originalSize,
				multiThreaded: ffmpegMultiThreaded,
			});

			return {
				file,
				wasOptimized: false,
				originalSize,
				finalSize: originalSize,
				multiThreaded: ffmpegMultiThreaded,
			};
		}

		// Build optimized File object with same name but .mp4 extension
		const baseName = file.name.replace(/\.[^.]+$/, "");
		const optimizedFile = new File([optimizedBlob], `${baseName}.mp4`, {
			type: "video/mp4",
			lastModified: Date.now(),
		});

		onProgress?.({
			phase: "done",
			percent: 100,
			message: `Optimized: ${formatBytes(originalSize)} → ${formatBytes(optimizedSize)}`,
			originalSize,
			optimizedSize,
			multiThreaded: ffmpegMultiThreaded,
		});

		return {
			file: optimizedFile,
			wasOptimized: true,
			originalSize,
			finalSize: optimizedSize,
			multiThreaded: ffmpegMultiThreaded,
		};
	} catch (err) {
		// Don't report abort as error
		if (err instanceof DOMException && err.name === "AbortError") {
			throw err;
		}

		const message = err instanceof Error ? err.message : "Optimization failed";
		console.error("[MediaOptimizer] Error:", err);

		onProgress?.({
			phase: "error",
			percent: 0,
			message: `Optimization failed: ${message}. Uploading original.`,
			originalSize,
			optimizedSize: originalSize,
			multiThreaded: ffmpegMultiThreaded,
		});

		// Graceful degradation — return original file on error
		return {
			file,
			wasOptimized: false,
			originalSize,
			finalSize: originalSize,
			multiThreaded: ffmpegMultiThreaded,
		};
	}
}

/**
 * Build FFmpeg CLI arguments for the given file type.
 */
function buildFFmpegArgs(inputFile: string, outputFile: string, file: File): string[] {
	if (isVideoFile(file)) {
		return [
			"-i", inputFile,
			// Video: scale down to 720p max height, preserve aspect ratio, ensure even dimensions
			"-vf", `scale=-2:'min(${VIDEO_MAX_HEIGHT},ih)'`,
			"-c:v", "libx264",
			"-preset", "fast",
			"-b:v", VIDEO_BITRATE,
			"-maxrate", VIDEO_BITRATE,
			"-bufsize", `${Number.parseInt(VIDEO_BITRATE) * 2}k`,
			// Audio: AAC 128 kbps
			"-c:a", "aac",
			"-b:a", AUDIO_BITRATE,
			// MP4 faststart for streaming
			"-movflags", "+faststart",
			// Overwrite output
			"-y",
			outputFile,
		];
	}

	// Audio optimization
	return [
		"-i", inputFile,
		"-c:a", "aac",
		"-b:a", AUDIO_BITRATE,
		"-movflags", "+faststart",
		"-y",
		outputFile,
	];
}

// ── Utilities ──────────────────────────────────────────────────────────

/** Format bytes into human-readable string */
export function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const units = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	const value = bytes / 1024 ** i;
	return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
}
