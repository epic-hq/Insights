/**
 * Regenerate project-level themes using the new consolidation logic
 *
 * This script:
 * 1. Deletes ALL existing themes for the project
 * 2. Re-runs auto-grouping on ALL evidence with new consolidation prompt
 * 3. Creates 3-7 strategic themes instead of 30+ micro-themes
 *
 * Usage:
 *   npx tsx scripts/regenerate-project-themes.ts <project-id>
 *   npx tsx scripts/regenerate-project-themes.ts a6c27966-9cde-4aba-85aa-ae6313f9e060
 */

import consola from "consola"
import { autoGroupThemesAndApply } from "~/features/themes/db.autoThemes.server"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"

async function regenerateProjectThemes() {
	const supabase = createSupabaseAdminClient()

	// Get project ID from command line
	const projectId = process.argv[2]

	if (!projectId) {
		consola.error("Usage: npx tsx scripts/regenerate-project-themes.ts <project-id>")
		process.exit(1)
	}

	consola.info("🔄 Regenerating themes for project:", projectId)

	// Get project details
	const { data: project, error: projectError } = await supabase
		.from("projects")
		.select("id, name, account_id")
		.eq("id", projectId)
		.single()

	if (projectError || !project) {
		consola.error("Project not found:", projectError?.message)
		process.exit(1)
	}

	consola.info(`📁 Project: ${project.name} (${project.id})`)
	consola.info(`👤 Account: ${project.account_id}`)

	// Count evidence
	const { count: evidenceCount, error: countError } = await supabase
		.from("evidence")
		.select("id", { count: "exact", head: true })
		.eq("project_id", projectId)

	if (countError) {
		consola.error("Failed to count evidence:", countError.message)
		process.exit(1)
	}

	if (!evidenceCount || evidenceCount === 0) {
		consola.warn("⚠️  No evidence found for this project. Cannot generate themes.")
		process.exit(0)
	}

	consola.info(`📊 Found ${evidenceCount} pieces of evidence`)

	// Count existing themes
	const { count: themeCount, error: themeCountError } = await supabase
		.from("themes")
		.select("id", { count: "exact", head: true })
		.eq("project_id", projectId)

	if (themeCountError) {
		consola.warn("Failed to count existing themes:", themeCountError.message)
	} else {
		consola.info(`🗑️  Found ${themeCount || 0} existing themes (will be deleted)`)
	}

	// Confirm before proceeding
	consola.warn("\n⚠️  WARNING: This will DELETE all existing themes and regenerate them from scratch!")
	consola.info("Press Ctrl+C to cancel, or wait 5 seconds to proceed...\n")

	await new Promise((resolve) => setTimeout(resolve, 5000))

	// Step 1: Delete all theme_evidence links for this project
	consola.start("Deleting theme-evidence links...")
	const { error: deleteLinkError } = await supabase.from("theme_evidence").delete().eq("project_id", projectId)

	if (deleteLinkError) {
		consola.error("Failed to delete theme links:", deleteLinkError.message)
		process.exit(1)
	}
	consola.success("✅ Deleted theme-evidence links")

	// Step 2: Delete all themes for this project
	consola.start("Deleting existing themes...")
	const { error: deleteThemeError } = await supabase.from("themes").delete().eq("project_id", projectId)

	if (deleteThemeError) {
		consola.error("Failed to delete themes:", deleteThemeError.message)
		process.exit(1)
	}
	consola.success("✅ Deleted existing themes")

	// Step 3: Run auto-grouping with new consolidation logic
	consola.start("Generating new consolidated themes (this may take a few minutes)...")

	try {
		const result = await autoGroupThemesAndApply({
			supabase,
			account_id: project.account_id,
			project_id: projectId,
			limit: evidenceCount || 200, // Process all evidence
			guidance: `
Project: ${project.name}

IMPORTANT: Focus on creating 3-7 STRATEGIC themes that drive business decisions.
Aggressively consolidate related pain points, workflow steps, and industry variations.
Avoid creating separate themes for symptoms of the same structural problem.
Each theme should represent a major category of customer needs/problems, not micro-issues.
			`.trim(),
		})

		consola.success("\n✅ Theme generation complete!")
		consola.info("📊 Results:")
		consola.info(`   • Created ${result.created_theme_ids.length} themes`)
		consola.info(`   • Linked ${result.link_count} pieces of evidence`)

		if (result.themes.length > 0) {
			consola.info("\n📝 Generated Themes:")
			result.themes.forEach((theme, idx) => {
				consola.info(`   ${idx + 1}. ${theme.name}`)
				if (theme.statement) {
					consola.info(`      → ${theme.statement}`)
				}
			})
		}

		// Show comparison
		consola.info(`\n📈 Before: ${themeCount || 0} themes`)
		consola.info(`📉 After: ${result.created_theme_ids.length} themes`)

		if (result.created_theme_ids.length > 7) {
			consola.warn(
				`\n⚠️  Warning: Generated ${result.created_theme_ids.length} themes (expected 3-7). The consolidation may need further tuning.`
			)
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		consola.error("❌ Failed to generate themes:", message)
		process.exit(1)
	}

	consola.success("\n🎉 Project theme regeneration complete!")
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	regenerateProjectThemes().catch((error) => {
		consola.error("Fatal error:", error)
		process.exit(1)
	})
}

export { regenerateProjectThemes }
