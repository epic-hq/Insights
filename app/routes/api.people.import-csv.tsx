import { randomUUID } from "node:crypto";
import { RequestContext } from "@mastra/core/di";
import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import type { Database } from "~/database.types";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { resolveAccountIdFromProject } from "~/mastra/tools/context-utils";
import { importPeopleFromTableTool } from "~/mastra/tools/import-people-from-table";
import { parseSpreadsheetTool } from "~/mastra/tools/parse-spreadsheet";
import { userContext } from "~/server/user-context";

type AdminClient = SupabaseClient<Database>;

const facetColumnSchema = z.object({
	column: z.string().min(1),
	facetKind: z.string().min(1),
});

const suggestedFacetSchema = z.object({
	column: z.string().min(1),
	facetKind: z.string().min(1),
	sampleValues: z.array(z.string()).nullish(),
	reason: z.string().nullish(),
});

const columnMappingSchema = z.record(z.string(), z.string());

const parseResultSchema = z.object({
	success: z.boolean(),
	message: z.string().nullish(),
	assetId: z.string().uuid().nullish(),
	headers: z.array(z.string()).nullish(),
	rowCount: z.number().nullish(),
	columnCount: z.number().nullish(),
	columnMapping: columnMappingSchema.nullish(),
	suggestedFacets: z.array(suggestedFacetSchema).nullish(),
	mappingWarnings: z.array(z.string()).nullish(),
	error: z.string().optional(),
});

const importResultSchema = z.object({
	success: z.boolean(),
	message: z.string(),
	imported: z.object({
		people: z.number(),
		updated: z.number(),
		organizations: z.number(),
		facets: z.number(),
		surveyResponses: z.number().nullish(),
		skipped: z.number(),
	}),
	details: z
		.array(
			z.object({
				personId: z.string(),
				name: z.string(),
				organizationId: z.string().optional(),
				organizationName: z.string().optional(),
				rowIndex: z.number(),
			})
		)
		.nullish(),
	detectedMapping: z.record(z.string(), z.string()).nullish(),
	skipReasons: z
		.array(
			z.object({
				rowIndex: z.number(),
				reason: z.string(),
				data: z.record(z.string(), z.unknown()).optional(),
			})
		)
		.nullish(),
	error: z.string().optional(),
});

interface ImportPayload {
	csvContent: string;
	projectId?: string;
	title?: string;
	mode?: "create" | "upsert";
	skipDuplicates?: boolean;
	createOrganizations?: boolean;
	verify?: boolean;
	columnMapping?: Record<string, string>;
	facetColumns?: Array<{ column: string; facetKind: string }>;
	suggestedFacets?: Array<{
		column: string;
		facetKind: string;
		sampleValues?: string[];
		reason?: string;
	}>;
}

interface ImportDetail {
	personId: string;
	name: string;
	organizationId?: string;
	organizationName?: string;
	rowIndex: number;
}

function summarizeCsv(content: string) {
	const trimmed = content.trim();
	if (!trimmed) return { chars: 0, lines: 0 };
	const lines = trimmed.split(/\r?\n/).length;
	return { chars: content.length, lines };
}

function parseBoolean(value: FormDataEntryValue | undefined, defaultValue: boolean): boolean {
	if (typeof value !== "string") return defaultValue;
	const normalized = value.trim().toLowerCase();
	if (["true", "1", "yes", "on"].includes(normalized)) return true;
	if (["false", "0", "no", "off"].includes(normalized)) return false;
	return defaultValue;
}

function parseJsonField<T>(
	value: FormDataEntryValue | undefined,
	schema: z.ZodSchema<T>,
	fieldName: string
): T | undefined {
	if (typeof value !== "string" || !value.trim()) return undefined;
	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch {
		throw new Error(`Invalid JSON in field '${fieldName}'`);
	}

	const validated = schema.safeParse(parsed);
	if (!validated.success) {
		throw new Error(`Invalid '${fieldName}' payload`);
	}
	return validated.data;
}

async function parsePayload(request: Request): Promise<ImportPayload> {
	const contentType = request.headers.get("content-type") || "";

	if (contentType.includes("multipart/form-data")) {
		const formData = await request.formData();
		const file = formData.get("file");
		const csvFromBody = formData.get("csvContent");

		let csvContent = "";
		if (file instanceof File) {
			csvContent = await file.text();
		} else if (typeof csvFromBody === "string") {
			csvContent = csvFromBody;
		}

		const modeRaw = formData.get("mode");
		const mode = typeof modeRaw === "string" && (modeRaw === "create" || modeRaw === "upsert") ? modeRaw : undefined;

		return {
			csvContent,
			projectId: typeof formData.get("projectId") === "string" ? String(formData.get("projectId")) : undefined,
			title: typeof formData.get("title") === "string" ? String(formData.get("title")) : undefined,
			mode,
			skipDuplicates: parseBoolean(formData.get("skipDuplicates") ?? undefined, true),
			createOrganizations: parseBoolean(formData.get("createOrganizations") ?? undefined, true),
			verify: parseBoolean(formData.get("verify") ?? undefined, true),
			columnMapping: parseJsonField(formData.get("columnMapping") ?? undefined, columnMappingSchema, "columnMapping"),
			facetColumns: parseJsonField(
				formData.get("facetColumns") ?? undefined,
				z.array(facetColumnSchema),
				"facetColumns"
			),
			suggestedFacets: parseJsonField(
				formData.get("suggestedFacets") ?? undefined,
				z.array(suggestedFacetSchema),
				"suggestedFacets"
			),
		};
	}

	const jsonBody = await request.json().catch(() => ({}));
	const payloadSchema = z.object({
		csvContent: z.string().min(1),
		projectId: z.string().nullish(),
		title: z.string().nullish(),
		mode: z.enum(["create", "upsert"]).nullish(),
		skipDuplicates: z.boolean().nullish(),
		createOrganizations: z.boolean().nullish(),
		verify: z.boolean().nullish(),
		columnMapping: columnMappingSchema.nullish(),
		facetColumns: z.array(facetColumnSchema).nullish(),
		suggestedFacets: z.array(suggestedFacetSchema).nullish(),
	});

	const parsed = payloadSchema.safeParse(jsonBody);
	if (!parsed.success) {
		throw new Error("Invalid JSON payload");
	}

	return {
		csvContent: parsed.data.csvContent,
		projectId: parsed.data.projectId ?? undefined,
		title: parsed.data.title ?? undefined,
		mode: parsed.data.mode ?? undefined,
		skipDuplicates: parsed.data.skipDuplicates ?? true,
		createOrganizations: parsed.data.createOrganizations ?? true,
		verify: parsed.data.verify ?? true,
		columnMapping: parsed.data.columnMapping ?? undefined,
		facetColumns: parsed.data.facetColumns ?? undefined,
		suggestedFacets: parsed.data.suggestedFacets ?? undefined,
	};
}

function normalizeHeader(header: string): string {
	return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function chooseFacetKind(availableKinds: Set<string>, candidates: string[]): string | null {
	for (const candidate of candidates) {
		if (availableKinds.has(candidate)) return candidate;
	}
	return null;
}

function inferFacetColumns(
	headers: string[],
	availableKinds: Set<string>
): Array<{ column: string; facetKind: string }> {
	const inferred: Array<{ column: string; facetKind: string }> = [];

	for (const header of headers) {
		const normalized = normalizeHeader(header);
		let facetKind: string | null = null;

		if (/(toolsused|securitytools|toolstack|tooling|stack|cloudplatforms)/.test(normalized)) {
			facetKind = chooseFacetKind(availableKinds, ["tool", "custom", "artifact"]);
		} else if (/(applicationlanguages|programminglanguages|languagesused|codinglanguages)/.test(normalized)) {
			facetKind = chooseFacetKind(availableKinds, ["custom", "tool", "artifact"]);
		} else if (/(securityteamsize|teamsize|socsize|securityheadcount)/.test(normalized)) {
			facetKind = chooseFacetKind(availableKinds, ["demographic", "custom", "context"]);
		} else if (/(aiadoption|aimaturity|aiusage|aireadiness)/.test(normalized)) {
			facetKind = chooseFacetKind(availableKinds, ["behavior", "preference", "custom"]);
		} else if (/(jtbd|jobtobedone|primaryjob)/.test(normalized)) {
			facetKind = chooseFacetKind(availableKinds, ["task", "goal", "custom"]);
		}

		if (facetKind) {
			inferred.push({ column: header, facetKind });
		}
	}

	return dedupeFacetColumns(inferred);
}

function dedupeFacetColumns(
	columns: Array<{ column: string; facetKind: string }>
): Array<{ column: string; facetKind: string }> {
	const seen = new Set<string>();
	const deduped: Array<{ column: string; facetKind: string }> = [];
	for (const col of columns) {
		const key = `${col.column.toLowerCase()}::${col.facetKind.toLowerCase()}`;
		if (seen.has(key)) continue;
		seen.add(key);
		deduped.push(col);
	}
	return deduped;
}

async function fetchFacetKinds(supabase: AdminClient): Promise<Set<string>> {
	const { data, error } = await supabase.from("facet_kind_global").select("slug");
	if (error) {
		consola.warn("people.import-csv: failed to load facet kinds", error);
		return new Set<string>(["custom"]);
	}
	return new Set((data ?? []).map((row) => row.slug));
}

async function countByProject(
	supabase: AdminClient,
	table: "people" | "organizations" | "person_facet",
	projectId: string
) {
	const { count, error } = await supabase
		.from(table)
		.select("id", { count: "exact", head: true })
		.eq("project_id", projectId);
	if (error) {
		consola.warn(`people.import-csv: failed counting ${table}`, error);
		return null;
	}
	return count ?? 0;
}

async function buildIntegrityReport(supabase: AdminClient, details: ImportDetail[]) {
	const personIds = [...new Set(details.map((detail) => detail.personId))];
	if (personIds.length === 0) {
		return {
			expectedPeople: 0,
			foundPeople: 0,
			allPeoplePresent: true,
			allOrganizationLinksPresent: true,
			missingPeopleIds: [] as string[],
			missingOrganizationLinks: [] as string[],
			peopleWithFacets: 0,
			totalFacetRows: 0,
			people: [] as Array<Record<string, unknown>>,
		};
	}

	const { data: peopleRows } = await supabase
		.from("people")
		.select("id, name, primary_email, title, default_organization_id")
		.in("id", personIds);

	const peopleById = new Map((peopleRows ?? []).map((person) => [person.id, person]));
	const missingPeopleIds = personIds.filter((id) => !peopleById.has(id));

	const allOrgIds = [
		...new Set(details.map((detail) => detail.organizationId).filter((id): id is string => Boolean(id))),
	];
	const { data: organizationRows } = allOrgIds.length
		? await supabase.from("organizations").select("id, name").in("id", allOrgIds)
		: { data: [] as Array<{ id: string; name: string | null }> };
	const organizationById = new Map((organizationRows ?? []).map((org) => [org.id, org.name]));

	const { data: personOrgRows } = await supabase
		.from("people_organizations")
		.select("person_id, organization_id, is_primary, job_title")
		.in("person_id", personIds);

	const orgLinksByPerson = new Map<
		string,
		Array<{ organization_id: string; is_primary: boolean | null; job_title: string | null }>
	>();
	for (const row of personOrgRows ?? []) {
		const existing = orgLinksByPerson.get(row.person_id) ?? [];
		existing.push({
			organization_id: row.organization_id,
			is_primary: row.is_primary,
			job_title: row.job_title,
		});
		orgLinksByPerson.set(row.person_id, existing);
	}

	const { data: personFacetRows } = await supabase
		.from("person_facet")
		.select("person_id, facet_account_id")
		.in("person_id", personIds);

	const facetAccountIds = [...new Set((personFacetRows ?? []).map((row) => row.facet_account_id))];
	const { data: facetAccounts } = facetAccountIds.length
		? await supabase.from("facet_account").select("id, label, kind_id").in("id", facetAccountIds)
		: { data: [] as Array<{ id: number; label: string; kind_id: number }> };

	const kindIds = [...new Set((facetAccounts ?? []).map((row) => row.kind_id))];
	const { data: facetKinds } = kindIds.length
		? await supabase.from("facet_kind_global").select("id, slug").in("id", kindIds)
		: { data: [] as Array<{ id: number; slug: string }> };

	const kindSlugById = new Map((facetKinds ?? []).map((kind) => [kind.id, kind.slug]));
	const facetMetaById = new Map(
		(facetAccounts ?? []).map((facet) => [
			facet.id,
			{
				label: facet.label,
				kindSlug: kindSlugById.get(facet.kind_id) ?? "unknown",
			},
		])
	);

	const facetsByPerson = new Map<string, Array<{ kindSlug: string; label: string }>>();
	for (const row of personFacetRows ?? []) {
		const meta = facetMetaById.get(row.facet_account_id);
		if (!meta) continue;
		const existing = facetsByPerson.get(row.person_id) ?? [];
		existing.push({ kindSlug: meta.kindSlug, label: meta.label });
		facetsByPerson.set(row.person_id, existing);
	}

	const missingOrganizationLinks: string[] = [];
	const people = details.map((detail) => {
		const person = peopleById.get(detail.personId);
		const orgLinks = orgLinksByPerson.get(detail.personId) ?? [];
		const expectedOrgId = detail.organizationId;
		const defaultOrganizationId = person?.default_organization_id ?? null;
		const hasExpectedOrgLink =
			!expectedOrgId ||
			defaultOrganizationId === expectedOrgId ||
			orgLinks.some((link) => link.organization_id === expectedOrgId);

		if (!hasExpectedOrgLink && expectedOrgId) {
			missingOrganizationLinks.push(detail.personId);
		}

		return {
			personId: detail.personId,
			name: person?.name ?? detail.name,
			email: person?.primary_email ?? null,
			title: person?.title ?? null,
			defaultOrganizationId,
			expectedOrganizationId: expectedOrgId ?? null,
			expectedOrganizationName: detail.organizationName ?? null,
			defaultOrganizationName: defaultOrganizationId ? (organizationById.get(defaultOrganizationId) ?? null) : null,
			organizationLinks: orgLinks,
			facetCount: (facetsByPerson.get(detail.personId) ?? []).length,
			facets: (facetsByPerson.get(detail.personId) ?? []).slice(0, 15),
			hasExpectedOrgLink,
		};
	});

	return {
		expectedPeople: personIds.length,
		foundPeople: peopleById.size,
		allPeoplePresent: missingPeopleIds.length === 0,
		allOrganizationLinksPresent: missingOrganizationLinks.length === 0,
		missingPeopleIds,
		missingOrganizationLinks,
		peopleWithFacets: people.filter((person) => person.facetCount > 0).length,
		totalFacetRows: (personFacetRows ?? []).length,
		people,
	};
}

export async function action({ request, context, params }: ActionFunctionArgs) {
	const requestId = randomUUID();
	const startedAt = Date.now();
	const requestUrl = new URL(request.url);
	const contentType = request.headers.get("content-type") || "";

	consola.info("[people.import-csv] request:start", {
		requestId,
		method: request.method,
		path: requestUrl.pathname,
		projectIdParam: params.projectId || null,
		accountIdParam: params.accountId || null,
		contentType,
	});

	if (request.method !== "POST") {
		consola.warn("[people.import-csv] request:invalid-method", {
			requestId,
			method: request.method,
		});
		return Response.json({ requestId, error: "Method not allowed" }, { status: 405 });
	}

	const ctx = context.get(userContext);
	const userId = String(ctx?.claims?.sub || "");
	if (!ctx?.supabase || !userId) {
		consola.warn("[people.import-csv] request:unauthorized", {
			requestId,
			hasSupabaseContext: Boolean(ctx?.supabase),
			hasUserId: Boolean(userId),
		});
		return Response.json({ requestId, error: "Unauthorized" }, { status: 401 });
	}

	try {
		let payload: ImportPayload;
		try {
			payload = await parsePayload(request);
		} catch (payloadError) {
			consola.warn("[people.import-csv] payload:invalid", {
				requestId,
				error: payloadError instanceof Error ? payloadError.message : "Invalid request payload",
			});
			return Response.json(
				{
					requestId,
					success: false,
					error: payloadError instanceof Error ? payloadError.message : "Invalid request payload",
				},
				{ status: 400 }
			);
		}
		if (!payload.csvContent || !payload.csvContent.trim()) {
			consola.warn("[people.import-csv] payload:missing-csv", { requestId });
			return Response.json({ requestId, error: "No CSV content provided" }, { status: 400 });
		}

		const projectIdFromQuery = new URL(request.url).searchParams.get("projectId");
		const projectId = String(params.projectId || payload.projectId || projectIdFromQuery || "").trim();
		if (!projectId) {
			consola.warn("[people.import-csv] request:missing-project-id", { requestId });
			return Response.json(
				{ requestId, error: "Missing projectId (URL param, query, or form/json field)" },
				{ status: 400 }
			);
		}

		const fallbackAccountId = String(params.accountId || ctx.account_id || "");
		const accountId = await resolveAccountIdFromProject(projectId, "api.people.import-csv", fallbackAccountId);
		consola.info("[people.import-csv] context:resolved", {
			requestId,
			projectId,
			accountId,
			userId,
		});
		const csvSummary = summarizeCsv(payload.csvContent);
		consola.info("[people.import-csv] payload:parsed", {
			requestId,
			mode: payload.mode ?? "create",
			skipDuplicates: payload.skipDuplicates ?? true,
			createOrganizations: payload.createOrganizations ?? true,
			verify: payload.verify ?? true,
			hasColumnMapping: Boolean(payload.columnMapping),
			facetColumnsCount: payload.facetColumns?.length ?? 0,
			suggestedFacetsCount: payload.suggestedFacets?.length ?? 0,
			csvChars: csvSummary.chars,
			csvLines: csvSummary.lines,
		});

		const admin = createSupabaseAdminClient();
		const requestContext = new RequestContext();
		requestContext.set("user_id", userId);
		requestContext.set("account_id", accountId);
		requestContext.set("project_id", projectId);

		const countsBefore = {
			people: await countByProject(admin, "people", projectId),
			organizations: await countByProject(admin, "organizations", projectId),
			personFacets: await countByProject(admin, "person_facet", projectId),
		};
		consola.info("[people.import-csv] db:counts-before", { requestId, countsBefore });

		const parseResultRaw = await parseSpreadsheetTool.execute(
			{
				content: payload.csvContent,
				saveToAssets: true,
				includeStats: false,
				title: payload.title || "People Import CSV",
				maxDisplayRows: 20,
			},
			{ requestContext }
		);

		const parseResult = parseResultSchema.parse(parseResultRaw);
		if (!parseResult.success || !parseResult.assetId) {
			consola.warn("[people.import-csv] parse:failed", {
				requestId,
				message: parseResult.message || null,
				error: parseResult.error || null,
			});
			return Response.json(
				{
					requestId,
					success: false,
					stage: "parse",
					message: parseResult.message || "Failed to parse spreadsheet",
					error: parseResult.error || "Could not parse CSV or save table asset",
				},
				{ status: 400 }
			);
		}
		consola.info("[people.import-csv] parse:ok", {
			requestId,
			assetId: parseResult.assetId,
			rowCount: parseResult.rowCount ?? null,
			columnCount: parseResult.columnCount ?? null,
			mappingWarnings: parseResult.mappingWarnings?.length ?? 0,
		});

		const availableKinds = !payload.facetColumns?.length ? await fetchFacetKinds(admin) : new Set<string>();
		const inferredFacetColumns = !payload.facetColumns?.length
			? inferFacetColumns(parseResult.headers ?? [], availableKinds)
			: [];

		const effectiveFacetColumns = dedupeFacetColumns(payload.facetColumns ?? inferredFacetColumns);
		const effectiveColumnMapping = payload.columnMapping ?? parseResult.columnMapping ?? undefined;
		const effectiveSuggestedFacets = payload.suggestedFacets ?? parseResult.suggestedFacets ?? undefined;
		consola.info("[people.import-csv] import:config", {
			requestId,
			mode: payload.mode ?? "create",
			facetColumnsCount: effectiveFacetColumns.length,
			hasColumnMapping: Boolean(effectiveColumnMapping),
			suggestedFacetsCount: effectiveSuggestedFacets?.length ?? 0,
		});

		const importResultRaw = await importPeopleFromTableTool.execute(
			{
				assetId: parseResult.assetId,
				mode: payload.mode ?? "create",
				skipDuplicates: payload.skipDuplicates ?? true,
				createOrganizations: payload.createOrganizations ?? true,
				columnMapping: effectiveColumnMapping,
				facetColumns: effectiveFacetColumns,
				suggestedFacets: effectiveSuggestedFacets,
			},
			{ requestContext }
		);

		const importResult = importResultSchema.parse(importResultRaw);
		const details = (importResult.details ?? []) as ImportDetail[];
		consola.info("[people.import-csv] import:result", {
			requestId,
			success: importResult.success,
			imported: importResult.imported,
			detailsCount: details.length,
			skipReasons: importResult.skipReasons?.length ?? 0,
		});

		const verification = payload.verify === false ? null : await buildIntegrityReport(admin, details);
		if (verification) {
			consola.info("[people.import-csv] verify:result", {
				requestId,
				expectedPeople: verification.expectedPeople,
				foundPeople: verification.foundPeople,
				allPeoplePresent: verification.allPeoplePresent,
				allOrganizationLinksPresent: verification.allOrganizationLinksPresent,
				peopleWithFacets: verification.peopleWithFacets,
				totalFacetRows: verification.totalFacetRows,
			});
		}

		const countsAfter = {
			people: await countByProject(admin, "people", projectId),
			organizations: await countByProject(admin, "organizations", projectId),
			personFacets: await countByProject(admin, "person_facet", projectId),
		};
		consola.info("[people.import-csv] db:counts-after", { requestId, countsAfter });

		const elapsedMs = Date.now() - startedAt;
		consola.info("[people.import-csv] request:complete", {
			requestId,
			elapsedMs,
			success: importResult.success,
		});

		return Response.json(
			{
				requestId,
				success: importResult.success,
				message: importResult.message,
				parse: {
					assetId: parseResult.assetId,
					rowCount: parseResult.rowCount ?? null,
					columnCount: parseResult.columnCount ?? null,
					headers: parseResult.headers ?? [],
					mappingWarnings: parseResult.mappingWarnings ?? [],
				},
				import: importResult,
				inputApplied: {
					mode: payload.mode ?? "create",
					skipDuplicates: payload.skipDuplicates ?? true,
					createOrganizations: payload.createOrganizations ?? true,
					columnMapping: effectiveColumnMapping ?? null,
					facetColumns: effectiveFacetColumns,
					suggestedFacets: effectiveSuggestedFacets ?? [],
				},
				counts: {
					before: countsBefore,
					after: countsAfter,
					delta: {
						people:
							typeof countsBefore.people === "number" && typeof countsAfter.people === "number"
								? countsAfter.people - countsBefore.people
								: null,
						organizations:
							typeof countsBefore.organizations === "number" && typeof countsAfter.organizations === "number"
								? countsAfter.organizations - countsBefore.organizations
								: null,
						personFacets:
							typeof countsBefore.personFacets === "number" && typeof countsAfter.personFacets === "number"
								? countsAfter.personFacets - countsBefore.personFacets
								: null,
					},
				},
				verification,
			},
			{ status: importResult.success ? 200 : 500 }
		);
	} catch (error) {
		const elapsedMs = Date.now() - startedAt;
		consola.error("[people.import-csv] request:error", {
			requestId,
			elapsedMs,
			error: error instanceof Error ? error.message : String(error),
		});
		return Response.json(
			{
				requestId,
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
