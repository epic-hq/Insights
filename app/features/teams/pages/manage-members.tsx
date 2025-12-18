import { parseWithZod } from "@conform-to/zod";
import consola from "consola";
import { formatDistanceToNow } from "date-fns";
import {
  Check,
  Clock4,
  Copy,
  Info,
  LinkIcon,
  RefreshCw,
  ShieldOff,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { data, useLoaderData, useNavigation } from "react-router";
import { useSubmit } from "react-router-dom";
import { z } from "zod";
import { PageContainer } from "~/components/layout/PageContainer";
import { Alert, AlertDescription } from "~/components/ui/alert";
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
  type PermissionLevel,
  TeamInvite,
  type TeamMember,
} from "~/components/ui/team-invite";
import { getPostHogServerClient } from "~/lib/posthog.server";
// import { sendEmail } from "~/emails/clients.server"
import {
  getAuthenticatedUser,
  getServerClient,
} from "~/lib/supabase/client.server";
import { PATHS } from "~/paths";
import type { GetAccountInvitesResponse } from "~/types-accounts";
import InvitationEmail from "../../../../emails/team-invitation";
import {
  getAccount as dbGetAccount,
  getAccountMembers as dbGetAccountMembers,
  updateAccountUserRole as dbUpdateAccountUserRole,
} from "../db/accounts";
import {
  acceptInvitation as dbAcceptInvitation,
  createInvitation as dbCreateInvitation,
  deleteInvitation as dbDeleteInvitation,
  getAccountInvitations as dbGetAccountInvitations,
  lookupInvitation as dbLookupInvitation,
} from "../db/invitations";

type MembersRow = {
  user_id: string;
  name: string;
  email: string;
  account_role: "owner" | "member" | "viewer";
  is_primary_owner: boolean;
};

type InvitationAcceptanceState = {
  status: "idle" | "accepted" | "inactive" | "error";
  message?: string;
};

type LoaderData = {
  account: {
    account_id: string;
    name: string | null;
    personal_account: boolean;
    account_role: "owner" | "member" | "viewer";
  } | null;
  members: MembersRow[];
  invitations: GetAccountInvitesResponse;
  inviteAcceptance: InvitationAcceptanceState;
  activeShareLinks: ActiveShareLink[];
};

type ShareLinkRow = {
  id: string;
  title: string | null;
  share_token: string | null;
  share_expires_at: string | null;
  share_created_at: string | null;
  project_id: string;
};

type ActiveShareLink = {
  interviewId: string;
  title: string | null;
  shareToken: string;
  shareExpiresAt: string | null;
  shareCreatedAt: string | null;
  projectId: string;
};
export async function loader({ request, params }: LoaderFunctionArgs) {
  const { client } = getServerClient(request);
  const { user } = await getAuthenticatedUser(request);
  if (!user) throw new Response("Unauthorized", { status: 401 });

  const accountId = params.accountId as string | undefined;
  if (!accountId) throw new Response("Missing accountId", { status: 400 });

  const url = new URL(request.url);
  const inviteToken = url.searchParams.get("invite_token")?.trim() || null;
  let inviteAcceptance: InvitationAcceptanceState = { status: "idle" };

  if (inviteToken) {
    const { data: lookupData, error: lookupError } = await dbLookupInvitation({
      supabase: client,
      lookup_invitation_token: inviteToken,
    });
    if (lookupError) {
      inviteAcceptance = {
        status: "error",
        message: lookupError.message || "We couldn't validate this invitation.",
      };
    } else {
      const lookup = (lookupData as Record<string, unknown> | null) ?? null;
      const lookupAccountId =
        (lookup?.account_id as string | undefined) ?? null;
      const isActive = Boolean(lookup?.active);

      if (!lookupAccountId || lookupAccountId !== accountId) {
        inviteAcceptance = {
          status: "error",
          message: "This invitation doesn't match the selected team.",
        };
      } else if (!isActive) {
        inviteAcceptance = {
          status: "inactive",
          message: "This invitation has already been used or has expired.",
        };
      } else {
        const { error: acceptError } = await dbAcceptInvitation({
          supabase: client,
          lookup_invitation_token: inviteToken,
        });
        if (acceptError) {
          inviteAcceptance = {
            status: "error",
            message:
              acceptError.message || "We couldn't accept this invitation.",
          };
        } else {
          inviteAcceptance = {
            status: "accepted",
            message: "Invitation accepted. You're now on this team.",
          };

          // Capture invite_accepted event
          try {
            const inviterUserId =
              (lookup?.inviter_user_id as string | undefined) ?? null;
            const role =
              (lookup?.account_role as
                | "owner"
                | "member"
                | "viewer"
                | undefined) ?? "member";

            const posthogServer = getPostHogServerClient();
            if (posthogServer) {
              posthogServer.capture({
                distinctId: user.sub,
                event: "invite_accepted",
                properties: {
                  account_id: accountId,
                  inviter_user_id: inviterUserId,
                  role,
                  $set: {
                    team_member: true,
                    last_team_joined_at: new Date().toISOString(),
                  },
                },
              });
            }
          } catch (trackingError) {
            consola.warn("[INVITE] PostHog tracking failed:", trackingError);
          }
        }
      }
    }
  }

  const { data: account, error: accountError } = await dbGetAccount({
    supabase: client,
    account_id: accountId,
  });
  if (accountError) throw new Response(accountError.message, { status: 500 });

  const normalizedAccount = account
    ? {
        account_id: accountId,
        name:
          ((account as Record<string, unknown>)?.name as
            | string
            | null
            | undefined) ?? null,
        personal_account: Boolean(
          (account as Record<string, unknown>)?.personal_account ??
          (account as Record<string, unknown>)?.personalAccount,
        ),
        account_role: ((account as Record<string, unknown>)?.account_role ??
          "viewer") as "owner" | "member" | "viewer",
      }
    : null;

  let members: MembersRow[] = [];
  let invitations: GetAccountInvitesResponse = [];

  // All team members can see the member list
  const { data: membersData, error: membersError } = await dbGetAccountMembers({
    supabase: client,
    account_id: accountId,
  });
  if (membersError) throw new Response(membersError.message, { status: 500 });
  members = (membersData as MembersRow[] | null) ?? [];

  // Only owners can see pending invitations
  if (normalizedAccount?.account_role === "owner") {
    const { data: invitationsData, error: invitationsError } =
      await dbGetAccountInvitations({
        supabase: client,
        account_id: accountId,
      });
    if (invitationsError)
      throw new Response(invitationsError.message, { status: 500 });
    invitations = (invitationsData as GetAccountInvitesResponse | null) ?? [];
  }

  // Active public share links (interviews with enabled, non-expired share tokens)
  const nowIso = new Date().toISOString();
  const { data: shareLinksData, error: shareLinksError } = await client
    .from("interviews")
    .select(
      "id, title, project_id, share_token, share_expires_at, share_created_at",
    )
    .eq("account_id", accountId)
    .eq("share_enabled", true)
    .not("share_token", "is", null)
    .or(`share_expires_at.is.null,share_expires_at.gt.${nowIso}`)
    .order("share_expires_at", { ascending: true, nullsFirst: true });

  if (shareLinksError) {
    throw new Response(shareLinksError.message, { status: 500 });
  }

  const activeShareLinks: ActiveShareLink[] = (
    (shareLinksData as ShareLinkRow[] | null) ?? []
  )
    .filter((row) => typeof row.share_token === "string")
    .map((row) => ({
      interviewId: row.id,
      title: row.title,
      shareToken: row.share_token as string,
      shareExpiresAt: row.share_expires_at,
      shareCreatedAt: row.share_created_at,
      projectId: row.project_id,
    }));

  const data: LoaderData = {
    account: normalizedAccount,
    members,
    invitations,
    inviteAcceptance,
    activeShareLinks,
  };
  return data;
}

// --- React Router Action ---
const InviteSchema = z.object({
  intent: z.literal("invite"),
  email: z.string().email(),
  permission: z.enum(["can-view", "can-edit", "admin"]),
});

const UpdateRoleSchema = z.object({
  intent: z.literal("updateRole"),
  memberId: z.string().uuid(),
  permission: z.enum(["can-view", "can-edit", "admin"]),
});

const DeleteInviteSchema = z.object({
  intent: z.literal("deleteInvite"),
  invitationId: z.string().uuid(),
});

const ResendInviteSchema = z.object({
  intent: z.literal("resendInvite"),
  email: z.string().email(),
  role: z.enum(["owner", "member", "viewer"]),
});

const RevokeShareLinkSchema = z.object({
  intent: z.literal("revokeShareLink"),
  interviewId: z.string().uuid(),
});

export async function action({ request, params }: ActionFunctionArgs) {
  const { client } = getServerClient(request);
  const { user } = await getAuthenticatedUser(request);
  if (!user) return new Response("Unauthorized", { status: 401 });
  const accountId = params.accountId as string | undefined;
  if (!accountId) return new Response("Missing accountId", { status: 400 });

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "invite") {
    const submission = parseWithZod(formData, { schema: InviteSchema });
    if (submission.status !== "success") {
      return data({ ok: false, errors: submission.error }, { status: 400 });
    }
    const { email, permission } = submission.value;
    const result = await dbCreateInvitation({
      supabase: client,
      account_id: accountId,
      account_role: mapPermissionToAccountRoleForRpc(permission),
      invitation_type: "one_time",
      invitee_email: email,
    });
    if (result.error)
      return data(
        { ok: false, message: result.error.message },
        { status: 500 },
      );
    const token =
      typeof (result.data as { token?: unknown } | null)?.token === "string"
        ? (result.data as { token: string }).token
        : undefined;

    // Attempt to send invitation email if we have both email and token
    if (email && token) {
      try {
        // Build absolute invite URL that preserves token through auth
        const host = PATHS.AUTH.HOST;
        const inviteUrl = `${host}/accept-invite?invite_token=${encodeURIComponent(token)}`;

        consola.info("[INVITE] Prepared invite", {
          accountId,
          to: email,
          inviteUrl,
          token,
        });

        // Optionally fetch account name for nicer subject
        let teamName = "your team";
        try {
          const { data: accountData } = await dbGetAccount({
            supabase: client,
            account_id: accountId,
          });
          if (
            accountData &&
            typeof accountData === "object" &&
            "name" in accountData &&
            typeof accountData.name === "string"
          ) {
            teamName = accountData.name;
          }
        } catch {}
        const { sendEmail } = await import("~/emails/clients.server");

        const sendResult = await sendEmail({
          to: email,
          subject: `You’re invited to join ${teamName} on Upsight`,
          send_intent: "transactional",
          reply_to: user.email ?? undefined,
          react: (
            <InvitationEmail
              appName="Upsight"
              inviterName={user.email || "A teammate"}
              teamName={teamName}
              inviteUrl={inviteUrl}
              inviteeEmail={email}
            />
          ),
        });
        consola.success("[INVITE] Email send attempted", {
          to: email,
          resultId: (sendResult as unknown as { id?: string })?.id,
        });
      } catch (err) {
        consola.error("[INVITE] Failed to send invitation email", {
          to: email,
          error: err,
        });
      }
    }

    // Capture invite_sent event
    try {
      const posthogServer = getPostHogServerClient();
      if (posthogServer) {
        posthogServer.capture({
          distinctId: user.sub,
          event: "invite_sent",
          properties: {
            account_id: accountId,
            invitee_email: email,
            role: mapPermissionToAccountRoleForRpc(permission),
            invitation_type: "one_time",
          },
        });
      }
    } catch (trackingError) {
      consola.warn("[INVITE] PostHog tracking failed:", trackingError);
    }

    return data({ ok: true, token, email });
  }

  if (intent === "updateRole") {
    const submission = parseWithZod(formData, { schema: UpdateRoleSchema });
    if (submission.status !== "success") {
      return data({ ok: false, errors: submission.error }, { status: 400 });
    }
    const { memberId, permission } = submission.value;
    const result = await dbUpdateAccountUserRole({
      supabase: client,
      account_id: accountId,
      user_id: memberId,
      role: mapPermissionToAccountRoleForRpc(permission),
    });
    if (result.error)
      return data(
        { ok: false, message: result.error.message },
        { status: 500 },
      );
    return data({ ok: true });
  }

  if (intent === "deleteInvite") {
    const submission = parseWithZod(formData, { schema: DeleteInviteSchema });
    if (submission.status !== "success") {
      return data({ ok: false, errors: submission.error }, { status: 400 });
    }
    const { invitationId } = submission.value;
    const result = await dbDeleteInvitation({
      supabase: client,
      invitation_id: invitationId,
    });
    if (result.error)
      return data(
        { ok: false, message: result.error.message },
        { status: 500 },
      );
    return data({ ok: true });
  }

  if (intent === "resendInvite") {
    const submission = parseWithZod(formData, { schema: ResendInviteSchema });
    if (submission.status !== "success") {
      return data({ ok: false, errors: submission.error }, { status: 400 });
    }
    const { email, role } = submission.value;

    // Get account name for the email
    let teamName = "your team";
    try {
      const { data: accountData } = await dbGetAccount({
        supabase: client,
        account_id: accountId,
      });
      if (
        accountData &&
        typeof accountData === "object" &&
        "name" in accountData &&
        typeof accountData.name === "string"
      ) {
        teamName = accountData.name;
      }
    } catch {}

    // Create a new invitation (replaces the old one since invitee_email is unique per account)
    const result = await dbCreateInvitation({
      supabase: client,
      account_id: accountId,
      account_role: role,
      invitation_type: "one_time",
      invitee_email: email,
    });
    if (result.error)
      return data(
        { ok: false, message: result.error.message },
        { status: 500 },
      );

    const token =
      typeof (result.data as { token?: unknown } | null)?.token === "string"
        ? (result.data as { token: string }).token
        : undefined;

    // Send the invitation email
    if (token) {
      try {
        const host = PATHS.AUTH.HOST;
        const inviteUrl = `${host}/accept-invite?invite_token=${encodeURIComponent(token)}`;
        const { sendEmail } = await import("~/emails/clients.server");

        await sendEmail({
          to: email,
          subject: `Reminder: You're invited to join ${teamName} on Upsight`,
          send_intent: "transactional",
          reply_to: user.email ?? undefined,
          react: (
            <InvitationEmail
              appName="Upsight"
              inviterName={user.email || "A teammate"}
              teamName={teamName}
              inviteUrl={inviteUrl}
              inviteeEmail={email}
            />
          ),
        });
        consola.success("[RESEND INVITE] Email sent", { to: email });
      } catch (err) {
        consola.error("[RESEND INVITE] Failed to send email", { error: err });
      }
    }

    return data({ ok: true, resent: true });
  }

  if (intent === "revokeShareLink") {
    const submission = parseWithZod(formData, {
      schema: RevokeShareLinkSchema,
    });
    if (submission.status !== "success") {
      return data({ ok: false, errors: submission.error }, { status: 400 });
    }
    const { interviewId } = submission.value;

    // Disable public sharing for this interview
    const { error: updateError } = await client
      .from("interviews")
      .update({ share_enabled: false })
      .eq("id", interviewId)
      .eq("account_id", accountId);

    if (updateError) {
      consola.error("[MANAGE TEAM] Failed to revoke share link", {
        interviewId,
        error: updateError,
      });
      return data({ ok: false, message: updateError.message }, { status: 500 });
    }

    consola.info("[MANAGE TEAM] Share link revoked", {
      interviewId,
      accountId,
    });
    return data({ ok: true, revoked: true });
  }

  return new Response("Bad Request", { status: 400 });
}
export default function ManageTeamMembers() {
  const { account, members, invitations, inviteAcceptance, activeShareLinks } =
    useLoaderData() as LoaderData;
  const submit = useSubmit();
  const navigation = useNavigation();

  const [localMembers, setLocalMembers] = useState<TeamMember[]>(() =>
    (members || []).map((m) => ({
      id: m.user_id,
      name: m.name,
      email: m.email,
      role: mapAccountRoleToPermission(m.account_role),
      isOwner: m.is_primary_owner,
    })),
  );

  const [localInvitations, setLocalInvitations] =
    useState<GetAccountInvitesResponse>(() => invitations);
  const [localShareLinks, setLocalShareLinks] = useState<ActiveShareLink[]>(
    () => activeShareLinks || [],
  );

  const [isRevokeOpen, setIsRevokeOpen] = useState(false);
  const [selectedInviteId, setSelectedInviteId] = useState<string | null>(null);
  const [selectedInviteEmail, setSelectedInviteEmail] = useState<string | null>(
    null,
  );
  const [shareLinkOrigin, setShareLinkOrigin] = useState(
    "https://getupsight.com",
  );
  const [copiedShareLinkId, setCopiedShareLinkId] = useState<string | null>(
    null,
  );

  // Keep local state in sync with loader data after automatic revalidation
  useEffect(() => {
    setLocalMembers(
      (members || []).map((m) => ({
        id: m.user_id,
        name: m.name,
        email: m.email,
        role: mapAccountRoleToPermission(m.account_role),
        isOwner: m.is_primary_owner,
      })),
    );
  }, [members]);

  useEffect(() => {
    setLocalInvitations(invitations);
  }, [invitations]);

  useEffect(() => {
    setLocalShareLinks(activeShareLinks || []);
  }, [activeShareLinks]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location?.origin) {
      setShareLinkOrigin(window.location.origin);
    }
  }, []);

  const canManage = account?.account_role === "owner";
  const teamName = getAccountDisplayName(account);
  const totalMembers = localMembers.length;

  const handleInvite = useCallback(
    async (email: string, permission: PermissionLevel) => {
      if (!account?.account_id) return;
      submit(
        { intent: "invite", email, permission },
        { method: "post", replace: true },
      );
    },
    [account?.account_id, submit],
  );

  const handleUpdateMemberPermission = useCallback(
    async (memberId: string, permission: PermissionLevel) => {
      if (!account?.account_id) return;
      setLocalMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: permission } : m)),
      );
      submit(
        { intent: "updateRole", memberId, permission },
        { method: "post", replace: true },
      );
      return null;
    },
    [account?.account_id, submit],
  );

  const handleDeleteInvitation = useCallback(
    async (invitationId: string) => {
      if (!account?.account_id) return;
      setLocalInvitations((prev) =>
        prev.filter((inv) => inv.invitation_id !== invitationId),
      );
      submit(
        { intent: "deleteInvite", invitationId },
        { method: "post", replace: true },
      );
      return null;
    },
    [account?.account_id, submit],
  );

  const [resendingEmail, setResendingEmail] = useState<string | null>(null);
  const [revokingShareLinkId, setRevokingShareLinkId] = useState<string | null>(
    null,
  );
  const shareLinksWithUrls = useMemo(
    () =>
      (localShareLinks || []).map((link) => ({
        ...link,
        publicUrl: `${shareLinkOrigin.replace(/\/$/, "")}/s/${link.shareToken}`,
      })),
    [localShareLinks, shareLinkOrigin],
  );

  const formatExpirationLabel = useCallback((expiresAt: string | null) => {
    if (!expiresAt) return "Never expires";
    const expiresDate = new Date(expiresAt);
    if (Number.isNaN(expiresDate.getTime())) return "Expiration unavailable";
    if (expiresDate.getTime() <= Date.now()) return "Expired";
    return `Expires ${formatDistanceToNow(expiresDate, { addSuffix: true })}`;
  }, []);

  const handleCopyShareLink = useCallback(
    async (url: string, linkId: string) => {
      try {
        await navigator.clipboard.writeText(url);
        setCopiedShareLinkId(linkId);
        setTimeout(() => {
          setCopiedShareLinkId((prev) => (prev === linkId ? null : prev));
        }, 1500);
      } catch (error) {
        consola.warn("[MANAGE TEAM] Failed to copy share link", { error });
      }
    },
    [],
  );

  const handleRevokeShareLink = useCallback(
    async (interviewId: string) => {
      if (!account?.account_id) return;
      setLocalShareLinks((prev) =>
        prev.filter((link) => link.interviewId !== interviewId),
      );
      setRevokingShareLinkId(interviewId);
      submit(
        { intent: "revokeShareLink", interviewId },
        { method: "post", replace: true },
      );
    },
    [account?.account_id, submit],
  );

  const handleResendInvitation = useCallback(
    async (email: string, role: string) => {
      if (!account?.account_id) return;
      setResendingEmail(email);
      submit(
        { intent: "resendInvite", email, role },
        { method: "post", replace: true },
      );
      // Clear resending state after a delay to show feedback
      setTimeout(() => setResendingEmail(null), 2000);
    },
    [account?.account_id, submit],
  );

  return (
    <PageContainer
      size="sm"
      padded={false}
      className="container max-w-3xl py-6"
    >
      <div className="mb-6 space-y-2">
        <h1 className="font-semibold text-2xl">Team Access</h1>
        <div className="space-y-1 text-muted-foreground text-sm">
          <p>
            {canManage
              ? "Manage access and invite collaborators for"
              : "Viewing members for"}{" "}
            <span className="font-medium text-foreground">{teamName}</span>
          </p>
          <p>
            Your role:{" "}
            <span className="font-medium text-foreground capitalize">
              {account?.account_role || "member"}
            </span>
            {!canManage && <span className="text-xs"> (view only)</span>}
          </p>
        </div>
        {inviteAcceptance.status !== "idle" && inviteAcceptance.message && (
          <div
            className={
              inviteAcceptance.status === "accepted"
                ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700 text-sm dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                : inviteAcceptance.status === "inactive"
                  ? "rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700 text-sm dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                  : "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-600 text-sm dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            }
          >
            {inviteAcceptance.message}
          </div>
        )}
        {localInvitations.length > 0 && (
          <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-amber-700 text-sm dark:bg-amber-950/40 dark:text-amber-300">
            You have {localInvitations.length} pending invitation
            {localInvitations.length === 1 ? "" : "s"}.
          </p>
        )}
      </div>

      {/* Explainer widget - what this page does */}
      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>How team access works:</strong> Inviting someone adds them to
          your entire account. They'll have access to all projects and resources
          based on their permission level.
          <span className="mt-1 block text-muted-foreground">
            Per-resource sharing (e.g., sharing a single interview) is coming
            soon.
          </span>
        </AlertDescription>
      </Alert>

      <TeamInvite
        teamName={teamName}
        totalMembers={totalMembers}
        members={localMembers}
        onInvite={canManage ? handleInvite : undefined}
        onUpdateMemberPermission={
          canManage ? handleUpdateMemberPermission : undefined
        }
      />

      {/* Active public share links */}
      <div className="mt-6 space-y-2">
        <div className="space-y-1">
          <h2 className="font-semibold text-lg">Active share links</h2>
          <p className="text-muted-foreground text-sm">
            Public interview links that are currently active. Anyone with the
            link can view the shared interview.
          </p>
        </div>
        {shareLinksWithUrls.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-2 text-muted-foreground text-sm">
            No active share links.
          </p>
        ) : (
          <ul className="space-y-2">
            {shareLinksWithUrls.map((link) => (
              <li
                key={link.shareToken}
                className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">
                      {link.title && link.title.trim().length > 0
                        ? link.title
                        : "Untitled interview"}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      Public
                    </Badge>
                  </div>
                  <p className="break-all font-mono text-muted-foreground text-xs">
                    {link.publicUrl}
                  </p>
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <Clock4 className="h-3 w-3" />
                    <span>{formatExpirationLabel(link.shareExpiresAt)}</span>
                    {link.shareExpiresAt && (
                      <span className="hidden sm:inline">
                        • {new Date(link.shareExpiresAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleCopyShareLink(link.publicUrl, link.shareToken)
                    }
                  >
                    {copiedShareLinkId === link.shareToken ? (
                      <>
                        <Check className="mr-1 h-4 w-4" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1 h-4 w-4" />
                        Copy link
                      </>
                    )}
                  </Button>
                  {canManage && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                      onClick={() => handleRevokeShareLink(link.interviewId)}
                      disabled={revokingShareLinkId === link.interviewId}
                    >
                      {revokingShareLinkId === link.interviewId ? (
                        <>
                          <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                          Revoking...
                        </>
                      ) : (
                        <>
                          <ShieldOff className="mr-1 h-3 w-3" />
                          Revoke
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {localInvitations.length > 0 && (
        <>
          <div className="mt-6">
            <h2 className="font-semibold text-lg">Pending invitations</h2>
            <ul className="mt-2 space-y-2">
              {localInvitations.map((inv, idx) => (
                <li
                  key={inv.invitation_id ?? idx}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <span className="text-sm">
                    {inv.email ? <strong>{inv.email}</strong> : "(no email)"} •
                    Role: {formatAccountRoleForDisplay(inv.account_role)}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">
                      {new Date(String(inv.created_at)).toLocaleString()}
                    </span>
                    {canManage && inv.email && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={resendingEmail === inv.email}
                        onClick={() => {
                          if (inv.email) {
                            handleResendInvitation(inv.email, inv.account_role);
                          }
                        }}
                      >
                        {resendingEmail === inv.email ? (
                          <>
                            <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          "Resend"
                        )}
                      </Button>
                    )}
                    {canManage && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                        onClick={() => {
                          setSelectedInviteId(inv.invitation_id);
                          setSelectedInviteEmail(inv.email ?? null);
                          setIsRevokeOpen(true);
                        }}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Revoke confirmation dialog */}
          <AlertDialog
            open={isRevokeOpen}
            onOpenChange={(open) => {
              setIsRevokeOpen(open);
              if (!open) {
                setSelectedInviteId(null);
                setSelectedInviteEmail(null);
              }
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Revoke invitation</AlertDialogTitle>
              </AlertDialogHeader>
              <AlertDialogDescription>
                {selectedInviteEmail ? (
                  <span>
                    Are you sure you want to revoke the invitation for{" "}
                    <strong>{selectedInviteEmail}</strong>?
                  </span>
                ) : (
                  <span>Are you sure you want to revoke this invitation?</span>
                )}
              </AlertDialogDescription>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={
                    navigation.state === "submitting" || !selectedInviteId
                  }
                  onClick={() => {
                    if (selectedInviteId) {
                      handleDeleteInvitation(selectedInviteId);
                      setIsRevokeOpen(false);
                      setSelectedInviteId(null);
                      setSelectedInviteEmail(null);
                    }
                  }}
                >
                  Revoke invitation
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </PageContainer>
  );
}

function mapAccountRoleToPermission(
  role: "owner" | "member" | "viewer",
): PermissionLevel {
  switch (role) {
    case "owner":
      return "admin";
    case "member":
      return "can-edit";
    default:
      return "can-view";
  }
}
// For RPCs that only accept 'owner' | 'member'
function mapPermissionToAccountRoleForRpc(
  permission: PermissionLevel,
): "owner" | "member" {
  switch (permission) {
    case "admin":
      return "owner";
    case "can-edit":
      return "member";
    default:
      return "member"; // fallback to member when 'viewer' is not supported in RPC type
  }
}

function formatAccountRoleForDisplay(
  role: "owner" | "member" | "viewer",
): string {
  const permission = mapAccountRoleToPermission(role);
  switch (permission) {
    case "admin":
      return "Admin";
    case "can-edit":
      return "Editor";
    default:
      return "Viewer";
  }
}

function getAccountDisplayName(account: LoaderData["account"]): string {
  if (!account) return "Team";
  const baseName = account.name?.trim();
  if (account.personal_account) {
    return baseName && baseName.length > 0
      ? `${baseName} (Personal)`
      : "Personal Workspace";
  }
  return baseName && baseName.length > 0 ? baseName : "Team";
}
