/**
 * Sync status indicator for project setup
 *
 * Shows the current sync state with appropriate icons and colors.
 * Uses subtle styling to avoid distraction while providing feedback.
 */

import { Check, Cloud, CloudOff, Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";
import { useProjectSetup } from "../contexts/project-setup-context";
import type { SyncStatus } from "../stores/project-setup-store";

interface StatusConfig {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	className: string;
	iconClassName?: string;
}

const STATUS_CONFIG: Record<SyncStatus, StatusConfig> = {
	synced: {
		icon: Check,
		label: "Saved",
		className: "text-muted-foreground",
	},
	saving: {
		icon: Loader2,
		label: "Saving...",
		className: "text-muted-foreground",
		iconClassName: "animate-spin",
	},
	offline: {
		icon: CloudOff,
		label: "Offline",
		className: "text-amber-600 dark:text-amber-500",
	},
	error: {
		icon: Cloud,
		label: "Save failed",
		className: "text-destructive",
	},
};

interface SyncStatusIndicatorProps {
	className?: string;
	showLabel?: boolean;
}

/**
 * Displays the current sync status
 *
 * Shows:
 * - Check icon when synced
 * - Spinner when saving
 * - Warning icon when offline
 * - Error icon when save failed
 */
export function SyncStatusIndicator({ className, showLabel = true }: SyncStatusIndicatorProps) {
	const { syncStatus } = useProjectSetup();

	const config = STATUS_CONFIG[syncStatus];
	const Icon = config.icon;

	return (
		<div
			className={cn("inline-flex items-center gap-1.5 text-xs", config.className, className)}
			role="status"
			aria-live="polite"
		>
			<Icon className={cn("h-3.5 w-3.5", config.iconClassName)} aria-hidden="true" />
			{showLabel && <span>{config.label}</span>}
		</div>
	);
}

/**
 * Compact dot indicator for tight spaces
 * Shows only a colored dot that pulses when saving
 */
export function SyncStatusDot({ className }: { className?: string }) {
	const { syncStatus } = useProjectSetup();

	return (
		<div
			className={cn(
				"h-2 w-2 rounded-full transition-colors",
				syncStatus === "synced" && "bg-green-500",
				syncStatus === "saving" && "animate-pulse bg-blue-500",
				syncStatus === "offline" && "bg-amber-500",
				syncStatus === "error" && "bg-destructive",
				className
			)}
			role="status"
			aria-label={STATUS_CONFIG[syncStatus].label}
		/>
	);
}

/**
 * Extended indicator with last saved time
 */
export function SyncStatusWithTime({ className }: { className?: string }) {
	const { syncStatus, lastSyncedAt } = useProjectSetup();

	const config = STATUS_CONFIG[syncStatus];
	const Icon = config.icon;

	const formatTime = (date: Date | null) => {
		if (!date) return "";

		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffSec = Math.floor(diffMs / 1000);

		if (diffSec < 5) return "just now";
		if (diffSec < 60) return `${diffSec}s ago`;
		if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
		return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
	};

	return (
		<div
			className={cn("inline-flex items-center gap-2 text-xs", config.className, className)}
			role="status"
			aria-live="polite"
		>
			<Icon className={cn("h-3.5 w-3.5", config.iconClassName)} aria-hidden="true" />
			<span>{config.label}</span>
			{syncStatus === "synced" && lastSyncedAt && (
				<span className="text-muted-foreground/70">{formatTime(lastSyncedAt)}</span>
			)}
		</div>
	);
}
