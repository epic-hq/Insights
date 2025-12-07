/**
 * BottomTabBar - Mobile bottom navigation
 *
 * 5-tab bottom navigation with AI chat as central prominent element.
 * Includes safe area padding for notched devices.
 */

import { Home, MessageSquare, MoreHorizontal, Plus, Sparkles } from "lucide-react"
import { NavLink, useLocation } from "react-router"
import { cn } from "~/lib/utils"

export interface BottomTabBarProps {
	/** Route helpers for navigation */
	routes: {
		home: string
		recordings: string
		upload: string
		more: string
	}
	/** Callback when AI chat tab is clicked */
	onChatClick?: () => void
	/** Whether chat has new suggestions to show */
	hasChatNotification?: boolean
	/** Whether chat is available (has project context) */
	isChatAvailable?: boolean
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

function TabItem({
	to,
	icon,
	label,
	isActive,
	onClick,
	isCenter,
	hasNotification,
	isDisabled,
}: TabItemProps) {
	const baseClasses = cn(
		"flex flex-col items-center justify-center gap-1 min-h-[48px] min-w-[64px] flex-1",
		"text-muted-foreground transition-colors",
		isActive && "text-primary",
		!isCenter && "hover:text-foreground",
		isDisabled && "opacity-50 cursor-not-allowed"
	)

	const content = (
		<>
			{isCenter ? (
				<div
					className={cn(
						"relative flex items-center justify-center",
						"w-14 h-14 -mt-5 rounded-full",
						"bg-primary text-primary-foreground shadow-lg",
						"hover:bg-primary/90 active:scale-95 transition-all"
					)}
				>
					{icon}
					{hasNotification && (
						<span className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full border-2 border-background" />
					)}
				</div>
			) : (
				<div className="relative">
					{icon}
				</div>
			)}
			<span className={cn("text-[10px] font-medium", isCenter && "mt-1")}>
				{label}
			</span>
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
			<NavLink
				to={to}
				className={({ isActive: navActive }) =>
					cn(baseClasses, navActive && "text-primary")
				}
			>
				{content}
			</NavLink>
		)
	}

	return <div className={baseClasses}>{content}</div>
}

export function BottomTabBar({
	routes,
	onChatClick,
	hasChatNotification,
	isChatAvailable = true,
	className,
}: BottomTabBarProps) {
	const location = useLocation()

	// Check if current path matches recordings section
	const isRecordingsActive = location.pathname.includes("/interviews")

	return (
		<nav
			className={cn(
				"fixed bottom-0 left-0 right-0 z-50",
				"bg-background/95 backdrop-blur-md border-t border-border",
				"pb-[env(safe-area-inset-bottom)]",
				className
			)}
		>
			<div className="flex items-end justify-around px-2 py-1">
				{/* Home */}
				<TabItem
					to={routes.home}
					icon={<Home className="h-5 w-5" />}
					label="Home"
				/>

				{/* Recordings (Conversations) */}
				<TabItem
					to={routes.recordings}
					icon={<MessageSquare className="h-5 w-5" />}
					label="Recordings"
					isActive={isRecordingsActive}
				/>

				{/* AI Chat (Center - Prominent) */}
				<TabItem
					onClick={isChatAvailable ? onChatClick : undefined}
					icon={<Sparkles className="h-6 w-6" />}
					label="AI"
					isCenter
					hasNotification={hasChatNotification}
					isDisabled={!isChatAvailable}
				/>

				{/* Add - Links to full upload page */}
				<TabItem
					to={routes.upload}
					icon={<Plus className="h-5 w-5" />}
					label="Add"
				/>

				{/* More */}
				<TabItem
					to={routes.more}
					icon={<MoreHorizontal className="h-5 w-5" />}
					label="More"
				/>
			</div>
		</nav>
	)
}

export default BottomTabBar
