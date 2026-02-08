import consola from "consola";
import type { ActionFunctionArgs } from "react-router";

export async function action({ request }: ActionFunctionArgs) {
	try {
		const payload = await request.json();
		consola.info("[questions/save-debug]", payload);
		return Response.json({ ok: true });
	} catch (error) {
		consola.error("[questions/save-debug] failed to log payload", error);
		return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
	}
}
