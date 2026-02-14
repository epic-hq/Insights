import { AnimatePresence, motion } from "framer-motion";
import { Mic } from "lucide-react";
import React from "react";

import { cn } from "~/lib/utils";

const FREQUENCY_BAR_IDS = Array.from({ length: 12 }, (_, idx) => `frequency-bar-${idx}`);

interface VoiceInputProps {
	onStart?: () => void;
	onStop?: () => void;
	audioIntensity?: number;
	status?: "listening" | "transcribing" | "idle";
}

export function VoiceInput({
	className,
	audioIntensity,
	status = "idle",
	onStart,
	onStop,
}: React.ComponentProps<"div"> & VoiceInputProps) {
	const [_listening, _setListening] = React.useState<boolean>(false);
	const [_time, _setTime] = React.useState<number>(0);

	React.useEffect(() => {
		let intervalId: NodeJS.Timeout;

		if (_listening) {
			onStart?.();
			intervalId = setInterval(() => {
				_setTime((t) => t + 1);
			}, 1000);
		} else {
			onStop?.();
			_setTime(0);
		}

		return () => clearInterval(intervalId);
	}, [_listening, onStart, onStop]);

	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
	};

	const onClickHandler = () => {
		_setListening(!_listening);
	};

	const normalizedIntensity = React.useMemo(() => {
		if (typeof audioIntensity !== "number" || Number.isNaN(audioIntensity)) return 0;
		return Math.min(Math.max(audioIntensity, 0), 1);
	}, [audioIntensity]);

	const peakHeight = React.useMemo(() => 2 + normalizedIntensity * 12, [normalizedIntensity]);

	return (
		<div className={cn("flex flex-col items-center justify-center", className)}>
			<motion.div
				className={cn(
					"flex cursor-pointer items-center justify-center rounded-full border p-2",
					status === "transcribing" && "animate-pulse cursor-not-allowed bg-gray-200"
				)}
				layout
				transition={{
					layout: {
						duration: 0.4,
					},
				}}
				onClick={status === "transcribing" ? () => null : onClickHandler}
			>
				<div className="flex h-6 w-6 items-center justify-center">
					{_listening ? (
						<motion.div
							className="h-4 w-4 rounded-sm bg-primary"
							animate={{
								rotate: [0, 180, 360],
							}}
							transition={{
								duration: 2,
								repeat: Number.POSITIVE_INFINITY,
								ease: "easeInOut",
							}}
						/>
					) : (
						<Mic />
					)}
				</div>
				<AnimatePresence mode="wait">
					{_listening && (
						<motion.div
							initial={{ opacity: 0, width: 0, marginLeft: 0 }}
							animate={{ opacity: 1, width: "auto", marginLeft: 8 }}
							exit={{ opacity: 0, width: 0, marginLeft: 0 }}
							transition={{
								duration: 0.4,
							}}
							className="flex items-center justify-center gap-2 overflow-hidden"
						>
							{/* Frequency Animation */}
							<div className="flex items-center justify-center gap-0.5">
								{FREQUENCY_BAR_IDS.map((barId, index) => (
									<motion.div
										key={barId}
										className="w-0.5 rounded-full bg-primary"
										initial={{ height: 2 }}
										animate={{
											height: _listening ? [2, peakHeight, Math.max(2, peakHeight * 0.6), 2] : 2,
										}}
										transition={{
											duration: _listening ? 1 : 0.3,
											repeat: _listening ? Number.POSITIVE_INFINITY : 0,
											delay: _listening ? index * 0.05 : 0,
											ease: "easeInOut",
										}}
									/>
								))}
							</div>
							{/* Timer */}
							<div className="w-10 text-center text-muted-foreground text-xs">{formatTime(_time)}</div>
						</motion.div>
					)}
				</AnimatePresence>
			</motion.div>
		</div>
	);
}
