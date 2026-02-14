import { Shield, ShieldAlert, ShieldCheck, SignalHigh, SignalLow, SignalMedium } from "lucide-react";
import { Badge } from "~/components/ui/badge";

type Confidence = "low" | "medium" | "high";
function toBand(score: number | string): Confidence {
	if (typeof score === "string") {
		const normalized = score.toLowerCase();
		if (normalized === "high") return "high";
		if (normalized === "medium") return "medium";
		if (normalized === "low") return "low";
		// Fallback for invalid strings
		return "low";
	}
	if (score >= 0.95) return "high";
	if (score >= 0.85) return "medium";
	return "low";
}

const COLORS: Record<Confidence, string> = {
	low: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900",
	medium: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900",
	high: "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900",
};

const DOTS: Record<Confidence, string> = {
	low: "bg-rose-500",
	medium: "bg-amber-500",
	high: "bg-emerald-500",
};

export function ConfidencePill({ value }: { value: number }) {
	const band = toBand(value);
	const label = `${band[0].toUpperCase()}${band.slice(1)} (${(value * 100).toFixed(1)}%)`;
	return (
		<Badge
			variant="outline"
			aria-label={`Confidence ${label}`}
			className={`inline-flex items-center gap-1.5 border ${COLORS[band]}`}
		>
			<span className={`h-2.5 w-2.5 rounded-full ${DOTS[band]}`} />
			<span className="capitalize">{band}</span>
		</Badge>
	);
}

export function ConfidenceBars({ value }: { value: number }) {
	const band = toBand(value);
	const Icon = band === "low" ? SignalLow : band === "medium" ? SignalMedium : SignalHigh;
	return (
		<button
			type="button"
			aria-label={`Confidence ${band} ${(value * 100).toFixed(1)}%`}
			className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-accent"
			title={`${band} • ${(value * 100).toFixed(1)}%`}
		>
			<Icon className="h-4 w-4" />
			<span className="sr-only">{band}</span>
		</button>
	);
}

export function ConfidenceShield({ value }: { value: number }) {
	const band = toBand(value);
	const Icon = band === "low" ? ShieldAlert : band === "medium" ? Shield : ShieldCheck;
	const color = band === "low" ? "text-rose-600" : band === "medium" ? "text-amber-600" : "text-emerald-600";
	return (
		<div className="inline-flex items-center gap-1.5" aria-label={`Confidence ${band}`}>
			<Icon className={`h-4 w-4 ${color}`} />
			<span className="text-muted-foreground text-xs">{(value * 100).toFixed(0)}%</span>
		</div>
	);
}
