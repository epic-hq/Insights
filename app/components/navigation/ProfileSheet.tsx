/**
 * ProfileSheet - Mobile profile/settings bottom sheet
 *
 * Shows account switcher and user profile options in a bottom sheet.
 */

import { LogOut, Settings, User } from "lucide-react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { useAuth } from "~/contexts/AuthContext";
import { TeamSwitcher } from "./TeamSwitcher";

export interface ProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountSettingsHref: string;
}

export function ProfileSheet({
  open,
  onOpenChange,
  accountSettingsHref,
}: ProfileSheetProps) {
  const { user, signOut } = useAuth();

  function handleSignOut() {
    onOpenChange(false);
    signOut();
  }

  const userEmail = user?.email || "Unknown";
  const userName =
    user?.user_metadata?.full_name || user?.user_metadata?.name || userEmail;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[80vh] rounded-t-xl">
        <SheetHeader className="pb-4">
          <SheetTitle>Profile & Settings</SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
          {/* User Info */}
          <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-sm">{userName}</p>
              <p className="truncate text-muted-foreground text-xs">
                {userEmail}
              </p>
            </div>
          </div>

          {/* Team/Project Switcher */}
          <div>
            <p className="mb-2 px-1 font-medium text-muted-foreground text-xs uppercase tracking-wider">
              Switch Project
            </p>
            <div className="rounded-lg border p-2">
              <TeamSwitcher />
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Button
              variant="ghost"
              className="h-12 w-full justify-start gap-3"
              asChild
              onClick={() => onOpenChange(false)}
            >
              <Link to={accountSettingsHref}>
                <Settings className="h-5 w-5" />
                Account Settings
              </Link>
            </Button>

            <Button
              variant="ghost"
              className="h-12 w-full justify-start gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleSignOut}
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default ProfileSheet;
