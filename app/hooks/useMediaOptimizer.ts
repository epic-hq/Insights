/**
 * React hook for client-side media file optimization before upload.
 *
 * Wraps the media-optimizer engine with React state management,
 * providing progress tracking, abort control, and skip functionality.
 */

import { useCallback, useRef, useState } from "react";
import type { OptimizationProgress, OptimizationResult } from "~/utils/media-optimizer.client";

export type OptimizationStatus = "idle" | "optimizing" | "done" | "skipped" | "error";

export interface MediaOptimizerState {
	status: OptimizationStatus;
	progress: OptimizationProgress | null;
	result: OptimizationResult | null;
}

export interface UseMediaOptimizerReturn {
	/** Current optimization state */
	state: MediaOptimizerState;
	/** Start optimizing a file. Returns the optimized (or original) file. */
	optimize: (file: File) => Promise<File>;
	/** Skip optimization and use the original file */
	skip: () => void;
	/** Reset state back to idle */
	reset: () => void;
}

const INITIAL_STATE: MediaOptimizerState = {
	status: "idle",
	progress: null,
	result: null,
};

export function useMediaOptimizer(): UseMediaOptimizerReturn {
	const [state, setState] = useState<MediaOptimizerState>(INITIAL_STATE);
	const abortRef = useRef<AbortController | null>(null);
	const resolveSkipRef = useRef<((file: File) => void) | null>(null);
	const originalFileRef = useRef<File | null>(null);

	const optimize = useCallback(async (file: File): Promise<File> => {
		// Lazy import to avoid loading FFmpeg WASM until needed
		const { optimizeMediaFile, shouldOptimize } = await import("~/utils/media-optimizer.client");

		// If file doesn't need optimization, return immediately
		if (!shouldOptimize(file)) {
			setState({
				status: "skipped",
				progress: {
					phase: "skipped",
					percent: 100,
					message: "No optimization needed",
					originalSize: file.size,
					optimizedSize: file.size,
					multiThreaded: false,
				},
				result: {
					file,
					wasOptimized: false,
					originalSize: file.size,
					finalSize: file.size,
					multiThreaded: false,
				},
			});
			return file;
		}

		const controller = new AbortController();
		abortRef.current = controller;
		originalFileRef.current = file;

		setState({
			status: "optimizing",
			progress: {
				phase: "loading",
				percent: 0,
				message: "Preparing optimizer...",
				originalSize: file.size,
				optimizedSize: 0,
				multiThreaded: false,
			},
			result: null,
		});

		// Create a promise that can be resolved by skip()
		const skipPromise = new Promise<File>((resolve) => {
			resolveSkipRef.current = resolve;
		});

		const optimizePromise = (async () => {
			try {
				const result = await optimizeMediaFile(file, {
					onProgress: (progress) => {
						setState((prev) => ({
							...prev,
							progress,
						}));
					},
					signal: controller.signal,
				});

				resolveSkipRef.current = null;
				setState({
					status: result.wasOptimized ? "done" : "skipped",
					progress: {
						phase: "done",
						percent: 100,
						message: result.wasOptimized
							? `Optimized: ${formatBytesInline(result.originalSize)} → ${formatBytesInline(result.finalSize)}`
							: "Original file is already well-optimized",
						originalSize: result.originalSize,
						optimizedSize: result.finalSize,
						multiThreaded: result.multiThreaded,
					},
					result,
				});

				return result.file;
			} catch (error) {
				if (error instanceof DOMException && error.name === "AbortError") {
					return originalFileRef.current ?? file;
				}
				throw error;
			} finally {
				abortRef.current = null;
			}
		})();

		// Race between optimization completing and user clicking skip
		return Promise.race([optimizePromise, skipPromise]);
	}, []);

	const skip = useCallback(() => {
		// Abort any in-progress optimization
		abortRef.current?.abort();
		abortRef.current = null;

		const originalFile = originalFileRef.current;
		if (originalFile && resolveSkipRef.current) {
			setState({
				status: "skipped",
				progress: {
					phase: "skipped",
					percent: 100,
					message: "Skipped — uploading original",
					originalSize: originalFile.size,
					optimizedSize: originalFile.size,
					multiThreaded: false,
				},
				result: {
					file: originalFile,
					wasOptimized: false,
					originalSize: originalFile.size,
					finalSize: originalFile.size,
					multiThreaded: false,
				},
			});
			resolveSkipRef.current(originalFile);
			resolveSkipRef.current = null;
		}
	}, []);

	const reset = useCallback(() => {
		abortRef.current?.abort();
		abortRef.current = null;
		resolveSkipRef.current = null;
		originalFileRef.current = null;
		setState(INITIAL_STATE);
	}, []);

	return { state, optimize, skip, reset };
}

function formatBytesInline(bytes: number): string {
	if (bytes === 0) return "0 B";
	const units = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	const value = bytes / 1024 ** i;
	return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
}
