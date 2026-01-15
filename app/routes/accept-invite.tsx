import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import consola from "consola";
import { useState } from "react";
import { type LoaderFunctionArgs, redirect } from "react-router";
import { Link, useLoaderData, useNavigate } from "react-router-dom";
import { Logo } from "~/components/branding";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "~/components/ui/card";
import { acceptInvitation, lookupInvitation } from "~/features/teams/db";
import { getServerClient } from "~/lib/supabase/client.server";

type LoaderData =
  | {
      status: "success";
      accountId: string;
      accountName: string;
      accountSlug: string | null;
      accountRole: string;
      destination: string;
    }
  | {
      status: "error";
      error: string;
    }
  | {
      status: "already_member";
      accountId: string;
      accountName: string;
      accountSlug: string | null;
      destination: string;
    };

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const token =
    url.searchParams.get("invite_token") ||
    url.searchParams.get("token") ||
    null;
  const redirectTo = url.searchParams.get("redirect") || null;

  consola.log(
    "[ACCEPT INVITE] Received request with token:",
    token ? "present" : "missing",
    "redirect:",
    redirectTo,
  );

  const { client: supabase, headers: supabaseHeaders } =
    getServerClient(request);

  // Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If no user, redirect to login
  if (!user) {
    let next = "/accept-invite";
    if (token) {
      next = `/accept-invite?invite_token=${encodeURIComponent(token)}`;
      if (redirectTo) {
        next += `&redirect=${encodeURIComponent(redirectTo)}`;
      }
    }
    consola.log(
      "[ACCEPT INVITE] User not authenticated, redirecting to login with next:",
      next,
    );
    return redirect(`/login?next=${encodeURIComponent(next)}`, {
      headers: supabaseHeaders,
    });
  }

  consola.log(
    "[ACCEPT INVITE] User authenticated:",
    user.email,
    "proceeding with token:",
    token,
  );

  if (!token) {
    consola.warn("[ACCEPT INVITE] No invitation token found");
    return {
      status: "error",
      error: "No invitation token provided",
    } satisfies LoaderData;
  }

  // Lookup invitation first to get account details
  const { data: lookup, error: lookupError } = await lookupInvitation({
    supabase,
    lookup_invitation_token: token,
  });

  if (lookupError) {
    consola.error("[ACCEPT INVITE] lookup_invitation error:", lookupError);
    return {
      status: "error",
      error: "Failed to lookup invitation",
    } satisfies LoaderData;
  }

  const lookupData = lookup as {
    active?: boolean;
    account_name?: string;
    account_id?: string;
    account_role?: string;
  } | null;

  if (!lookupData?.active) {
    consola.warn("[ACCEPT INVITE] Invitation inactive or expired");
    return {
      status: "error",
      error: "This invitation has expired or is no longer valid",
    } satisfies LoaderData;
  }

  // Accept the invitation
  const { data: accepted, error: acceptError } = await acceptInvitation({
    supabase,
    lookup_invitation_token: token,
  });

  const acceptedData = accepted as {
    account_id?: string;
    account_role?: string;
    slug?: string;
  } | null;

  // Determine destination
  let destination = "/home";
  if (acceptedData?.slug) {
    destination = `/a/${acceptedData.slug}`;
  } else if (acceptedData?.account_id) {
    destination = `/a/${acceptedData.account_id}`;
  }

  // Override with explicit redirect if provided
  if (redirectTo && redirectTo.startsWith("/")) {
    destination = redirectTo;
  }

  if (acceptError) {
    const msg = acceptError.message || "";
    consola.warn("[ACCEPT INVITE] accept_invitation error:", msg);

    // If already a member, show that state
    if (msg.includes("already a member")) {
      return {
        status: "already_member",
        accountId: lookupData?.account_id ?? "",
        accountName: lookupData?.account_name ?? "the team",
        accountSlug: acceptedData?.slug ?? null,
        destination,
      } satisfies LoaderData;
    }

    return {
      status: "error",
      error: msg || "Failed to accept invitation",
    } satisfies LoaderData;
  }

  return {
    status: "success",
    accountId: acceptedData?.account_id ?? "",
    accountName: lookupData?.account_name ?? "the team",
    accountSlug: acceptedData?.slug ?? null,
    accountRole: acceptedData?.account_role ?? "member",
    destination,
  } satisfies LoaderData;
}

export default function AcceptInvite() {
  const data = useLoaderData<LoaderData>();
  const navigate = useNavigate();
  const [isNavigating, setIsNavigating] = useState(false);

  const handleContinue = () => {
    if (data.status === "success" || data.status === "already_member") {
      setIsNavigating(true);
      navigate(data.destination);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md border-white/10 bg-white/5 text-white shadow-2xl backdrop-blur">
        <CardHeader className="flex flex-col items-center gap-4 pb-2">
          <Logo size={10} />
        </CardHeader>

        <CardContent className="space-y-4 text-center">
          {data.status === "success" && (
            <>
              <div className="flex justify-center">
                <div className="rounded-full bg-emerald-500/20 p-3">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
              </div>
              <div>
                <h1 className="font-semibold text-xl">Welcome to the Team!</h1>
                <p className="mt-2 text-white/70">
                  You&apos;ve joined{" "}
                  <span className="font-medium text-white">
                    {data.accountName}
                  </span>{" "}
                  as a {data.accountRole}.
                </p>
              </div>
            </>
          )}

          {data.status === "already_member" && (
            <>
              <div className="flex justify-center">
                <div className="rounded-full bg-blue-500/20 p-3">
                  <CheckCircle2 className="h-8 w-8 text-blue-400" />
                </div>
              </div>
              <div>
                <h1 className="font-semibold text-xl">Already a Member</h1>
                <p className="mt-2 text-white/70">
                  You&apos;re already part of{" "}
                  <span className="font-medium text-white">
                    {data.accountName}
                  </span>
                  .
                </p>
              </div>
            </>
          )}

          {data.status === "error" && (
            <>
              <div className="flex justify-center">
                <div className="rounded-full bg-red-500/20 p-3">
                  <XCircle className="h-8 w-8 text-red-400" />
                </div>
              </div>
              <div>
                <h1 className="font-semibold text-xl">
                  Unable to Accept Invitation
                </h1>
                <p className="mt-2 text-white/70">{data.error}</p>
              </div>
            </>
          )}
        </CardContent>

        <CardFooter className="flex justify-center gap-3 pt-2">
          {(data.status === "success" || data.status === "already_member") && (
            <Button
              onClick={handleContinue}
              disabled={isNavigating}
              className="min-w-32"
            >
              {isNavigating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                "Continue to Dashboard"
              )}
            </Button>
          )}

          {data.status === "error" && (
            <Button asChild variant="secondary">
              <Link to="/home">Go to Home</Link>
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
