import type { Meta, StoryObj } from "@storybook/react-vite"
import { DollarSign, Sparkles } from "lucide-react"
import { Badge } from "~/components/ui/badge"
// Create a simplified version of AppSidebar for Storybook
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarTrigger,
} from "~/components/ui/sidebar"
// Import the real config!
import { APP_SIDEBAR_SECTIONS, APP_SIDEBAR_UTILITY_LINKS } from "./app-sidebar.config"

// Mock counts for each item key
const mockCounts: Record<string, number | undefined> = {
	conversations: 24,
	topics: 18,
	personas: 5,
	insights: 42,
	people: 156,
	organizations: 45,
	opportunities: 8,
}

// Transform the real sections to add counts
const mockSections = APP_SIDEBAR_SECTIONS.map((section) => ({
	key: section.key,
	title: section.title,
	items: section.items.map((item) => ({
		key: item.key,
		title: item.title,
		icon: item.icon,
		count: mockCounts[item.key],
	})),
}))

const mockUtilityLinks = APP_SIDEBAR_UTILITY_LINKS.map((item) => ({
	key: item.key,
	title: item.title,
	icon: item.icon,
}))

interface AppSidebarPreviewProps {
	sections?: typeof mockSections
	utilityLinks?: typeof mockUtilityLinks
	showAnalysis?: boolean
	showSalesSection?: boolean
	countsLoading?: boolean
	activeItemKey?: string
	backgroundColor?: string
}

function AppSidebarPreview({
	sections = mockSections,
	utilityLinks = mockUtilityLinks,
	showAnalysis = true,
	showSalesSection = false,
	countsLoading = false,
	activeItemKey = "overview",
	backgroundColor = "#ffffff",
}: AppSidebarPreviewProps) {
	const filteredSections = sections.filter((section) => {
		if (section.key === "analyze" && !showAnalysis) return false
		return true
	})

	const renderRightBadge = (count: number | undefined, isActive: boolean) => {
		if (typeof count === "number") {
			return (
				<Badge
					variant={isActive ? "secondary" : "outline"}
					className="ml-2 rounded-full px-2 py-0.5 text-[10px] leading-4 group-data-[collapsible=icon]:hidden"
				>
					{count}
				</Badge>
			)
		}

		if (countsLoading && count !== undefined) {
			return (
				<span className="ml-2 h-4 w-6 animate-pulse rounded-full bg-muted-foreground/20 group-data-[collapsible=icon]:hidden" />
			)
		}

		return null
	}

	return (
		<Sidebar collapsible="icon" variant="sidebar" style={backgroundColor ? { backgroundColor } : undefined}>
			{/* Header - Logo and toggle */}
			<SidebarHeader>
				<div className="flex items-center justify-between px-2 transition-all duration-200 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
					<div className="flex items-center gap-2 transition-all duration-200 group-data-[collapsible=icon]:gap-0">
						{/* Logo - fades out and collapses when collapsed */}
						<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground transition-all duration-200 group-data-[collapsible=icon]:h-0 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:overflow-hidden group-data-[collapsible=icon]:opacity-0">
							U
						</div>
						{/* Text - fades out and collapses when collapsed */}
						<span className="font-bold text-lg transition-all duration-200 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:overflow-hidden group-data-[collapsible=icon]:opacity-0">
							UpSight
						</span>
					</div>
					{/* Toggle button - always visible, moves to center when collapsed */}
					<SidebarTrigger className="transition-all duration-200" />
				</div>
			</SidebarHeader>

			{/* Content */}
			<SidebarContent className="group-data-[collapsible=icon]">
				{/* CTA Button */}
				<div className="group-data-[collapsible=icon] px-2 pt-2">
					<SidebarMenuButton asChild tooltip="Start">
						<a href="#" className="bg-primary text-primary-foreground hover:bg-primary/90">
							<Sparkles className="fill-current" />
							<span className="font-semibold group-data-[collapsible=icon]:sr-only">Start</span>
						</a>
					</SidebarMenuButton>
				</div>

				{filteredSections.map((section) => (
					<SidebarGroup key={section.key}>
						<SidebarGroupLabel className="group-data-[collapsible=icon]:sr-only">{section.title}</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{section.items.map((item) => {
									const isActive = activeItemKey === item.key

									return (
										<SidebarMenuItem key={item.key}>
											<SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
												<a href="#">
													<item.icon />
													<span className="group-data-[collapsible=icon]:sr-only">{item.title}</span>
													{renderRightBadge(item.count, isActive)}
												</a>
											</SidebarMenuButton>
										</SidebarMenuItem>
									)
								})}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				))}

				{showSalesSection && (
					<SidebarGroup>
						<SidebarGroupLabel className="group-data-[collapsible=icon]:sr-only">Sales</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarMenuButton asChild tooltip="BANT Lens">
										<a href="#">
											<DollarSign />
											<span className="group-data-[collapsible=icon]:sr-only">BANT Lens</span>
										</a>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				)}
			</SidebarContent>

			{/* Footer */}
			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton asChild tooltip="Invite Team">
							<button>
								<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
								</svg>
								<span className="group-data-[collapsible=icon]:sr-only">Invite Team</span>
							</button>
						</SidebarMenuButton>
					</SidebarMenuItem>

					{utilityLinks.map((item) => (
						<SidebarMenuItem key={item.key}>
							<SidebarMenuButton asChild tooltip={item.title}>
								<a href="#">
									<item.icon />
									<span className="group-data-[collapsible=icon]:sr-only">{item.title}</span>
								</a>
							</SidebarMenuButton>
						</SidebarMenuItem>
					))}
				</SidebarMenu>

				{/* User info */}
				<div className="flex items-center gap-2 border-t px-2 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
					<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-sm">
						JD
					</div>
					<div className="flex min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
						<span className="truncate font-medium text-sm">John Doe</span>
						<span className="truncate text-muted-foreground text-xs">john@example.com</span>
					</div>
				</div>
			</SidebarFooter>
		</Sidebar>
	)
}

const meta = {
	title: "Components/Navigation/AppSidebar",
	component: AppSidebarPreview,
	parameters: {
		layout: "fullscreen",
	},
	tags: ["autodocs"],
	argTypes: {
		backgroundColor: {
			control: "color",
			description: "Sidebar background color",
		},
	},
	decorators: [
		(Story) => (
			<SidebarProvider defaultOpen style={{ "--sidebar-width-icon": "3.5rem" } as React.CSSProperties}>
				<div className="flex min-h-screen w-full">
					<Story />
					<main className="ml-[var(--sidebar-width)] flex-1 overflow-auto transition-[margin] duration-200 ease-linear group-data-[collapsible=icon]:ml-[var(--sidebar-width-icon)]">
						<div className="p-8">
							<div className="max-w-4xl">
								<h1 className="mb-4 font-bold text-3xl">Production Sidebar UI Playground</h1>
								<p className="mb-6 text-muted-foreground">
									This is your production AppSidebar UI with all backend dependencies removed. Interact with the sidebar
									to explore different states.
								</p>
								<div className="space-y-4">
									<div className="rounded-lg border p-6">
										<h2 className="mb-2 font-semibold text-xl">Try these interactions:</h2>
										<ul className="list-inside list-disc space-y-2 text-muted-foreground">
											<li>Click the collapse/expand button in the sidebar rail</li>
											<li>Click on different navigation items to see active states</li>
											<li>Hover over items when collapsed to see tooltips</li>
											<li>Notice the count badges on navigation items</li>
											<li>Scroll through all the sections: Discovery, Analysis, CRM</li>
										</ul>
									</div>
									<div className="rounded-lg border bg-muted/30 p-6">
										<h3 className="mb-2 font-semibold">Mocked Data</h3>
										<ul className="space-y-1 text-muted-foreground text-sm">
											<li>• 24 Calls & Notes</li>
											<li>• 5 Personas</li>
											<li>• 18 Themes</li>
											<li>• 42 Findings</li>
											<li>• 156 People</li>
											<li>• 45 Organizations</li>
											<li>• 8 Opportunities</li>
										</ul>
									</div>
								</div>
							</div>
						</div>
					</main>
				</div>
			</SidebarProvider>
		),
	],
} satisfies Meta<typeof AppSidebarPreview>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		showAnalysis: false,
		showSalesSection: false,
		countsLoading: false,
		activeItemKey: "overview",
	},
}

export const InitiallyCollapsed: Story = {
	args: {
		showAnalysis: true,
		showSalesSection: false,
		countsLoading: false,
		activeItemKey: "overview",
	},
	decorators: [
		(Story) => (
			<SidebarProvider defaultOpen={false} style={{ "--sidebar-width-icon": "3.5rem" } as React.CSSProperties}>
				<div className="flex min-h-screen w-full">
					<Story />
					<main className="ml-[var(--sidebar-width)] flex-1 overflow-auto transition-[margin] duration-200 ease-linear group-data-[collapsible=icon]:ml-[var(--sidebar-width-icon)]">
						<div className="p-8">
							<div className="max-w-4xl">
								<h1 className="mb-4 font-bold text-3xl">Collapsed Sidebar</h1>
								<p className="mb-6 text-muted-foreground">
									This variant starts with the sidebar collapsed. Click the expand button to open it.
								</p>
							</div>
						</div>
					</main>
				</div>
			</SidebarProvider>
		),
	],
}
