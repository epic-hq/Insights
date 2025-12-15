import { Check, LinkIcon, Mail, Share2, UserPlus } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useFetcher } from "react-router-dom";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";

export type ShareableResourceType =
  | "interview"
  | "insight"
  | "evidence"
  | "lens"
  | "opportunity";

interface ResourceShareMenuProps {
  projectPath: string;
  accountId: string;
  resourceId: string;
  resourceName: string;
  resourceType: ShareableResourceType;
  align?: "start" | "center" | "end";
  buttonLabel?: string;
}

function buildRelativePath(
  resourceType: ShareableResourceType,
  resourceId: string,
  projectPath: string,
  routes: ReturnType<typeof useProjectRoutes>,
): string {
  switch (resourceType) {
    case "interview":
      return routes.interviews.detail(resourceId);
    case "insight":
      return routes.insights.detail(resourceId);
    case "evidence":
      return routes.evidence.detail(resourceId);
    case "lens":
      return routes.lenses.byTemplateKey(resourceId);
    case "opportunity":
      return routes.opportunities.detail(resourceId);
    default:
      return `${projectPath}`;
  }
}

function toShareUrl(relativePath: string): string {
  if (typeof window === "undefined") return relativePath;
  const origin = window.location.origin || "";
  return `${origin}${relativePath}`;
}

export function ResourceShareMenu({
  projectPath,
  accountId,
  resourceId,
  resourceName,
  resourceType,
  align = "end",
  buttonLabel = "Share",
}: ResourceShareMenuProps) {
  const routes = useProjectRoutes(projectPath);
  const fetcher = useFetcher<{ ok?: boolean; error?: string }>();
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const relativePath = useMemo(
    () => buildRelativePath(resourceType, resourceId, projectPath, routes),
    [projectPath, resourceId, resourceType, routes],
  );
  const shareUrl = useMemo(() => toShareUrl(relativePath), [relativePath]);
  const isSubmitting = fetcher.state === "submitting";

  useEffect(() => {
    if (fetcher.data?.ok) {
      setEmail("");
      setNote("");
      setOpen(false);
    }
  }, [fetcher.data]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      // noop: clipboard may be blocked; leave silent to avoid console noise
    }
  };

  const handleSend = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) return;

    const formData = new FormData(event.currentTarget);
    formData.set("resourceLink", shareUrl);
    formData.set("resourceName", resourceName);
    formData.set("resourceType", resourceType);
    formData.set("accountId", accountId);

    fetcher.submit(formData, { method: "post", action: "/api/share-invite" });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Share2 className="h-4 w-4" />
          {buttonLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-52">
        <DropdownMenuItem
          onClick={handleCopy}
          className="flex items-center gap-2"
        >
          <LinkIcon className="h-4 w-4" />
          {copied ? "Link copied" : "Copy link"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setOpen(true)}
          className="flex items-center gap-2"
        >
          <UserPlus className="h-4 w-4" />
          Invite to team
        </DropdownMenuItem>
      </DropdownMenuContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite to team</DialogTitle>
            <DialogDescription>
              They'll join your team and be taken directly to this{" "}
              {resourceType}.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSend}>
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                name="targetEmail"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-note">Message (optional)</Label>
              <Textarea
                id="invite-note"
                name="note"
                placeholder={`Hi, check out this ${resourceType}!`}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
            <input type="hidden" name="projectPath" value={projectPath} />
            <input type="hidden" name="shareUrl" value={shareUrl} />
            <DialogFooter className="gap-2 sm:justify-between">
              <div className="text-muted-foreground text-xs">
                {fetcher.data?.ok && (
                  <span className="flex items-center gap-1 text-green-600">
                    <Check className="h-3 w-3" /> Invitation sent
                  </span>
                )}
                {fetcher.data?.error && (
                  <span className="text-destructive">{fetcher.data.error}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || !email.trim()}>
                  {isSubmitting ? "Sending..." : "Send invitation"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DropdownMenu>
  );
}
