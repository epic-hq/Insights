export function ProgressDots({ className = "" }: { className?: string }) {
	return (
		<span className={`inline-flex items-center gap-1 ${className}`}>
			<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current opacity-70" />
			<span className="h-1.5 w-1.5 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-current opacity-60 [animation-delay:0.2s]" />
			<span className="h-1.5 w-1.5 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-current opacity-50 [animation-delay:0.4s]" />
		</span>
	);
}
