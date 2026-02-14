/**
 * WowRoutePicker - Full-page route selection for Steps to Wow.
 * Presents 3 cards: Discover (blue), Reach Out (amber), Full Setup.
 */

import { motion } from "framer-motion";
import { ArrowRight, Map, Mic, Send } from "lucide-react";
import { useFetcher } from "react-router";
import { cn } from "~/lib/utils";
import type { WowPath } from "../journey-config";

interface WowRoutePickerProps {
	onFullSetup: () => void;
}

const ROUTE_CARDS: Array<{
	path: WowPath | "full_setup";
	label: string;
	tagline: string;
	icon: typeof Mic;
	accent: string;
	border: string;
	bg: string;
	iconBg: string;
}> = [
	{
		path: "discover",
		label: "Discover",
		tagline: "Upload a conversation, see AI findings, click for receipts",
		icon: Mic,
		accent: "text-blue-600 dark:text-blue-400",
		border: "border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600",
		bg: "hover:bg-blue-50/50 dark:hover:bg-blue-950/30",
		iconBg: "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400",
	},
	{
		path: "reach_out",
		label: "Reach Out",
		tagline: "Send a smart survey, watch responses, see patterns",
		icon: Send,
		accent: "text-amber-600 dark:text-amber-400",
		border: "border-amber-200 dark:border-amber-800 hover:border-amber-400 dark:hover:border-amber-600",
		bg: "hover:bg-amber-50/50 dark:hover:bg-amber-950/30",
		iconBg: "bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400",
	},
	{
		path: "full_setup",
		label: "Full Setup",
		tagline: "See the complete journey map and go at your own pace",
		icon: Map,
		accent: "text-muted-foreground",
		border: "border-border hover:border-muted-foreground/50",
		bg: "hover:bg-muted/30",
		iconBg: "bg-muted text-muted-foreground",
	},
];

const containerVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: { staggerChildren: 0.1, delayChildren: 0.2 },
	},
};

const cardVariants = {
	hidden: { opacity: 0, y: 20, scale: 0.97 },
	visible: {
		opacity: 1,
		y: 0,
		scale: 1,
		transition: { type: "spring", stiffness: 300, damping: 25 },
	},
};

export function WowRoutePicker({ onFullSetup }: WowRoutePickerProps) {
	const fetcher = useFetcher();

	function handlePick(path: WowPath | "full_setup") {
		if (path === "full_setup") {
			onFullSetup();
			return;
		}
		fetcher.submit({ _action: "set_wow_path", wow_path: path }, { method: "POST" });
	}

	return (
		<div className="flex min-h-full w-full items-center justify-center bg-background px-4 py-12">
			<div className="w-full max-w-2xl space-y-8">
				<motion.div
					initial={{ opacity: 0, y: -10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.4 }}
					className="text-center"
				>
					<h1 className="font-bold text-2xl tracking-tight sm:text-3xl">How do you want to start?</h1>
					<p className="mt-2 text-muted-foreground text-sm">
						Pick a path to your first "aha" moment. You can always explore everything later.
					</p>
				</motion.div>

				<motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid gap-4">
					{ROUTE_CARDS.map((card) => {
						const Icon = card.icon;
						return (
							<motion.button
								key={card.path}
								variants={cardVariants}
								type="button"
								onClick={() => handlePick(card.path)}
								disabled={fetcher.state !== "idle"}
								className={cn(
									"group relative flex items-center gap-4 rounded-xl border-2 p-5 text-left transition-all duration-200",
									card.border,
									card.bg,
									fetcher.state !== "idle" && "pointer-events-none opacity-60"
								)}
							>
								<div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-lg", card.iconBg)}>
									<Icon className="h-6 w-6" />
								</div>
								<div className="min-w-0 flex-1">
									<div className={cn("font-semibold text-base", card.accent)}>{card.label}</div>
									<p className="mt-0.5 text-muted-foreground text-sm leading-snug">{card.tagline}</p>
								</div>
								<ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-1 group-hover:text-muted-foreground" />
							</motion.button>
						);
					})}
				</motion.div>
			</div>
		</div>
	);
}
