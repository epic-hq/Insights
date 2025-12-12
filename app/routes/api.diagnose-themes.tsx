/**
 * API route to diagnose theme/evidence linking issues
 *
 * GET: Returns diagnostic info about themes, evidence, and their links
 * GET with action=reset: Wipes all themes and re-runs consolidation
 */

import consola from "consola"
import type { LoaderFunctionArgs } from "react-router"
import { autoGroupThemesAndApply } from "~/features/themes/db.autoThemes.server"
import { createSupabaseAdminClient, getServerClient } from "~/lib/supabase/client.server"

export async function loader({ request }: LoaderFunctionArgs) {
	try {
		const { getAuthenticatedUser } = await import("~/lib/supabase/client.server")
		const claims = await getAuthenticatedUser(request)
		if (!claims?.sub) {
			return Response.json({ error: "Unauthorized" }, { status: 401 })
		}

		const { client: userDb } = getServerClient(request)

		const url = new URL(request.url)
		const projectId = url.searchParams.get("project_id")
		const accountId = url.searchParams.get("account_id")

		if (!projectId || !accountId) {
			return Response.json({ error: "project_id and account_id required" }, { status: 400 })
		}

		const action = url.searchParams.get("action")

		// Handle reset action - wipe themes and re-consolidate
		if (action === "reset") {
			consola.info(`[diagnose-themes] RESET action for project ${projectId}`)

			// Use admin client for privileged operations to avoid RLS/session issues
			const adminDb = createSupabaseAdminClient()

			// 1. Delete all theme_evidence links for this project
			const { error: linkDeleteError, count: linksDeleted } = await adminDb
				.from("theme_evidence")
				.delete({ count: "exact" })
				.eq("project_id", projectId)

			if (linkDeleteError) {
				consola.error("[diagnose-themes] Failed to delete theme_evidence:", linkDeleteError)
				return Response.json({ error: `Failed to delete links: ${linkDeleteError.message}` }, { status: 500 })
			}

			consola.info(`[diagnose-themes] Deleted ${linksDeleted} theme_evidence links`)

			// 2. Delete all themes for this project
			const { error: themeDeleteError, count: themesDeleted } = await adminDb
				.from("themes")
				.delete({ count: "exact" })
				.eq("project_id", projectId)

			if (themeDeleteError) {
				consola.error("[diagnose-themes] Failed to delete themes:", themeDeleteError)
				return Response.json({ error: `Failed to delete themes: ${themeDeleteError.message}` }, { status: 500 })
			}

			consola.info(`[diagnose-themes] Deleted ${themesDeleted} themes`)

			// 3. Run fresh consolidation
			consola.info(`[diagnose-themes] Running fresh consolidation...`)

			const result = await autoGroupThemesAndApply({
				supabase: adminDb,
				account_id: accountId,
				project_id: projectId,
				guidance: "Create consolidated, actionable themes from all evidence. Avoid duplicates. Each theme should have a clear, distinct focus.",
				limit: 600, // Get all evidence
			})

			consola.success(`[diagnose-themes] Reset complete: ${result.themes.length} themes, ${result.link_count} links`)

			return Response.json({
				action: "reset",
				deleted: {
					themes: themesDeleted,
					links: linksDeleted,
				},
				created: {
					themes: result.themes.length,
					links: result.link_count,
				},
				newThemes: result.themes.map((t) => ({
					id: t.id,
					name: t.name,
					statement: t.statement?.substring(0, 100),
				})),
			})
		}

		// 1. Count evidence in project
		const { count: evidenceCount, error: evError } = await userDb
			.from("evidence")
			.select("*", { count: "exact", head: true })
			.eq("project_id", projectId)
			.or("is_question.is.null,is_question.eq.false")

		// 2. Count themes in project
		const { count: themeCount, error: themeError } = await userDb
			.from("themes")
			.select("*", { count: "exact", head: true })
			.eq("project_id", projectId)

		// 3. Count theme_evidence links
		const { count: linkCount, error: linkError } = await userDb
			.from("theme_evidence")
			.select("*", { count: "exact", head: true })
			.eq("project_id", projectId)

		// 4. Get themes with their evidence counts
		const { data: themesWithCounts, error: themesError } = await userDb
			.from("themes")
			.select(`
				id,
				name,
				statement,
				created_at,
				theme_evidence(count)
			`)
			.eq("project_id", projectId)
			.order("created_at", { ascending: false })
			.limit(20)

		// 5. Sample of evidence (first 5)
		const { data: sampleEvidence, error: sampleError } = await userDb
			.from("evidence")
			.select("id, gist, verbatim, interview_id, created_at")
			.eq("project_id", projectId)
			.or("is_question.is.null,is_question.eq.false")
			.order("created_at", { ascending: false })
			.limit(5)

		// 6. Check theme_evidence links with theme names
		const { data: themeEvidenceLinks } = await userDb
			.from("theme_evidence")
			.select(`
				id,
				theme_id,
				evidence_id,
				project_id,
				themes:theme_id (name)
			`)
			.eq("project_id", projectId)
			.limit(100)

		consola.log("[diagnose-themes] theme_evidence sample:", themeEvidenceLinks?.slice(0, 3))

		// 7. Get interviews count
		const { count: interviewCount } = await userDb
			.from("interviews")
			.select("*", { count: "exact", head: true })
			.eq("project_id", projectId)

		const diagnosis = {
			projectId,
			accountId,
			counts: {
				interviews: interviewCount ?? 0,
				evidence: evidenceCount ?? 0,
				themes: themeCount ?? 0,
				themeEvidenceLinks: linkCount ?? 0,
			},
			// Show actual theme_evidence records
			themeEvidenceSample: (themeEvidenceLinks ?? []).slice(0, 5).map((te: any) => ({
				theme_id: te.theme_id,
				theme_name: te.themes?.name,
				evidence_id: te.evidence_id,
				project_id: te.project_id,
			})),
			ratios: {
				evidencePerInterview: interviewCount ? ((evidenceCount ?? 0) / interviewCount).toFixed(1) : "N/A",
				linksPerTheme: themeCount ? ((linkCount ?? 0) / themeCount).toFixed(1) : "N/A",
				linksPerEvidence: evidenceCount ? ((linkCount ?? 0) / evidenceCount).toFixed(1) : "N/A",
			},
			themes: (themesWithCounts ?? []).map((t: any) => ({
				id: t.id,
				name: t.name,
				statement: t.statement?.substring(0, 100),
				evidenceCount: t.theme_evidence?.[0]?.count ?? 0,
				created: t.created_at,
			})),
			sampleEvidence: (sampleEvidence ?? []).map((e: any) => ({
				id: e.id,
				gist: e.gist?.substring(0, 80),
				hasVerbatim: !!e.verbatim,
				interviewId: e.interview_id,
			})),
			issues: [] as string[],
			errors: {
				evidence: evError?.message,
				themes: themeError?.message || themesError?.message,
				links: linkError?.message,
				sample: sampleError?.message,
			},
		}

		// Identify issues
		if ((evidenceCount ?? 0) === 0) {
			diagnosis.issues.push("No evidence found - interviews may not have been processed")
		}
		if ((themeCount ?? 0) > 0 && (linkCount ?? 0) === 0) {
			diagnosis.issues.push("Themes exist but no evidence links - run Consolidate Themes")
		}
		if ((linkCount ?? 0) > (evidenceCount ?? 0) * 3) {
			diagnosis.issues.push("Over-linking detected - too many links per evidence (run Consolidate)")
		}
		if ((themeCount ?? 0) > 50) {
			diagnosis.issues.push("Many themes - consider consolidating to reduce duplicates")
		}

		consola.info("[diagnose-themes] Diagnosis complete:", diagnosis.counts)

		return Response.json(diagnosis)
	} catch (error: unknown) {
		consola.error("[diagnose-themes] Error:", error)
		const errorMessage =
			error instanceof Error
				? error.message
				: typeof error === "object" && error !== null && "message" in error
					? String((error as { message: unknown }).message)
					: String(error)
		return Response.json({ error: errorMessage }, { status: 500 })
	}
}
