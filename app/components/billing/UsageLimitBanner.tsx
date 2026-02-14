/**
 * Usage Limit Banner
 *
 * Shows a warning when account usage approaches plan limits (80%+).
 * Dismissible per-session. Follows TrialBanner patterns.
 */

import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

export interface UsageLimitInfo {
  isApproaching: boolean;
  limitName: string;
  currentUsage: number;
  limit: number;
  percentUsed: number;
  accountId: string;
}

interface UsageLimitBannerProps {
  usage: UsageLimitInfo;
}

export function UsageLimitBanner({ usage }: UsageLimitBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!usage.isApproaching || dismissed) {
    return null;
  }

  const remaining = usage.limit - usage.currentUsage;

  return (
    <div className="border-amber-200 bg-amber-50 px-4 py-2.5 dark:border-amber-800 dark:bg-amber-950/50">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-amber-800 text-sm dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            You've used <strong>{usage.percentUsed}%</strong> of your monthly{" "}
            {usage.limitName} limit ({usage.currentUsage}/{usage.limit}).{" "}
            {remaining > 0 ? `${remaining} remaining.` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/a/${usage.accountId}/billing`}
            className="whitespace-nowrap rounded-md bg-amber-600 px-3 py-1 font-medium text-sm text-white hover:bg-amber-700"
          >
            View Plans
          </Link>
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
