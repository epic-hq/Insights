#!/usr/bin/env tsx
/**
 * Story Generator Script
 *
 * Generates Storybook stories for components in batch.
 *
 * Usage:
 *   npx tsx scripts/generate-stories.ts
 *
 * Or make it executable:
 *   chmod +x scripts/generate-stories.ts
 *   ./scripts/generate-stories.ts
 */

import fs from "node:fs"
import path from "node:path"

interface StoryConfig {
	componentPath: string
	componentName: string
	title: string
	hasRouter: boolean
	mockData?: Record<string, any>
	layout?: "centered" | "padded" | "fullscreen"
}

function generateStory(config: StoryConfig): string {
	const { componentName, title, hasRouter, mockData, layout = "centered" } = config

	const imports = `import type { Meta, StoryObj } from "@storybook/react"
${hasRouter ? 'import { reactRouterParameters, withRouter } from "storybook-addon-remix-react-router"' : ""}
import { ${componentName} } from "./${componentName}"`

	const meta = `
const meta = {
	title: "${title}",
	component: ${componentName},${hasRouter ? "\n\tdecorators: [withRouter]," : ""}
	parameters: {
		layout: "${layout}",
	},
	tags: ["autodocs"],
	argTypes: {
		// Add controls here
	},
} satisfies Meta<typeof ${componentName}>

export default meta
type Story = StoryObj<typeof meta>`

	const defaultStory = hasRouter
		? `

export const Default: Story = {
	parameters: {
		reactRouter: reactRouterParameters({
			location: {
				pathParams: {},
			},
			routing: {
				path: "/",
				loader: () => (${JSON.stringify(mockData || {}, null, 2)}),
			},
		}),
	},
}`
		: `

export const Default: Story = {
	args: {
		// Add default props here
	},
}`

	return `${imports}\n${meta}\n${defaultStory}\n`
}

// =============================================================================
// COMPONENT LIST - Edit this array to generate stories
// =============================================================================

const components: Array<{
	name: string
	path: string
	title?: string
	hasRouter?: boolean
	mockData?: Record<string, any>
	layout?: "centered" | "padded" | "fullscreen"
}> = [
	// Example components - uncomment and edit:
	// {
	//   name: "Button",
	//   path: "./app/components/ui/Button.tsx",
	//   title: "Components/UI/Button",
	//   hasRouter: false,
	//   layout: "centered",
	// },
	// {
	//   name: "Card",
	//   path: "./app/components/ui/Card.tsx",
	//   title: "Components/UI/Card",
	//   hasRouter: false,
	//   layout: "padded",
	// },
	// {
	//   name: "InterviewCard",
	//   path: "./app/features/interviews/components/InterviewCard.tsx",
	//   title: "Features/Interviews/InterviewCard",
	//   hasRouter: true,
	//   mockData: {
	//     interview: { id: "1", title: "Test Interview" },
	//   },
	//   layout: "padded",
	// },
]

// =============================================================================
// GENERATOR LOGIC
// =============================================================================

function main() {
	console.log("🚀 Generating Storybook stories...\n")

	if (components.length === 0) {
		console.log("⚠️  No components configured!")
		console.log("   Edit scripts/generate-stories.ts and add components to the array.\n")
		return
	}

	let successCount = 0
	let errorCount = 0

	for (const c of components) {
		try {
			// Resolve paths
			const componentPath = path.resolve(process.cwd(), c.path)
			const componentDir = path.dirname(componentPath)
			const storyPath = path.join(componentDir, `${c.name}.stories.tsx`)

			// Check if component file exists
			if (!fs.existsSync(componentPath)) {
				console.log(`❌ Component not found: ${c.path}`)
				errorCount++
				continue
			}

			// Check if story already exists
			if (fs.existsSync(storyPath)) {
				console.log(`⏭️  Story already exists: ${c.name}.stories.tsx (skipping)`)
				continue
			}

			// Generate story content
			const story = generateStory({
				componentPath: c.path,
				componentName: c.name,
				title: c.title || `Components/${c.name}`,
				hasRouter: c.hasRouter || false,
				mockData: c.mockData,
				layout: c.layout,
			})

			// Write story file
			fs.writeFileSync(storyPath, story)
			console.log(`✅ Generated: ${c.name}.stories.tsx`)
			successCount++
		} catch (error) {
			console.log(`❌ Error generating story for ${c.name}:`, error)
			errorCount++
		}
	}

	console.log("\n📊 Summary:")
	console.log(`   ✅ Generated: ${successCount}`)
	console.log(`   ❌ Errors: ${errorCount}`)
	console.log(`   ⏭️  Skipped: ${components.length - successCount - errorCount}`)
	console.log("\n🎉 Done!\n")
}

// Run the generator
main()
