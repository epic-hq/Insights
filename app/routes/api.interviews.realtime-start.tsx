import consola from "consola";
import { format } from "date-fns";
import type { ActionFunctionArgs } from "react-router";
import { ensureInterviewInterviewerLink } from "~/features/people/services/internalPeople.server";
import { userContext } from "~/server/user-context";

export async function action({ request, context, params }: ActionFunctionArgs) {
	try {
		const ctx = context.get(userContext);
		const supabase = ctx.supabase;
		const accountId = ctx.account_id;
		const { projectId } = params;

		if (!projectId) {
			return new Response(JSON.stringify({ error: "Missing projectId in URL" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		const body = await request.json().catch(() => ({}));
		const now = new Date();
		const defaultTitle = format(now, "MMM-dd hh:mm a").replace(/\sAM|\sPM/, (m) => m.toLowerCase());
		const title = typeof body?.title === "string" && body.title.trim().length > 0 ? body.title.trim() : defaultTitle;

		const { data, error } = await supabase
			.from("interviews")
			.insert({
				account_id: accountId,
				project_id: projectId,
				title,
				interview_date: new Date().toISOString(),
				media_type: "interview",
				status: "transcribing",
			})
			.select("id")
			.single();

		if (error) {
			consola.error("Failed to create interview:", error);
			return new Response(JSON.stringify({ error: error.message }), {
				status: 500,
				headers: { "Content-Type": "application/json" },
			});
		}

		if (ctx.claims?.sub) {
			await ensureInterviewInterviewerLink({
				supabase,
				accountId,
				projectId,
				interviewId: data.id,
				userId: ctx.claims.sub,
				userSettings: ctx.user_settings || null,
				userMetadata: ctx.user_metadata || null,
			});
		}

		return new Response(JSON.stringify({ interviewId: data.id }), {
			headers: { "Content-Type": "application/json" },
		});
	} catch (e: any) {
		consola.error("Unexpected error in realtime-start:", e);
		return new Response(JSON.stringify({ error: e?.message || "Unexpected error" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}
