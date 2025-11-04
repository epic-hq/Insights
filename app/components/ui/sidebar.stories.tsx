import type { Meta, StoryObj } from '@storybook/react';
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuItem,
	SidebarMenuButton,
	SidebarProvider,
	SidebarTrigger,
} from './sidebar';

// Flexible demo component with lots of props to play with
const SidebarDemo = ({
	defaultOpen = true,
	showHeader = true,
	showFooter = true,
	headerText = "My App",
	menuItems = ["Dashboard", "Projects", "Settings"],
	groupLabel = "Navigation",
}: {
	defaultOpen?: boolean;
	showHeader?: boolean;
	showFooter?: boolean;
	headerText?: string;
	menuItems?: string[];
	groupLabel?: string;
}) => (
	<SidebarProvider defaultOpen={defaultOpen}>
		<div className="flex h-screen w-full">
			<Sidebar collapsible={'icon'}>
				{showHeader && (
					<SidebarHeader>
						<h2 className="px-4 py-2 text-lg font-semibold">{headerText}</h2>
					</SidebarHeader>
				)}
				<SidebarContent>
					<SidebarGroup>
						<SidebarGroupLabel>{groupLabel}</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{menuItems.map((item, index) => (
									<SidebarMenuItem key={index}>
										<SidebarMenuButton>{item}</SidebarMenuButton>
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>
				{showFooter && (
					<SidebarFooter>
						<p className="px-4 py-2 text-sm text-gray-500">Footer content</p>
					</SidebarFooter>
				)}
			</Sidebar>

			{/* Main content area so you can see the sidebar in context */}
			<SidebarInset className="p-8">
				<SidebarTrigger />
				<h1 className="text-2xl font-bold mt-4">Main Content Area</h1>
				<p className="mt-2">Use the trigger to toggle the sidebar</p>
			</SidebarInset>
		</div>
	</SidebarProvider>
);

const meta: Meta<typeof SidebarDemo> = {
	title: 'Components/Sidebar',
	component: SidebarDemo,
	parameters: {
		layout: 'fullscreen',
	},
	// This creates the interactive controls panel!
	argTypes: {
		defaultOpen: {
			control: 'boolean',
			description: 'Whether the sidebar starts open or collapsed',
		},
		showHeader: {
			control: 'boolean',
			description: 'Show/hide the header section',
		},
		showFooter: {
			control: 'boolean',
			description: 'Show/hide the footer section',
		},
		headerText: {
			control: 'text',
			description: 'Text to display in the header',
		},
		groupLabel: {
			control: 'text',
			description: 'Label for the menu group',
		},
		menuItems: {
			control: 'object',
			description: 'Array of menu item labels',
		},
	},
};

export default meta;
type Story = StoryObj<typeof SidebarDemo>;

// Default - you can tweak ALL these in the Controls panel!
export const Default: Story = {
	args: {
		defaultOpen: true,
		showHeader: true,
		showFooter: true,
		headerText: "My App",
		menuItems: ["Dashboard", "Projects", "Settings", "Team"],
		groupLabel: "Navigation",
	},
};

// Pre-configured variants
export const Collapsed: Story = {
	args: {
		defaultOpen: false,
		showHeader: true,
		showFooter: true,
		headerText: "My App",
		menuItems: ["Dashboard", "Projects", "Settings"],
		groupLabel: "Navigation",
	},
};

export const Minimal: Story = {
	args: {
		defaultOpen: true,
		showHeader: false,
		showFooter: false,
		menuItems: ["Home", "About", "Contact"],
		groupLabel: "Menu",
	},
};

export const ManyItems: Story = {
	args: {
		defaultOpen: true,
		showHeader: true,
		showFooter: true,
		headerText: "Dashboard",
		menuItems: [
			"Overview",
			"Analytics",
			"Reports",
			"Users",
			"Settings",
			"Billing",
			"API Keys",
			"Integrations",
			"Support",
		],
		groupLabel: "Main Menu",
	},
};