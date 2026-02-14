import consola from "consola";
import { data, redirect, useLoaderData } from "react-router";
import { Button } from "~/components/ui/button";
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/client.server";

interface InviteItem {
	account_id: string;
	account_name: string | null;
	account_role: string;
	invitation_type: string;
	created_at: string;
	token: string;
}

export async function loader({ request }: { request: Request }) {
	// Require auth
	const { user } = await getAuthenticatedUser(request);
	if (!user) {
		const next = "/invites";
		throw redirect(`/login?next=${encodeURIComponent(next)}`);
	}

	const { client: supabase, headers } = getServerClient(request);

	const { data: raw, error } = await supabase.rpc("list_invitations_for_current_user");

	if (error) {
		consola.error("[INVITES] Failed to list invitations:", error);
		return data({ ok: false, error: error.message, invites: [] as InviteItem[] }, { headers, status: 500 });
	}

	let invites: InviteItem[] = [];
	try {
		invites = Array.isArray(raw) ? (raw as InviteItem[]) : JSON.parse(String(raw || "[]"));
	} catch {
		// If parsing fails, keep as empty
		invites = [];
	}

	return data({ ok: true, invites }, { headers });
}

export default function InvitesPage() {
	const { invites } = useLoaderData() as { ok: boolean; invites: InviteItem[] };

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
			<div className="container mx-auto max-w-3xl py-10">
				<div className="mb-8 text-center">
					<h1 className="font-bold text-2xl text-slate-900 dark:text-slate-100">Your Invitations</h1>
					<p className="mt-2 text-slate-600 dark:text-slate-400">Accept invitations that were sent to your email.</p>
				</div>

				{invites.length === 0 ? (
					<div className="rounded-xl border bg-white/80 p-8 text-center dark:bg-slate-900/80">
						<p className="text-slate-600 dark:text-slate-400">No invitations found for your email.</p>
						<p className="mt-2 text-slate-500 text-sm dark:text-slate-500">
							Ask your teammate to resend an invite if you believe this is a mistake.
						</p>
					</div>
				) : (
					<div className="space-y-4">
						{invites.map((inv) => (
							<div
								key={`${inv.account_id}-${inv.token}`}
								className="rounded-xl border bg-white/80 p-4 dark:bg-slate-900/80"
							>
								<div className="flex items-center justify-between gap-4">
									<div>
										<div className="font-medium text-slate-900 dark:text-slate-100">
											{inv.account_name || "Untitled team"}
										</div>
										<div className="text-slate-500 text-sm dark:text-slate-400">
											Role: {inv.account_role} • Type: {inv.invitation_type}
										</div>
									</div>
									<div className="flex items-center gap-2">
										<a href={`/accept-invite?invite_token=${encodeURIComponent(inv.token)}`}>
											<Button>Accept</Button>
										</a>
										<button
											className="text-slate-500 text-xs underline hover:text-slate-700"
											onClick={() =>
												navigator.clipboard.writeText(
													`${window.location.origin}/accept-invite?invite_token=${encodeURIComponent(inv.token)}`
												)
											}
										>
											Copy link
										</button>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
