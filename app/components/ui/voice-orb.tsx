/**
 * VoiceOrb - Audio-reactive glowing sphere for voice interfaces
 *
 * A mesmerizing orb that pulses and glows in response to audio input.
 * Used in voice chat mode to provide visual feedback during conversation.
 *
 * States:
 * - idle: Soft breathing glow
 * - listening: Brighter, pulses with voice amplitude
 * - processing: Spinning/morphing animation
 * - speaking: Different color when AI is talking
 */

import { useEffect, useRef } from "react"
import { cn } from "~/lib/utils"

export type VoiceOrbState = "idle" | "listening" | "processing" | "speaking"

export interface VoiceOrbProps {
	state?: VoiceOrbState
	/** Audio level from 0-1, drives pulse intensity when listening */
	audioLevel?: number
	/** Size preset */
	size?: "sm" | "md" | "lg" | "xl"
	/** Optional className for container */
	className?: string
}

const SIZE_CLASSES = {
	sm: "h-24 w-24",
	md: "h-32 w-32",
	lg: "h-48 w-48",
	xl: "h-64 w-64",
}

const ORB_SIZES = {
	sm: 96,
	md: 128,
	lg: 192,
	xl: 256,
}

export function VoiceOrb({ state = "idle", audioLevel = 0, size = "lg", className }: VoiceOrbProps) {
	const orbRef = useRef<HTMLDivElement>(null)
	const glowIntensity = state === "listening" ? 0.5 + audioLevel * 0.5 : 0.5

	// Update CSS custom property for audio-reactive glow
	useEffect(() => {
		if (orbRef.current) {
			orbRef.current.style.setProperty("--glow-intensity", String(glowIntensity))
			orbRef.current.style.setProperty("--audio-scale", String(1 + audioLevel * 0.15))
		}
	}, [glowIntensity, audioLevel])

	return (
		<div className={cn("relative flex items-center justify-center", SIZE_CLASSES[size], className)}>
			{/* Outer glow layers */}
			<div
				className={cn(
					"absolute inset-0 rounded-full opacity-30 blur-3xl transition-all duration-300",
					state === "idle" && "animate-pulse bg-primary/40",
					state === "listening" && "bg-primary/60",
					state === "processing" && "animate-spin bg-gradient-to-r from-primary via-purple-500 to-primary",
					state === "speaking" && "animate-pulse bg-emerald-500/50"
				)}
				style={{
					transform: state === "listening" ? `scale(${1 + audioLevel * 0.3})` : undefined,
				}}
			/>

			{/* Middle glow layer */}
			<div
				className={cn(
					"absolute inset-4 rounded-full opacity-50 blur-xl transition-all duration-200",
					state === "idle" && "bg-primary/50",
					state === "listening" && "bg-primary/70",
					state === "processing" && "bg-purple-500/60",
					state === "speaking" && "bg-emerald-400/60"
				)}
				style={{
					transform: state === "listening" ? `scale(${1 + audioLevel * 0.2})` : undefined,
				}}
			/>

			{/* Core orb */}
			<div
				ref={orbRef}
				className={cn(
					"relative rounded-full transition-all duration-150",
					state === "idle" && "animate-breathe",
					state === "processing" && "animate-morph"
				)}
				style={{
					width: ORB_SIZES[size] * 0.5,
					height: ORB_SIZES[size] * 0.5,
					transform: state === "listening" ? `scale(${1 + audioLevel * 0.1})` : undefined,
				}}
			>
				{/* Gradient background */}
				<div
					className={cn(
						"absolute inset-0 rounded-full transition-all duration-300",
						state === "idle" && "bg-gradient-to-br from-primary/80 via-primary to-primary/60",
						state === "listening" && "bg-gradient-to-br from-primary via-primary/90 to-purple-500/80",
						state === "processing" && "animate-gradient bg-gradient-to-br from-purple-500 via-primary to-purple-600",
						state === "speaking" && "bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-500"
					)}
				/>

				{/* Inner highlight */}
				<div className="absolute inset-2 rounded-full bg-gradient-to-br from-white/30 to-transparent" />

				{/* Center bright spot */}
				<div
					className={cn(
						"absolute top-1/4 left-1/4 h-1/4 w-1/4 rounded-full bg-white/40 blur-sm",
						state === "listening" && "bg-white/60"
					)}
				/>

				{/* Ripple effect for listening state */}
				{state === "listening" && audioLevel > 0.1 && (
					<>
						<div
							className="absolute inset-0 animate-ping rounded-full border-2 border-primary/30"
							style={{ animationDuration: "1.5s" }}
						/>
						<div
							className="absolute inset-0 animate-ping rounded-full border border-primary/20"
							style={{ animationDuration: "2s", animationDelay: "0.5s" }}
						/>
					</>
				)}

				{/* Processing spinner overlay */}
				{state === "processing" && (
					<div className="absolute inset-0 rounded-full">
						<div className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-t-white/50" />
					</div>
				)}
			</div>

			{/* Particle effects for active states */}
			{(state === "listening" || state === "speaking") && (
				<div className="absolute inset-0 overflow-hidden rounded-full">
					{[...Array(6)].map((_, i) => (
						<div
							key={i}
							className={cn(
								"absolute h-1 w-1 rounded-full",
								state === "listening" ? "bg-primary/60" : "bg-emerald-400/60"
							)}
							style={{
								left: `${50 + Math.cos((i * Math.PI) / 3) * 40}%`,
								top: `${50 + Math.sin((i * Math.PI) / 3) * 40}%`,
								animation: `float ${2 + i * 0.3}s ease-in-out infinite`,
								animationDelay: `${i * 0.2}s`,
							}}
						/>
					))}
				</div>
			)}
		</div>
	)
}

// Add custom animations to tailwind.config or use inline styles
// These keyframes should be added to your global CSS or tailwind config:
/*
@keyframes breathe {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.05); opacity: 1; }
}

@keyframes morph {
  0%, 100% { border-radius: 50%; }
  25% { border-radius: 45% 55% 55% 45%; }
  50% { border-radius: 55% 45% 45% 55%; }
  75% { border-radius: 45% 55% 55% 45%; }
}

@keyframes gradient {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

@keyframes float {
  0%, 100% { transform: translateY(0) scale(1); opacity: 0.6; }
  50% { transform: translateY(-10px) scale(1.2); opacity: 1; }
}
*/
