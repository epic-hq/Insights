import consola from "consola";
import type { LoaderFunctionArgs } from "react-router";
import { z } from "zod";

import { userContext } from "~/server/user-context";

const querySchema = z.object({
	search: z.string().optional(),
	ids: z.array(z.string().uuid()).optional(),
	limit: z.number().int().min(1).max(50).default(10),
});

export async function loader({ request, context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext);
	if (!ctx?.supabase || !ctx?.account_id) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const url = new URL(request.url);
	const rawSearch = url.searchParams.get("q") ?? "";
	const rawLimit = url.searchParams.get("limit");
	const rawIds = url.searchParams.getAll("id");

	const parsed = querySchema.safeParse({
		search: rawSearch?.trim() ? rawSearch.trim() : undefined,
		limit: rawLimit ? Number.parseInt(rawLimit, 10) : undefined,
		ids: rawIds.length ? rawIds : undefined,
	});

	if (!parsed.success) {
		consola.warn("Invalid people search query", parsed.error.flatten().fieldErrors);
		return Response.json({ error: "Invalid query" }, { status: 400 });
	}

	const { search, limit, ids } = parsed.data;

	let query = ctx.supabase
		.from("people")
		.select("id, name, primary_email, project_id, default_organization:organizations!default_organization_id(name)")
		.eq("account_id", ctx.account_id)
		.order("updated_at", { ascending: false })
		.limit(limit);

	if (ids && ids.length > 0) {
		query = query.in("id", ids);
	}

	if (search) {
		const escaped = search.replace(/%/g, "\\%").replace(/_/g, "\\_");
		// Still search company text column for backwards compatibility during transition
		query = query.or([`name.ilike.%${escaped}%`, primaryEmailClause(escaped), `company.ilike.%${escaped}%`].join(","), {
			foreignTable: undefined,
		});
	}

	const { data, error } = await query;

	if (error) {
		consola.error("Failed to search people", error);
		return Response.json({ error: "Failed to search people" }, { status: 500 });
	}

	return Response.json({
		people: (data ?? []).map((person) => {
			const orgName = (person.default_organization as { name: string | null } | null)?.name;
			return {
				id: person.id,
				name: person.name,
				email: person.primary_email,
				company: orgName ?? null,
				projectId: person.project_id,
			};
		}),
	});
}

function primaryEmailClause(value: string) {
	return `primary_email.ilike.%${value}%`;
}
