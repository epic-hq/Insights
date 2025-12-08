/**
 * BottomTabBar - Mobile bottom navigation
 *
 * 6-tab bottom navigation with AI chat as central prominent element.
 * Tabs: Dashboard | People | Opportunities | AI (center) | Add | Profile
 * Includes safe area padding for notched devices.
 */

import { Briefcase, LayoutDashboard, Plus, Sparkles, User, Users } from "lucide-react"
import { NavLink, useLocation } from "react-router"
import { cn } from "~/lib/utils"

export interface BottomTabBarProps {
	/** Route helpers for navigation */
	routes: {
		dashboard: string
		people: string
		opportunities: string
		chat: string // Full page AI chat
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
		"flex flex-col items-center justify-center gap-1 min-h-[48px] min-w-[48px] flex-1",
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

export function BottomTabBar({
	routes,
	onProfileClick,
	className,
}: BottomTabBarProps) {
	const location = useLocation()

	// Check active states
	const isDashboardActive = location.pathname.includes("/dashboard") || location.pathname.endsWith(routes.dashboard.replace(/\/$/, ""))
	const isPeopleActive = location.pathname.includes("/people")
	const isOpportunitiesActive = location.pathname.includes("/opportunities")
	const isChatActive = location.pathname.includes("/assistant")

	return (
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

				{/* People */}
				<TabItem
					to={routes.people}
					icon={<Users className="h-5 w-5" />}
					label="People"
					isActive={isPeopleActive}
				/>

				{/* Opportunities */}
				<TabItem
					to={routes.opportunities}
					icon={<Briefcase className="h-5 w-5" />}
					label="Opps"
					isActive={isOpportunitiesActive}
				/>

				{/* AI Chat (Center - Full Page) */}
				<TabItem
					to={routes.chat}
					icon={<Sparkles className="h-6 w-6" />}
					label="AI"
					isCenter
					isActive={isChatActive}
				/>

				{/* Add - Links to full upload page */}
				<TabItem to={routes.upload} icon={<Plus className="h-5 w-5" />} label="Add" />

				{/* Profile - Opens sheet */}
				<TabItem
					onClick={onProfileClick}
					icon={<User className="h-5 w-5" />}
					label="Profile"
				/>
			</div>
		</nav>
	)
}

export default BottomTabBar
