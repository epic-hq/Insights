/**
 * Video recorder component for Ask link respondents
 * Uses MediaRecorder API to capture video feedback
 */
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Camera, CheckCircle2, Loader2, RefreshCw, Square, Upload, Video } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

type VideoRecorderProps = {
	slug: string;
	responseId: string;
	onComplete?: (videoUrl: string) => void;
	onSkip?: () => void;
};

type RecordingState =
	| "idle"
	| "requesting_permission"
	| "preview"
	| "recording"
	| "stopped"
	| "uploading"
	| "complete"
	| "error";

const MAX_RECORDING_SECONDS = 120; // 2 minutes max

function getSupportedVideoMimeType(): string {
	const types = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
	return types.find((type) => MediaRecorder.isTypeSupported(type)) || "video/webm";
}

export function VideoRecorder({ slug, responseId, onComplete, onSkip }: VideoRecorderProps) {
	const [state, setState] = useState<RecordingState>("idle");
	const [error, setError] = useState<string | null>(null);
	const [recordingSeconds, setRecordingSeconds] = useState(0);
	const [videoUrl, setVideoUrl] = useState<string | null>(null);
	const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

	const videoPreviewRef = useRef<HTMLVideoElement>(null);
	const videoPlaybackRef = useRef<HTMLVideoElement>(null);
	const mediaStreamRef = useRef<MediaStream | null>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (mediaStreamRef.current) {
				mediaStreamRef.current.getTracks().forEach((track) => track.stop());
			}
			if (timerRef.current) {
				clearInterval(timerRef.current);
			}
			if (videoUrl) {
				URL.revokeObjectURL(videoUrl);
			}
		};
	}, [videoUrl]);

	const startPreview = useCallback(async () => {
		setState("requesting_permission");
		setError(null);

		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: {
					facingMode: "user",
					width: { ideal: 1280 },
					height: { ideal: 720 },
				},
				audio: true,
			});

			mediaStreamRef.current = stream;

			if (videoPreviewRef.current) {
				videoPreviewRef.current.srcObject = stream;
				videoPreviewRef.current.muted = true;
				await videoPreviewRef.current.play();
			}

			setState("preview");
		} catch (err) {
			const message =
				err instanceof Error
					? err.name === "NotAllowedError"
						? "Camera access denied. Please allow camera and microphone access."
						: err.message
					: "Failed to access camera";
			setError(message);
			setState("error");
		}
	}, []);

	const startRecording = useCallback(() => {
		if (!mediaStreamRef.current) return;

		chunksRef.current = [];
		const mimeType = getSupportedVideoMimeType();

		const recorder = new MediaRecorder(mediaStreamRef.current, {
			mimeType,
			videoBitsPerSecond: 2500000, // 2.5 Mbps
		});

		recorder.ondataavailable = (event) => {
			if (event.data.size > 0) {
				chunksRef.current.push(event.data);
			}
		};

		recorder.onstop = () => {
			const blob = new Blob(chunksRef.current, { type: mimeType });
			const url = URL.createObjectURL(blob);
			setVideoUrl(url);

			// Stop the preview stream
			if (mediaStreamRef.current) {
				mediaStreamRef.current.getTracks().forEach((track) => track.stop());
				mediaStreamRef.current = null;
			}

			setState("stopped");
		};

		mediaRecorderRef.current = recorder;
		recorder.start(1000); // Collect data every second
		setState("recording");
		setRecordingSeconds(0);

		// Start timer
		timerRef.current = setInterval(() => {
			setRecordingSeconds((prev) => {
				const next = prev + 1;
				if (next >= MAX_RECORDING_SECONDS) {
					stopRecording();
				}
				return next;
			});
		}, 1000);
	}, []);

	const stopRecording = useCallback(() => {
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}

		if (mediaRecorderRef.current?.state === "recording") {
			mediaRecorderRef.current.stop();
		}
	}, []);

	const resetRecording = useCallback(() => {
		if (videoUrl) {
			URL.revokeObjectURL(videoUrl);
			setVideoUrl(null);
		}
		setRecordingSeconds(0);
		chunksRef.current = [];
		startPreview();
	}, [videoUrl, startPreview]);

	const uploadVideo = useCallback(async () => {
		if (!videoUrl || chunksRef.current.length === 0) return;

		setState("uploading");
		setError(null);

		try {
			const mimeType = getSupportedVideoMimeType();
			const blob = new Blob(chunksRef.current, { type: mimeType });
			const ext = mimeType.includes("mp4") ? "mp4" : "webm";
			const file = new File([blob], `video.${ext}`, { type: mimeType });

			const formData = new FormData();
			formData.append("video", file);
			formData.append("responseId", responseId);

			const response = await fetch(`/api/research-links/${slug}/upload-video`, {
				method: "POST",
				body: formData,
			});

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.error || "Upload failed");
			}

			const result = await response.json();
			setUploadedUrl(result.videoUrl);
			setState("complete");
			onComplete?.(result.videoUrl);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Upload failed");
			setState("error");
		}
	}, [videoUrl, responseId, slug, onComplete]);

	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	return (
		<div className="space-y-4">
			{/* Video container */}
			<div className="relative aspect-video overflow-hidden rounded-xl bg-black/50">
				{/* Idle state */}
				{state === "idle" && (
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
						<div className="rounded-full bg-white/10 p-4">
							<Video className="h-8 w-8 text-white/70" />
						</div>
						<div className="text-center">
							<p className="font-medium text-white">Record a video response</p>
							<p className="mt-1 text-sm text-white/60">Share your thoughts on camera (optional)</p>
						</div>
						<Button onClick={startPreview} className="mt-2 gap-2 bg-white text-black hover:bg-white/90">
							<Camera className="h-4 w-4" />
							Enable Camera
						</Button>
					</div>
				)}

				{/* Requesting permission */}
				{state === "requesting_permission" && (
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
						<Loader2 className="h-8 w-8 animate-spin text-white/70" />
						<p className="text-sm text-white/60">Requesting camera access...</p>
					</div>
				)}

				{/* Preview & Recording - always render video to prevent re-mount issues */}
				<video
					ref={videoPreviewRef}
					className={cn("h-full w-full object-cover", state !== "preview" && state !== "recording" && "hidden")}
					playsInline
					muted
					autoPlay
				/>
				{state === "recording" && (
					<div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-red-500 px-3 py-1.5">
						<span className="h-2 w-2 animate-pulse rounded-full bg-white" />
						<span className="font-medium text-sm text-white">{formatTime(recordingSeconds)}</span>
					</div>
				)}

				{/* Playback */}
				{(state === "stopped" || state === "uploading" || state === "complete") && videoUrl && (
					<video ref={videoPlaybackRef} src={videoUrl} className="h-full w-full object-cover" controls playsInline />
				)}

				{/* Uploading overlay */}
				{state === "uploading" && (
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
						<Loader2 className="h-8 w-8 animate-spin text-white" />
						<p className="text-sm text-white">Uploading video...</p>
					</div>
				)}

				{/* Complete overlay */}
				{state === "complete" && (
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
						<CheckCircle2 className="h-12 w-12 text-emerald-400" />
						<p className="font-medium text-white">Video uploaded!</p>
					</div>
				)}

				{/* Error state */}
				{state === "error" && (
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-4">
						<div className="rounded-full bg-red-500/20 p-3">
							<AlertCircle className="h-6 w-6 text-red-400" />
						</div>
						<p className="text-center text-red-300 text-sm">{error}</p>
						<Button
							onClick={() => {
								setError(null);
								setState("idle");
							}}
							variant="outline"
							size="sm"
							className="border-white/20 bg-white/5 text-white hover:bg-white/10"
						>
							Try Again
						</Button>
					</div>
				)}
			</div>

			{/* Controls */}
			<AnimatePresence mode="wait">
				{state === "preview" && (
					<motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
						className="flex justify-center gap-3"
					>
						<Button onClick={startRecording} className="gap-2 bg-red-500 text-white hover:bg-red-600">
							<span className="h-3 w-3 rounded-full bg-white" />
							Start Recording
						</Button>
						{onSkip && (
							<Button onClick={onSkip} variant="ghost" className="text-white/60 hover:bg-white/10 hover:text-white">
								Skip
							</Button>
						)}
					</motion.div>
				)}

				{state === "recording" && (
					<motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
						className="flex flex-col items-center gap-3"
					>
						<Button onClick={stopRecording} className="gap-2 bg-white text-black hover:bg-white/90">
							<Square className="h-4 w-4 fill-current" />
							Stop Recording
						</Button>
						<p className="text-sm text-white/50">Max {Math.floor(MAX_RECORDING_SECONDS / 60)} minutes</p>
					</motion.div>
				)}

				{state === "stopped" && (
					<motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
						className="flex justify-center gap-3"
					>
						<Button
							onClick={resetRecording}
							variant="outline"
							className="gap-2 border-white/20 bg-white/5 text-white hover:bg-white/10"
						>
							<RefreshCw className="h-4 w-4" />
							Re-record
						</Button>
						<Button onClick={uploadVideo} className="gap-2 bg-white text-black hover:bg-white/90">
							<Upload className="h-4 w-4" />
							Submit Video
						</Button>
					</motion.div>
				)}

				{state === "idle" && onSkip && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="flex justify-center"
					>
						<Button onClick={onSkip} variant="ghost" className="text-white/50 hover:bg-white/10 hover:text-white/70">
							Skip video
						</Button>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
