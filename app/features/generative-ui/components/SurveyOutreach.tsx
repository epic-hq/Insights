/**
 * SurveyOutreach - Inline chat widget for survey distribution status.
 *
 * Shows survey link with copy-to-clipboard, recipient list with delivery
 * status indicators, optional message preview, and a funnel summary.
 * Designed for conversational context where the agent has just created
 * or updated a survey outreach campaign.
 */

import { Check, CircleAlert, Copy, ExternalLink, Mail, MailOpen, Send, UserPlus, XCircle } from "lucide-react";
import { useCallback, useState } from "react";
import { Link } from "react-router";
import { cn } from "~/lib/utils";

export interface SurveyOutreachData {
	surveyId: string;
	surveyName: string;
	publicUrl: string;
	recipients?: Array<{
		email: string;
		name?: string;
		status?: "pending" | "sent" | "opened" | "completed" | "bounced";
	}>;
	messagePreview?: string;
	funnel?: {
		sent: number;
		opened: number;
		completed: number;
		bounced: number;
	};
	statusLine: string;
	editUrl?: string;
	addRecipientsUrl?: string;
}

interface SurveyOutreachProps {
	data: SurveyOutreachData;
	isStreaming?: boolean;
}

const RECIPIENT_STATUS = {
	completed: {
		icon: Check,
		dot: "bg-emerald-500 dark:bg-emerald-400",
		label: "Completed",
	},
	opened: {
		icon: MailOpen,
		dot: "bg-blue-500 dark:bg-blue-400",
		label: "Opened",
	},
	sent: {
		icon: Send,
		dot: "bg-sky-400 dark:bg-sky-500",
		label: "Sent",
	},
	pending: {
		icon: Mail,
		dot: "bg-muted-foreground/40",
		label: "Pending",
	},
	bounced: {
		icon: XCircle,
		dot: "bg-red-500 dark:bg-red-400",
		label: "Bounced",
	},
} as const;

function CopyButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard API not available
		}
	}, [text]);

	return (
		<button
			type="button"
			onClick={handleCopy}
			className={cn(
				"inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
				"border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
				copied &&
					"border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
			)}
		>
			{copied ? (
				<>
					<Check className="h-3 w-3" />
					<span>Copied!</span>
				</>
			) : (
				<>
					<Copy className="h-3 w-3" />
					<span>Copy</span>
				</>
			)}
		</button>
	);
}

export function SurveyOutreach({ data, isStreaming }: SurveyOutreachProps) {
	const recipients = data.recipients ?? [];
	const funnel = data.funnel;

	return (
		<div className={cn("overflow-hidden rounded-lg border bg-card", isStreaming && "animate-pulse")}>
			{/* Header */}
			<div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
				<div className="flex min-w-0 items-center gap-2">
					<Send className="h-4 w-4 shrink-0 text-muted-foreground" />
					<h3 className="truncate font-semibold text-sm">{data.surveyName}</h3>
				</div>
				{data.editUrl && (
					<Link
						to={data.editUrl}
						className="shrink-0 text-muted-foreground text-xs underline-offset-2 hover:text-foreground hover:underline"
					>
						Edit survey
					</Link>
				)}
			</div>

			{/* Public URL */}
			<div className="mx-4 mb-3 flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
				<ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
				<span className="min-w-0 flex-1 truncate text-muted-foreground text-xs">{data.publicUrl}</span>
				<CopyButton text={data.publicUrl} />
			</div>

			{/* Funnel stats */}
			{funnel && (
				<div className="mx-4 mb-3 flex items-center gap-3 text-muted-foreground text-xs">
					<span className="flex items-center gap-1">
						<span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400 dark:bg-sky-500" />
						{funnel.sent} sent
					</span>
					<span className="text-border">|</span>
					<span className="flex items-center gap-1">
						<span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500 dark:bg-blue-400" />
						{funnel.opened} opened
					</span>
					<span className="text-border">|</span>
					<span className="flex items-center gap-1">
						<span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
						{funnel.completed} completed
					</span>
					{funnel.bounced > 0 && (
						<>
							<span className="text-border">|</span>
							<span className="flex items-center gap-1 text-red-600 dark:text-red-400">
								<CircleAlert className="h-3 w-3" />
								{funnel.bounced} bounced
							</span>
						</>
					)}
				</div>
			)}

			{/* Recipients */}
			{recipients.length > 0 && (
				<div className="mx-4 mb-3">
					<p className="mb-1.5 font-medium text-[11px] text-muted-foreground uppercase tracking-wider">Recipients</p>
					<div className="space-y-1">
						{recipients.map((r) => {
							const status = RECIPIENT_STATUS[r.status ?? "pending"];
							return (
								<div
									key={r.email}
									className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/50"
								>
									<span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", status.dot)} title={status.label} />
									<span className="min-w-0 flex-1 truncate text-foreground">{r.name ?? r.email}</span>
									{r.name && <span className="hidden shrink-0 text-muted-foreground text-xs sm:inline">{r.email}</span>}
									<span className="shrink-0 text-[11px] text-muted-foreground">{status.label}</span>
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* Message preview */}
			{data.messagePreview && (
				<div className="mx-4 mb-3 rounded-md border border-dashed bg-muted/20 px-3 py-2.5">
					<p className="mb-1 font-medium text-[11px] text-muted-foreground uppercase tracking-wider">Message preview</p>
					<p className="whitespace-pre-wrap text-muted-foreground text-xs leading-relaxed">{data.messagePreview}</p>
				</div>
			)}

			{/* Footer */}
			<div className="border-t bg-muted/30 px-4 py-2.5">
				<p className="text-muted-foreground text-sm italic">{data.statusLine}</p>
				{data.addRecipientsUrl && (
					<Link
						to={data.addRecipientsUrl}
						className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground text-xs transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<UserPlus className="h-3.5 w-3.5" />
						Add more recipients
					</Link>
				)}
			</div>
		</div>
	);
}
