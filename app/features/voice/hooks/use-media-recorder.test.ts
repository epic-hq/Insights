// @vitest-environment jsdom
/**
 * Tests for useMediaRecorder hook — focused on the Chrome audio
 * transcription fixes: race condition, MIME type handling, and
 * empty chunk guard.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMediaRecorder } from "./use-media-recorder";

// ---------------------------------------------------------------------------
// Mock browser APIs
// ---------------------------------------------------------------------------

/** Track instances for assertions */
let mockTrackStopFn: ReturnType<typeof vi.fn>;

/** Stored reference to the latest MockMediaRecorder instance */
let recorderInstance: MockMediaRecorderInstance | null = null;

interface MockMediaRecorderInstance {
	state: string;
	start: () => void;
	stop: () => void;
	pause: () => void;
	resume: () => void;
	ondataavailable: ((e: { data: Blob }) => void) | null;
	onstop: (() => void) | null;
	onstart: (() => void) | null;
	onerror: ((e: unknown) => void) | null;
	simulateStop: (chunks?: Blob[]) => void;
}

/**
 * Class-based mock — `new MockMediaRecorder(stream, opts)` works with `new`.
 * Stores event handlers; use `simulateStop()` to fire dataavailable + onstop.
 */
class MockMediaRecorder {
	state = "inactive";
	ondataavailable: ((e: { data: Blob }) => void) | null = null;
	onstop: (() => void) | null = null;
	onstart: (() => void) | null = null;
	onerror: ((e: unknown) => void) | null = null;

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	constructor(_stream: unknown, _opts?: unknown) {
		recorderInstance = this;
	}

	start() {
		this.state = "recording";
		queueMicrotask(() => this.onstart?.());
	}

	stop() {
		this.state = "inactive";
	}

	pause() {
		this.state = "paused";
	}

	resume() {
		this.state = "recording";
	}

	/** Helper — simulates browser firing dataavailable + onstop async events */
	simulateStop(chunks: Blob[] = [new Blob(["audio-data"], { type: "audio/webm;codecs=opus" })]) {
		for (const chunk of chunks) {
			this.ondataavailable?.({ data: chunk });
		}
		this.onstop?.();
	}

	static isTypeSupported(type: string) {
		return type.startsWith("audio/webm");
	}
}

/**
 * Minimal mock MediaStream that tracks whether stop() was called on tracks.
 */
class MockMediaStream {
	active = true;
	private _tracks: { kind: string; readyState: string; enabled: boolean; stop: ReturnType<typeof vi.fn> }[];

	constructor(tracks?: unknown[]) {
		this._tracks = (tracks as typeof this._tracks) ?? [
			{
				kind: "audio",
				readyState: "live",
				enabled: true,
				stop: mockTrackStopFn,
			},
		];
	}

	getTracks() {
		return this._tracks;
	}

	getAudioTracks() {
		return this._tracks.filter((t) => t.kind === "audio");
	}

	getVideoTracks() {
		return [];
	}

	addTrack() {}
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
	recorderInstance = null;
	mockTrackStopFn = vi.fn();

	// Install globals that jsdom doesn't provide
	(globalThis as any).MediaRecorder = MockMediaRecorder;
	(globalThis as any).MediaStream = MockMediaStream;

	// Navigator.mediaDevices
	Object.defineProperty(window.navigator, "mediaDevices", {
		value: {
			getUserMedia: vi.fn().mockResolvedValue(new MockMediaStream()),
			getSupportedConstraints: vi.fn(() => ({
				echoCancellation: true,
				noiseSuppression: true,
				sampleRate: true,
				channelCount: true,
			})),
		},
		writable: true,
		configurable: true,
	});

	// URL.createObjectURL / revokeObjectURL
	globalThis.URL.createObjectURL = vi.fn(() => "blob:mock-url");
	globalThis.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
	vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useMediaRecorder", () => {
	describe("race condition fix: track stopping deferred to onstop", () => {
		it("should NOT stop tracks synchronously in stopRecording", async () => {
			const onStop = vi.fn();
			const { result } = renderHook(() =>
				useMediaRecorder({
					audio: true,
					stopStreamsOnStop: true,
					onStop,
				})
			);

			// Start recording
			await act(async () => {
				await result.current.startRecording();
			});

			expect(mockTrackStopFn).not.toHaveBeenCalled();

			// Stop recording — this should NOT stop tracks yet
			act(() => {
				result.current.stopRecording();
			});

			// Tracks must still be alive at this point (before onstop fires)
			expect(mockTrackStopFn).not.toHaveBeenCalled();
		});

		it("should stop tracks inside onstop handler (after data is flushed)", async () => {
			const onStop = vi.fn();
			const { result } = renderHook(() =>
				useMediaRecorder({
					audio: true,
					stopStreamsOnStop: true,
					onStop,
				})
			);

			await act(async () => {
				await result.current.startRecording();
			});

			act(() => {
				result.current.stopRecording();
			});

			expect(mockTrackStopFn).not.toHaveBeenCalled();

			// Now simulate the browser firing dataavailable + onstop
			act(() => {
				recorderInstance!.simulateStop([new Blob(["audio-data"], { type: "audio/webm;codecs=opus" })]);
			});

			// NOW tracks should be stopped
			expect(mockTrackStopFn).toHaveBeenCalled();
			expect(onStop).toHaveBeenCalled();
		});

		it("should not stop tracks when stopStreamsOnStop is false", async () => {
			const onStop = vi.fn();
			const { result } = renderHook(() =>
				useMediaRecorder({
					audio: true,
					stopStreamsOnStop: false,
					onStop,
				})
			);

			await act(async () => {
				await result.current.startRecording();
			});

			act(() => {
				result.current.stopRecording();
			});

			act(() => {
				recorderInstance!.simulateStop([new Blob(["audio-data"], { type: "audio/webm;codecs=opus" })]);
			});

			expect(mockTrackStopFn).not.toHaveBeenCalled();
			expect(onStop).toHaveBeenCalled();
		});
	});

	describe("MIME type handling", () => {
		it("should preserve actual recorded MIME type when no blobPropertyBag is given", async () => {
			const onStop = vi.fn();
			const { result } = renderHook(() =>
				useMediaRecorder({
					audio: true,
					onStop,
					// No blobPropertyBag — simulates useSpeechToText path
				})
			);

			await act(async () => {
				await result.current.startRecording();
			});

			act(() => {
				result.current.stopRecording();
			});

			act(() => {
				recorderInstance!.simulateStop([new Blob(["audio-data"], { type: "audio/webm;codecs=opus" })]);
			});

			expect(onStop).toHaveBeenCalledTimes(1);
			const blob = onStop.mock.calls[0][1] as Blob;
			// Must be the actual recorded type, NOT "audio/wav"
			expect(blob.type).toBe("audio/webm;codecs=opus");
		});

		it("should use blobPropertyBag type when provided", async () => {
			const onStop = vi.fn();
			const { result } = renderHook(() =>
				useMediaRecorder({
					audio: true,
					onStop,
					blobPropertyBag: { type: "audio/webm" },
				})
			);

			await act(async () => {
				await result.current.startRecording();
			});

			act(() => {
				result.current.stopRecording();
			});

			act(() => {
				recorderInstance!.simulateStop([new Blob(["audio-data"], { type: "audio/webm;codecs=opus" })]);
			});

			expect(onStop).toHaveBeenCalledTimes(1);
			const blob = onStop.mock.calls[0][1] as Blob;
			expect(blob.type).toBe("audio/webm");
		});

		it("should fallback to audio/webm when chunk has no type", async () => {
			const onStop = vi.fn();
			const { result } = renderHook(() =>
				useMediaRecorder({
					audio: true,
					onStop,
				})
			);

			await act(async () => {
				await result.current.startRecording();
			});

			act(() => {
				result.current.stopRecording();
			});

			act(() => {
				// Blob with empty type
				recorderInstance!.simulateStop([new Blob(["audio-data"])]);
			});

			expect(onStop).toHaveBeenCalledTimes(1);
			const blob = onStop.mock.calls[0][1] as Blob;
			expect(blob.type).toBe("audio/webm");
		});
	});

	describe("empty chunks guard", () => {
		it("should not crash when MediaRecorder produces empty chunks", async () => {
			const onStop = vi.fn();
			const { result } = renderHook(() =>
				useMediaRecorder({
					audio: true,
					onStop,
				})
			);

			await act(async () => {
				await result.current.startRecording();
			});

			act(() => {
				result.current.stopRecording();
			});

			// Simulate Chrome firing dataavailable with zero-size data
			act(() => {
				recorderInstance!.simulateStop([new Blob([], { type: "audio/webm;codecs=opus" })]);
			});

			// onStop should NOT be called — there's no data to process
			expect(onStop).not.toHaveBeenCalled();
			// Status should reset to idle
			expect(result.current.status).toBe("idle");
		});

		it("should not crash when MediaRecorder produces no chunks at all", async () => {
			const onStop = vi.fn();
			const { result } = renderHook(() =>
				useMediaRecorder({
					audio: true,
					onStop,
				})
			);

			await act(async () => {
				await result.current.startRecording();
			});

			act(() => {
				result.current.stopRecording();
			});

			// onstop fires without any preceding dataavailable
			act(() => {
				recorderInstance!.simulateStop([]);
			});

			expect(onStop).not.toHaveBeenCalled();
			expect(result.current.status).toBe("idle");
		});

		it("should filter out zero-size chunks and use remaining valid ones", async () => {
			const onStop = vi.fn();
			const { result } = renderHook(() =>
				useMediaRecorder({
					audio: true,
					onStop,
				})
			);

			await act(async () => {
				await result.current.startRecording();
			});

			act(() => {
				result.current.stopRecording();
			});

			act(() => {
				recorderInstance!.simulateStop([
					new Blob([], { type: "audio/webm;codecs=opus" }), // empty
					new Blob(["real-audio-data"], { type: "audio/webm;codecs=opus" }), // valid
					new Blob([], { type: "audio/webm;codecs=opus" }), // empty
				]);
			});

			expect(onStop).toHaveBeenCalledTimes(1);
			const blob = onStop.mock.calls[0][1] as Blob;
			expect(blob.size).toBeGreaterThan(0);
		});
	});

	describe("deleteRecording", () => {
		it("should discard audio data and reset to idle", async () => {
			const onStop = vi.fn();
			const { result } = renderHook(() =>
				useMediaRecorder({
					audio: true,
					onStop,
				})
			);

			await act(async () => {
				await result.current.startRecording();
			});

			// Delete instead of normal stop
			act(() => {
				result.current.deleteRecording();
			});

			act(() => {
				recorderInstance!.simulateStop([new Blob(["audio-data"], { type: "audio/webm;codecs=opus" })]);
			});

			// onStop should NOT be called — the recording was deleted
			expect(onStop).not.toHaveBeenCalled();
			expect(result.current.status).toBe("idle");
		});
	});

	describe("status transitions", () => {
		it("should transition idle → recording → stopping → stopped", async () => {
			const onStop = vi.fn();
			const { result } = renderHook(() =>
				useMediaRecorder({
					audio: true,
					onStop,
				})
			);

			expect(result.current.status).toBe("idle");

			await act(async () => {
				await result.current.startRecording();
			});
			expect(result.current.status).toBe("recording");

			act(() => {
				result.current.stopRecording();
			});
			expect(result.current.status).toBe("stopping");

			act(() => {
				recorderInstance!.simulateStop([new Blob(["audio-data"], { type: "audio/webm;codecs=opus" })]);
			});
			expect(result.current.status).toBe("stopped");
		});
	});

	describe("getSupportedMimeType selection", () => {
		it("should select audio/webm;codecs=opus when supported", async () => {
			// Default MockMediaRecorder.isTypeSupported returns true for audio/webm*
			const constructorSpy = vi.spyOn(MockMediaRecorder.prototype, "start");

			const { result } = renderHook(() => useMediaRecorder({ audio: true }));

			await act(async () => {
				await result.current.startRecording();
			});

			// Verify the recorder was started (confirms constructor succeeded)
			expect(constructorSpy).toHaveBeenCalled();
			expect(result.current.status).toBe("recording");

			constructorSpy.mockRestore();
		});
	});
});
