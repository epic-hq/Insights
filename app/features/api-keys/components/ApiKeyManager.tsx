/**
 * API Key management panel for project settings.
 * Allows generating, viewing, copying, and revoking API keys.
 * Keys are used to authenticate MCP server connections (Claude Desktop, Cursor, etc.)
 */

import { Check, Copy, Key, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { useFetcher } from "react-router";
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
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApiKeyRecord {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
}

interface CreateResponse {
  ok: boolean;
  rawKey?: string;
  record?: ApiKeyRecord;
  error?: string;
}

interface RevokeResponse {
  ok: boolean;
  error?: string;
}

interface ApiKeyManagerProps {
  projectPath: string;
  initialKeys: ApiKeyRecord[];
}

// ---------------------------------------------------------------------------
// Copy Button
// ---------------------------------------------------------------------------

function CopyButton({ text, label }: { text: string; label?: string }) {
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
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="gap-1.5"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {label ?? (copied ? "Copied!" : "Copy")}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ApiKeyManager({
  projectPath,
  initialKeys,
}: ApiKeyManagerProps) {
  const formId = useId();
  const createFetcher = useFetcher<CreateResponse>();
  const revokeFetcher = useFetcher<RevokeResponse>();

  const [keys, setKeys] = useState<ApiKeyRecord[]>(initialKeys);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRecord | null>(null);

  const apiRoute = `${projectPath}/api/api-keys`;
  const isCreating = createFetcher.state !== "idle";
  const isRevoking = revokeFetcher.state !== "idle";

  // Handle create response
  useEffect(() => {
    const data = createFetcher.data;
    if (data?.ok && data.rawKey && data.record) {
      setCreatedRawKey(data.rawKey);
      setKeys((prev) => [data.record as ApiKeyRecord, ...prev]);
      setNewKeyName("");
    }
  }, [createFetcher.data]);

  const handleCreate = useCallback(() => {
    if (!newKeyName.trim()) return;
    createFetcher.submit(
      { intent: "create", name: newKeyName.trim() },
      { method: "POST", action: apiRoute, encType: "application/json" },
    );
  }, [newKeyName, createFetcher, apiRoute]);

  const handleRevoke = useCallback(
    (key: ApiKeyRecord) => {
      // Optimistically remove from list immediately
      setKeys((prev) => prev.filter((k) => k.id !== key.id));
      setRevokeTarget(null);
      revokeFetcher.submit(
        { intent: "revoke", keyId: key.id },
        { method: "POST", action: apiRoute, encType: "application/json" },
      );
    },
    [revokeFetcher, apiRoute],
  );

  const formatDate = (iso: string | null) => {
    if (!iso) return "Never";
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Keys
          </CardTitle>
          <CardDescription>
            Connect AI agents (Claude Desktop, Cursor, etc.) to this project via
            MCP.
          </CardDescription>
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreateDialog(true)}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Generate Key
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {keys.length === 0 ? (
          <p className="py-4 text-center text-muted-foreground text-sm">
            No API keys yet. Generate one to connect an AI agent.
          </p>
        ) : (
          keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{key.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {key.scopes.join(", ")}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground text-xs">
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    {key.key_prefix}...
                  </code>
                  <span>Created {formatDate(key.created_at)}</span>
                  <span>Last used {formatDate(key.last_used_at)}</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRevokeTarget(key)}
                disabled={isRevoking}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}

        {/* MCP Config Hint */}
        {keys.length > 0 && (
          <div className="mt-4 rounded-lg bg-muted/50 p-3 text-muted-foreground text-xs">
            <p className="mb-1 font-medium">Claude Desktop / Cursor config:</p>
            <pre className="overflow-x-auto whitespace-pre">
              {`{
  "mcpServers": {
    "upsight": {
      "url": "https://getupsight.com/mcp",
      "headers": {
        "Authorization": "Bearer your_key_here"
      }
    }
  }
}`}
            </pre>
          </div>
        )}
      </CardContent>

      {/* Create Dialog */}
      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setCreatedRawKey(null);
            setNewKeyName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate API Key</DialogTitle>
            <DialogDescription>
              Create a key to connect an AI agent to this project. The key will
              only be shown once.
            </DialogDescription>
          </DialogHeader>

          {createdRawKey ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950">
                <p className="mb-2 font-medium text-emerald-800 text-sm dark:text-emerald-200">
                  Key created! Copy it now — it won't be shown again.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all rounded border bg-white px-2 py-1.5 font-mono text-xs dark:bg-black">
                    {createdRawKey}
                  </code>
                  <CopyButton text={createdRawKey} />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    setShowCreateDialog(false);
                    setCreatedRawKey(null);
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor={`${formId}-name`}>Key Name</Label>
                <Input
                  id={`${formId}-name`}
                  placeholder="e.g., Claude Desktop, Cursor, My Agent"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                  }}
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!newKeyName.trim() || isCreating}
                >
                  {isCreating && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Generate
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation */}
      <AlertDialog
        open={!!revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately disconnect any AI agents using the key{" "}
              <strong>{revokeTarget?.name}</strong> ({revokeTarget?.key_prefix}
              ...). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revokeTarget && handleRevoke(revokeTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
