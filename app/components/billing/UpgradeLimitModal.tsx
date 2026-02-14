/**
 * Upgrade Limit Modal
 *
 * Shown when account hits 100% of a plan limit.
 * Prevents action and prompts upgrade.
 */

import { AlertTriangle, Sparkles } from "lucide-react";
import { Link } from "react-router";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";

export interface LimitExceededInfo {
  isExceeded: boolean;
  limitName: string;
  currentUsage: number;
  limit: number;
  accountId: string;
  requiredPlan?: string;
}

interface UpgradeLimitModalProps {
  info: LimitExceededInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpgradeLimitModal({
  info,
  open,
  onOpenChange,
}: UpgradeLimitModalProps) {
  if (!info.isExceeded) {
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <AlertDialogTitle className="text-center">
            {info.limitName} Limit Reached
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            You've used {info.currentUsage} of {info.limit}{" "}
            {info.limitName.toLowerCase()} this month. Upgrade your plan to
            continue.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center">
          <AlertDialogCancel>Maybe Later</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Link to={`/a/${info.accountId}/billing`}>
              <Sparkles className="mr-2 h-4 w-4" />
              Upgrade Now
            </Link>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
