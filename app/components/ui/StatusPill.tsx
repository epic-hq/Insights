import { Check, Circle } from "lucide-react";
import type React from "react";

type Variant = "active" | "done" | "queued" | "error" | "neutral";

export function StatusPill({
	label,
	variant = "neutral",
	children,
}: {
	label?: string;
	variant?: Variant;
	children?: React.ReactNode;
}) {
	const base = "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium";
	const styles: Record<Variant, string> = {
		active: "border-blue-200 bg-blue-50 text-blue-700",
		done: "border-green-200 bg-green-50 text-green-700",
		queued: "border-slate-200 bg-slate-50 text-slate-700",
		error: "border-red-200 bg-red-50 text-red-700",
		neutral: "border-slate-200 bg-slate-50 text-slate-700",
	};
	return (
		<span className={`${base} ${styles[variant]}`}>
			{variant === "done" ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
			{children ?? label}
		</span>
	);
}
