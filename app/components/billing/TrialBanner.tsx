/**
 * Trial Banner Component
 *
 * Shows trial countdown and upgrade CTA for users on trial plans.
 * Displays different messages based on days remaining.
 */

import { differenceInDays, formatDistanceToNow } from "date-fns";
import { Clock, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";

export interface TrialInfo {
	isOnTrial: boolean;
	planName: string;
	trialEnd: string | null;
	accountId: string;
}

interface TrialBannerProps {
	trial: TrialInfo;
}

export function TrialBanner({ trial }: TrialBannerProps) {
	const [dismissed, setDismissed] = useState(false);

	if (!trial.isOnTrial || !trial.trialEnd || dismissed) {
		return null;
	}

	const trialEndDate = new Date(trial.trialEnd);
	const now = new Date();
	const daysLeft = differenceInDays(trialEndDate, now);
	const isExpiringSoon = daysLeft <= 3;
	const isExpired = daysLeft < 0;

	if (isExpired) {
		return (
			<div className="border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950/50">
				<div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
					<div className="flex items-center gap-2 text-red-800 text-sm dark:text-red-200">
						<Clock className="h-4 w-4" />
						<span>
							Your <strong>{trial.planName}</strong> trial has ended. Upgrade to keep your features.
						</span>
					</div>
					<div className="flex items-center gap-2">
						<Button size="sm" asChild>
							<Link to={`/a/${trial.accountId}/billing`}>
								<Sparkles className="mr-2 h-4 w-4" />
								Upgrade Now
							</Link>
						</Button>
					</div>
				</div>
			</div>
		);
	}

	if (isExpiringSoon) {
		return (
			<div className="border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/50">
				<div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
					<div className="flex items-center gap-2 text-amber-800 text-sm dark:text-amber-200">
						<Clock className="h-4 w-4" />
						<span>
							Your <strong>{trial.planName}</strong> trial ends{" "}
							<strong>{daysLeft === 0 ? "today" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`}</strong>. Upgrade
							to keep all features.
						</span>
					</div>
					<div className="flex items-center gap-2">
						<Button size="sm" asChild>
							<Link to={`/a/${trial.accountId}/billing`}>
								<Sparkles className="mr-2 h-4 w-4" />
								Upgrade Now
							</Link>
						</Button>
						<button
							type="button"
							onClick={() => setDismissed(true)}
							className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
						>
							<X className="h-4 w-4" />
						</button>
					</div>
				</div>
			</div>
		);
	}

	// Normal trial state - subtle, centered banner
	return (
		<div className="bg-blue-50/80 px-4 py-1.5 dark:bg-blue-950/30">
			<div className="relative mx-auto flex max-w-7xl items-center justify-center gap-1.5 text-blue-700 text-xs dark:text-blue-300">
				<Sparkles className="h-3 w-3" />
				<span>
					<strong>{trial.planName}</strong> trial &middot; {formatDistanceToNow(trialEndDate, { addSuffix: false })}{" "}
					left
				</span>
				<span className="mx-1">&middot;</span>
				<Link
					to={`/a/${trial.accountId}/billing`}
					className="font-medium underline underline-offset-2 hover:text-blue-900 dark:hover:text-blue-100"
				>
					View Plans
				</Link>
				<button
					type="button"
					onClick={() => setDismissed(true)}
					className="absolute right-0 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200"
				>
					<X className="h-3.5 w-3.5" />
				</button>
			</div>
		</div>
	);
}
