/**
 * BottomTabBar - Mobile bottom navigation
 *
 * 6-tab bottom navigation with AI chat as central prominent element.
 * Tabs: Dashboard | People | Opportunities | AI (center) | Add | Profile
 * Includes safe area padding for notched devices.
 */

import { LayoutDashboard, Lightbulb, MessageSquare, Mic, Plus, User, Users } from "lucide-react"
import { NavLink, useLocation } from "react-router"
import { cn } from "~/lib/utils"

export interface BottomTabBarProps {
	/** Route helpers for navigation */
	routes: {
		dashboard: string
		contacts: string
		content: string
		chat: string // Full page AI chat
		insights: string
		upload: string
	}
	/** Callback when profile tab is clicked */
	onProfileClick?: () => void
	/** Additional CSS classes */
	className?: string
}

interface TabItemProps {
	to?: string
	icon: React.ReactNode
	label: string
	isActive?: boolean
	onClick?: () => void
	isCenter?: boolean
	hasNotification?: boolean
	isDisabled?: boolean
}

function TabItem({ to, icon, label, isActive, onClick, isCenter, hasNotification, isDisabled }: TabItemProps) {
	const baseClasses = cn(
		"flex min-h-[48px] min-w-[48px] flex-1 flex-col items-center justify-center gap-1",
		"text-muted-foreground transition-colors",
		isActive && "text-primary",
		!isCenter && "hover:text-foreground",
		isDisabled && "cursor-not-allowed opacity-50"
	)

	const content = (
		<>
			{isCenter ? (
				<div
					className={cn(
						"relative flex items-center justify-center",
						"-mt-5 h-14 w-14 rounded-full",
						"bg-primary text-primary-foreground shadow-lg",
						"transition-all hover:bg-primary/90 active:scale-95"
					)}
				>
					{icon}
					{hasNotification && (
						<span className="-top-1 -right-1 absolute h-3 w-3 rounded-full border-2 border-background bg-destructive" />
					)}
				</div>
			) : (
				<div className="relative">{icon}</div>
			)}
			<span className={cn("font-medium text-[10px]", isCenter && "mt-1")}>{label}</span>
		</>
	)

	if (onClick) {
		return (
			<button type="button" className={baseClasses} onClick={onClick}>
				{content}
			</button>
		)
	}

	if (to) {
		return (
			<NavLink to={to} className={({ isActive: navActive }) => cn(baseClasses, navActive && "text-primary")}>
				{content}
			</NavLink>
		)
	}

	return <div className={baseClasses}>{content}</div>
}

export function BottomTabBar({ routes, onProfileClick, className }: BottomTabBarProps) {
	const location = useLocation()

	// Check active states
	const isDashboardActive =
		location.pathname.includes("/dashboard") || location.pathname.endsWith(routes.dashboard.replace(/\/$/, ""))
	const isContactsActive = location.pathname.includes("/people")
	const isContentActive = location.pathname.includes("/interviews")
	const isChatActive = location.pathname.includes("/assistant")
	const isInsightsActive = location.pathname.includes("/insights")
	const isUploadActive = location.pathname.includes("/interviews/upload")

	return (
		<>
			{/* Floating Action Button (Upload) */}
			{!isUploadActive && (
				<NavLink
					to={routes.upload}
					aria-label="Add"
					className={cn(
						"fixed right-4 z-[60]",
						"bottom-[calc(env(safe-area-inset-bottom)+84px)]",
						"inline-flex h-12 w-12 items-center justify-center rounded-full",
						"bg-primary text-primary-foreground shadow-lg",
						"transition-all hover:bg-primary/90 active:scale-95"
					)}
				>
					<Plus className="h-6 w-6" />
				</NavLink>
			)}

			<nav
				className={cn(
					"fixed right-0 bottom-0 left-0 z-50",
					"border-border border-t bg-background/95 backdrop-blur-md",
					"pb-[env(safe-area-inset-bottom)]",
					className
				)}
			>
				<div className="flex items-end justify-around px-2 py-1">
					{/* Dashboard */}
					<TabItem
						to={routes.dashboard}
						icon={<LayoutDashboard className="h-5 w-5" />}
						label="Home"
						isActive={isDashboardActive}
					/>

					{/* Contacts (People) */}
					<TabItem
						to={routes.contacts}
						icon={<Users className="h-5 w-5" />}
						label="Contacts"
						isActive={isContactsActive}
					/>

					{/* Content (Interviews) */}
					<TabItem to={routes.content} icon={<Mic className="h-5 w-5" />} label="Content" isActive={isContentActive} />

					{/* AI Chat (Full Page) */}
					<TabItem to={routes.chat} icon={<MessageSquare className="h-5 w-5" />} label="AI" isActive={isChatActive} />

					{/* Insights (Cards) */}
					<TabItem
						to={routes.insights}
						icon={<Lightbulb className="h-5 w-5" />}
						label="Insights"
						isActive={isInsightsActive}
					/>

					{/* Profile - Opens sheet */}
					<TabItem onClick={onProfileClick} icon={<User className="h-5 w-5" />} label="Profile" />
				</div>
			</nav>
		</>
	)
}

export default BottomTabBar
