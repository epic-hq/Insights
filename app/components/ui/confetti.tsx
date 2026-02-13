/**
 * Reusable confetti celebration animation.
 * Extracted from OnboardingWalkthrough for use across features.
 */

import { motion } from "framer-motion";

interface ConfettiParticleProps {
	delay: number;
	x: number;
	color: string;
	size: number;
	isCircle: boolean;
	drift: number;
	rotation: number;
}

function ConfettiParticle({ delay, x, color, size, isCircle, drift, rotation }: ConfettiParticleProps) {
	return (
		<motion.div
			initial={{ y: -20, x, opacity: 1, rotate: 0, scale: 1 }}
			animate={{
				y: 400,
				x: x + drift,
				opacity: [1, 1, 0],
				rotate: rotation,
				scale: [1, 1, 0.5],
			}}
			transition={{
				duration: 2.5,
				delay,
				ease: [0.25, 0.46, 0.45, 0.94],
			}}
			className="pointer-events-none absolute top-0"
			style={{
				width: size,
				height: size,
				backgroundColor: color,
				borderRadius: isCircle ? "50%" : "2px",
			}}
		/>
	);
}

export function ConfettiCelebration({ particleCount = 60 }: { particleCount?: number }) {
	const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];

	const particles = Array.from({ length: particleCount }, (_, i) => ({
		id: i,
		delay: (i % 10) * 0.05,
		x: ((i % 12) - 6) * 35,
		color: colors[i % colors.length],
		size: 6 + (i % 4) * 3,
		isCircle: i % 3 !== 0,
		drift: ((i % 7) - 3) * 25,
		rotation: ((i % 8) - 4) * 180,
	}));

	return (
		<div className="pointer-events-none absolute inset-0 overflow-hidden">
			<div className="-translate-x-1/2 -translate-y-1/2 absolute top-1/3 left-1/2">
				{particles.map((p) => (
					<ConfettiParticle key={p.id} {...p} />
				))}
			</div>
		</div>
	);
}
