/**
 * IntakeBatchStatus Gen-UI Widget
 *
 * Shows the processing status of a batch of intake items (uploads, recordings,
 * surveys, imports). Each item displays its status with an icon, title, and
 * optional result summary. A footer shows an editorial status line, signal
 * gate assessment, and CTA to upload more.
 */

import type { LucideIcon } from "lucide-react";
import { CheckCircle, Clock, ExternalLink, Loader2, Upload, XCircle } from "lucide-react";
import { Link } from "react-router";
import { cn } from "~/lib/utils";

export interface IntakeBatchStatusData {
	projectId: string;
	items: Array<{
		id: string;
		title: string;
		source: "upload" | "recording" | "survey" | "import";
		status: "queued" | "processing" | "ready" | "failed";
		resultSummary?: string;
		detailUrl?: string;
	}>;
	summary: {
		total: number;
		ready: number;
		processing: number;
		failed: number;
	};
	statusLine: string;
	signalGate?: {
		sufficient: boolean;
		message: string;
	};
	uploadMoreUrl?: string;
}

const STATUS_CONFIG: Record<string, { icon: LucideIcon; className: string; spin?: boolean }> = {
	ready: {
		icon: CheckCircle,
		className: "text-emerald-500 dark:text-emerald-400",
	},
	processing: {
		icon: Loader2,
		className: "text-primary",
		spin: true,
	},
	queued: {
		icon: Clock,
		className: "text-muted-foreground",
	},
	failed: {
		icon: XCircle,
		className: "text-red-500 dark:text-red-400",
	},
};

const SOURCE_LABELS: Record<string, string> = {
	upload: "Upload",
	recording: "Recording",
	survey: "Survey",
	import: "Import",
};

export function IntakeBatchStatus({ data, isStreaming }: { data: IntakeBatchStatusData; isStreaming?: boolean }) {
	const items = data.items ?? [];
	const summary = data.summary ?? {
		total: 0,
		ready: 0,
		processing: 0,
		failed: 0,
	};

	return (
		<div className={cn("overflow-hidden rounded-lg border bg-card", isStreaming && "animate-pulse")}>
			{/* Header */}
			<div className="flex items-center justify-between border-b bg-muted/50 px-4 py-3">
				<div className="flex items-center gap-2">
					<Upload className="h-4 w-4 text-primary" />
					<h4 className="font-semibold text-xs uppercase tracking-wide">Intake Status</h4>
				</div>
				<span
					className={cn(
						"rounded-full px-2 py-0.5 font-medium text-[11px]",
						summary.ready === summary.total && summary.total > 0
							? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
							: "bg-muted text-muted-foreground"
					)}
				>
					{summary.ready} of {summary.total} ready
				</span>
			</div>

			{/* Items list */}
			{items.length > 0 && (
				<div className="divide-y">
					{items.map((item) => {
						const config = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.queued;
						const StatusIcon = config.icon;

						return (
							<div key={item.id} className="flex items-start gap-3 px-4 py-2.5">
								<StatusIcon
									className={cn("mt-0.5 h-4 w-4 shrink-0", config.className, config.spin && "animate-spin")}
								/>
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<p className="truncate font-medium text-sm">{item.title}</p>
										<span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
											{SOURCE_LABELS[item.source] ?? item.source}
										</span>
									</div>
									{item.resultSummary && <p className="mt-0.5 text-muted-foreground text-xs">{item.resultSummary}</p>}
								</div>
								{item.detailUrl && item.status === "ready" && (
									<Link
										to={item.detailUrl}
										className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
									>
										<ExternalLink className="h-3.5 w-3.5" />
									</Link>
								)}
							</div>
						);
					})}
				</div>
			)}

			{/* Empty state */}
			{items.length === 0 && !isStreaming && (
				<div className="px-4 py-6 text-center">
					<p className="text-muted-foreground text-sm">No items in this batch yet.</p>
				</div>
			)}

			{/* Footer */}
			{(data.statusLine || data.signalGate || data.uploadMoreUrl) && (
				<div className="border-t bg-muted/30 px-4 py-3">
					{/* Status line */}
					{data.statusLine && <p className="text-muted-foreground text-sm italic">{data.statusLine}</p>}

					{/* Signal gate */}
					{data.signalGate && (
						<p
							className={cn(
								"mt-1.5 font-medium text-xs",
								data.signalGate.sufficient
									? "text-emerald-600 dark:text-emerald-400"
									: "text-amber-600 dark:text-amber-400"
							)}
						>
							{data.signalGate.message}
						</p>
					)}

					{/* Upload more CTA */}
					{data.uploadMoreUrl && (
						<Link
							to={data.uploadMoreUrl}
							className="mt-2 inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 font-medium text-foreground text-xs transition-colors hover:bg-muted"
						>
							<Upload className="h-3 w-3" />
							Upload more
						</Link>
					)}
				</div>
			)}
		</div>
	);
}
