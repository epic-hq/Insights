/**
 * Analysis Page - The redesigned "Saved Views" experience
 *
 * Four tabs:
 *   1. Overview  - AI-synthesized executive briefing across all lenses
 *   2. By Person - Per-person consolidated lens results
 *   3. By Lens   - Aggregate per-lens view with drill-down
 *   4. Manage    - Enable/disable lenses, view template details, create custom lenses
 */

import { tasks } from "@trigger.dev/sdk"
import consola from "consola"
import { BarChart3, Glasses, Settings, Telescope, Users } from "lucide-react"
import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	type MetaFunction,
	useFetcher,
	useLoaderData,
	useRevalidator,
	useSearchParams,
} from "react-router"
import type { synthesizeCrossLensTask } from "~/../src/trigger/lens/synthesizeCrossLens"
import { Badge } from "~/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { type AccountSettingsMetadata, PLATFORM_DEFAULT_LENS_KEYS } from "~/features/opportunities/stage-config"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"
import { AnalysisByLensTab } from "../components/AnalysisByLensTab"
import { AnalysisByPersonTab } from "../components/AnalysisByPersonTab"
import { AnalysisOverviewTab } from "../components/AnalysisOverviewTab"
import { ManageLensesTab } from "../components/ManageLensesTab"
import { loadAnalysisPageData } from "../lib/loadAnalysisData.server"
import { loadLensTemplates } from "../lib/loadLensAnalyses.server"

export const meta: MetaFunction = () => {
	return [
		{ title: "Analysis | Insights" },
		{
			name: "description",
			content: "Unified analysis across all conversation lenses",
		},
	]
}

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const projectId = params.projectId
	const accountId = params.accountId

	if (!supabase || !projectId || !accountId) {
		throw new Response("Unauthorized", { status: 401 })
	}

	const projectPath = `/a/${accountId}/${projectId}`

	const [pageData, allTemplates] = await Promise.all([
		loadAnalysisPageData(supabase as any, projectId, accountId),
		loadLensTemplates(supabase as any),
	])

	// Load enabled lenses for manage dialog
	let enabledLenses: string[] = [...PLATFORM_DEFAULT_LENS_KEYS]

	const { data: accountSettings } = await supabase
		.from("account_settings")
		.select("metadata")
		.eq("account_id", accountId)
		.maybeSingle()

	if (accountSettings?.metadata) {
		const metadata = accountSettings.metadata as AccountSettingsMetadata
		if (Array.isArray(metadata.default_lens_keys) && metadata.default_lens_keys.length > 0) {
			enabledLenses = metadata.default_lens_keys
		}
	}

	const { data: project } = await supabase.from("projects").select("project_settings").eq("id", projectId).single()

	if (project?.project_settings) {
		const settings = project.project_settings as Record<string, unknown>
		if (Array.isArray(settings.enabled_lenses) && settings.enabled_lenses.length > 0) {
			enabledLenses = settings.enabled_lenses as string[]
		}
	}

	return {
		overview: pageData.overview,
		people: pageData.people,
		allTemplates,
		enabledLenses,
		projectPath,
		projectId,
		accountId,
		userId: ctx.claims?.sub,
	}
}

export async function action({ context, params, request }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	if (!supabase || !ctx.claims?.sub) {
		throw new Response("Unauthorized", { status: 401 })
	}

	const projectId = params.projectId as string
	const accountId = params.accountId as string
	const formData = await request.formData()
	const intent = formData.get("intent")

	// Handle cross-lens synthesis
	if (intent === "synthesize-cross-lens") {
		const force = formData.get("force") === "true"
		const customInstructions = formData.get("customInstructions") as string | null

		try {
			const result = await tasks.trigger<typeof synthesizeCrossLensTask>("lens.synthesize-cross-lens", {
				projectId,
				accountId,
				customInstructions: customInstructions || undefined,
				force,
			})

			consola.info(`[analysis] Triggered cross-lens synthesis, run ID: ${result.id}`)
			return { success: true, runId: result.id }
		} catch (error) {
			consola.error("[analysis] Failed to trigger cross-lens synthesis:", error)
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			}
		}
	}

	// Handle lens settings updates (delegate to existing library action logic)
	if (intent === "update_lens_settings") {
		const enabledLensesJson = (formData.get("enabled_lenses") as string) || "[]"
		const applyToExisting = formData.get("apply_to_existing") === "true"

		let enabledLenses: string[]
		try {
			enabledLenses = JSON.parse(enabledLensesJson)
		} catch {
			return { error: "Invalid lens settings" }
		}

		const { data: project } = await supabase
			.from("projects")
			.select("project_settings, account_id")
			.eq("id", projectId)
			.single()

		const currentSettings = (project?.project_settings as Record<string, unknown>) || {}
		let previousLenses = currentSettings.enabled_lenses as string[] | undefined

		if (!previousLenses || previousLenses.length === 0) {
			const { data: acctSettings } = await supabase
				.from("account_settings")
				.select("metadata")
				.eq("account_id", accountId)
				.maybeSingle()

			const metadata = (acctSettings?.metadata || {}) as AccountSettingsMetadata
			previousLenses = metadata.default_lens_keys || PLATFORM_DEFAULT_LENS_KEYS
		}

		const { error } = await supabase
			.from("projects")
			.update({
				project_settings: { ...currentSettings, enabled_lenses: enabledLenses },
				updated_at: new Date().toISOString(),
			})
			.eq("id", projectId)

		if (error) {
			return { error: `Failed to save: ${error.message}` }
		}

		// Backfill newly enabled lenses
		if (applyToExisting && project?.account_id) {
			const newlyEnabled = enabledLenses.filter((lens) => !previousLenses!.includes(lens))

			if (newlyEnabled.length > 0) {
				const { data: interviews } = await supabase
					.from("interviews")
					.select("id")
					.eq("project_id", projectId)
					.neq("lens_visibility", "private")

				if (interviews && interviews.length > 0) {
					try {
						const { applyAllLensesTask } = await import("~/../src/trigger/lens/applyAllLenses")

						for (const interview of interviews) {
							await applyAllLensesTask.trigger({
								interviewId: interview.id,
								accountId: project.account_id,
								projectId,
								lensesToApply: newlyEnabled,
							})
						}

						consola.info(`[analysis] Triggered backfill for ${interviews.length} interviews`)
					} catch (err) {
						consola.error("[analysis] Failed to trigger backfill:", err)
					}
				}
			}
		}

		return { success: true }
	}

	return { error: "Unknown intent" }
}

// ============================================================================
// Main Component
// ============================================================================

export default function AnalysisPage() {
	const { overview, people, allTemplates, enabledLenses, projectPath, projectId, accountId, userId } =
		useLoaderData<typeof loader>()

	const routes = useProjectRoutes(projectPath)
	const revalidator = useRevalidator()
	const fetcher = useFetcher<typeof action>()
	const [searchParams, setSearchParams] = useSearchParams()

	const activeTab = searchParams.get("tab") || "overview"
	const isSubmitting = fetcher.state === "submitting"

	const handleSynthesizeCrossLens = (force: boolean) => {
		fetcher.submit({ intent: "synthesize-cross-lens", force: force.toString() }, { method: "post" })
		setTimeout(() => revalidator.revalidate(), 3000)
	}

	// Summary stats for header
	const activeLensCount = overview.lensStats.filter((ls) => ls.completedCount > 0).length

	return (
		<div className="container mx-auto max-w-7xl space-y-6 px-4 py-8">
			{/* Page Header */}
			<div className="space-y-1">
				<div className="flex items-center gap-3">
					<div className="rounded-xl bg-primary/10 p-2.5">
						<Telescope className="h-6 w-6 text-primary" />
					</div>
					<h1 className="font-bold text-3xl tracking-tight">Analysis</h1>
				</div>
				<p className="text-muted-foreground">
					{overview.interviewCount > 0 ? (
						<>
							<span className="font-medium text-foreground">{overview.interviewCount}</span> conversation
							{overview.interviewCount !== 1 ? "s" : ""}
							{overview.surveyResponseCount > 0 && (
								<>
									{" "}
									&middot; <span className="font-medium text-foreground">{overview.surveyResponseCount}</span> survey
									response
									{overview.surveyResponseCount !== 1 ? "s" : ""}
								</>
							)}{" "}
							&middot; <span className="font-medium text-foreground">{overview.peopleCount}</span> people &middot;{" "}
							<span className="font-medium text-foreground">{activeLensCount}</span> lens
							{activeLensCount !== 1 ? "es" : ""} active
						</>
					) : (
						"No conversations analyzed yet. Record or upload interviews to get started."
					)}
				</p>
			</div>

			{/* Tab Navigation */}
			<Tabs value={activeTab} onValueChange={(value) => setSearchParams({ tab: value })} className="w-full">
				<TabsList>
					<TabsTrigger value="overview" className="gap-2">
						<BarChart3 className="h-4 w-4" />
						Overview
					</TabsTrigger>
					<TabsTrigger value="people" className="gap-2">
						<Users className="h-4 w-4" />
						By Person
						{overview.peopleCount > 0 && (
							<Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
								{overview.peopleCount}
							</Badge>
						)}
					</TabsTrigger>
					<TabsTrigger value="lenses" className="gap-2">
						<Glasses className="h-4 w-4" />
						By Lens
						{activeLensCount > 0 && (
							<Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
								{activeLensCount}
							</Badge>
						)}
					</TabsTrigger>
					<TabsTrigger value="manage" className="gap-2">
						<Settings className="h-4 w-4" />
						Manage
						<Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
							{allTemplates.length}
						</Badge>
					</TabsTrigger>
				</TabsList>

				<TabsContent value="overview" className="mt-6">
					<AnalysisOverviewTab
						overview={overview}
						isSubmitting={isSubmitting}
						onSynthesize={handleSynthesizeCrossLens}
						routes={routes}
						projectPath={projectPath}
					/>
				</TabsContent>

				<TabsContent value="people" className="mt-6">
					<AnalysisByPersonTab people={people} routes={routes} projectPath={projectPath} />
				</TabsContent>

				<TabsContent value="lenses" className="mt-6">
					<AnalysisByLensTab lensStats={overview.lensStats} routes={routes} projectPath={projectPath} />
				</TabsContent>

				<TabsContent value="manage" className="mt-6">
					<ManageLensesTab
						templates={allTemplates}
						enabledLenses={enabledLenses}
						accountId={accountId}
						userId={userId}
						onCreateLens={() => setSearchParams({ tab: "manage", create: "true" })}
					/>
				</TabsContent>
			</Tabs>
		</div>
	)
}
